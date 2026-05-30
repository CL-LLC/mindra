#!/usr/bin/env npx tsx

import assert from 'assert';
import { exec as execCb } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { promisify } from 'util';
import { FFmpegComposer } from '../generators/ffmpeg-composer';
import { shellQuote } from '../render-executor';
import type { NarrationTrack } from '../generators/types';

const execAsync = promisify(execCb);

async function dominantFrequency(filePath: string): Promise<number> {
  const script = String.raw`
import sys, wave
import numpy as np
p = sys.argv[1]
w = wave.open(p, 'rb')
sr = w.getframerate()
data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)
start = int(sr * 0.25)
x = data[start:]
if len(x) == 0 or np.max(np.abs(x)) < 1:
    print(0)
    raise SystemExit
window = np.hanning(len(x))
spec = np.abs(np.fft.rfft(x * window))
freqs = np.fft.rfftfreq(len(x), 1 / sr)
print(float(freqs[int(np.argmax(spec))]))
`;
  const { stdout } = await execAsync(`python3 -c ${shellQuote(script)} ${shellQuote(filePath)}`);
  return Number.parseFloat(stdout.trim());
}

async function testComposerPreservesFiveSceneNarrations() {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'mindra-ffmpeg-composer-test-'));
  try {
    const totalDuration = 50;
    const videoPath = path.join(tempDir, 'silent.mp4');
    await execAsync(
      [
        'ffmpeg -y',
        `-f lavfi -i ${shellQuote(`color=c=black:s=320x180:d=${totalDuration}:r=10`)}`,
        '-c:v libx264 -pix_fmt yuv420p',
        shellQuote(videoPath),
      ].join(' ')
    );

    const expectedFrequencies = [400, 600, 800, 1000, 1200];
    const narrationTracks: NarrationTrack[] = [];

    for (let index = 0; index < expectedFrequencies.length; index++) {
      const audioPath = path.join(tempDir, `narration-${index}.wav`);
      await execAsync(
        [
          'ffmpeg -y',
          `-f lavfi -i ${shellQuote(`sine=frequency=${expectedFrequencies[index]}:duration=2`)}`,
          '-c:a pcm_s16le',
          shellQuote(audioPath),
        ].join(' ')
      );
      narrationTracks.push({
        path: audioPath,
        start: index * 10,
        duration: 10,
        clipDuration: 2,
        repeat: false,
        sourceType: 'recorded',
      });
    }

    const composer = new FFmpegComposer(shellQuote);
    const finalVideo = await composer.mixAudio({
      outputFile: videoPath,
      tempDir,
      narrationTracks,
      musicAsset: { trackId: 'none', volume: 0.1, fadeIn: 1, fadeOut: 1 },
      totalDuration,
      introDuration: 0,
      mainDuration: totalDuration,
    });

    for (let index = 0; index < expectedFrequencies.length; index++) {
      const segmentPath = path.join(tempDir, `segment-${index}.wav`);
      await execAsync(
        [
          'ffmpeg -y',
          `-ss ${index * 10}`,
          '-t 3',
          `-i ${shellQuote(finalVideo)}`,
          '-vn -ac 1 -ar 16000',
          shellQuote(segmentPath),
        ].join(' ')
      );
      const frequency = await dominantFrequency(segmentPath);
      assert(
        Math.abs(frequency - expectedFrequencies[index]) < 8,
        `segment ${index} should preserve narration tone ${expectedFrequencies[index]}Hz, got ${frequency}Hz`
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  await testComposerPreservesFiveSceneNarrations();
  console.log('✅ ffmpeg-composer narration tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
