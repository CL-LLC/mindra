/**
 * Pipeline Factory — Mindra uses the V2 renderer as the only supported path.
 *
 * The previous V1/V2 feature flag has been retired so local, render-worker,
 * GitHub/Vercel, and production environments all exercise the same pipeline.
 */

export { RenderContext } from "./render-context";
export type { ResolvedRenderOptions } from "./render-context";
import type { RenderPipeline } from "./types";
import { V2Pipeline } from "./v2-pipeline";

let _cachedPipeline: RenderPipeline | undefined;

export function getPipeline(): RenderPipeline {
  if (_cachedPipeline) return _cachedPipeline;

  _cachedPipeline = new V2Pipeline();
  console.log("[mindra] Pipeline V2 selected (V2-only mode)");

  return _cachedPipeline;
}

/**
 * Reset cached pipeline (useful for tests or hot config changes).
 */
export function resetPipeline(): void {
  _cachedPipeline = undefined;
}
