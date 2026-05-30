// Affirmation playback overlay timing for Mind Movie affirmations
// Legacy filename retained; behavior now sequences all affirmations instead of collapsing to a two-item pair.

export interface PairPlaybackScene {
  affirmation: string;
  startTime: number;
  endTime: number;
  position: 'bottom'; // Fixed to bottom subtitle-style overlay
}

export interface PairPlaybackManifest {
  version: 2;
  scenes: PairPlaybackScene[];
  totalDuration: number;
  pairIndex: number; // Legacy field retained for compatibility; always 0 for all-affirmation sequencing
  affirmations: string[]; // All affirmations being used in the playback window
}

/**
 * Legacy compatibility helper. Prefer generatePairPlaybackManifest(), which now uses
 * every affirmation instead of rotating only a selected pair.
 */
export function selectAffirmationPair(
  affirmations: string[],
  rotationIndex?: number
): { pair: [string, string]; pairIndex: number } {
  if (affirmations.length === 0) {
    throw new Error('No affirmations available');
  }

  if (affirmations.length === 1) {
    return { pair: [affirmations[0], affirmations[0]], pairIndex: 0 };
  }

  const index = rotationIndex ?? 0;
  const maxPairs = affirmations.length - 1;
  const pairIndex = index % maxPairs;
  return { pair: [affirmations[pairIndex], affirmations[pairIndex + 1]], pairIndex };
}

/**
 * Generate an affirmation overlay manifest using all available affirmations.
 *
 * Strategy:
 * - NO affirmations during intro/outro
 * - Divide main content into one segment per affirmation
 * - Use every affirmation when there is main-content duration available
 */
export function generatePairPlaybackManifest(
  affirmations: string[],
  totalDuration: number,
  _rotationIndex?: number,
  introDuration: number = 15,
  outroDuration: number = 15
): PairPlaybackManifest {
  const cleanedAffirmations = affirmations.map((affirmation) => affirmation.trim()).filter(Boolean);
  if (cleanedAffirmations.length === 0) {
    throw new Error('No affirmations available');
  }

  const mainDuration = totalDuration - introDuration - outroDuration;
  if (mainDuration <= 0) {
    return {
      version: 2,
      scenes: [],
      totalDuration,
      pairIndex: 0,
      affirmations: cleanedAffirmations,
    };
  }

  const segmentDuration = mainDuration / cleanedAffirmations.length;
  const scenes: PairPlaybackScene[] = cleanedAffirmations.map((affirmation, index) => ({
    affirmation,
    startTime: introDuration + index * segmentDuration,
    endTime: index === cleanedAffirmations.length - 1
      ? totalDuration - outroDuration
      : introDuration + (index + 1) * segmentDuration,
    position: 'bottom',
  }));

  return {
    version: 2,
    scenes,
    totalDuration,
    pairIndex: 0,
    affirmations: cleanedAffirmations,
  };
}

/**
 * Find the active affirmation at a given time
 */
export function getActiveAffirmation(
  manifest: PairPlaybackManifest,
  currentTime: number
): string | null {
  const scene = manifest.scenes.find(
    (s) => currentTime >= s.startTime && currentTime < s.endTime
  );
  return scene?.affirmation ?? null;
}
