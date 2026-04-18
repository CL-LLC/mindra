/**
 * V1KeyframeGenerator — Delegates to the existing ImageGenerator seam.
 */
import type { KeyframeGenerator, KeyframeResult, ShotPlan } from './types';
import type { ImageGenerator } from '../generators/types';

export class V1KeyframeGenerator implements KeyframeGenerator {
  constructor(
    private imageGenerator: ImageGenerator,
    private width: number,
    private height: number,
  ) {}

  async generate(shot: ShotPlan, tempDir: string, index: number): Promise<KeyframeResult> {
    const imagePath = await this.imageGenerator.generate({
      prompt: shot.imagePrompt,
      tempDir,
      index,
      width: this.width,
      height: this.height,
    });

    // If image gen fails or is skipped, we still return — the animator
    // will use PIL fallback with backgroundColor + text.
    return {
      imagePath: imagePath ?? '',
      width: this.width,
      height: this.height,
    };
  }
}
