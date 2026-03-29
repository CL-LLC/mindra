'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useConvexAuth } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import { MindMoviePlayer } from '../../../../components/MindMoviePlayer';
import { ArrowLeft, Clock, Film, CheckCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { getSceneCopy, normalizeStoryboard } from '@/lib/mindmovie/storyboard';

export default function WatchPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trackingComplete, setTrackingComplete] = useState(false);
  const completionRequestedRef = useRef(false);

  const movieId = useMemo(() => params.id as Id<'mindMovies'>, [params.id]);
  const movie = useQuery(api.mindMovies.getById, isAuthenticated ? { id: movieId } : 'skip');

  const recordMorning = useMutation(api.tracking.recordMorning);
  const recordEvening = useMutation(api.tracking.recordEvening);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/sign-in');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    completionRequestedRef.current = false;
    setTrackingComplete(false);
  }, [movieId]);

  const handleVideoComplete = async () => {
    if (completionRequestedRef.current) return;
    completionRequestedRef.current = true;

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
      completionRequestedRef.current = false;
      console.error('Failed to record tracking:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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

  const isReady = movie.status === 'ready' && Boolean(movie.videoUrl);
  const canWatch = isReady;
  const statusCopy = movie.status === 'ready'
    ? 'This Mind Movie is ready to watch.'
    : movie.status === 'rendering'
      ? 'This Mind Movie is still rendering. Come back when processing finishes and the video URL is available.'
      : movie.status === 'archived'
        ? 'This Mind Movie is archived. Restore it from the details page before watching.'
        : 'This Mind Movie is still a draft. Render it from the details page first.';

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/mind-movies/${params.id}`)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to details</span>
          </button>

          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold text-white">{movie.title}</h1>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${movie.status === 'ready' ? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-200' : movie.status === 'rendering' ? 'border-yellow-400/20 bg-yellow-500/15 text-yellow-200' : movie.status === 'archived' ? 'border-amber-400/20 bg-amber-500/15 text-amber-200' : 'border-slate-400/20 bg-slate-500/15 text-slate-200'}`}>{movie.status}</span>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">{statusCopy}</p>

          <div className="flex items-center gap-4 text-slate-400 text-sm mt-4 flex-wrap">
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
              <span>Completion saved for this watch session.</span>
            </div>
          )}
        </div>

        <div className="mb-8">
          {canWatch ? (
            <MindMoviePlayer
              videoUrl={movie.videoUrl ?? ''}
              manifest={movie.affirmationManifest}
              onComplete={handleVideoComplete}
            />
          ) : (
            <div className="aspect-video rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center px-6">
              <div className="max-w-md text-center">
                <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-slate-100 text-lg font-medium mb-2">Watch is unavailable</p>
                <p className="text-slate-400 text-sm mb-5">{statusCopy}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => router.push(`/mind-movies/${params.id}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white hover:bg-white/20 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to details
                  </button>
                  <button
                    onClick={() => router.refresh()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh status
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

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
