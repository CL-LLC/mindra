// Video Render API Route - Handles FFmpeg rendering
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { api } from '../../../../convex/_generated/api';
import { renderVideo } from '../../../lib/video/render-executor';
import { validateStoryboard } from '../../../lib/video/renderer';
import { normalizeStoryboard } from '../../../lib/mindmovie/storyboard';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST(request: NextRequest) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const convex = new ConvexHttpClient(convexUrl, { auth: token });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing mind movie ID' }, { status: 400 });

    const movie = await convex.query(api.mindMovies.getById, { id });
    if (!movie) return NextResponse.json({ error: 'Mind movie not found' }, { status: 404 });
    if (!movie.storyboard || movie.storyboard.length === 0) return NextResponse.json({ error: 'Mind movie has no storyboard' }, { status: 400 });

    const affirmations = Array.isArray(movie.affirmations) ? movie.affirmations : [];
    const voiceRecordings = Array.isArray(movie.voiceRecordings) ? movie.voiceRecordings : [];
    const recordedIndices = new Set(voiceRecordings.map((recording: any) => recording.affirmationIndex));
    const missing = affirmations.map((_, index) => index).filter((index) => !recordedIndices.has(index));
    if (affirmations.length > 0 && missing.length > 0) {
      return NextResponse.json({ error: `Record all affirmations before rendering. Missing ${missing.length} more.` }, { status: 400 });
    }

    const normalizedStoryboard = normalizeStoryboard(movie.storyboard);
    const storyboardValidation = validateStoryboard(normalizedStoryboard.map((scene: any) => ({ affirmation: scene.affirmation, duration: scene.duration, imagePrompt: scene.imagePrompt, transition: scene.transition })));
    if (!storyboardValidation.valid) return NextResponse.json({ error: 'Invalid storyboard', details: storyboardValidation.errors }, { status: 400 });

    await convex.mutation(api.mindMovies.updateStatus, { id, status: 'rendering' });

    try {
      const recordingsByIndex = new Map(voiceRecordings.map((recording: any) => [recording.affirmationIndex, recording]));
      const scenes = normalizedStoryboard.map((scene: any, index: number) => {
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
        };
      });

      const scenesForRender = scenes.slice(0, 4);
      if (scenes.length > scenesForRender.length) {
        console.log(`Temporary test render cap enabled: rendering ${scenesForRender.length} of ${scenes.length} scenes.`);
      }

      const videoBuffer = await renderVideo(scenesForRender, { width: 1280, height: 720, fps: 30, quality: 'medium', musicTrack: movie.musicTrack });
      const fs = await import('fs/promises');
      const path = await import('path');
      const videoDir = path.join(process.cwd(), 'public', 'videos');
      await fs.mkdir(videoDir, { recursive: true });
      const videoFileName = `${id}-${Date.now()}.mp4`;
      const videoPath = path.join(videoDir, videoFileName);
      await fs.writeFile(videoPath, videoBuffer);
      const videoUrl = `/api/videos/${videoFileName}`;
      await convex.mutation(api.mindMovies.updateVideo, { id, videoUrl, status: 'ready' });
      return NextResponse.json({ success: true, message: 'Render complete', videoUrl, size: videoBuffer.length });
    } catch (renderError) {
      await convex.mutation(api.mindMovies.updateStatus, { id, status: 'draft' });
      throw renderError;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Render failed' }, { status: 500 });
  }
}
