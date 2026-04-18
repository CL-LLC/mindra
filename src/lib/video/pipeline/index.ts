/**
 * Pipeline Factory — selects V1 or V2 based on feature flag.
 *
 * V1 remains the default. Set MINDRA_PIPELINE_VERSION=2 (or future flag)
 * to opt into V2 when ready.
 */

export { RenderContext } from "./render-context";
export type { ResolvedRenderOptions } from "./render-context";
import type { RenderPipeline } from "./types";
import { V1Pipeline } from "./v1-pipeline";
import { V2Pipeline } from "./v2-pipeline";

let _cachedPipeline: RenderPipeline | undefined;

export function getPipeline(): RenderPipeline {
  if (_cachedPipeline) return _cachedPipeline;

  const version = Number(process.env.MINDRA_PIPELINE_VERSION || "1");

  switch (version) {
    case 2:
      _cachedPipeline = new V2Pipeline();
      break;
    default:
      _cachedPipeline = new V1Pipeline();
  }

  return _cachedPipeline;
}

/**
 * Reset cached pipeline (useful for tests or hot config changes).
 */
export function resetPipeline(): void {
  _cachedPipeline = undefined;
}
