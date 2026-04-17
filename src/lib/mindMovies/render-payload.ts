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
  const recordingsByIndex = new Map(
    (Array.isArray(movie.voiceRecordings) ? movie.voiceRecordings : []).map((r) => [
      r.affirmationIndex,
      r,
    ])
  );
  return normalizedStoryboard.map((scene: any, index: number) => {
    const recording = recordingsByIndex.get(index);
    return {
      affirmation: movie.affirmations?.[index] || scene.affirmation,
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
