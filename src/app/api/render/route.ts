// Video Render API Route - Handles FFmpeg rendering
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { api } from '../../../../convex/_generated/api';
import { renderVideo } from '../../../lib/video/render-executor';
import { validateStoryboard } from '../../../lib/video/renderer';
import { normalizeStoryboard } from '../../../lib/mindmovie/storyboard';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const TEST_SCENE_LIMIT = 4;

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
    const renderStoryboard = normalizedStoryboard.slice(0, TEST_SCENE_LIMIT);
    const storyboardValidation = validateStoryboard(renderStoryboard.map((scene: any) => ({ affirmation: scene.affirmation, duration: scene.duration, imagePrompt: scene.imagePrompt, transition: scene.transition })));
    if (!storyboardValidation.valid) return NextResponse.json({ error: 'Invalid storyboard', details: storyboardValidation.errors }, { status: 400 });

    await convex.mutation(api.mindMovies.updateStatus, { id, status: 'rendering' });

    try {
      const scenes = renderStoryboard.map((scene: any, index: number) => ({
        affirmation: movie.affirmations?.[index] || scene.affirmation,
        duration: scene.duration,
        backgroundColor: scene.backgroundColor,
        backgroundImageUrl: scene.imageUrl,
        imagePrompt: scene.imagePrompt,
        title: scene.title,
        description: scene.description,
      }));

      const videoBuffer = await renderVideo(scenes, { width: 1280, height: 720, fps: 30, quality: 'medium', musicTrack: movie.musicTrack });
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
