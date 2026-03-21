'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, CheckCircle2, Pencil, Play, Film, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { getSceneCopy, normalizeStoryboard } from '@/lib/mindmovie/storyboard';

export default function MindMovieDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const created = searchParams.get('created') === '1';
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const updateStatus = useMutation(api.mindMovies.updateStatus);

  const movieId = useMemo(() => params.id as Id<'mindMovies'>, [params.id]);
  const movie = useQuery(api.mindMovies.getById, isAuthenticated ? { id: movieId } : 'skip');

  const handleRender = async () => {
    if (!movie) return;
    setRendering(true);
    setRenderError(null);
    try {
      const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: movie._id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Render failed');
      window.location.reload();
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setRendering(false);
    }
  };

  const setArchived = async (status: 'ready' | 'archived') => {
    if (!movie) return;
    setArchiveBusy(true);
    setStatusError(null);
    try {
      if (status === 'archived') {
        if (!window.confirm('Archive this Mind Movie? It will be hidden from the default dashboard, but you can restore it anytime.')) return;
        if (movie.status === 'rendering') throw new Error('This Mind Movie is currently rendering. Wait for rendering to finish before archiving.');
      }
      await updateStatus({ id: movie._id, status });
      router.refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not update archive status.');
    } finally {
      setArchiveBusy(false);
    }
  };

  if (!authLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') window.location.replace('/sign-in');
    return <div className="min-h-screen bg-slate-900" />;
  }

  if (movie === undefined) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading…</div>;
  if (!movie) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Mind movie not found.</div>;

  const isArchived = movie.status === 'archived';

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <Link href="/dashboard" className="text-white/70 hover:text-white inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Dashboard</Link>
          <div className="flex gap-3">
            {isArchived ? (
              <button onClick={() => setArchived('ready')} disabled={archiveBusy} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 rounded-lg inline-flex items-center gap-2"><ArchiveRestore className="w-4 h-4" />{archiveBusy ? 'Restoring...' : 'Unarchive'}</button>
            ) : (
              <button onClick={() => setArchived('archived')} disabled={archiveBusy || movie.status === 'rendering'} className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-60 rounded-lg inline-flex items-center gap-2"><Archive className="w-4 h-4" />{archiveBusy ? 'Archiving...' : 'Archive'}</button>
            )}
            {movie.status === 'ready' && <Link href={`/mind-movies/${movie._id}/watch`} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center gap-2"><Play className="w-4 h-4" />Watch</Link>}
            {(movie.status === 'draft' || !movie.videoUrl) && !isArchived && (
              <button onClick={handleRender} disabled={rendering} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 rounded-lg inline-flex items-center gap-2">
                {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                {rendering ? 'Rendering...' : 'Render Video'}
              </button>
            )}
            {movie.status === 'rendering' && <span className="px-4 py-2 bg-yellow-600/30 text-yellow-300 rounded-lg inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Rendering...</span>}
            <Link href={`/mind-movies/${movie._id}/edit`} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg inline-flex items-center gap-2"><Pencil className="w-4 h-4" />Edit</Link>
          </div>
        </div>

        {movie.status === 'rendering' && <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-yellow-200 text-sm">This Mind Movie is rendering right now. Archiving is disabled until rendering finishes.</div>}
        {created && <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Success. Your mind movie has been generated.</div>}
        {renderError && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">{renderError}</div>}
        {statusError && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">{statusError}</div>}
        {isArchived && <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">Archived movies stay here for recovery, but are hidden from the default dashboard.</div>}

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
          <p className="text-white/60">{movie.goals.length} goals • {movie.duration}s • status: {movie.status}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white/5 border border-white/10 rounded-xl p-5"><h2 className="font-semibold mb-3">Goals</h2><ul className="space-y-2 text-white/90">{movie.goals.map((goal: string, i: number) => <li key={i}>• {goal}</li>)}</ul></section>
          <section className="bg-white/5 border border-white/10 rounded-xl p-5"><h2 className="font-semibold mb-3">Affirmations</h2><ul className="space-y-2 text-primary-200">{movie.affirmations.map((aff: string, i: number) => <li key={i}>• {aff}</li>)}</ul></section>
        </div>

        {movie.storyboard && movie.storyboard.length > 0 && (
          <section className="mt-6 bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="font-semibold mb-3">Storyboard ({movie.storyboard.length} scenes)</h2>
            <div className="space-y-3">
              {normalizeStoryboard(movie.storyboard).map((scene: any, i: number) => {
                const copy = getSceneCopy(scene, i);
                return <div key={i} className="bg-white/5 rounded-lg p-3"><div className="flex items-start gap-3"><div className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs font-semibold">{i + 1}</div><div><p className="text-white/90">{copy.title}</p><p className="text-white/70 text-sm mt-1">{copy.description}</p><p className="text-white/50 text-xs mt-1">{scene.duration || 10}s</p></div></div></div>;
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
