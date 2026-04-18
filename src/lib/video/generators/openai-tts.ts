import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { AudioGenerator } from './types';

export class OpenAITtsGenerator implements AudioGenerator {
  constructor(
    private readonly openaiClient: OpenAI,
    private readonly model: string,
    private readonly voice: string
  ) {}

  async synthesize(tempDir: string, sceneIndex: number, affirmation: string): Promise<string> {
    const response: any = await (this.openaiClient as any).audio.speech.create({
      model: this.model,
      voice: this.voice,
      input: affirmation,
      format: 'mp3',
    });

    const narrationPath = path.join(tempDir, `narration-${sceneIndex}.mp3`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(narrationPath, buffer);
    return narrationPath;
  }
}
