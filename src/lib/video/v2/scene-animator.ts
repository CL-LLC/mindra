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

    // V1 parity: render frames with empty text (text is not overlaid on video frames)
    const fontSize = Math.floor(keyframe.height * 0.06);
    await this.sceneRenderer.renderFrame(framePath, {
      text: '',
      backgroundColor: shot.backgroundColor,
      backgroundImagePath: bgImage,
      width: keyframe.width,
      height: keyframe.height,
      fontSize,
      maxTextWidth: Math.round(keyframe.width * 0.76),
    });

    // Still-image → video clip
    // V1 parity: match quality-based preset
    const preset = 'medium'; // TODO: accept quality option from planner
    const q = this.shellQuote;
    const cmd = `ffmpeg -y -loop 1 -i ${q(framePath)} -t ${shot.durationSec} -r ${fps} -c:v libx264 -preset ${preset} -pix_fmt yuv420p ${q(clipPath)}`;
    await execAsync(cmd);

    return {
      clipPath,
      durationSec: shot.durationSec,
    };
  }
}
