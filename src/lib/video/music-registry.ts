import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export type MusicMood = 'uplift' | 'focus' | 'calm';

export type MusicAsset = {
  mood: MusicMood;
  trackId: string;
  fileName: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
};

const MUSIC_REGISTRY: Record<MusicMood, MusicAsset> = {
  uplift: {
    mood: 'uplift',
    trackId: 'mindra-bg-loop',
    fileName: 'mindra-bg-loop.mp3',
    volume: 0.18,
    fadeIn: 1.5,
    fadeOut: 2.5,
  },
  focus: {
    mood: 'focus',
    trackId: 'mindra-bg-loop',
    fileName: 'mindra-bg-loop.mp3',
    volume: 0.18,
    fadeIn: 1.5,
    fadeOut: 2.5,
  },
  calm: {
    mood: 'calm',
    trackId: 'mindra-bg-loop',
    fileName: 'mindra-bg-loop.mp3',
    volume: 0.18,
    fadeIn: 1.5,
    fadeOut: 2.5,
  },
};

export function resolveMusicMood(trackId?: string, sceneCount = 0): MusicMood {
  if (!trackId) return sceneCount >= 4 ? 'uplift' : 'calm';
  if (trackId.includes('focus') || trackId.includes('vision')) return 'focus';
  if (trackId.includes('uplift') || trackId.includes('drive')) return 'uplift';
  return 'calm';
}

export function getMusicAsset(trackId?: string, sceneCount = 0): MusicAsset {
  const mood = resolveMusicMood(trackId, sceneCount);
  return MUSIC_REGISTRY[mood];
}

export async function resolveMusicAssetPath(asset: MusicAsset): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'audio', asset.fileName),
    path.join(process.cwd(), 'public', 'music', asset.fileName),
    path.join(os.tmpdir(), asset.fileName),
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
