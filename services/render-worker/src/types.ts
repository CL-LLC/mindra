import type { RenderScene } from '../../../src/lib/video/render-executor';

export interface RenderJobPayload {
  mindMovieId: string;
  renderJobId: string;
  scenes: RenderScene[];
  options?: {
    width?: number;
    height?: number;
    fps?: number;
    quality?: 'low' | 'medium' | 'high';
    musicTrack?: string;
  };
  affirmationManifest?: unknown;
}
