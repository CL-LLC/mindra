// Pair Playback Strategy for Mind Movie affirmations
// Implements JC's product rule: 2 affirmations per session, consecutive repeats, pair rotation

export interface PairPlaybackScene {
  affirmation: string;
  startTime: number;
  endTime: number;
  position: 'bottom'; // Fixed to bottom subtitle-style overlay
}

export interface PairPlaybackManifest {
  version: 2; // New version for pair-playback
  scenes: PairPlaybackScene[];
  totalDuration: number;
  pairIndex: number; // Which pair is currently active (for debugging/transparency)
  affirmations: [string, string]; // The two affirmations being used
}

/**
 * Get day-of-year for deterministic pair rotation
 * This provides variety across sessions without requiring persistence
 */
export function getDayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Select a pair of affirmations based on rotation strategy
 * Uses day-of-year for deterministic rotation without persistence
 */
export function selectAffirmationPair(
  affirmations: string[],
  rotationIndex?: number
): { pair: [string, string]; pairIndex: number } {
  if (affirmations.length === 0) {
    throw new Error('No affirmations available');
  }
  
  if (affirmations.length === 1) {
    // Edge case: only one affirmation, use it for both
    return { pair: [affirmations[0], affirmations[0]], pairIndex: 0 };
  }
  
  // Use provided rotation index or calculate from day-of-year
  const index = rotationIndex ?? getDayOfYear();
  
  // Calculate which pair to use
  // For n affirmations, we can make n-1 consecutive pairs
  // Then we cycle through them
  const maxPairs = affirmations.length - 1;
  const pairIndex = index % maxPairs;
  
  const firstAffirmation = affirmations[pairIndex];
  const secondAffirmation = affirmations[pairIndex + 1];
  
  if (!firstAffirmation || !secondAffirmation) {
    // Fallback: use first two affirmations
    return { pair: [affirmations[0], affirmations[1]], pairIndex: 0 };
  }
  
  return { pair: [firstAffirmation, secondAffirmation], pairIndex };
}

/**
 * Generate pair-playback manifest with consecutive repeats
 * 
 * Strategy:
 * - Divide video into two halves
 * - First half: Affirmation A repeats with gaps
 * - Second half: Affirmation B repeats with gaps
 * - Gap between repeats: ~2 seconds of no text
 * - Each affirmation display: ~8 seconds
 */
export function generatePairPlaybackManifest(
  affirmations: string[],
  totalDuration: number,
  rotationIndex?: number
): PairPlaybackManifest {
  const { pair, pairIndex } = selectAffirmationPair(affirmations, rotationIndex);
  const [affirmationA, affirmationB] = pair;
  
  const scenes: PairPlaybackScene[] = [];
  
  // Configuration
  const DISPLAY_DURATION = 8; // seconds per affirmation display
  const GAP_DURATION = 2; // seconds between repeats
  const CYCLE_DURATION = DISPLAY_DURATION + GAP_DURATION;
  
  // Divide timeline in half
  const midpoint = totalDuration / 2;
  
  // First half: Affirmation A repeats
  let currentTime = 0;
  while (currentTime + DISPLAY_DURATION <= midpoint) {
    scenes.push({
      affirmation: affirmationA,
      startTime: currentTime,
      endTime: currentTime + DISPLAY_DURATION,
      position: 'bottom',
    });
    currentTime += CYCLE_DURATION;
  }
  
  // Second half: Affirmation B repeats
  currentTime = midpoint;
  while (currentTime + DISPLAY_DURATION <= totalDuration) {
    scenes.push({
      affirmation: affirmationB,
      startTime: currentTime,
      endTime: currentTime + DISPLAY_DURATION,
      position: 'bottom',
    });
    currentTime += CYCLE_DURATION;
  }
  
  return {
    version: 2,
    scenes,
    totalDuration,
    pairIndex,
    affirmations: pair,
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
