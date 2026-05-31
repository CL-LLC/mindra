import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';
import type { RenderScene } from '@/lib/video/render-executor';
import { buildMindMovieScenePlan } from './scene-plan';

type VoiceRecording = {
  affirmationIndex: number;
  audioDataUrl?: string;
  audioUrl?: string;
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
    .filter((recording) => Boolean(recording.audioDataUrl || recording.audioUrl))
    .sort((a, b) => a.affirmationIndex - b.affirmationIndex);
  const recordingByAffirmationIndex = new Map(recordings.map((recording) => [recording.affirmationIndex, recording]));

  const scenePlan = buildMindMovieScenePlan({
    storyboard: movie.storyboard,
    affirmations,
    emotionalImages: movie.emotionalImages,
  });

  return normalizedStoryboard.map((scene: any, index: number) => {
    const planEntry = scenePlan[index];
    const affirmationIndex = planEntry?.affirmationIndex ?? proportionalIndex(index, sceneCount, affirmations.length);
    const recording = affirmationIndex === undefined ? undefined : recordingByAffirmationIndex.get(affirmationIndex);
    const backgroundImageUrl = planEntry?.visualSource === 'uploaded_direct'
      ? planEntry.backgroundImageUrl
      : undefined;

    return {
      affirmation: affirmationIndex === undefined ? scene.affirmation : affirmations[affirmationIndex],
      duration: scene.duration,
      backgroundColor: scene.backgroundColor,
      backgroundImageUrl,
      imagePrompt: scene.imagePrompt,
      title: scene.title,
      description: scene.description,
      narrationAudioDataUrl: recording?.audioDataUrl ?? recording?.audioUrl,
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
