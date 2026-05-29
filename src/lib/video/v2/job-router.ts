/**
 * EnvJobRouter — V2-only routing.
 */
import type { JobRouter, RenderOptionsV2 } from './types';

export class EnvJobRouter implements JobRouter {
  selectPipeline(_options: RenderOptionsV2): 'v1' | 'v2' {
    return 'v2';
  }
}
