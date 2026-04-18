import OpenAI from 'openai';
import { FFmpegComposer } from './ffmpeg-composer';
import { OpenAIImageGenerator } from './openai-image';
import { OpenAITtsGenerator } from './openai-tts';
import { PythonPilSceneRenderer } from './pil-scene-renderer';

export function createVideoGenerators(params: {
  openaiClient: OpenAI | null;
  imageModel: string;
  ttsModel: string;
  ttsVoice: string;
  pythonCommand: string;
  shellQuote: (value: string) => string;
  fallbackRenderer: (outputPath: string, prompt: string, width: number, height: number) => Promise<void>;
}) {
  const imageGenerator = new OpenAIImageGenerator(
    params.openaiClient,
    params.imageModel,
    params.fallbackRenderer
  );

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
