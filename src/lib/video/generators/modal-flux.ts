import fs from 'fs/promises';
import path from 'path';
import type { ImageGenerator, RenderSceneImageParams } from './types';

export interface ModalFluxGeneratorConfig {
  endpointUrl?: string;
  apiKey?: string;
  maxOutputResolution?: number;
}

export class ModalFluxGenerator implements ImageGenerator {
  private readonly endpointUrl: string;
  private readonly apiKey?: string;
  private readonly maxOutputResolution: number;

  constructor(config: ModalFluxGeneratorConfig = {}) {
    this.endpointUrl = config.endpointUrl || process.env.MODAL_FLUX_ENDPOINT_URL || '';
    this.apiKey = config.apiKey || process.env.MODAL_FLUX_API_KEY || process.env.MODAL_TOKEN_SECRET;
    this.maxOutputResolution = config.maxOutputResolution || 1080;
  }

  async generate(params: RenderSceneImageParams): Promise<string | undefined> {
    if (!this.endpointUrl) {
      throw new Error('Flux image generation is required but MODAL_FLUX_ENDPOINT_URL is not configured. Configure the Modal Flux endpoint; OpenAI image generation is intentionally disabled.');
    }

    const { prompt, tempDir, index, width, height } = params;
    const outputPath = path.join(tempDir, `generated-${index}.png`);
    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        seed: params.index,
        width: Math.min(width, this.maxOutputResolution),
        height: Math.min(height, this.maxOutputResolution),
      }),
    });

    if (!response.ok) {
      throw new Error(`Modal Flux request failed with ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json() as { image?: string; imageUrl?: string; base64?: string; buffer?: string };
      const base64 = data.base64 || data.buffer || data.image;
      const imageUrl = data.imageUrl;
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
      return undefined;
    }

    await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    return outputPath;
  }
}
