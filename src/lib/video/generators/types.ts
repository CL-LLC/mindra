export interface RenderScene {
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

export interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  quality?: 'low' | 'medium' | 'high';
  musicTrack?: string;
}

export interface RenderSceneImageParams {
  prompt: string;
  tempDir: string;
  index: number;
  width: number;
  height: number;
}

export interface SceneFrameParams {
  text: string;
  backgroundColor: string;
  backgroundImagePath?: string;
  width: number;
  height: number;
  fontSize: number;
  maxTextWidth: number;
}

export interface NarrationTrack {
  path: string;
  start: number;
  duration: number;
  clipDuration: number;
  repeat: boolean;
  sourceType: 'recorded' | 'tts';
}

export interface ImageGenerator {
  generate(params: RenderSceneImageParams): Promise<string | undefined>;
}

export interface SceneRenderer {
  renderFrame(outputPath: string, params: SceneFrameParams): Promise<void>;
}

export interface AudioGenerator {
  synthesize(tempDir: string, sceneIndex: number, affirmation: string): Promise<string>;
}

export interface VideoComposer {
  concatScenes(params: {
    concatParts: string[];
    tempDir: string;
  }): Promise<string>;
  mixAudio(params: {
    outputFile: string;
    tempDir: string;
    narrationTracks?: NarrationTrack[];
    musicPath?: string;
    musicAsset: { volume: number; fadeIn: number; fadeOut: number; trackId: string };
    totalDuration: number;
    introDuration?: number;
    mainDuration?: number;
  }): Promise<string>;
}
