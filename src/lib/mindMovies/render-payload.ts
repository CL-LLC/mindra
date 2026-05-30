import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';
import type { RenderScene } from '@/lib/video/render-executor';

type VoiceRecording = {
  affirmationIndex: number;
  audioDataUrl?: string;
  mimeType?: string;
  durationMs?: number;
};

/** User-uploaded emotional image metadata (stored in Convex storage, not base64). */
export type EmotionalImageMeta = {
  storageId: string;
  imageUrl: string;
  caption?: string;
  goalIndex?: number;
  sceneIndex?: number;
  usageMode: 'direct' | 'style_reference' | 'both';
};

/** Build scene list for ffmpeg (shared by local /api/render and remote worker payload). */
export function buildScenesForRender(movie: {
  storyboard: unknown;
  affirmations?: string[];
  voiceRecordings?: VoiceRecording[];
  language?: 'en' | 'es';
  /** Optional user-uploaded emotional images to overlay as scene backgrounds. */
  emotionalImages?: EmotionalImageMeta[];
}): RenderScene[] {
  const normalizedStoryboard = normalizeStoryboard(movie.storyboard);
  const sceneCount = normalizedStoryboard.length;
  const affirmations = Array.isArray(movie.affirmations) ? movie.affirmations.filter(Boolean) : [];
  const recordings = (Array.isArray(movie.voiceRecordings) ? movie.voiceRecordings : [])
    .filter((recording) => Boolean(recording.audioDataUrl))
    .sort((a, b) => a.affirmationIndex - b.affirmationIndex);

  // Filter emotional images that should be used as direct scene backgrounds.
  // Exact scene placements are reserved for that scene only; proportional images fill the remaining movie.
  const directImages = (Array.isArray(movie.emotionalImages) ? movie.emotionalImages : [])
    .filter((img) => img.usageMode === 'direct' || img.usageMode === 'both');
  const proportionalImages = directImages.filter((img) => img.sceneIndex === undefined);

  return normalizedStoryboard.map((scene: any, index: number) => {
    const affirmationIndex = proportionalIndex(index, sceneCount, affirmations.length);
    const recordingIndex = proportionalIndex(index, sceneCount, recordings.length);
    const recording = recordingIndex === undefined ? undefined : recordings[recordingIndex];

    // Resolve background image: emotional image takes priority when assigned
    let backgroundImageUrl = scene.imageUrl;

    // Check for a directly-assigned emotional image (by sceneIndex)
    const exactSceneImage = directImages.find((img) => img.sceneIndex === index);
    if (exactSceneImage?.imageUrl) {
      backgroundImageUrl = exactSceneImage.imageUrl;
    } else {
      // Fallback: proportional distribution across scenes for non-exact images
      const emotionalImageIndex = proportionalIndex(index, sceneCount, proportionalImages.length);
      if (emotionalImageIndex !== undefined) {
        const candidate = proportionalImages[emotionalImageIndex];
        if (candidate?.imageUrl) {
          backgroundImageUrl = candidate.imageUrl;
        }
      }
    }

    return {
      affirmation: affirmationIndex === undefined ? scene.affirmation : affirmations[affirmationIndex],
      duration: scene.duration,
      backgroundColor: scene.backgroundColor,
      backgroundImageUrl,
      imagePrompt: scene.imagePrompt,
      title: scene.title,
      description: scene.description,
      narrationAudioDataUrl: recording?.audioDataUrl,
      narrationMimeType: recording?.mimeType,
      narrationDurationMs: recording?.durationMs,
      language: movie.language,
    };
  });
}

function proportionalIndex(sceneIndex: number, sceneCount: number, itemCount: number): number | undefined {
  if (sceneCount <= 0 || itemCount <= 0) return undefined;
  return Math.min(itemCount - 1, Math.floor((sceneIndex * itemCount) / sceneCount));
}
