/**
 * EnvJobRouter — Selects pipeline version based on MINDRA_V2_PIPELINE env var.
 */
import type { JobRouter, RenderOptionsV2 } from './types';

export class EnvJobRouter implements JobRouter {
  selectPipeline(_options: RenderOptionsV2): 'v1' | 'v2' {
    return process.env.MINDRA_V2_PIPELINE === 'true' ? 'v2' : 'v1';
  }
}
