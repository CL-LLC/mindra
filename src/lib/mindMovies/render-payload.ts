import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';
import type { RenderScene } from '@/lib/video/render-executor';

type VoiceRecording = {
  affirmationIndex: number;
  audioDataUrl?: string;
  mimeType?: string;
  durationMs?: number;
};

/** Build scene list for ffmpeg (shared by local /api/render and remote worker payload). */
export function buildScenesForRender(movie: {
  storyboard: unknown;
  affirmations?: string[];
  voiceRecordings?: VoiceRecording[];
  language?: 'en' | 'es';
}): RenderScene[] {
  const normalizedStoryboard = normalizeStoryboard(movie.storyboard);
  const sceneCount = normalizedStoryboard.length;
  const affirmations = Array.isArray(movie.affirmations) ? movie.affirmations.filter(Boolean) : [];
  const recordings = (Array.isArray(movie.voiceRecordings) ? movie.voiceRecordings : [])
    .filter((recording) => Boolean(recording.audioDataUrl))
    .sort((a, b) => a.affirmationIndex - b.affirmationIndex);

  return normalizedStoryboard.map((scene: any, index: number) => {
    const affirmationIndex = proportionalIndex(index, sceneCount, affirmations.length);
    const recordingIndex = proportionalIndex(index, sceneCount, recordings.length);
    const recording = recordingIndex === undefined ? undefined : recordings[recordingIndex];
    return {
      affirmation: affirmationIndex === undefined ? scene.affirmation : affirmations[affirmationIndex],
      duration: scene.duration,
      backgroundColor: scene.backgroundColor,
      backgroundImageUrl: scene.imageUrl,
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
