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
    private resolveBackgroundImage?: (url: string, tempDir: string, index: number) => Promise<string | undefined>,
  ) {}

  async generate(shot: ShotPlan, tempDir: string, index: number): Promise<KeyframeResult> {
    // Resolve background image URL first (V1 parity)
    let resolvedBgPath: string | undefined;
    if (shot.backgroundImageUrl && this.resolveBackgroundImage) {
      resolvedBgPath = await this.resolveBackgroundImage(shot.backgroundImageUrl, tempDir, index);
    }

    // If a pre-existing background image was resolved, skip image generation
    if (resolvedBgPath) {
      return {
        imagePath: resolvedBgPath,
        width: this.width,
        height: this.height,
      };
    }

    const imagePath = await this.imageGenerator.generate({
      prompt: shot.imagePrompt,
      tempDir,
      index,
      width: this.width,
      height: this.height,
    });

    return {
      imagePath: imagePath ?? '',
      width: this.width,
      height: this.height,
    };
  }
}
