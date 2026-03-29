'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Sparkles, Plus, Play, Clock, Eye, Pencil, Archive, ArchiveRestore, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useLanguage } from '@/lib/hooks';
import { MindMoviePlayer } from '@/components';

// Type for mind movie with optional affirmation manifest
interface MindMovie {
  _id: string;
  title: string;
  goals: string[];
  affirmations: string[];
  duration: number;
  videoUrl?: string;
  affirmationManifest?: {
    version: 1;
    scenes: Array<{
      affirmation: string;
      startTime: number;
      endTime: number;
      position: 'center' | 'top' | 'bottom';
    }>;
    totalDuration: number;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : 'skip');
  const stats = useQuery(api.users.getStats, isAuthenticated ? {} : 'skip');
  const mindMovies = useQuery(api.mindMovies.list, isAuthenticated ? {} : 'skip');
  const archivedMovies = useQuery(api.mindMovies.listArchived, isAuthenticated ? {} : 'skip');
  const updateStatus = useMutation(api.mindMovies.updateStatus);
  const { t } = useLanguage();

  const [showCreatedBanner, setShowCreatedBanner] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [playingMovie, setPlayingMovie] = useState<MindMovie | null>(null);

  useEffect(() => {
    if (searchParams.get('created')) {
      setShowCreatedBanner(true);
      const timer = setTimeout(() => setShowCreatedBanner(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const setArchived = async (id: string, status: 'ready' | 'archived') => {
    if (status === 'archived' && !window.confirm(t('dashboard.archiveConfirm'))) return;
    await updateStatus({ id: id as any, status });
    router.refresh();
  };

  if (!authLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') window.location.replace('/sign-in');
    return <div className="min-h-screen bg-slate-900" />;
  }

  if (user === undefined || mindMovies === undefined || archivedMovies === undefined || stats === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary-400 animate-pulse" />
          <span className="text-white/60">{t('app.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">{t('app.name')}</span>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/30 transition-colors"
          >
            {(user?.name || user?.email || 'User')}
          </Link>
        </div>
      </header>

      {/* Created Banner */}
      {showCreatedBanner && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-emerald-500/15 border border-emerald-400/20 rounded-lg px-4 py-3 flex items-start justify-between">
            <p className="text-emerald-200">{t('dashboard.movieCreated')}</p>
            <button onClick={() => setShowCreatedBanner(false)} className="text-emerald-300 hover:text-emerald-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('dashboard.welcomeBack')}, {(user?.name || user?.email?.split('@')[0] || 'there')}!</h1>
          <p className="text-white/60">{t('dashboard.visionLibraryReady')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-sm">{t('dashboard.level')}</p>
            <p className="text-2xl font-bold">{stats?.level ?? 1}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-sm">{t('dashboard.streak')}</p>
            <p className="text-2xl font-bold">{stats?.currentStreak ?? 0} days</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-sm">{t('dashboard.activeMindMovies')}</p>
            <p className="text-2xl font-bold">{mindMovies?.length ?? 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-sm">{t('dashboard.archived')}</p>
            <p className="text-2xl font-bold">{archivedMovies?.length ?? 0}</p>
          </div>
        </div>

        {/* Mind Movies Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('dashboard.yourMindMovies')}</h2>
          <Link
            href="/create"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('dashboard.createNew')}
          </Link>
        </div>

        {/* Mind Movies Grid */}
        {mindMovies && mindMovies.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mindMovies.map((movie) => (
              <div
                key={movie._id}
                className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
              >
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{movie.title}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {movie.goals.slice(0, 3).map((goal: string, i: number) => (
                      <span key={i} className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/70">
                        {goal.length > 20 ? goal.slice(0, 20) + '...' : goal}
                      </span>
                    ))}
                    {movie.goals.length > 3 && (
                      <span className="text-xs text-white/50">+{movie.goals.length - 3} more</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                    <Clock className="w-4 h-4" />
                    <span>{movie.duration}s</span>
                    <span>•</span>
                    <span>{movie.goals.length} {t('dashboard.goalsCount')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/mind-movies/${movie._id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      {t('dashboard.view')}
                    </Link>
                    {movie.videoUrl && (
                      <button
                        onClick={() => setPlayingMovie(movie as MindMovie)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        {t('dashboard.watch')}
                      </button>
                    )}
                    <button
                      onClick={() => setArchived(movie._id, 'archived')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/60"
                    >
                      <Archive className="w-3 h-3" />
                      {t('dashboard.archive')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/40 text-lg mb-4">{t('dashboard.noActiveMovies')}</p>
            <p className="text-white/30 text-sm mb-6">{t('dashboard.noActiveMoviesDesc')}</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.createFirst')}
            </Link>
          </div>
        )}

        {/* Archived Section Toggle */}
        {archivedMovies && archivedMovies.length > 0 && (
          <div className="mt-12">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
            >
              <span>{showArchived ? t('dashboard.hideArchived') : t('dashboard.showArchived')}</span>
              <span className="text-sm bg-white/10 px-2 py-0.5 rounded">{archivedMovies.length}</span>
            </button>

            {showArchived && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedMovies.map((movie) => (
                  <div
                    key={movie._id}
                    className="bg-white/5 rounded-xl border border-white/10 overflow-hidden opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2">{movie.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                        <span>{movie.goals.length} {t('dashboard.goalsCount')}</span>
                      </div>
                      <button
                        onClick={() => setArchived(movie._id, 'ready')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <ArchiveRestore className="w-3 h-3" />
                        {t('dashboard.unarchive')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty archived message */}
        {archivedMovies && archivedMovies.length === 0 && showArchived === false && mindMovies && mindMovies.length > 0 && (
          <div className="mt-12 text-center text-white/30 text-sm">
            {t('dashboard.noArchivedMovies')}
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {playingMovie && playingMovie.videoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl">
            <MindMoviePlayer
              videoUrl={playingMovie.videoUrl}
              manifest={playingMovie.affirmationManifest}
              autoPlay
              showCloseButton
              onClose={() => setPlayingMovie(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
