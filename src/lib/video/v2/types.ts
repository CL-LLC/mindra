/**
 * Mindra V2 Pipeline — Type definitions
 *
 * These types define the contract between pipeline stages.
 * V1 adapters implement these interfaces by delegating to existing generators.
 */

// Re-use existing RenderScene / RenderOptions from generators seam,
// but also export V2-specific types here for pipeline-internal use.

export interface ShotPlan {
  sceneIndex: number;
  shotId: string;
  affirmation: string;
  durationSec: number;
  imagePrompt: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  language?: string;
  title?: string;
  description?: string;
}

export interface RenderPlan {
  shots: ShotPlan[];
  globalOptions: {
    width: number;
    height: number;
    fps: number;
    musicTrack?: string;
  };
}

export interface KeyframeResult {
  imagePath: string;
  width: number;
  height: number;
}

export interface AnimateParams {
  keyframe: KeyframeResult;
  shot: ShotPlan;
  tempDir: string;
  index: number;
  fps: number;
}

export interface AnimateResult {
  clipPath: string;
  durationSec: number;
}

export interface MusicAssetConfig {
  volume: number;
  fadeIn: number;
  fadeOut: number;
  trackId: string;
}

export interface AssembleParams {
  clips: AnimateResult[];
  narrationTracks: NarrationTrackV2[];
  musicAsset: MusicAssetConfig;
  musicPath: string;
  tempDir: string;
  totalDurationSec: number;
  introDurationSec?: number;
  mainDurationSec?: number;
  introPath?: string;
  outroPath?: string;
  globalOptions: RenderPlan['globalOptions'];
}

export interface NarrationTrackV2 {
  path: string;
  start: number;
  duration: number;
  clipDuration: number;
  repeat: boolean;
  sourceType: 'recorded' | 'tts';
}

// --- Stage interfaces ---

export interface Planner {
  plan(scenes: RenderSceneV2[], options: RenderOptionsV2): Promise<RenderPlan>;
}

export interface KeyframeGenerator {
  generate(shot: ShotPlan, tempDir: string, index: number): Promise<KeyframeResult>;
}

export interface SceneAnimator {
  animate(params: AnimateParams): Promise<AnimateResult>;
}

export interface Assembler {
  assemble(params: AssembleParams): Promise<Buffer>;
}

export interface JobRouter {
  selectPipeline(options: RenderOptionsV2): 'v1' | 'v2';
}

// Re-exports of shapes matching existing generators/types.ts (avoids cross-import in adapters)
export interface RenderSceneV2 {
  affirmation: string;
  duration: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  imagePrompt?: string;
  title?: string;
  description?: string;
  narrationAudioDataUrl?: string;
  narrationMimeType?: string;
  narrationDurationMs?: number;
  language?: string;
}

export interface RenderOptionsV2 {
  width?: number;
  height?: number;
  fps?: number;
  quality?: 'low' | 'medium' | 'high';
  musicTrack?: string;
}
