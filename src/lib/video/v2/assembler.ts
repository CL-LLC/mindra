/**
 * V1Assembler — Delegates to existing VideoComposer (FFmpeg concat + audio mix).
 */
import type { Assembler, AssembleParams } from './types';
import type { VideoComposer, NarrationTrack } from '../generators/types';

export class V1Assembler implements Assembler {
  constructor(
    private videoComposer: VideoComposer,
    private shellQuote: (v: string) => string,
  ) {}

  async assemble(params: AssembleParams): Promise<Buffer> {
    const {
      clips,
      narrationTracks,
      musicAsset,
      musicPath,
      tempDir,
      totalDurationSec,
      introPath,
      outroPath,
    } = params;

    // Build concat list — intro, scene clips, outro
    const concatParts: string[] = [];
    if (introPath) concatParts.push(introPath);
    for (const clip of clips) concatParts.push(clip.clipPath);
    if (outroPath) concatParts.push(outroPath);

    const silentVideo = await this.videoComposer.concatScenes({
      concatParts,
      tempDir,
    });

    // Convert V2 narration tracks to V1 shape (identical structure)
    const v1NarrationTracks: NarrationTrack[] = narrationTracks.map((t) => ({
      path: t.path,
      start: t.start,
      duration: t.duration,
      clipDuration: t.clipDuration,
      repeat: t.repeat,
      sourceType: t.sourceType,
    }));

    const finalPath = await this.videoComposer.mixAudio({
      outputFile: silentVideo,
      tempDir,
      narrationTracks: v1NarrationTracks,
      musicPath,
      musicAsset,
      totalDuration: totalDurationSec,
    });

    const { readFile } = await import('fs/promises');
    return readFile(finalPath);
  }
}
