/**
 * RenderContext — staged execution state for V1 rendering.
 *
 * Decomposes the monolithic renderVideo() into phases:
 *   1. prepare()  — temp dir, options resolution, music, narration
 *   2. renderScenes() — image generation, frame rendering, per-scene video
 *   3. compose()  — concatenation + audio mixing
 *   4. finalize() — buffer read + cleanup
 *
 * V1Pipeline delegates here. Future V2 contexts can swap individual stages.
 */

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

import type { RenderScene, RenderOptions } from "../render-executor";
import {
  DEFAULT_OPTIONS,
  getSceneVisualPrompt,
  resolveBackgroundImage,
  shellQuote,
} from "../render-executor";
import { getMusicAsset, resolveMusicAssetPath } from "../music-registry";
import { selectAffirmationPair } from "../pair-playback";
import {
  getKaleidoscopeConfig,
  resolveKaleidoscopeAssetPath,
  type KaleidoscopeConfig,
} from "../kaleidoscope-registry";
import { createVideoGenerators } from "../generators";
import type { NarrationTrack } from "../generators/types";
import OpenAI from "openai";

const execAsync = promisify(exec);
const PYTHON = process.env.PYTHON || "python3";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openaiClient = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;
const generators = createVideoGenerators({
  openaiClient,
  ttsModel: process.env.MINDRA_TTS_MODEL || "tts-1",
  ttsVoice: process.env.MINDRA_TTS_VOICE || "alloy",
  pythonCommand: PYTHON,
  shellQuote,
  fallbackRenderer: renderFallbackSceneImage,
});

/** Resolved options (all fields present). */
export interface ResolvedRenderOptions {
  width: number;
  height: number;
  fps: number;
  quality: "low" | "medium" | "high";
  musicTrack?: string;
  kaleidoscope?: Partial<KaleidoscopeConfig>;
}

export class RenderContext {
  // --- inputs ---
  readonly scenes: RenderScene[];
  readonly options: ResolvedRenderOptions;

  // --- derived state (populated in prepare) ---
  tempDir!: string;
  kaleidoscopeConfig!: KaleidoscopeConfig;
  musicPath?: string;
  narrationTracks?: NarrationTrack[];

  // --- staged outputs ---
  sceneFiles: string[] = [];
  introFile?: string;
  outroFile?: string;
  composedFile?: string;
  totalDuration = 0;
  introDuration = 0;
  mainDuration = 0;

  constructor(scenes: RenderScene[], options?: RenderOptions) {
    this.scenes = scenes;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    } as ResolvedRenderOptions;
  }

  /** Phase 1: resolve all prerequisites. */
  async prepare(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mindra-render-"));
    this.kaleidoscopeConfig = getKaleidoscopeConfig(this.options.kaleidoscope);

    const musicAsset = getMusicAsset(
      this.options.musicTrack,
      this.scenes.length
    );
    this.musicPath =
      (await resolveMusicAssetPath(musicAsset)) ||
      (await ensureFallbackMusicAsset(
        this.tempDir,
        musicAsset,
        this.scenes.length
      ));

    this.narrationTracks = await buildSceneNarrationTracks(
      this.scenes,
      this.tempDir
    );
  }

  /** Phase 2: render each scene frame → per-scene video clip. */
  async renderScenes(): Promise<void> {
    // Kaleidoscope intro/outro
    if (this.kaleidoscopeConfig.enabled) {
      this.introFile = await ensureKaleidoscopeClip({
        type: "intro",
        config: this.kaleidoscopeConfig,
        tempDir: this.tempDir,
        width: this.options.width,
        height: this.options.height,
        fps: this.options.fps,
        quality: this.options.quality,
      });
      this.outroFile = await ensureKaleidoscopeClip({
        type: "outro",
        config: this.kaleidoscopeConfig,
        tempDir: this.tempDir,
        width: this.options.width,
        height: this.options.height,
        fps: this.options.fps,
        quality: this.options.quality,
      });
    }

    for (let i = 0; i < this.scenes.length; i++) {
      const scene = this.scenes[i];
      const sceneFile = path.join(this.tempDir, `scene-${i}.mp4`);
      const frameFile = path.join(this.tempDir, `scene-${i}.png`);
      const bgColor = scene.backgroundColor || getRandomGradientColor();
      const fontSize = Math.floor(this.options.height * 0.06);
      const maxTextWidth = Math.floor(this.options.width * 0.76);

      const generatedImagePath = await ensureSceneImageAsset({
        scene,
        tempDir: this.tempDir,
        index: i,
        width: this.options.width,
        height: this.options.height,
      });

      await generators.sceneRenderer.renderFrame(frameFile, {
        text: "",
        backgroundColor: bgColor,
        backgroundImagePath: generatedImagePath,
        width: this.options.width,
        height: this.options.height,
        fontSize,
        maxTextWidth,
      });

      const cmd = [
        "ffmpeg -y",
        `-loop 1 -t ${scene.duration} -i ${shellQuote(frameFile)}`,
        `-r ${this.options.fps}`,
        `-c:v libx264 -preset ${this.options.quality === "high" ? "slow" : this.options.quality === "low" ? "ultrafast" : "medium"}`,
        "-pix_fmt yuv420p",
        shellQuote(sceneFile),
      ].join(" ");

      console.log(`Rendering scene ${i + 1}/${this.scenes.length}...`);
      await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
      this.sceneFiles.push(sceneFile);
    }

    this.mainDuration = this.scenes.reduce(
      (sum, s) => sum + s.duration,
      0
    );
    this.introDuration = this.introFile
      ? this.kaleidoscopeConfig.introDuration
      : 0;
    const outroDuration = this.outroFile
      ? this.kaleidoscopeConfig.outroDuration
      : 0;
    this.totalDuration =
      this.introDuration + this.mainDuration + outroDuration;
  }

  /** Phase 3: concatenate scenes and mix audio. */
  async compose(): Promise<void> {
    const concatParts: string[] = [];
    if (this.introFile) concatParts.push(this.introFile);
    concatParts.push(...this.sceneFiles);
    if (this.outroFile) concatParts.push(this.outroFile);

    this.composedFile = await generators.videoComposer.concatScenes({
      concatParts,
      tempDir: this.tempDir,
    });
  }

  /** Phase 4: mix audio, read final buffer, cleanup temp dir. */
  async finalize(): Promise<Buffer> {
    if (!this.composedFile) throw new Error("compose() not run");

    const musicAsset = getMusicAsset(
      this.options.musicTrack,
      this.scenes.length
    );

    const finalVideoFile = await generators.videoComposer.mixAudio({
      outputFile: this.composedFile,
      tempDir: this.tempDir,
      narrationTracks: this.narrationTracks,
      musicPath: this.musicPath,
      musicAsset,
      totalDuration: this.totalDuration,
      introDuration: this.introDuration,
      mainDuration: this.mainDuration,
    });

    const videoBuffer = await fs.readFile(finalVideoFile);
    console.log(
      `Render complete: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`
    );
    return videoBuffer;
  }

  /** Cleanup temp dir (safe to call multiple times). */
  async cleanup(): Promise<void> {
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to cleanup temp dir:", e);
      }
    }
  }

  /** Run all phases in order (convenience for V1Pipeline). */
  async run(): Promise<Buffer> {
    try {
      await this.prepare();
      await this.renderScenes();
      await this.compose();
      return await this.finalize();
    } finally {
      await this.cleanup();
    }
  }
}

// ---------------------------------------------------------------------------
// Helper functions — extracted from render-executor.ts (unchanged logic)
// ---------------------------------------------------------------------------

function getRandomGradientColor(): string {
  const colors = [
    "#1e1b4b", "#312e81", "#3730a3", "#4c1d95",
    "#5b21b6", "#6d28d9", "#7c3aed",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function ensureKaleidoscopeClip(params: {
  type: "intro" | "outro";
  config: KaleidoscopeConfig;
  tempDir: string;
  width: number;
  height: number;
  fps: number;
  quality: "low" | "medium" | "high";
}): Promise<string | undefined> {
  const { type, config, tempDir, width, height, fps, quality } = params;
  const asset = type === "intro" ? config.intro : config.outro;
  const duration = type === "intro" ? config.introDuration : config.outroDuration;

  const stockPath = await resolveKaleidoscopeAssetPath(asset);
  if (stockPath) {
    console.log(`Using stock kaleidoscope ${type}: ${stockPath}`);
    const outputClip = path.join(tempDir, `kaleidoscope-${type}.mp4`);
    const cmd = [
      "ffmpeg -y",
      `-i ${shellQuote(stockPath)}`,
      `-t ${duration}`,
      `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      `-r ${fps}`,
      `-c:v libx264 -preset ${quality === "high" ? "slow" : quality === "low" ? "ultrafast" : "medium"}`,
      "-an",
      "-pix_fmt yuv420p",
      shellQuote(outputClip),
    ].join(" ");
    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
    return outputClip;
  }

  console.log(`Generating synthetic kaleidoscope ${type} (${duration}s)...`);
  return generateSyntheticKaleidoscopeClip({ type, duration, tempDir, width, height, fps, quality });
}

async function generateSyntheticKaleidoscopeClip(params: {
  type: "intro" | "outro";
  duration: number;
  tempDir: string;
  width: number;
  height: number;
  fps: number;
  quality: "low" | "medium" | "high";
}): Promise<string> {
  const { type, duration, tempDir, width, height, fps, quality } = params;
  const outputClip = path.join(tempDir, `kaleidoscope-${type}.mp4`);
  const kaleidoscopeFilter = `geq=r='128+100*sin(N/180+X/40+Y/40)+50*cos(N/120-X/30)':g='128+100*cos(N/150+X/35+Y/45)+50*sin(N/210-Y/35)':b='128+80*sin(N/240+X/50-Y/30)+40*cos(N/180+X/45+Y/35)'`;
  const cmd = [
    "ffmpeg -y",
    `-f lavfi -i color=c=0x1e1b4b:s=${width}x${height}:d=${duration}:r=${fps}`,
    `-vf "${kaleidoscopeFilter}"`,
    `-t ${duration}`,
    `-c:v libx264 -preset ${quality === "high" ? "slow" : quality === "low" ? "ultrafast" : "medium"}`,
    "-an",
    "-pix_fmt yuv420p",
    shellQuote(outputClip),
  ].join(" ");
  console.log(`Generating synthetic kaleidoscope ${type}...`);
  await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
  return outputClip;
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
  return generators.imageGenerator.generate({
    prompt: getSceneVisualPrompt(scene, index),
    tempDir,
    index,
    width,
    height,
  });
}

async function renderFallbackSceneImage(
  outputPath: string,
  prompt: string,
  width: number,
  height: number
): Promise<void> {
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
  const scriptPath = path.join(path.dirname(outputPath), "fallback-scene.py");
  await fs.writeFile(scriptPath, script);
  await execAsync(
    `${shellQuote(PYTHON)} ${shellQuote(scriptPath)} ${shellQuote(outputPath)} ${shellQuote(prompt)} ${shellQuote(String(width))} ${shellQuote(String(height))}`,
    { maxBuffer: 10 * 1024 * 1024 }
  );
}

async function ensureFallbackMusicAsset(
  tempDir: string,
  musicAsset: { trackId: string; volume: number; fadeIn: number; fadeOut: number },
  sceneCount: number
): Promise<string | undefined> {
  const fallbackPath = path.join(
    tempDir,
    `${musicAsset.trackId || "mindra-fallback"}-${sceneCount}.wav`
  );
  try {
    const duration = Math.max(8, sceneCount * 10);
    const cmd = [
      "ffmpeg -y",
      `-f lavfi -i ${shellQuote(`sine=frequency=220:duration=${duration}`)}`,
      `-f lavfi -i ${shellQuote(`sine=frequency=330:duration=${duration}`)}`,
      `-filter_complex ${shellQuote(`[0:a]volume=0.22[a0];[1:a]volume=0.12[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2[aout]`)}`,
      "-map [aout]",
      "-c:a pcm_s16le",
      shellQuote(fallbackPath),
    ].join(" ");
    await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    return fallbackPath;
  } catch (error) {
    console.warn("Fallback music generation failed.", error);
    return undefined;
  }
}

async function buildSceneNarrationTracks(
  scenes: RenderScene[],
  tempDir: string
): Promise<NarrationTrack[] | undefined> {
  const affirmations = [
    ...new Set(scenes.map((s) => s.affirmation.trim()).filter(Boolean)),
  ];
  if (affirmations.length === 0) return undefined;

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  if (totalDuration <= 0) return undefined;

  const { pair } = selectAffirmationPair(affirmations);
  const [affirmationA, affirmationB] = pair;

  const DISPLAY_DURATION = 8;
  const GAP_DURATION = 2;
  const CYCLE_DURATION = DISPLAY_DURATION + GAP_DURATION;
  const midpoint = totalDuration / 2;

  const affirmationToScene = new Map<string, RenderScene>();
  for (const scene of scenes) {
    const text = scene.affirmation.trim();
    if (text && !affirmationToScene.has(text)) {
      affirmationToScene.set(text, scene);
    }
  }

  const tracks: NarrationTrack[] = [];

  const sourceA = affirmationToScene.get(affirmationA);
  const sourceB = affirmationToScene.get(affirmationB);

  let audioPathA: string | undefined;
  let audioPathB: string | undefined;
  let sourceTypeA: "recorded" | "tts" = "tts";
  let sourceTypeB: "recorded" | "tts" = "tts";
  let clipDurationA = 0;
  let clipDurationB = 0;

  if (sourceA) {
    const narration = await resolveNarrationSource(
      sourceA,
      tempDir,
      0,
      affirmationA
    );
    if (narration) {
      audioPathA = narration.path;
      sourceTypeA = narration.sourceType;
      clipDurationA = await getMediaDurationSeconds(audioPathA);
    }
  }

  if (affirmationB !== affirmationA && sourceB) {
    const narration = await resolveNarrationSource(
      sourceB,
      tempDir,
      1,
      affirmationB
    );
    if (narration) {
      audioPathB = narration.path;
      sourceTypeB = narration.sourceType;
      clipDurationB = await getMediaDurationSeconds(audioPathB);
    }
  } else if (affirmationB === affirmationA) {
    audioPathB = audioPathA;
    sourceTypeB = sourceTypeA;
    clipDurationB = clipDurationA;
  }

  if (audioPathA && clipDurationA > 0) {
    let currentTime = 0;
    while (currentTime + DISPLAY_DURATION <= midpoint) {
      tracks.push({
        path: audioPathA,
        start: currentTime,
        duration: DISPLAY_DURATION,
        clipDuration: clipDurationA,
        repeat: false,
        sourceType: sourceTypeA,
      });
      currentTime += CYCLE_DURATION;
    }
  }

  if (audioPathB && clipDurationB > 0) {
    let currentTime = midpoint;
    while (currentTime + DISPLAY_DURATION <= totalDuration) {
      tracks.push({
        path: audioPathB,
        start: currentTime,
        duration: DISPLAY_DURATION,
        clipDuration: clipDurationB,
        repeat: false,
        sourceType: sourceTypeB,
      });
      currentTime += CYCLE_DURATION;
    }
  }

  return tracks.length ? tracks : undefined;
}

async function resolveNarrationSource(
  scene: RenderScene,
  tempDir: string,
  sceneIndex: number,
  affirmation: string
): Promise<{ path: string; sourceType: "recorded" | "tts" } | undefined> {
  const recordingPath = await writeNarrationRecording(
    tempDir,
    sceneIndex,
    scene.narrationAudioDataUrl,
    scene.narrationMimeType
  );
  if (recordingPath) return { path: recordingPath, sourceType: "recorded" };
  if (!openaiClient) return undefined;
  const synthesizedPath = await generators.audioGenerator?.synthesize(
    tempDir,
    sceneIndex,
    affirmation
  );
  if (!synthesizedPath) return undefined;
  return { path: synthesizedPath, sourceType: "tts" };
}

async function writeNarrationRecording(
  tempDir: string,
  sceneIndex: number,
  dataUrl?: string,
  mimeType?: string
): Promise<string | undefined> {
  if (!dataUrl) return undefined;
  const prefix = "base64,";
  const base64Index = dataUrl.indexOf(prefix);
  if (!dataUrl.startsWith("data:") || base64Index === -1) return undefined;
  const meta = dataUrl.slice(5, base64Index - 1);
  const payload = dataUrl.slice(base64Index + prefix.length);
  const detectedMimeType = meta || mimeType || "audio/webm";
  const ext = mimeTypeToExtension(detectedMimeType);
  const outputPath = path.join(tempDir, `narration-${sceneIndex}${ext}`);
  await fs.writeFile(outputPath, Buffer.from(payload, "base64"));
  return outputPath;
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  if (mimeType.includes("ogg")) return ".ogg";
  return ".webm";
}

async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const cmd = [
    "ffprobe -v error",
    `-show_entries format=duration`,
    "-of default=noprint_wrappers=1:nokey=1",
    shellQuote(filePath),
  ].join(" ");
  const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  const duration = Number.parseFloat(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid media duration for ${filePath}`);
  }
  return duration;
}
