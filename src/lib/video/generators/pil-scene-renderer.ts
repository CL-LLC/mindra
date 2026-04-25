import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SceneFrameParams, SceneRenderer } from './types';

const execAsync = promisify(exec);

export class PythonPilSceneRenderer implements SceneRenderer {
  constructor(
    private readonly pythonCommand: string,
    private readonly shellQuote: (value: string) => string
  ) {}

  async renderFrame(outputPath: string, params: SceneFrameParams): Promise<void> {
    const script = String.raw`
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import sys

output_path = sys.argv[1]
text = sys.argv[2]
background = sys.argv[3]
background_image_path = sys.argv[4]
width = int(sys.argv[5])
height = int(sys.argv[6])
font_size = int(sys.argv[7])
max_text_width = int(sys.argv[8])

img = Image.new('RGB', (width, height), background)
if background_image_path and background_image_path != '':
    try:
        bg = Image.open(background_image_path).convert('RGB')
        bg_ratio = bg.width / bg.height
        target_ratio = width / height
        if bg_ratio > target_ratio:
            new_height = height
            new_width = int(bg_ratio * new_height)
        else:
            new_width = width
            new_height = int(new_width / bg_ratio)
        bg = bg.resize((new_width, new_height), Image.LANCZOS)
        left = max(0, (bg.width - width) // 2)
        top = max(0, (bg.height - height) // 2)
        bg = bg.crop((left, top, left + width, top + height))
        bg = bg.filter(ImageFilter.GaussianBlur(radius=1.5))
        img.paste(bg, (0, 0))
    except Exception:
        pass

draw = ImageDraw.Draw(img)

font_candidates = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Helvetica.ttf',
    '/Library/Fonts/Arial.ttf',
]
font = None
for candidate in font_candidates:
    try:
        font = ImageFont.truetype(candidate, font_size)
        break
    except Exception:
        pass
if font is None:
    font = ImageFont.load_default()

lines = []
for paragraph in text.split('\n'):
    words = paragraph.split()
    if not words:
        lines.append('')
        continue
    current = words[0]
    for word in words[1:]:
        test = current + ' ' + word
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_text_width:
            current = test
        else:
            lines.append(current)
            current = word
    lines.append(current)

line_boxes = [draw.textbbox((0, 0), line, font=font) if line else (0, 0, 0, 0) for line in lines]
line_heights = [box[3] - box[1] for box in line_boxes]
line_spacing = max(8, font_size // 5)
block_height = sum(line_heights) + line_spacing * max(0, len(lines) - 1)
current_y = (height - block_height) // 2

for line, box, line_height in zip(lines, line_boxes, line_heights):
    line_width = box[2] - box[0]
    x = (width - line_width) // 2
    draw.text((x + 2, current_y + 2), line, font=font, fill='black')
    draw.text((x, current_y), line, font=font, fill='white')
    current_y += line_height + line_spacing

img.save(output_path)
`;

    const scriptPath = path.join(path.dirname(outputPath), 'render-scene.py');
    await fs.writeFile(scriptPath, script);

    const args = [
      this.shellQuote(scriptPath),
      this.shellQuote(outputPath),
      this.shellQuote(params.text),
      this.shellQuote(params.backgroundColor),
      this.shellQuote(params.backgroundImagePath || ''),
      this.shellQuote(String(params.width)),
      this.shellQuote(String(params.height)),
      this.shellQuote(String(params.fontSize)),
      this.shellQuote(String(params.maxTextWidth)),
    ].join(' ');

    try {
      await execAsync(`${this.shellQuote(this.pythonCommand)} ${args}`, { maxBuffer: 10 * 1024 * 1024 });
    } catch (error) {
      if (this.canRenderWithFfmpegFallback(params, error)) {
        await this.renderFrameWithFfmpeg(outputPath, params);
        return;
      }
      throw error;
    }
  }

  private canRenderWithFfmpegFallback(params: SceneFrameParams, error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return params.text.trim() === '' && /ModuleNotFoundError: No module named 'PIL'/.test(message);
  }

  private async renderFrameWithFfmpeg(outputPath: string, params: SceneFrameParams): Promise<void> {
    if (params.backgroundImagePath) {
      const filter = `scale=${params.width}:${params.height}:force_original_aspect_ratio=increase,crop=${params.width}:${params.height}`;
      const cmd = [
        'ffmpeg -y',
        `-i ${this.shellQuote(params.backgroundImagePath)}`,
        `-vf ${this.shellQuote(filter)}`,
        '-frames:v 1',
        this.shellQuote(outputPath),
      ].join(' ');
      await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
      return;
    }

    const cmd = [
      'ffmpeg -y',
      `-f lavfi -i ${this.shellQuote(`color=c=${params.backgroundColor}:s=${params.width}x${params.height}:d=1`)}`,
      '-frames:v 1',
      this.shellQuote(outputPath),
    ].join(' ');
    await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  }
}
