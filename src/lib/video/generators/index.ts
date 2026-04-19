import OpenAI from 'openai';
import { FFmpegComposer } from './ffmpeg-composer';
import { ImageBackend, ImageProvider, OpenAIImageGenerator } from './openai-image';
import { ModalFluxGenerator } from './modal-flux';
import { OpenAITtsGenerator } from './openai-tts';
import { PythonPilSceneRenderer } from './pil-scene-renderer';

export function createVideoGenerators(params: {
  openaiClient: OpenAI | null;
  imageBackend?: ImageBackend;
  imageProvider?: ImageProvider;
  imageModel: string;
  ttsModel: string;
  ttsVoice: string;
  pythonCommand: string;
  shellQuote: (value: string) => string;
  fallbackRenderer: (outputPath: string, prompt: string, width: number, height: number) => Promise<void>;
}) {
  const imageGenerator =
    (process.env.MINDRA_IMAGE_PROVIDER === 'modal-flux'
      ? new ModalFluxGenerator({
          endpointUrl: process.env.MODAL_FLUX_ENDPOINT_URL,
          apiKey: process.env.MODAL_FLUX_API_KEY || process.env.MODAL_TOKEN_SECRET,
          maxOutputResolution: 1080,
        })
      : new OpenAIImageGenerator({
          backend: params.imageBackend || 'openai',
          provider: params.imageProvider || 'openai',
          model: params.imageModel,
          openaiClient: params.openaiClient,
          fallbackRenderer: params.fallbackRenderer,
        }));

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
