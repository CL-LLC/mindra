/**
 * Mindra V2 Pipeline — Public API
 *
 * Import from here to use V2 pipeline stages.
 * The V1 adapters in this directory are implementation details
 * that delegate to existing generators/ seams.
 */
export { V1Planner } from './planner';
export { V1KeyframeGenerator } from './keyframe-generator';
export { V1SceneAnimator } from './scene-animator';
export { V1Assembler } from './assembler';
export { EnvJobRouter } from './job-router';
export { runV2Pipeline } from './pipeline';
export type { V2PipelineDeps } from './pipeline';

export type {
  ShotPlan,
  RenderPlan,
  KeyframeResult,
  AnimateParams,
  AnimateResult,
  MusicAssetConfig,
  AssembleParams,
  NarrationTrackV2,
  Planner,
  KeyframeGenerator,
  SceneAnimator,
  Assembler,
  JobRouter,
  RenderSceneV2,
  RenderOptionsV2,
} from './types';
