'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useLanguage } from '@/lib/hooks';

export default function EditMindMoviePage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const movieId = useMemo(() => params.id as Id<'mindMovies'>, [params.id]);
  const movie = useQuery(api.mindMovies.getById, isAuthenticated ? { id: movieId } : 'skip');
  const updateMovie = useMutation(api.mindMovies.update);

  const [title, setTitle] = useState('');
  const [goalsText, setGoalsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movie) return;
    setTitle(movie.title || '');
    setGoalsText((movie.goals || []).join('\n'));
  }, [movie]);

  if (!authLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') window.location.replace('/sign-in');
    return <div className="min-h-screen bg-slate-900" />;
  }

  if (movie === undefined) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">{t('movie.loading')}</div>;
  if (!movie) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">{t('movie.movieNotFound')}</div>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const goals = goalsText.split('\n').map((g) => g.trim()).filter(Boolean);
      if (!goals.length) {
        setError(t('edit.errorAddGoal'));
        return;
      }

      await updateMovie({
        id: movieId,
        title: title.trim() || movie.title,
        goals,
        affirmations: movie.affirmations,
        storyboard: movie.storyboard,
        assets: movie.assets,
        duration: movie.duration,
      });

      router.push(`/mind-movies/${movieId}`);
    } catch (err: any) {
      setError(err?.message || t('edit.errorSave'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href={`/mind-movies/${movieId}`} className="text-white/70 hover:text-white inline-flex items-center gap-2 mb-6"><ArrowLeft className="w-4 h-4" />{t('movie.backToDetail')}</Link>
        <h1 className="text-3xl font-bold mb-6">{t('edit.title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
          <div>
            <label className="block text-sm text-white/70 mb-2">{t('edit.titleLabel')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3" />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">{t('edit.goalsLabel')}</label>
            <textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={7} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-60 inline-flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}{t('edit.saveChanges')}
          </button>
        </form>
      </main>
    </div>
  );
}
