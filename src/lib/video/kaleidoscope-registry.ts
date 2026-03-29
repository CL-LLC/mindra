// Kaleidoscope Intro/Outro Registry for Mindra
// Manages configurable kaleidoscope video assets for intro/outro clips

import fs from 'fs/promises';
import path from 'path';

export interface KaleidoscopeAsset {
  id: string;
  fileName: string;
  defaultDuration: number; // seconds
}

export interface KaleidoscopeConfig {
  enabled: boolean;
  intro: KaleidoscopeAsset;
  outro: KaleidoscopeAsset;
  introDuration: number; // seconds (overrides defaultDuration)
  outroDuration: number; // seconds (overrides defaultDuration)
}

// Default stock kaleidoscope assets for v1
// These are placeholder paths - actual stock assets should be placed in public/kaleidoscope/
const DEFAULT_INTRO: KaleidoscopeAsset = {
  id: 'kaleidoscope-intro-default',
  fileName: 'kaleidoscope-intro.mp4',
  defaultDuration: 15,
};

const DEFAULT_OUTRO: KaleidoscopeAsset = {
  id: 'kaleidoscope-outro-default',
  fileName: 'kaleidoscope-outro.mp4',
  defaultDuration: 15,
};

// Default configuration
export const DEFAULT_KALEIDOSCOPE_CONFIG: KaleidoscopeConfig = {
  enabled: true,
  intro: DEFAULT_INTRO,
  outro: DEFAULT_OUTRO,
  introDuration: 15,
  outroDuration: 15,
};

/**
 * Get kaleidoscope configuration with optional overrides
 */
export function getKaleidoscopeConfig(overrides?: Partial<KaleidoscopeConfig>): KaleidoscopeConfig {
  if (!overrides) return DEFAULT_KALEIDOSCOPE_CONFIG;

  return {
    enabled: overrides.enabled ?? DEFAULT_KALEIDOSCOPE_CONFIG.enabled,
    intro: overrides.intro ?? DEFAULT_KALEIDOSCOPE_CONFIG.intro,
    outro: overrides.outro ?? DEFAULT_KALEIDOSCOPE_CONFIG.outro,
    introDuration: overrides.introDuration ?? DEFAULT_KALEIDOSCOPE_CONFIG.introDuration,
    outroDuration: overrides.outroDuration ?? DEFAULT_KALEIDOSCOPE_CONFIG.outroDuration,
  };
}

/**
 * Resolve the full path to a kaleidoscope asset
 * Checks multiple locations: public/kaleidoscope, public/assets, assets
 */
export async function resolveKaleidoscopeAssetPath(asset: KaleidoscopeAsset): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'kaleidoscope', asset.fileName),
    path.join(process.cwd(), 'public', 'assets', 'kaleidoscope', asset.fileName),
    path.join(process.cwd(), 'assets', 'kaleidoscope', asset.fileName),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  return null;
}

/**
 * Check if kaleidoscope assets are available
 */
export async function areKaleidoscopeAssetsAvailable(config: KaleidoscopeConfig): Promise<boolean> {
  const introPath = await resolveKaleidoscopeAssetPath(config.intro);
  const outroPath = await resolveKaleidoscopeAssetPath(config.outro);
  return introPath !== null && outroPath !== null;
}
