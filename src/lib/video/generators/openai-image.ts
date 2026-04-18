import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { ImageGenerator, RenderSceneImageParams } from './types';

export class OpenAIImageGenerator implements ImageGenerator {
  constructor(
    private readonly openaiClient: OpenAI | null,
    private readonly imageModel: string,
    private readonly fallbackRenderer: (outputPath: string, prompt: string, width: number, height: number) => Promise<void>
  ) {}

  async generate(params: RenderSceneImageParams): Promise<string | undefined> {
    const { prompt, tempDir, index, width, height } = params;
    const outputPath = path.join(tempDir, `generated-${index}.png`);
    const fallbackPath = path.join(tempDir, `generated-${index}-fallback.png`);
    const size = width >= height ? '1024x1024' : '1024x1536';

    if (this.openaiClient) {
      try {
        const response: any = await (this.openaiClient as any).images.generate({
          model: this.imageModel,
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
        console.warn('OpenAI image generation failed; falling back to local poster render.', error);
      }
    }

    await this.fallbackRenderer(fallbackPath, prompt, width, height);
    return fallbackPath;
  }
}
