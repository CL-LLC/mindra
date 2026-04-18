/**
 * V1 Pipeline — delegates to RenderContext for staged execution.
 *
 * This is the current production path (FFmpeg + PIL + OpenAI).
 * No behavior changes; just adapts to the Pipeline interface via RenderContext.
 */

import type { RenderScene, RenderOptions } from "../render-executor";
import { RenderContext } from "./render-context";
import type { RenderPipeline, PipelineResult } from "./types";

export class V1Pipeline implements RenderPipeline {
  readonly version = 1;

  async render(scenes: RenderScene[], options?: RenderOptions): Promise<PipelineResult> {
    const ctx = new RenderContext(scenes, options);
    const videoBuffer = await ctx.run();
    return {
      videoBuffer,
      meta: {
        version: 1,
        sceneCount: scenes.length,
      },
    };
  }
}
