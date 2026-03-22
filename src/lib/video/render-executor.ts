// Video Render Executor - FFmpeg-based rendering for Mindra MVP
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import { getMusicAsset, resolveMusicAssetPath } from './music-registry';

const execAsync = promisify(exec);
const PYTHON = process.env.PYTHON || 'python3';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';
const ENABLE_NARRATION = process.env.MINDRA_ENABLE_NARRATION !== 'false';
const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export interface RenderScene {
  affirmation: string;
  duration: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
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
  const musicPath = (await resolveMusicAssetPath(musicAsset)) || undefined;
  const narrationPath = await buildNarrationTrack(scenes, tempDir);

  try {
    const sceneFiles: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneFile = path.join(tempDir, `scene-${i}.mp4`);
      const frameFile = path.join(tempDir, `scene-${i}.png`);
      const bgColor = scene.backgroundColor || getRandomGradientColor();
      const fontSize = Math.floor(opts.height * 0.06);
      const maxTextWidth = Math.floor(opts.width * 0.76);
      const generatedImagePath = i === scenes.length - 1
        ? undefined
        : await ensureSceneImageAsset({
            scene,
            tempDir,
            index: i,
            width: opts.width,
            height: opts.height,
          });

      await renderSceneFrame(frameFile, {
        text: scene.affirmation,
        backgroundColor: bgColor,
        backgroundImagePath: generatedImagePath,
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

    const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
    const finalVideoFile = await mixOptionalAudio({ outputFile, tempDir, narrationPath, musicPath, musicAsset, totalDuration });

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
    backgroundImagePath?: string;
    width: number;
    height: number;
    fontSize: number;
    maxTextWidth: number;
  }
): Promise<void> {
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
    shellQuote(scriptPath),
    shellQuote(outputPath),
    shellQuote(params.text),
    shellQuote(params.backgroundColor),
    shellQuote(params.backgroundImagePath || ''),
    shellQuote(String(params.width)),
    shellQuote(String(params.height)),
    shellQuote(String(params.fontSize)),
    shellQuote(String(params.maxTextWidth)),
  ].join(' ');

  await execAsync(`${shellQuote(PYTHON)} ${args}`, { maxBuffer: 10 * 1024 * 1024 });
}

async function ensureSceneImageAsset(params: {
  scene: RenderScene;
  tempDir: string;
  index: number;
  width: number;
  height: number;
}): Promise<string | undefined> {
  const { scene, tempDir, index, width, height } = params;
  const existingAsset = scene.backgroundImageUrl
    ? await resolveBackgroundImage(scene.backgroundImageUrl, tempDir, index)
    : undefined;
  if (existingAsset) return existingAsset;

  const generatedAsset = await generateSceneImageAsset({
    prompt: scene.affirmation,
    tempDir,
    index,
    width,
    height,
  });
  return generatedAsset;
}

async function generateSceneImageAsset(params: {
  prompt: string;
  tempDir: string;
  index: number;
  width: number;
  height: number;
}): Promise<string | undefined> {
  const { prompt, tempDir, index, width, height } = params;
  const outputPath = path.join(tempDir, `generated-${index}.png`);
  const fallbackPath = path.join(tempDir, `generated-${index}-fallback.png`);
  const size = width >= height ? '1024x1024' : '1024x1536';

  if (openaiClient) {
    try {
      const response: any = await (openaiClient as any).images.generate({
        model: OPENAI_IMAGE_MODEL,
        prompt: `Cinematic visual metaphor for the affirmation: ${prompt}. No text, no watermark, rich lighting, realistic composition.`,
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
        const response = await fetch(imageUrl);
        if (response.ok) {
          await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
          return outputPath;
        }
      }
    } catch (error) {
      console.warn('OpenAI image generation failed; falling back to local poster render.', error);
    }
  }

  await renderFallbackSceneImage(fallbackPath, prompt, width, height);
  return fallbackPath;
}

async function renderFallbackSceneImage(outputPath: string, prompt: string, width: number, height: number): Promise<void> {
  const script = String.raw`
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import sys, textwrap

output_path = sys.argv[1]
prompt = sys.argv[2]
width = int(sys.argv[3])
height = int(sys.argv[4])

img = Image.new('RGB', (width, height), '#111827')
draw = ImageDraw.Draw(img)
for y in range(height):
    blend = y / max(1, height - 1)
    r = int(17 + (78 - 17) * blend)
    g = int(24 + (70 - 24) * blend)
    b = int(39 + (229 - 39) * blend)
    draw.line((0, y, width, y), fill=(r, g, b))

try:
    glow = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((width*0.12, height*0.15, width*0.88, height*0.95), fill=(139, 92, 246, 45))
    img = Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')
except Exception:
    pass

font = None
for candidate in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']:
    try:
        font = ImageFont.truetype(candidate, max(28, width // 28))
        break
    except Exception:
        pass
if font is None:
    font = ImageFont.load_default()

caption = 'Scene visual generated locally'
wrapped = textwrap.wrap(prompt, width=28)[:5]
text = '\n'.join([caption, ''] + wrapped)
bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=12)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]
x = (width - text_w) // 2
y = (height - text_h) // 2
shadow = (0, 0, 0)
fill = 'white'
draw.multiline_text((x+3, y+3), text, font=font, fill=shadow, spacing=12, align='center')
draw.multiline_text((x, y), text, font=font, fill=fill, spacing=12, align='center')
img.save(output_path)
`;
  const scriptPath = path.join(path.dirname(outputPath), 'fallback-scene.py');
  await fs.writeFile(scriptPath, script);
  await execAsync(`${shellQuote(PYTHON)} ${shellQuote(scriptPath)} ${shellQuote(outputPath)} ${shellQuote(prompt)} ${shellQuote(String(width))} ${shellQuote(String(height))}`, { maxBuffer: 10 * 1024 * 1024 });
}

async function resolveBackgroundImage(url: string, tempDir: string, index: number): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('file://')) return url.slice('file://'.length);
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const contentType = response.headers.get('content-type') || '';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const target = path.join(tempDir, `background-${index}.${ext}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(target, buffer);
    return target;
  }
  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function estimateRenderTime(scenes: RenderScene[]): number {
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  return totalDuration * 2.5;
}

async function mixOptionalAudio(params: {
  outputFile: string;
  tempDir: string;
  narrationPath?: string;
  musicPath?: string;
  musicAsset: { volume: number; fadeIn: number; fadeOut: number; trackId: string };
  totalDuration: number;
}): Promise<string> {
  const { outputFile, tempDir, narrationPath, musicPath, musicAsset, totalDuration } = params;
  if (!narrationPath && !musicPath) return outputFile;

  const finalVideoFile = path.join(tempDir, 'output-final.mp4');
  const inputs: string[] = [];
  if (narrationPath) inputs.push(`-i ${shellQuote(narrationPath)}`);
  if (musicPath) inputs.push(`-stream_loop -1 -i ${shellQuote(musicPath)}`);

  const filters: string[] = [];
  const narrationInput = narrationPath ? (musicPath ? 1 : 1) : undefined;
  const musicInput = musicPath ? (narrationPath ? 2 : 1) : undefined;
  if (narrationPath && musicPath) {
    const fadeOutStart = Math.max(0.1, totalDuration - musicAsset.fadeOut);
    filters.push(`[${musicInput}:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${musicAsset.volume},afade=t=in:st=0:d=${musicAsset.fadeIn},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${musicAsset.fadeOut}[music]`);
    filters.push(`[${narrationInput}:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS[narr]`);
    filters.push(`[narr][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
  } else if (narrationPath) {
    filters.push(`[${narrationInput}:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS[aout]`);
  } else if (musicPath) {
    const fadeOutStart = Math.max(0.1, totalDuration - musicAsset.fadeOut);
    filters.push(`[${musicInput}:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${musicAsset.volume},afade=t=in:st=0:d=${musicAsset.fadeIn},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${musicAsset.fadeOut}[aout]`);
  }

  const cmd = [
    'ffmpeg -y',
    `-i ${shellQuote(outputFile)}`,
    ...inputs,
    `-filter_complex ${shellQuote(filters.join(';'))}`,
    '-map 0:v',
    '-map [aout]',
    '-c:v copy',
    '-c:a aac -b:a 128k',
    '-movflags +faststart',
    shellQuote(finalVideoFile),
  ].join(' ');

  try {
    console.log(`Adding ${narrationPath ? 'narration' : ''}${narrationPath && musicPath ? ' + ' : ''}${musicPath ? 'music' : ''} audio...`);
    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
    return finalVideoFile;
  } catch (audioError) {
    console.warn('Audio mix failed; returning silent video.', audioError);
    return outputFile;
  }
}

async function buildNarrationTrack(scenes: RenderScene[], tempDir: string): Promise<string | undefined> {
  if (!ENABLE_NARRATION || !openaiClient) return undefined;
  const affirmations = scenes.map(scene => scene.affirmation.trim()).filter(Boolean);
  if (!affirmations.length) return undefined;

  try {
    const response: any = await (openaiClient as any).audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: affirmations.join('. '),
      format: 'mp3',
    });

    const narrationPath = path.join(tempDir, 'narration.mp3');
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(narrationPath, buffer);
    return narrationPath;
  } catch (error) {
    console.warn('Narration generation failed; continuing without voiceover.', error);
    return undefined;
  }
}
