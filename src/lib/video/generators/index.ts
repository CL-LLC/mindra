import OpenAI from 'openai';
import { FFmpegComposer } from './ffmpeg-composer';
import { ModalFluxGenerator } from './modal-flux';
import { OpenAITtsGenerator } from './openai-tts';
import { PythonPilSceneRenderer } from './pil-scene-renderer';
import type { ImageGenerator } from './types';

export function createVideoGenerators(params: {
  openaiClient: OpenAI | null;
  ttsModel: string;
  ttsVoice: string;
  pythonCommand: string;
  shellQuote: (value: string) => string;
  fallbackRenderer: (outputPath: string, prompt: string, width: number, height: number) => Promise<void>;
}): {
  imageGenerator: ImageGenerator;
  sceneRenderer: PythonPilSceneRenderer;
  videoComposer: FFmpegComposer;
  audioGenerator: OpenAITtsGenerator | null;
} {
  const imageGenerator = new ModalFluxGenerator({
    endpointUrl: process.env.MODAL_FLUX_ENDPOINT_URL,
    apiKey: process.env.MODAL_FLUX_API_KEY || process.env.MODAL_TOKEN_SECRET,
    maxOutputResolution: 1080,
  });

  const sceneRenderer = new PythonPilSceneRenderer(params.pythonCommand, params.shellQuote);
  const videoComposer = new FFmpegComposer(params.shellQuote);
  const audioGenerator = params.openaiClient
    ? new OpenAITtsGenerator(params.openaiClient, params.ttsModel, params.ttsVoice)
    : null;

  return {
    imageGenerator,
    sceneRenderer,
    videoComposer,
    audioGenerator,
  };
}
