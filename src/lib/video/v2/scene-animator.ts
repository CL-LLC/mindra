/**
 * V1SceneAnimator — Delegates to existing SceneRenderer + ffmpeg still-to-video.
 *
 * The V1 flow:
 *  1. Render a PIL frame (text overlay on background)
 *  2. Convert the still to a video clip of the required duration using ffmpeg
 */
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import type { SceneAnimator, AnimateParams, AnimateResult } from './types';
import type { SceneRenderer } from '../generators/types';

const execAsync = promisify(execCb);

export class V1SceneAnimator implements SceneAnimator {
  constructor(
    private sceneRenderer: SceneRenderer,
    private shellQuote: (v: string) => string,
  ) {}

  async animate(params: AnimateParams): Promise<AnimateResult> {
    const { keyframe, shot, tempDir, index, fps } = params;
    const framePath = join(tempDir, `frame-v2-${index}.png`);
    const clipPath = join(tempDir, `clip-v2-${index}.mp4`);

    // Use generated image as background if available, otherwise use color
    const bgImage = keyframe.imagePath || undefined;

    await this.sceneRenderer.renderFrame(framePath, {
      text: shot.affirmation,
      backgroundColor: shot.backgroundColor,
      backgroundImagePath: bgImage,
      width: keyframe.width,
      height: keyframe.height,
      fontSize: 48,
      maxTextWidth: Math.round(keyframe.width * 0.8),
    });

    // Still-image → video clip
    const q = this.shellQuote;
    const cmd = `ffmpeg -y -loop 1 -i ${q(framePath)} -t ${shot.durationSec} -r ${fps} -c:v libx264 -pix_fmt yuv420p ${q(clipPath)}`;
    await execAsync(cmd);

    return {
      clipPath,
      durationSec: shot.durationSec,
    };
  }
}
