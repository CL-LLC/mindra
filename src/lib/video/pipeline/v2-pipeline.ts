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
import { buildNarrationTracks as buildSceneNarrationTracks } from '../narration-tracks';
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

/** Build narration tracks in scene order, preferring recorded audio per scene. */
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
    ttsModel: process.env.MINDRA_TTS_MODEL || 'tts-1',
    ttsVoice: process.env.MINDRA_TTS_VOICE || 'alloy',
    pythonCommand: PYTHON,
    shellQuote,
    fallbackRenderer: async () => {},
  });

  return (await buildSceneNarrationTracks(shots, {
    getDurationSec: (shot) => shot.durationSec,
    resolveAudio: async (shot, shotIndex) => {
      const text = shot.affirmation.trim();
      if (!text) return undefined;

      console.log(`[mindra] audio-map shot=${shotIndex} text="${text.slice(0, 48)}" recorded=${!!shot.narrationAudioDataUrl}`);

      // Try recorded audio first
      if (shot.narrationAudioDataUrl) {
        const prefix = 'base64,';
        const base64Index = shot.narrationAudioDataUrl.indexOf(prefix);
        if (shot.narrationAudioDataUrl.startsWith('data:') && base64Index !== -1) {
          const meta = shot.narrationAudioDataUrl.slice(5, base64Index - 1);
          const payload = shot.narrationAudioDataUrl.slice(base64Index + prefix.length);
          if (payload.length > 0) {
            const ext = meta.includes('webm') ? 'webm' : meta.includes('wav') ? 'wav' : meta.includes('ogg') ? 'ogg' : 'mp3';
            const audioPath = path.join(tempDir, `narration-v2-${shotIndex}.${ext}`);
            await fs.writeFile(audioPath, Buffer.from(payload, 'base64'));
            try {
              const { stdout } = await execAsync(
                `ffprobe -v quiet -show_entries format=duration -of csv=p=0 ${shellQuote(audioPath)}`,
              );
              const clipDuration = parseFloat(stdout.trim()) || 0;
              console.log(`[mindra] audio recorded shot=${shotIndex} duration=${clipDuration.toFixed(2)}s`);
              return { path: audioPath, sourceType: 'recorded', clipDuration };
            } catch {
              console.log(`[mindra] audio recorded shot=${shotIndex} duration=unknown`);
              return { path: audioPath, sourceType: 'recorded', clipDuration: 0 };
            }
          }
        }
      }

      // TTS fallback
      if (!generators.audioGenerator) return undefined;

      console.warn(`[mindra] audio tts shot=${shotIndex} affirmation="${text.slice(0, 48)}"`);
      try {
        const audioPath = await generators.audioGenerator.synthesize(tempDir, shotIndex, text);
        const { stdout } = await execAsync(
          `ffprobe -v quiet -show_entries format=duration -of csv=p=0 ${shellQuote(audioPath)}`,
        );
        const clipDuration = parseFloat(stdout.trim()) || 0;
        return { path: audioPath, sourceType: 'tts', clipDuration };
      } catch {
        return undefined;
      }
    },
  })) ?? [];
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
