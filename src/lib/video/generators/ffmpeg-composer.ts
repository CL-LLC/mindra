import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { NarrationTrack, VideoComposer } from './types';

const execAsync = promisify(exec);

export class FFmpegComposer implements VideoComposer {
  constructor(private readonly shellQuote: (value: string) => string) {}

  async concatScenes(params: { concatParts: string[]; tempDir: string }): Promise<string> {
    const { concatParts, tempDir } = params;
    const concatFile = path.join(tempDir, 'concat.txt');
    const concatContent = concatParts.map((file) => `file '${file}'`).join('\n');
    await fs.writeFile(concatFile, concatContent);

    const outputFile = path.join(tempDir, 'output-no-audio.mp4');
    const concatCmd = [
      'ffmpeg -y',
      `-f concat -safe 0 -i ${this.shellQuote(concatFile)}`,
      '-c copy',
      this.shellQuote(outputFile),
    ].join(' ');

    console.log('Concatenating scenes...');
    await execAsync(concatCmd, { maxBuffer: 20 * 1024 * 1024 });
    return outputFile;
  }

  async mixAudio(params: {
    outputFile: string;
    tempDir: string;
    narrationTracks?: NarrationTrack[];
    musicPath?: string;
    musicAsset: { volume: number; fadeIn: number; fadeOut: number; trackId: string };
    totalDuration: number;
    introDuration?: number;
    mainDuration?: number;
  }): Promise<string> {
    const { outputFile, tempDir, narrationTracks = [], musicPath, musicAsset, totalDuration, introDuration = 0, mainDuration = totalDuration } = params;
    if (!narrationTracks.length && !musicPath) return outputFile;

    const finalVideoFile = path.join(tempDir, 'output-final.mp4');
    const inputs: string[] = [];
    narrationTracks.forEach((track) => {
      const input = track.repeat ? `-stream_loop -1 -i ${this.shellQuote(track.path)}` : `-i ${this.shellQuote(track.path)}`;
      inputs.push(input);
    });
    if (musicPath) inputs.push(`-stream_loop -1 -i ${this.shellQuote(musicPath)}`);

    const filters: string[] = [];
    const audioMixInputs: string[] = [];
    const narrationInputOffset = 1;

    narrationTracks.forEach((track, index) => {
      const label = `narr${index}`;
      const inputIndex = narrationInputOffset + index;
      const usableDuration = track.repeat && track.clipDuration > 0
        ? Math.max(track.clipDuration, Math.floor(track.duration / track.clipDuration) * track.clipDuration)
        : Math.min(track.duration, mainDuration);
      const voiceGain = track.repeat ? 2.6 : 2.1;
      const adjustedStart = Math.round((introDuration + track.start) * 1000);
      filters.push(`[${inputIndex}:a]atrim=0:${usableDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${voiceGain},alimiter=limit=0.92,adelay=${adjustedStart}|${adjustedStart}[${label}]`);
      audioMixInputs.push(`[${label}]`);
    });

    const musicInputIndex = narrationInputOffset + narrationTracks.length;
    if (musicPath) {
      const fadeOutStart = Math.max(0.1, totalDuration - musicAsset.fadeOut);
      const musicGain = Math.max(0.06, Math.min(musicAsset.volume, 0.14));
      filters.push(`[${musicInputIndex}:a]atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${musicGain},afade=t=in:st=0:d=${musicAsset.fadeIn},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${musicAsset.fadeOut}[music]`);
      audioMixInputs.push('[music]');
    }

    if (audioMixInputs.length === 1) {
      filters.push(`${audioMixInputs[0]}anull[aout]`);
    } else {
      filters.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:duration=longest:dropout_transition=0,alimiter=limit=0.96[aout]`);
    }

    const cmd = [
      'ffmpeg -y',
      `-i ${this.shellQuote(outputFile)}`,
      ...inputs,
      `-filter_complex ${this.shellQuote(filters.join(';'))}`,
      '-map 0:v',
      '-map [aout]',
      '-c:v copy',
      '-c:a aac -b:a 128k',
      '-movflags +faststart',
      this.shellQuote(finalVideoFile),
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
}
