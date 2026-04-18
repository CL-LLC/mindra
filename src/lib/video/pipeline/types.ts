/**
 * V2 Pipeline Abstraction — Render Pipeline Interface
 *
 * A pipeline owns the full orchestration: scene images → frame renders →
 * concatenation → audio mixing → final buffer.
 *
 * V1Pipeline is the current FFmpeg+PIL flow. V2Pipeline (future) can swap
 * in cloud rendering, different compositors, etc.
 */

import type { RenderScene } from "../render-executor";
import type { RenderOptions } from "../render-executor";

/** Result of a completed pipeline run. */
export interface PipelineResult {
  /** Final encoded video buffer. */
  videoBuffer: Buffer;
  /** Metadata about the render (optional, for diagnostics). */
  meta?: {
    version: number;
    durationMs?: number;
    sceneCount: number;
  };
}

/**
 * A render pipeline takes scenes + options and returns a video buffer.
 *
 * Implementations must be side-effect-free except for temp-file creation
 * (cleaned up in finally blocks).
 */
export interface RenderPipeline {
  readonly version: number;
  render(scenes: RenderScene[], options?: RenderOptions): Promise<PipelineResult>;
}
