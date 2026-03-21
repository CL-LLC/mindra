// Video Render Executor - FFmpeg-based rendering for Mindra MVP
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getMusicAsset, resolveMusicAssetPath } from './music-registry';

const execAsync = promisify(exec);
const PYTHON = process.env.PYTHON || 'python3';

export interface RenderScene {
  affirmation: string;
  duration: number;
  backgroundColor?: string;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  quality?: 'low' | 'medium' | 'high';
  musicTrack?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RenderOptions, 'musicTrack'>> = {
  width: 1280,
  height: 720,
  fps: 30,
  quality: 'medium',
};

export async function renderVideo(
  scenes: RenderScene[],
  options: RenderOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-render-'));
  const musicAsset = getMusicAsset(opts.musicTrack, scenes.length);
  const musicPath = await resolveMusicAssetPath(musicAsset);

  try {
    const sceneFiles: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneFile = path.join(tempDir, `scene-${i}.mp4`);
      const frameFile = path.join(tempDir, `scene-${i}.png`);
      const bgColor = scene.backgroundColor || getRandomGradientColor();
      const fontSize = Math.floor(opts.height * 0.06);
      const maxTextWidth = Math.floor(opts.width * 0.76);

      await renderSceneFrame(frameFile, {
        text: scene.affirmation,
        backgroundColor: bgColor,
        width: opts.width,
        height: opts.height,
        fontSize,
        maxTextWidth,
      });

      const cmd = [
        'ffmpeg -y',
        `-loop 1 -t ${scene.duration} -i ${shellQuote(frameFile)}`,
        `-r ${opts.fps}`,
        `-c:v libx264 -preset ${opts.quality === 'high' ? 'slow' : opts.quality === 'low' ? 'ultrafast' : 'medium'}`,
        '-pix_fmt yuv420p',
        shellQuote(sceneFile)
      ].join(' ');

      console.log(`Rendering scene ${i + 1}/${scenes.length}...`);
      await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
      sceneFiles.push(sceneFile);
    }

    const concatFile = path.join(tempDir, 'concat.txt');
    const concatContent = sceneFiles.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(concatFile, concatContent);

    const outputFile = path.join(tempDir, 'output-no-audio.mp4');
    const concatCmd = [
      'ffmpeg -y',
      `-f concat -safe 0 -i ${shellQuote(concatFile)}`,
      '-c copy',
      shellQuote(outputFile)
    ].join(' ');

    console.log('Concatenating scenes...');
    await execAsync(concatCmd, { maxBuffer: 20 * 1024 * 1024 });

    const finalVideoFile = musicPath ? path.join(tempDir, 'output-with-music.mp4') : outputFile;
    if (musicPath) {
      const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
      const fadeOutStart = Math.max(0.1, totalDuration - musicAsset.fadeOut);
      const musicCmd = [
        'ffmpeg -y',
        `-i ${shellQuote(outputFile)}`,
        `-stream_loop -1 -i ${shellQuote(musicPath)}`,
        '-filter_complex', [
          `[1:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${musicAsset.volume},afade=t=in:st=0:d=${musicAsset.fadeIn},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${musicAsset.fadeOut}[aout]`
        ].join(';'),
        '-map 0:v',
        '-map [aout]',
        '-c:v copy',
        '-c:a aac -b:a 128k',
        '-movflags +faststart',
        shellQuote(finalVideoFile)
      ].join(' ');

      try {
        console.log(`Adding music track (${musicAsset.trackId})...`);
        await execAsync(musicCmd, { maxBuffer: 50 * 1024 * 1024 });
      } catch (musicError) {
        console.warn('Music mix failed; returning silent video.', musicError);
      }
    } else {
      console.warn(`No music asset found for ${musicAsset.trackId}; returning silent video.`);
    }

    const videoBuffer = await fs.readFile(finalVideoFile);
    console.log(`Render complete: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    return videoBuffer;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup temp dir:', e);
    }
  }
}

function getRandomGradientColor(): string {
  const colors = ['#1e1b4b', '#312e81', '#3730a3', '#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed'];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function renderSceneFrame(
  outputPath: string,
  params: {
    text: string;
    backgroundColor: string;
    width: number;
    height: number;
    fontSize: number;
    maxTextWidth: number;
  }
): Promise<void> {
  const script = String.raw`
from PIL import Image, ImageDraw, ImageFont
import sys

output_path = sys.argv[1]
text = sys.argv[2]
background = sys.argv[3]
width = int(sys.argv[4])
height = int(sys.argv[5])
font_size = int(sys.argv[6])
max_text_width = int(sys.argv[7])

img = Image.new('RGB', (width, height), background)
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
    shellQuote(scriptPath),
    shellQuote(outputPath),
    shellQuote(params.text),
    shellQuote(params.backgroundColor),
    shellQuote(String(params.width)),
    shellQuote(String(params.height)),
    shellQuote(String(params.fontSize)),
    shellQuote(String(params.maxTextWidth)),
  ].join(' ');

  await execAsync(`${shellQuote(PYTHON)} ${args}`, { maxBuffer: 10 * 1024 * 1024 });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function estimateRenderTime(scenes: RenderScene[]): number {
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  return totalDuration * 2.5;
}
