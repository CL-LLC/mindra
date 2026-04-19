import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { ImageGenerator, RenderSceneImageParams } from './types';

export type ImageBackend = 'openai' | 'local';

export type ImageProvider = 'openai' | 'qwen' | 'flux' | 'modal-flux';

const FALLBACK_ONLY_BACKENDS: ImageBackend[] = ['local'];

export interface ImageGeneratorConfig {
  backend: ImageBackend;
  provider: ImageProvider;
  model: string;
  openaiClient: OpenAI | null;
  fallbackRenderer: (outputPath: string, prompt: string, width: number, height: number) => Promise<void>;
}

export class OpenAIImageGenerator implements ImageGenerator {
  constructor(private readonly config: ImageGeneratorConfig) {}

  async generate(params: RenderSceneImageParams): Promise<string | undefined> {
    const { prompt, tempDir, index, width, height } = params;
    const outputPath = path.join(tempDir, `generated-${index}.png`);
    const fallbackPath = path.join(tempDir, `generated-${index}-fallback.png`);
    const size = width >= height ? '1024x1024' : '1024x1536';

    if (!FALLBACK_ONLY_BACKENDS.includes(this.config.backend) && this.config.openaiClient) {
      try {
        const model = this.config.model || (this.config.provider === 'qwen' ? 'Qwen-Image' : this.config.provider === 'flux' ? 'FLUX.2 klein' : this.config.provider === 'modal-flux' ? 'FLUX.2 klein 4B' : 'gpt-image-1');
        const response: any = await (this.config.openaiClient as any).images.generate({
          model,
          prompt: `Cinematic scene image for video production. Depict the scene faithfully: ${prompt}. No text, no watermark, rich lighting, realistic composition.`,
          size,
        });

        const imageData = response?.data?.[0];
        const base64 = imageData?.b64_json || imageData?.b64Json;
        const imageUrl = imageData?.url;

        if (base64) {
          await fs.writeFile(outputPath, Buffer.from(base64, 'base64'));
          return outputPath;
        }

        if (imageUrl) {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            await fs.writeFile(outputPath, Buffer.from(await imageResponse.arrayBuffer()));
            return outputPath;
          }
        }
      } catch (error) {
        console.warn('Image backend failed; falling back to local poster render.', error);
      }
    }

    await this.config.fallbackRenderer(fallbackPath, prompt, width, height);
    return fallbackPath;
  }
}
