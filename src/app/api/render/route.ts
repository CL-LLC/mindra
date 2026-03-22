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
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convex = new ConvexHttpClient(convexUrl, { auth: token });

    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Missing mind movie ID' }, { status: 400 });
    }

    // Get the mind movie
    const movie = await convex.query(api.mindMovies.getById, { id });
    
    if (!movie) {
      return NextResponse.json({ error: 'Mind movie not found' }, { status: 404 });
    }
    
    if (!movie.storyboard || movie.storyboard.length === 0) {
      return NextResponse.json({ error: 'Mind movie has no storyboard' }, { status: 400 });
    }

    const normalizedStoryboard = normalizeStoryboard(movie.storyboard);
    const renderStoryboard = normalizedStoryboard.slice(0, TEST_SCENE_LIMIT);
    const storyboardValidation = validateStoryboard(
      renderStoryboard.map((scene: any) => ({
        affirmation: scene.affirmation,
        duration: scene.duration,
        imagePrompt: scene.imagePrompt,
        transition: scene.transition,
      }))
    );

    if (!storyboardValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid storyboard', details: storyboardValidation.errors },
        { status: 400 }
      );
    }

    // Update status to rendering
    await convex.mutation(api.mindMovies.updateStatus, {
      id,
      status: 'rendering',
    });

    try {
      // Prepare scenes for rendering
      const scenes = renderStoryboard.map((scene: any, index: number) => ({
        affirmation: movie.affirmations?.[index] || scene.affirmation,
        duration: scene.duration,
        backgroundColor: scene.backgroundColor,
        backgroundImageUrl: scene.imageUrl,
        imagePrompt: scene.imagePrompt,
        title: scene.title,
        description: scene.description,
      }));

      // Render the video using FFmpeg
      console.log(`Rendering ${scenes.length}/${normalizedStoryboard.length} scenes for mind movie ${id} (test cap ${TEST_SCENE_LIMIT})...`);
      const videoBuffer = await renderVideo(scenes, {
        width: 1280,
        height: 720,
        fps: 30,
        quality: 'medium',
        musicTrack: movie.musicTrack,
      });

      // Upload to Convex storage via admin client
      // Note: For now, we'll save locally and provide a local URL
      // In production, this would upload to Convex storage or S3
      
      // For MVP, save to public folder
      const fs = await import('fs/promises');
      const path = await import('path');
      const videoDir = path.join(process.cwd(), 'public', 'videos');
      await fs.mkdir(videoDir, { recursive: true });
      
      const videoFileName = `${id}-${Date.now()}.mp4`;
      const videoPath = path.join(videoDir, videoFileName);
      await fs.writeFile(videoPath, videoBuffer);
      
      const videoUrl = `/api/videos/${videoFileName}`;

      // Update the mind movie with video URL
      await convex.mutation(api.mindMovies.updateVideo, {
        id,
        videoUrl,
        status: 'ready',
      });

      console.log(`Render complete: ${videoUrl} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

      return NextResponse.json({ 
        success: true, 
        message: 'Render complete',
        videoUrl,
        size: videoBuffer.length
      });

    } catch (renderError) {
      console.error('Render failed:', renderError);
      
      // Revert status to draft on failure
      await convex.mutation(api.mindMovies.updateStatus, {
        id,
        status: 'draft',
      });
      
      throw renderError;
    }

  } catch (error) {
    console.error('Render error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Render failed' 
    }, { status: 500 });
  }
}
