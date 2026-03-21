'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useConvexAuth } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { VideoPlayer } from '../../../../components/VideoPlayer';
import { ArrowLeft, Clock, Film, CheckCircle } from 'lucide-react';
import { getSceneCopy, normalizeStoryboard } from '@/lib/mindmovie/storyboard';

export default function WatchPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trackingComplete, setTrackingComplete] = useState(false);

  const movieId = useMemo(() => params.id as Id<'mindMovies'>, [params.id]);
  const movie = useQuery(api.mindMovies.getById, isAuthenticated ? { id: movieId } : 'skip');

  const recordMorning = useMutation(api.tracking.recordMorning);
  const recordEvening = useMutation(api.tracking.recordEvening);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/sign-in');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Mind movie not found</div>
      </div>
    );
  }

  const handleVideoComplete = async () => {
    if (trackingComplete) return;

    // Determine if it's morning or evening (12pm cutoff)
    const hour = new Date().getHours();
    const isMorning = hour < 12;

    try {
      if (isMorning) {
        await recordMorning({ mindMovieId: movieId });
      } else {
        await recordEvening({ mindMovieId: movieId });
      }
      setTrackingComplete(true);
    } catch (error) {
      console.error('Failed to record tracking:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/mind-movies/${params.id}`)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Details</span>
          </button>

          <h1 className="text-3xl font-bold text-white mb-2">{movie.title}</h1>
          
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{movie.duration ? formatDuration(movie.duration) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Film className="w-4 h-4" />
              <span>{movie.storyboard?.length || 0} scenes</span>
            </div>
          </div>

          {trackingComplete && (
            <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-900/20 px-4 py-2 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span>Session recorded! Keep up the great work.</span>
            </div>
          )}
        </div>

        {/* Video Player */}
        <div className="mb-8">
          <VideoPlayer
            videoUrl={movie.videoUrl ?? null}
            onComplete={handleVideoComplete}
          />
        </div>

        {/* Storyboard Chapters */}
        {movie.storyboard && movie.storyboard.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Storyboard</h2>
            <div className="space-y-3">
              {normalizeStoryboard(movie.storyboard).map((scene: any, index: number) => {
                const copy = getSceneCopy(scene, index);
                return (
                  <div
                    key={index}
                    className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">
                          {copy.title}
                        </h3>
                        <p className="text-slate-400 text-sm">
                          {copy.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
