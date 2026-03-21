'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  TrendingUp,
  Flame,
  Trophy,
  Calendar,
  Target,
  Zap,
  Loader2,
  Award
} from 'lucide-react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';

export default function StatsPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : 'skip');
  const stats = useQuery(api.users.getStats, isAuthenticated ? {} : 'skip');
  const mindMovies = useQuery(api.mindMovies.list, isAuthenticated ? {} : 'skip');
  const { signOut } = useAuthActions();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user || !isAuthenticated) {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  if (authLoading || isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">Mindra</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Your Statistics</h1>

        {/* Welcome */}
        <div className="mb-8 p-6 bg-primary-500/10 border border-primary-500/20 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">Welcome back, {user.name || 'Dreamer'}!</h2>
          <p className="text-white/60">
            Keep going! You're making progress towards your goals.
          </p>
        </div>

        {/* Stats Grid */}
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-primary-400" />
                <span className="text-sm text-white/60">Level</span>
              </div>
              <p className="text-3xl font-bold">{stats.level}</p>
              <p className="text-xs text-white/40 mt-1">
                {stats.xp} / {(stats.level || 1) * 500} XP
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-white/60">Current Streak</span>
              </div>
              <p className="text-3xl font-bold">{stats.currentStreak || 0}</p>
              <p className="text-xs text-white/40 mt-1">days</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-accent-400" />
                <span className="text-sm text-white/60">Best Streak</span>
              </div>
              <p className="text-3xl font-bold">{stats.longestStreak || 0}</p>
              <p className="text-xs text-white/40 mt-1">days</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-white/60">Mind Movies</span>
              </div>
              <p className="text-3xl font-bold">{stats.totalMindMovies || 0}</p>
              <p className="text-xs text-white/40 mt-1">
                {stats.activeMindMovies || 0} active
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
            <p className="text-white/60">Loading stats...</p>
          </div>
        )}

        {/* Mind Movies List */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Your Mind Movies
          </h2>

          {mindMovies && mindMovies.length > 0 ? (
            <div className="space-y-4">
              {mindMovies.map((movie: any) => (
                <div
                  key={movie._id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{movie.title}</h3>
                      <p className="text-sm text-white/60">
                        {movie.status} • {movie.createdAt ? new Date(movie.createdAt).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {movie.status === 'ready' && (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                        Ready to Watch
                      </span>
                    )}
                    {movie.status === 'draft' && (
                      <span className="px-3 py-1 bg-white/10 text-white/60 rounded-full text-sm">
                        Draft
                      </span>
                    )}
                    {movie.status === 'rendering' && (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                        Rendering...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 mb-4">No mind movies yet</p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Create Your First Mind Movie
              </Link>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Badges Earned
          </h2>
          {user.badges && user.badges.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {user.badges.map((badge: string, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-500/10 border border-accent-500/20 rounded-lg"
                >
                  <Award className="w-5 h-5 text-accent-400" />
                  <span className="text-white">{badge}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40">No badges yet. Keep going to earn rewards!</p>
          )}
        </div>
      </main>
    </div>
  );
}
