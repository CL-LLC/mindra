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
const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export interface RenderScene {
  affirmation: string;
  duration: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  imagePrompt?: string;
  title?: string;
  description?: string;
  narrationAudioDataUrl?: string;
  narrationMimeType?: string;
  narrationDurationMs?: number;
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
  const musicPath = (await resolveMusicAssetPath(musicAsset)) || (await ensureFallbackMusicAsset(tempDir, musicAsset, scenes.length));
  const narrationTracks = await buildSceneNarrationTracks(scenes, tempDir);

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
      const sceneOverlayText = scene.affirmation?.trim() || scene.title?.trim() || scene.description?.trim() || `Scene ${i + 1}`;

      await renderSceneFrame(frameFile, {
        text: sceneOverlayText,
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
    const finalVideoFile = await mixOptionalAudio({ outputFile, tempDir, narrationTracks, musicPath, musicAsset, totalDuration });

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
    prompt: getSceneVisualPrompt(scene, index),
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

async function ensureFallbackMusicAsset(tempDir: string, musicAsset: { trackId: string; volume: number; fadeIn: number; fadeOut: number }, sceneCount: number): Promise<string | undefined> {
  const fallbackPath = path.join(tempDir, `${musicAsset.trackId || 'mindra-fallback'}-${sceneCount}.wav`);
  try {
    const duration = Math.max(8, sceneCount * 10);
    const cmd = [
      'ffmpeg -y',
      `-f lavfi -i ${shellQuote(`sine=frequency=220:duration=${duration}`)}`,
      `-f lavfi -i ${shellQuote(`sine=frequency=330:duration=${duration}`)}`,
      `-filter_complex ${shellQuote(`[0:a]volume=0.22[a0];[1:a]volume=0.12[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2[aout]`)}`,
      '-map [aout]',
      '-c:a pcm_s16le',
      shellQuote(fallbackPath),
    ].join(' ');
    await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    return fallbackPath;
  } catch (error) {
    console.warn('Fallback music generation failed.', error);
    return undefined;
  }
}

function getSceneVisualPrompt(scene: RenderScene, index: number): string {
  const parts = [scene.title, scene.description, scene.imagePrompt, scene.affirmation]
    .map(part => part?.trim())
    .filter(Boolean) as string[];

  const lead = parts[0] || `Scene ${index + 1}`;
  const support = parts.slice(1).join(' | ');
  return support ? `${lead}. ${support}` : lead;
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
  narrationTracks?: Array<{ path: string; start: number; duration: number; repeat?: boolean }>;
  musicPath?: string;
  musicAsset: { volume: number; fadeIn: number; fadeOut: number; trackId: string };
  totalDuration: number;
}): Promise<string> {
  const { outputFile, tempDir, narrationTracks = [], musicPath, musicAsset, totalDuration } = params;
  if (!narrationTracks.length && !musicPath) return outputFile;

  const finalVideoFile = path.join(tempDir, 'output-final.mp4');
  const inputs: string[] = [];
  narrationTracks.forEach(track => {
    const input = track.repeat ? `-stream_loop -1 -i ${shellQuote(track.path)}` : `-i ${shellQuote(track.path)}`;
    inputs.push(input);
  });
  if (musicPath) inputs.push(`-stream_loop -1 -i ${shellQuote(musicPath)}`);

  const filters: string[] = [];
  const audioMixInputs: string[] = [];

  const narrationInputOffset = 1; // input #0 is the silent scene video; narration starts at input #1
  narrationTracks.forEach((track, index) => {
    const label = `narr${index}`;
    const inputIndex = narrationInputOffset + index;
    const trimEnd = Math.min(track.duration, totalDuration);
    filters.push(`[${inputIndex}:a]atrim=0:${trimEnd.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${Math.round(track.start * 1000)}|${Math.round(track.start * 1000)}[${label}]`);
    audioMixInputs.push(`[${label}]`);
  });

  const musicInputIndex = narrationInputOffset + narrationTracks.length;
  if (musicPath) {
    const fadeOutStart = Math.max(0.1, totalDuration - musicAsset.fadeOut);
    filters.push(`[${musicInputIndex}:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${musicAsset.volume},afade=t=in:st=0:d=${musicAsset.fadeIn},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${musicAsset.fadeOut}[music]`);
    audioMixInputs.push('[music]');
  }

  if (audioMixInputs.length === 1) {
    filters.push(`${audioMixInputs[0]}anull[aout]`);
  } else {
    filters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:duration=longest:dropout_transition=2[aout]`);
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
    const mixParts = [];
    if (narrationTracks.length) mixParts.push(`${narrationTracks.length} scene narration track${narrationTracks.length === 1 ? '' : 's'}`);
    if (musicPath) mixParts.push('music');
    console.log(`Adding ${mixParts.join(' + ')} audio...`);
    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
    return finalVideoFile;
  } catch (audioError) {
    console.warn('Audio mix failed; returning silent video.', audioError);
    return outputFile;
  }
}

async function buildSceneNarrationTracks(scenes: RenderScene[], tempDir: string): Promise<Array<{ path: string; start: number; duration: number }> | undefined> {
  const tracks: Array<{ path: string; start: number; duration: number; repeat: boolean; sourceType: 'recorded' | 'tts' }> = [];
  let start = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const affirmation = scene.affirmation.trim();
    if (!affirmation) {
      start += scene.duration;
      continue;
    }

    try {
      const narration = await resolveNarrationSource(scene, tempDir, i, affirmation);
      if (!narration) {
        start += scene.duration;
        continue;
      }

      const duration = scene.duration;
      const repeat = narration.sourceType === 'tts' || narration.sourceType === 'recorded';

      tracks.push({ path: narration.path, start, duration, repeat, sourceType: narration.sourceType });
    } catch (error) {
      console.warn(`Scene narration failed for scene ${i + 1}; continuing without it.`, error);
    }

    start += scene.duration;
  }

  return tracks.length ? tracks : undefined;
}

async function resolveNarrationSource(scene: RenderScene, tempDir: string, sceneIndex: number, affirmation: string): Promise<{ path: string; sourceType: 'recorded' | 'tts' } | undefined> {
  const recordingPath = await writeNarrationRecording(tempDir, sceneIndex, scene.narrationAudioDataUrl, scene.narrationMimeType);
  if (recordingPath) return { path: recordingPath, sourceType: 'recorded' };
  if (!openaiClient) return undefined;
  const synthesizedPath = await synthesizeAffirmationClip(tempDir, sceneIndex, affirmation);
  return { path: synthesizedPath, sourceType: 'tts' };
}

async function writeNarrationRecording(tempDir: string, sceneIndex: number, dataUrl?: string, mimeType?: string): Promise<string | undefined> {
  if (!dataUrl) return undefined;
  const prefix = 'base64,';
  const base64Index = dataUrl.indexOf(prefix);
  if (!dataUrl.startsWith('data:') || base64Index === -1) return undefined;
  const meta = dataUrl.slice(5, base64Index - 1);
  const payload = dataUrl.slice(base64Index + prefix.length);
  const detectedMimeType = meta || mimeType || 'audio/webm';
  const ext = mimeTypeToExtension(detectedMimeType);
  const outputPath = path.join(tempDir, `narration-${sceneIndex}${ext}`);
  await fs.writeFile(outputPath, Buffer.from(payload, 'base64'));
  return outputPath;
}

async function synthesizeAffirmationClip(tempDir: string, sceneIndex: number, affirmation: string): Promise<string> {
  const response: any = await (openaiClient as any).audio.speech.create({
    model: process.env.MINDRA_TTS_MODEL || 'tts-1',
    voice: process.env.MINDRA_TTS_VOICE || 'alloy',
    input: affirmation,
    format: 'mp3',
  });

  const narrationPath = path.join(tempDir, `narration-${sceneIndex}.mp3`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(narrationPath, buffer);
  return narrationPath;
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('ogg')) return '.ogg';
  return '.webm';
}

async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const cmd = [
    'ffprobe -v error',
    `-show_entries format=duration`,
    '-of default=noprint_wrappers=1:nokey=1',
    shellQuote(filePath),
  ].join(' ');

  const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  const duration = Number.parseFloat(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid media duration for ${filePath}`);
  }
  return duration;
}
