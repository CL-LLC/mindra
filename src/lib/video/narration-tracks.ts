import type { NarrationTrack } from "./generators/types";

export interface NarrationAudioResolution {
  path: string;
  sourceType: "recorded" | "tts";
  clipDuration: number;
}

export interface NarrationTrackSourceOptions<TScene> {
  getDurationSec: (scene: TScene) => number;
  resolveAudio: (
    scene: TScene,
    index: number
  ) => Promise<NarrationAudioResolution | undefined>;
}

/**
 * Build narration tracks in scene order.
 *
 * This keeps narration aligned to each scene, preserves duplicate affirmations,
 * and prefers recorded audio while allowing TTS fallback when available.
 */
export async function buildNarrationTracks<TScene>(
  scenes: TScene[],
  options: NarrationTrackSourceOptions<TScene>
): Promise<NarrationTrack[] | undefined> {
  if (scenes.length === 0) return undefined;

  const tracks: NarrationTrack[] = [];
  let currentStart = 0;

  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    const durationSec = options.getDurationSec(scene);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      continue;
    }

    const audio = await options.resolveAudio(scene, index);
    if (!audio?.path) {
      currentStart += durationSec;
      continue;
    }

    tracks.push({
      path: audio.path,
      start: currentStart,
      duration: durationSec,
      clipDuration: audio.clipDuration > 0 ? audio.clipDuration : durationSec,
      repeat: false,
      sourceType: audio.sourceType,
    });

    currentStart += durationSec;
  }

  return tracks.length ? tracks : undefined;
}
