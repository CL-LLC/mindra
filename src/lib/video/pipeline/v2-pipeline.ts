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
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

// Lazy-init generators (mirrors render-context.ts pattern)
let _openai: OpenAI | null | undefined;
function getOpenAIClient(): OpenAI | null {
  if (_openai === undefined) {
    _openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
  }
  return _openai;
}

/**
 * Build narration tracks from scenes using existing TTS / data-url logic.
 * Extracted from render-executor's buildSceneNarrationTracks pattern.
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
): Promise<NarrationTrackV2[]> {
  const generators = createVideoGenerators({
    openaiClient: getOpenAIClient(),
    imageModel: OPENAI_IMAGE_MODEL,
    ttsModel: process.env.MINDRA_TTS_MODEL || 'tts-1',
    ttsVoice: process.env.MINDRA_TTS_VOICE || 'alloy',
    pythonCommand: PYTHON,
    shellQuote,
    fallbackRenderer: async () => {},
  });

  const tracks: NarrationTrackV2[] = [];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const hasRecordedAudio = !!shot.narrationAudioDataUrl;

    if (hasRecordedAudio) {
      // Decode data-url to file (mirrors V1 logic)
      const mimeMatch = shot.narrationAudioDataUrl!.match(/^data:([^;]+);base64,(.+)$/);
      if (!mimeMatch) continue;

      const ext = mimeMatch[1].includes('webm') ? 'webm' : 'mp3';
      const audioPath = path.join(tempDir, `narration-v2-${i}.${ext}`);
      await fs.writeFile(audioPath, Buffer.from(mimeMatch[2], 'base64'));

      const durationSec = (shot.narrationDurationMs ?? shot.durationSec * 1000) / 1000;
      tracks.push({
        path: audioPath,
        start: 0,
        duration: durationSec,
        clipDuration: shot.durationSec,
        repeat: durationSec < shot.durationSec,
        sourceType: 'recorded',
      });
    } else if (generators.audioGenerator) {
      // TTS fallback
      try {
        const audioPath = await generators.audioGenerator.synthesize(
          tempDir, i, shot.affirmation,
        );
        // Get audio duration
        const { stdout } = await execAsync(
          `ffprobe -v quiet -show_entries format=duration -of csv=p=0 ${shellQuote(audioPath)}`,
        );
        const durationSec = parseFloat(stdout.trim()) || shot.durationSec;

        tracks.push({
          path: audioPath,
          start: 0,
          duration: durationSec,
          clipDuration: shot.durationSec,
          repeat: durationSec < shot.durationSec,
          sourceType: 'tts',
        });
      } catch {
        // TTS failure is non-fatal
      }
    }
  }

  return tracks;
}

export class V2Pipeline implements RenderPipeline {
  readonly version = 2;

  async render(scenes: RenderScene[], options?: RenderOptions): Promise<PipelineResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const generators = createVideoGenerators({
      openaiClient: getOpenAIClient(),
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

    // Resolve music (mirrors V1 render-context logic)
    const musicAssetConfig = getMusicAsset(opts.musicTrack, scenes.length);
    const resolvedMusicPath = (await resolveMusicAssetPath(musicAssetConfig)) ?? '';

    // Run the staged pipeline
    const videoBuffer = await runV2Pipeline(
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
        musicPath: resolvedMusicPath,
      },
    );

    return {
      videoBuffer,
      meta: {
        version: 2,
        sceneCount: scenes.length,
      },
    };
  }
}
