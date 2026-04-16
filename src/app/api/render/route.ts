// Video render: local ffmpeg when RENDER_WORKER_URL is unset; otherwise enqueue remote worker (R2 upload).
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { api } from '../../../../convex/_generated/api';
import { buildScenesForRender } from '@/lib/mindMovies/render-payload';
import { renderVideo } from '../../../lib/video/render-executor';
import {
  type StoryboardScene,
  validateStoryboard,
  generateAffirmationManifestFromNormalized,
} from '../../../lib/video/renderer';
import { normalizeStoryboard } from '../../../lib/mindmovie/storyboard';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const convex = new ConvexHttpClient(convexUrl, { auth: token });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing mind movie ID' }, { status: 400 });

    const movie = await convex.query(api.mindMovies.getById, { id });
    if (!movie) return NextResponse.json({ error: 'Mind movie not found' }, { status: 404 });
    if (!movie.storyboard || movie.storyboard.length === 0) {
      return NextResponse.json({ error: 'Mind movie has no storyboard' }, { status: 400 });
    }

    if (movie.status === 'rendering') {
      return NextResponse.json({ error: 'This Mind Movie is already rendering.' }, { status: 409 });
    }

    const affirmations = Array.isArray(movie.affirmations) ? movie.affirmations : [];
    const voiceRecordings = Array.isArray(movie.voiceRecordings) ? movie.voiceRecordings : [];
    const recordedIndices = new Set(voiceRecordings.map((recording: { affirmationIndex: number }) => recording.affirmationIndex));
    const missing = affirmations.map((_, index) => index).filter((index) => !recordedIndices.has(index));
    if (affirmations.length > 0 && missing.length > 0) {
      return NextResponse.json(
        { error: `Record all affirmations before rendering. Missing ${missing.length} more.` },
        { status: 400 }
      );
    }

    const normalizedStoryboard = normalizeStoryboard(movie.storyboard);
    const storyboardValidation = validateStoryboard(normalizedStoryboard as StoryboardScene[]);
    if (!storyboardValidation.valid) {
      return NextResponse.json({ error: 'Invalid storyboard', details: storyboardValidation.errors }, { status: 400 });
    }

    const scenes = buildScenesForRender(movie);
    const affirmationManifest = generateAffirmationManifestFromNormalized(
      scenes.map((scene) => ({
        affirmation: scene.affirmation,
        duration: scene.duration,
        title: scene.title,
        description: scene.description,
      }))
    );

    const workerBase = process.env.RENDER_WORKER_URL?.replace(/\/$/, '');
    const workerSecret = process.env.RENDER_WORKER_SECRET;

    if (workerBase && workerSecret) {
      const renderJobId = randomUUID();
      await convex.mutation(api.mindMovies.beginRemoteRender, { id, renderJobId });

      try {
        const workerRes = await fetch(`${workerBase}/render-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${workerSecret}`,
          },
          body: JSON.stringify({
            mindMovieId: id,
            renderJobId,
            scenes,
            options: {
              width: 1280,
              height: 720,
              fps: 30,
              quality: 'medium',
              musicTrack: movie.musicTrack,
            },
            affirmationManifest,
          }),
        });

        if (workerRes.status !== 202) {
          const errText = await workerRes.text();
          let message = `Worker returned ${workerRes.status}`;
          try {
            const j = JSON.parse(errText) as { error?: string };
            if (j.error) message = j.error;
          } catch {
            if (errText) message = errText.slice(0, 200);
          }
          await convex.mutation(api.mindMovies.revertRenderingAfterEnqueueFailure, { id });
          return NextResponse.json({ error: message }, { status: 502 });
        }

        return NextResponse.json(
          { success: true, accepted: true, renderJobId, message: 'Render queued' },
          { status: 202 }
        );
      } catch {
        await convex.mutation(api.mindMovies.revertRenderingAfterEnqueueFailure, { id });
        return NextResponse.json({ error: 'Could not reach the render service.' }, { status: 502 });
      }
    }

    // Local / fallback: run ffmpeg in this process (not for Vercel serverless in production).
    await convex.mutation(api.mindMovies.updateStatus, { id, status: 'rendering' });

    try {
      const videoBuffer = await renderVideo(scenes, {
        width: 1280,
        height: 720,
        fps: 30,
        quality: 'medium',
        musicTrack: movie.musicTrack,
      });
      const fs = await import('fs/promises');
      const path = await import('path');
      const videoDir = path.join(process.cwd(), 'public', 'videos');
      await fs.mkdir(videoDir, { recursive: true });
      const videoFileName = `${id}-${Date.now()}.mp4`;
      const videoPath = path.join(videoDir, videoFileName);
      await fs.writeFile(videoPath, videoBuffer);
      const videoUrl = `/api/videos/${videoFileName}`;

      await convex.mutation(api.mindMovies.updateVideo, {
        id,
        videoUrl,
        status: 'ready',
        affirmationManifest,
      });
      return NextResponse.json({
        success: true,
        message: 'Render complete',
        videoUrl,
        size: videoBuffer.length,
      });
    } catch (renderError) {
      await convex.mutation(api.mindMovies.updateStatus, { id, status: 'draft' });
      throw renderError;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Render failed' },
      { status: 500 }
    );
  }
}
