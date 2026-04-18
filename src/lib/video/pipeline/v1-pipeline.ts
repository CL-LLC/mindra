/**
 * V1 Pipeline — wraps the existing renderVideo() function.
 *
 * This is the current production path (FFmpeg + PIL + OpenAI).
 * No behavior changes; just adapts the legacy function to the Pipeline interface.
 */

import type { RenderScene, RenderOptions } from "../render-executor";
import { renderVideo } from "../render-executor";
import type { RenderPipeline, PipelineResult } from "./types";

export class V1Pipeline implements RenderPipeline {
  readonly version = 1;

  async render(scenes: RenderScene[], options?: RenderOptions): Promise<PipelineResult> {
    const videoBuffer = await renderVideo(scenes, options);
    return {
      videoBuffer,
      meta: {
        version: 1,
        sceneCount: scenes.length,
      },
    };
  }
}
