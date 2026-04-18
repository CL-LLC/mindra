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
  ) => Promise<NarrationTrackV2[]>;
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

  // 3. Narration tracks
  const narrationTracks = await deps.buildNarrationTracks(
    plan.shots.map((s, i) => ({
      affirmation: s.affirmation,
      narrationAudioDataUrl: scenes[i]?.narrationAudioDataUrl,
      narrationMimeType: scenes[i]?.narrationMimeType,
      narrationDurationMs: scenes[i]?.narrationDurationMs,
      durationSec: s.durationSec,
    })),
    tempDir,
  );

  // 4. Total duration
  const totalDurationSec = animateResults.reduce((sum, c) => sum + c.durationSec, 0);

  // 5. Assemble
  // NOTE: intro/outro and music path resolution is the caller's responsibility
  // in the integration layer. For now the assembler receives them as optional params.
  const buffer = await deps.assembler.assemble({
    clips: animateResults,
    narrationTracks,
    musicAsset: { volume: 0.15, fadeIn: 2, fadeOut: 3, trackId: 'default' },
    musicPath: '', // resolved by integration wrapper
    tempDir,
    totalDurationSec,
    globalOptions: plan.globalOptions,
  });

  return buffer;
}
