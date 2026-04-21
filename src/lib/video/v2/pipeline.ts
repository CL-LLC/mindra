/**
 * V2 Pipeline — Orchestrates Planner → KeyframeGen → SceneAnimator → Assembler.
 *
 * This is the new entry point. render-executor.ts (or a thin render-v2.ts wrapper)
 * calls `runV2Pipeline()` when the router selects 'v2'.
 *
 * The pipeline is a straight sequential loop: each shot goes through keyframe gen →
 * animation, then all clips are assembled at the end.
 */
import type {
  Planner,
  KeyframeGenerator,
  SceneAnimator,
  Assembler,
  RenderSceneV2,
  RenderOptionsV2,
  NarrationTrackV2,
  MusicAssetConfig,
} from './types';

export interface V2PipelineDeps {
  planner: Planner;
  keyframeGenerator: KeyframeGenerator;
  sceneAnimator: SceneAnimator;
  assembler: Assembler;
  /** Build narration tracks for all shots (delegates to existing TTS/data-url logic) */
  buildNarrationTracks: (
    shots: { affirmation: string; narrationAudioDataUrl?: string; narrationMimeType?: string; narrationDurationMs?: number; durationSec: number }[],
    tempDir: string,
    introDurationSec?: number,
    outroDurationSec?: number,
  ) => Promise<NarrationTrackV2[]>;
  /** Resolved music asset config and local file path */
  musicAsset?: MusicAssetConfig;
  musicPath?: string;
  /** Kaleidoscope intro/outro clip paths (resolved by caller) */
  introPath?: string;
  outroPath?: string;
  /** Kaleidoscope intro/outro durations in seconds (for total-duration accounting, V1 parity) */
  introDurationSec?: number;
  outroDurationSec?: number;
}

export async function runV2Pipeline(
  scenes: RenderSceneV2[],
  options: RenderOptionsV2,
  deps: V2PipelineDeps,
): Promise<Buffer> {
  // 1. Plan
  const plan = await deps.planner.plan(scenes, options);

  const { mkdtemp } = await import('fs/promises');
  const { join } = await import('path');
  const { tmpdir } = await import('os');
  const tempDir = await mkdtemp(join(tmpdir(), 'mindra-v2-'));

  // 2. Keyframe gen + animation per shot
  const animateResults = [];
  for (let i = 0; i < plan.shots.length; i++) {
    const shot = plan.shots[i];
    const keyframe = await deps.keyframeGenerator.generate(shot, tempDir, i);
    const clip = await deps.sceneAnimator.animate({
      keyframe,
      shot,
      tempDir,
      index: i,
      fps: plan.globalOptions.fps,
    });
    animateResults.push(clip);
  }

  // 3. Compute durations first (needed for narration track timing)
  const introDurationSec = deps.introPath ? (deps.introDurationSec ?? 0) : 0;
  const outroDurationSec = deps.outroPath ? (deps.outroDurationSec ?? 0) : 0;
  const mainDurationSec = animateResults.reduce((sum, c) => sum + c.durationSec, 0);
  const totalDurationSec = introDurationSec + mainDurationSec + outroDurationSec;

  // 4. Narration tracks (receives intro/outro durations for accurate timing)
  const narrationTracks = await deps.buildNarrationTracks(
    plan.shots.map((s, i) => ({
      affirmation: s.affirmation,
      narrationAudioDataUrl: scenes[i]?.narrationAudioDataUrl,
      narrationMimeType: scenes[i]?.narrationMimeType,
      narrationDurationMs: scenes[i]?.narrationDurationMs,
      durationSec: s.durationSec,
    })),
    tempDir,
    introDurationSec,
    outroDurationSec,
  );

  // 5. Assemble
  // NOTE: intro/outro and music path resolution is the caller's responsibility
  // in the integration layer. For now the assembler receives them as optional params.
  let buffer: Buffer;
  try {
    buffer = await deps.assembler.assemble({
      clips: animateResults,
      narrationTracks,
      musicAsset: deps.musicAsset ?? { volume: 0.15, fadeIn: 2, fadeOut: 3, trackId: 'default' },
      musicPath: deps.musicPath ?? '',
      tempDir,
      totalDurationSec,
      introDurationSec,
      mainDurationSec,
      introPath: deps.introPath,
      outroPath: deps.outroPath,
      globalOptions: plan.globalOptions,
    });
  } finally {
    // Cleanup temp dir (V1 parity)
    try {
      const { rm } = await import('fs/promises');
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Non-fatal cleanup failure
    }
  }

  return buffer;
}
