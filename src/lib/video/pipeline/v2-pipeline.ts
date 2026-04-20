/**
 * V2 Pipeline — uses the new stage-based architecture (Planner → Keyframe → Animate → Assemble).
 *
 * This pipeline delegates to the v2/ stage interfaces with V1 adapters,
 * producing output identical to V1 but through the new abstraction layer.
 * Future provider swaps (e.g., Flux images, cloud animation) plug in here.
 */

import type { RenderScene, RenderOptions } from '../render-executor';
import type { RenderPipeline, PipelineResult } from './types';
import {
  V1Planner,
  V1KeyframeGenerator,
  V1SceneAnimator,
  V1Assembler,
  runV2Pipeline,
  type V2PipelineDeps,
  type NarrationTrackV2,
} from '../v2';
import { createVideoGenerators } from '../generators';
import { getMusicAsset, resolveMusicAssetPath } from '../music-registry';
import {
  getKaleidoscopeConfig,
  resolveKaleidoscopeAssetPath,
  type KaleidoscopeConfig,
} from '../kaleidoscope-registry';
import { DEFAULT_OPTIONS, shellQuote, resolveBackgroundImage } from '../render-executor';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execCb);

const PYTHON = process.env.PYTHON || 'python3';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMAGE_PROVIDER = (process.env.MINDRA_IMAGE_PROVIDER || 'openai') as 'openai' | 'qwen' | 'flux';
const OPENAI_IMAGE_MODEL = process.env.MINDRA_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || (IMAGE_PROVIDER === 'qwen' ? 'Qwen-Image' : IMAGE_PROVIDER === 'flux' ? 'FLUX.2 klein' : 'gpt-image-1');
const IMAGE_BACKEND = (process.env.MINDRA_IMAGE_BACKEND || 'openai') as 'openai' | 'local';

/** Generate a synthetic fallback music track via ffmpeg (V1 parity). */
async function ensureFallbackMusicAsset(
  tempDir: string,
  musicAsset: { trackId: string; volume: number; fadeIn: number; fadeOut: number },
  sceneCount: number,
): Promise<string | undefined> {
  const fallbackPath = path.join(tempDir, `${musicAsset.trackId || 'mindra-fallback'}-${sceneCount}.wav`);
  try {
    const duration = Math.max(8, sceneCount * 10);
    const cmd = [
      'ffmpeg -y',
      `-f lavfi -i ${shellQuote(`sine=frequency=220:duration=${duration}`)}`,
      `-f lavfi -i ${shellQuote(`sine=frequency=330:duration=${duration}`)}`,
      `-filter_complex ${shellQuote(`[0:a]volume=0.22[a0];[1:a]volume=0.12[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2[aout]`)}`,
      '-map [aout]',
      '-c:a pcm_s16le',
      shellQuote(fallbackPath),
    ].join(' ');
    await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    return fallbackPath;
  } catch (error) {
    console.warn('Fallback music generation failed.', error);
    return undefined;
  }
}

// Lazy-init generators (mirrors render-context.ts pattern)
let _openai: OpenAI | null | undefined;
function getOpenAIClient(): OpenAI | null {
  if (_openai === undefined) {
    _openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
  }
  return _openai;
}

/**
 * Build narration tracks using V1-equivalent pair-cycling strategy.
 * Selects 2 affirmations via selectAffirmationPair, resolves audio for each,
 * then cycles A in the first half and B in the second half with 8s/2s timing.
 */
async function buildNarrationTracks(
  shots: {
    affirmation: string;
    narrationAudioDataUrl?: string;
    narrationMimeType?: string;
    narrationDurationMs?: number;
    durationSec: number;
  }[],
  tempDir: string,
  introDurationSec?: number,
  outroDurationSec?: number,
): Promise<NarrationTrackV2[]> {
  const generators = createVideoGenerators({
    openaiClient: getOpenAIClient(),
    imageBackend: IMAGE_BACKEND,
    imageProvider: IMAGE_PROVIDER,
    imageModel: OPENAI_IMAGE_MODEL,
    ttsModel: process.env.MINDRA_TTS_MODEL || 'tts-1',
    ttsVoice: process.env.MINDRA_TTS_VOICE || 'alloy',
    pythonCommand: PYTHON,
    shellQuote,
    fallbackRenderer: async () => {},
  });

  // --- V1 parity: pair-cycling narration ---
  const affirmations = [...new Set(shots.map((s) => s.affirmation.trim()).filter(Boolean))];
  if (affirmations.length === 0) return [];

  const totalDuration = shots.reduce((sum, s) => sum + s.durationSec, 0);
  if (totalDuration <= 0) return [];

  const { selectAffirmationPair } = await import('../pair-playback');
  const { pair } = selectAffirmationPair(affirmations);
  const [affirmationA, affirmationB] = pair;

  const DISPLAY_DURATION = 8;
  const GAP_DURATION = 2;
  const CYCLE_DURATION = DISPLAY_DURATION + GAP_DURATION;
  const midpoint = totalDuration / 2;

  // Build a map from affirmation text to shot data for audio resolution
  const affirmationToShot = new Map<string, typeof shots[0] & { index: number }>();
  for (let i = 0; i < shots.length; i++) {
    const text = shots[i].affirmation.trim();
    if (text && !affirmationToShot.has(text)) {
      affirmationToShot.set(text, { ...shots[i], index: i });
      console.log(`[mindra] audio-map shot=${i} text="${text.slice(0, 48)}" recorded=${!!shots[i].narrationAudioDataUrl}`);
    }
  }

  // Resolve audio for both pair members
  const resolveAudio = async (affirmation: string, label: string): Promise<{
    audioPath: string;
    sourceType: 'recorded' | 'tts';
    clipDuration: number;
  } | undefined> => {
    let shot = affirmationToShot.get(affirmation);
    if (!shot) {
      const normalized = affirmation.trim().toLowerCase();
      for (const [key, value] of affirmationToShot.entries()) {
        if (key.toLowerCase() === normalized) {
          shot = value;
          console.log(`[mindra] audio-match label=${label} exact-miss using-casefold shot=${value.index}`);
          break;
        }
      }
    }
    if (!shot) {
      console.warn(`[mindra] audio-miss label=${label} affirmation="${affirmation.slice(0, 48)}"`);
      return undefined;
    }

    // Try recorded audio first
    if (shot.narrationAudioDataUrl) {
      const mimeMatch = shot.narrationAudioDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (mimeMatch) {
        const ext = mimeMatch[1].includes('webm') ? 'webm' : 'mp3';
        const audioPath = path.join(tempDir, `narration-v2-${label}-${shot.index}.${ext}`);
        await fs.writeFile(audioPath, Buffer.from(mimeMatch[2], 'base64'));
        try {
          const { stdout } = await execAsync(
            `ffprobe -v quiet -show_entries format=duration -of csv=p=0 ${shellQuote(audioPath)}`,
          );
          const clipDuration = parseFloat(stdout.trim()) || 0;
          console.log(`[mindra] audio recorded label=${label} shot=${shot.index} duration=${clipDuration.toFixed(2)}s`);
          return { audioPath, sourceType: 'recorded', clipDuration };
        } catch {
          console.log(`[mindra] audio recorded label=${label} shot=${shot.index} duration=unknown`);
          return { audioPath, sourceType: 'recorded', clipDuration: 0 };
        }
      }
    }

    // TTS fallback
    console.warn(`[mindra] audio tts label=${label} shot=${shot.index} affirmation="${affirmation.slice(0, 48)}"`);
    if (generators.audioGenerator) {
      try {
        const audioPath = await generators.audioGenerator.synthesize(tempDir, shot.index, affirmation);
        const { stdout } = await execAsync(
          `ffprobe -v quiet -show_entries format=duration -of csv=p=0 ${shellQuote(audioPath)}`,
        );
        const clipDuration = parseFloat(stdout.trim()) || 0;
        return { audioPath, sourceType: 'tts', clipDuration };
      } catch {
        return undefined;
      }
    }

    return undefined;
  };

  const audioA = await resolveAudio(affirmationA, 'A');
  const audioB = affirmationB !== affirmationA
    ? await resolveAudio(affirmationB, 'B')
    : audioA
      ? { ...audioA, clipDuration: audioA.clipDuration }
      : undefined;

  const tracks: NarrationTrackV2[] = [];

  // First half: cycle affirmation A
  if (audioA && audioA.clipDuration > 0) {
    let currentTime = 0;
    while (currentTime + DISPLAY_DURATION <= midpoint) {
      tracks.push({
        path: audioA.audioPath,
        start: currentTime,
        duration: DISPLAY_DURATION,
        clipDuration: audioA.clipDuration,
        repeat: false,
        sourceType: audioA.sourceType,
      });
      currentTime += CYCLE_DURATION;
    }
  }

  // Second half: cycle affirmation B
  if (audioB && audioB.clipDuration > 0) {
    let currentTime = midpoint;
    while (currentTime + DISPLAY_DURATION <= totalDuration) {
      tracks.push({
        path: audioB.audioPath,
        start: currentTime,
        duration: DISPLAY_DURATION,
        clipDuration: audioB.clipDuration,
        repeat: false,
        sourceType: audioB.sourceType,
      });
      currentTime += CYCLE_DURATION;
    }
  }

  return tracks;
}

// --- Kaleidoscope intro/outro clip generation (V1 parity) ---

async function ensureKaleidoscopeClip(params: {
  type: 'intro' | 'outro';
  config: KaleidoscopeConfig;
  tempDir: string;
  width: number;
  height: number;
  fps: number;
  quality: 'low' | 'medium' | 'high';
}): Promise<string | undefined> {
  const { type, config, tempDir, width, height, fps, quality } = params;
  const asset = type === 'intro' ? config.intro : config.outro;
  const duration = type === 'intro' ? config.introDuration : config.outroDuration;

  // Try to use stock asset first
  const stockPath = await resolveKaleidoscopeAssetPath(asset);
  if (stockPath) {
    console.log(`Using stock kaleidoscope ${type}: ${stockPath}`);
    const outputClip = path.join(tempDir, `kaleidoscope-${type}.mp4`);
    const cmd = [
      'ffmpeg -y',
      `-i ${shellQuote(stockPath)}`,
      `-t ${duration}`,
      `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      `-r ${fps}`,
      `-c:v libx264 -preset ${quality === 'high' ? 'slow' : quality === 'low' ? 'ultrafast' : 'medium'}`,
      '-an',
      '-pix_fmt yuv420p',
      shellQuote(outputClip),
    ].join(' ');
    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
    return outputClip;
  }

  // Fallback: generate synthetic kaleidoscope-style video
  console.log(`Generating synthetic kaleidoscope ${type} (${duration}s)...`);
  return generateSyntheticKaleidoscopeClip({ type, duration, tempDir, width, height, fps, quality });
}

async function generateSyntheticKaleidoscopeClip(params: {
  type: 'intro' | 'outro';
  duration: number;
  tempDir: string;
  width: number;
  height: number;
  fps: number;
  quality: 'low' | 'medium' | 'high';
}): Promise<string> {
  const { type, duration, tempDir, width, height, fps, quality } = params;
  const outputClip = path.join(tempDir, `kaleidoscope-${type}.mp4`);

  const kaleidoscopeFilter = `geq=r='128+100*sin(N/180+X/40+Y/40)+50*cos(N/120-X/30)':g='128+100*cos(N/150+X/35+Y/45)+50*sin(N/210-Y/35)':b='128+80*sin(N/240+X/50-Y/30)+40*cos(N/180+X/45+Y/35)'`;

  const cmd = [
    'ffmpeg -y',
    `-f lavfi -i color=c=0x1e1b4b:s=${width}x${height}:d=${duration}:r=${fps}`,
    `-vf "${kaleidoscopeFilter}"`,
    `-t ${duration}`,
    `-c:v libx264 -preset ${quality === 'high' ? 'slow' : quality === 'low' ? 'ultrafast' : 'medium'}`,
    '-an',
    '-pix_fmt yuv420p',
    shellQuote(outputClip),
  ].join(' ');

  console.log(`Generating synthetic kaleidoscope ${type}...`);
  await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
  return outputClip;
}

export class V2Pipeline implements RenderPipeline {
  readonly version = 2;

  async render(scenes: RenderScene[], options?: RenderOptions): Promise<PipelineResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const generators = createVideoGenerators({
      openaiClient: getOpenAIClient(),
      imageBackend: IMAGE_BACKEND,
      imageModel: OPENAI_IMAGE_MODEL,
      ttsModel: process.env.MINDRA_TTS_MODEL || 'tts-1',
      ttsVoice: process.env.MINDRA_TTS_VOICE || 'alloy',
      pythonCommand: PYTHON,
      shellQuote,
      fallbackRenderer: async () => {},
    });

    const planner = new V1Planner();
    const keyframeGenerator = new V1KeyframeGenerator(
      generators.imageGenerator, opts.width, opts.height,
      resolveBackgroundImage,
    );
    const sceneAnimator = new V1SceneAnimator(generators.sceneRenderer, shellQuote);
    const assembler = new V1Assembler(generators.videoComposer, shellQuote);

    // Resolve music (mirrors V1 render-context two-stage resolution + fallback)
    const musicAssetConfig = getMusicAsset(opts.musicTrack, scenes.length);
    const resolvedMusicPath = (await resolveMusicAssetPath(musicAssetConfig)) || undefined;

    // Stage 2: generate fallback music if no resolved asset (V1 parity)
    let finalMusicPath: string | undefined = resolvedMusicPath;
    if (!finalMusicPath) {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-v2-music-'));
      try {
        finalMusicPath = await ensureFallbackMusicAsset(tempDir, musicAssetConfig, scenes.length);
      } finally {
        // Fallback writes into tempDir; the pipeline will clean up its own temp later.
        // If generation failed, clean up the music temp dir.
        if (!finalMusicPath) {
          try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
        }
      }
    }

    // Resolve kaleidoscope intro/outro clips (V1 parity)
    const kaleidoscopeConfig = getKaleidoscopeConfig(opts.kaleidoscope);
    const kTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-v2-kal-'));
    let introPath: string | undefined;
    let outroPath: string | undefined;
    let introDurationSec: number | undefined;
    let outroDurationSec: number | undefined;

    try {
      if (kaleidoscopeConfig.enabled) {
        const quality = opts.quality ?? 'medium';
        introPath = await ensureKaleidoscopeClip({
          type: 'intro',
          config: kaleidoscopeConfig,
          tempDir: kTempDir,
          width: opts.width,
          height: opts.height,
          fps: opts.fps,
          quality,
        });
        introDurationSec = introPath ? kaleidoscopeConfig.introDuration : undefined;
        outroPath = await ensureKaleidoscopeClip({
          type: 'outro',
          config: kaleidoscopeConfig,
          tempDir: kTempDir,
          width: opts.width,
          height: opts.height,
          fps: opts.fps,
          quality,
        });
        outroDurationSec = outroPath ? kaleidoscopeConfig.outroDuration : undefined;
      }
    } catch (err) {
      console.warn('Kaleidoscope clip generation failed, continuing without intro/outro.', err);
    }

    // Run the staged pipeline
    let videoBuffer: Buffer;
    try {
      videoBuffer = await runV2Pipeline(
        scenes,
        opts,
        {
          planner,
          keyframeGenerator,
          sceneAnimator,
          assembler,
          buildNarrationTracks,
          musicAsset: {
            volume: musicAssetConfig.volume,
            fadeIn: musicAssetConfig.fadeIn,
            fadeOut: musicAssetConfig.fadeOut,
            trackId: musicAssetConfig.trackId,
          },
          musicPath: finalMusicPath ?? '',
          introPath,
          outroPath,
          introDurationSec,
          outroDurationSec,
        },
      );
    } finally {
      // Always cleanup kaleidoscope temp dir (lifecycle-safe)
      try { await fs.rm(kTempDir, { recursive: true, force: true }); } catch {}
    }

    return {
      videoBuffer,
      meta: {
        version: 2,
        sceneCount: scenes.length,
      },
    };
  }
}
