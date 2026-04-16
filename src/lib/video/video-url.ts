/**
 * Playback URLs: production uses absolute https (e.g. R2). Legacy local renders used `/api/videos/...`.
 */

export function isLegacyRelativeVideoUrl(videoUrl: string | undefined | null): boolean {
  if (!videoUrl) return false;
  return !videoUrl.startsWith('http://') && !videoUrl.startsWith('https://');
}

/** Client-only: relative video URLs only work on same-origin local dev. */
export function canPlayVideoUrlClient(videoUrl: string | undefined | null): boolean {
  if (!videoUrl) return false;
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) return true;
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}
