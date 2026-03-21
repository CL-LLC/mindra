'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useAction } from 'convex/react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { buildDeterministicScaffold } from '@/lib/mindmovie/scaffold';
import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';

const STEPS = [
  'Validating your inputs',
  'Generating premium affirmations',
  'Composing cinematic storyboard',
  'Saving your mind movie',
];

export default function CreatePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createMindMovie = useMutation(api.mindMovies.create);
  const generateAffirmations = useAction(api.aiFunctions.generateAffirmations);
  const generateStoryboard = useAction(api.aiFunctions.generateStoryboard);

  const [title, setTitle] = useState('');
  const [goalsText, setGoalsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const goals = useMemo(() => goalsText.split('\n').map((g) => g.trim()).filter(Boolean), [goalsText]);

  if (!authLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') window.location.replace('/sign-in');
    return <div className="min-h-screen bg-slate-900" />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedTitle = title.trim() || 'My Mind Movie';

    if (goals.length === 0) {
      setError('Add at least one goal to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      setStepIndex(0);

      setStepIndex(1);
      let affirmations = await generateAffirmations({ goals });
      if (!affirmations?.length) {
        affirmations = buildDeterministicScaffold(normalizedTitle, goals).affirmations;
      }

      setStepIndex(2);
      let storyboard: any[] = [];
      let assets: any[] = [];
      let musicTrack: string | undefined;
      let duration = 0;

      try {
        const generated = await generateStoryboard({
          title: normalizedTitle,
          goals,
          affirmations,
          duration: Math.max(affirmations.length * 10, 30),
        });

        storyboard = normalizeStoryboard(generated.storyboard || []);
        assets = generated.assets || [];
        musicTrack = generated.musicTrack;
        duration = storyboard.reduce((sum, scene) => sum + (scene.duration || 10), 0);
      } catch {
        const fallback = buildDeterministicScaffold(normalizedTitle, goals);
        affirmations = fallback.affirmations;
        storyboard = normalizeStoryboard(fallback.storyboard);
        assets = fallback.assets;
        musicTrack = fallback.musicTrack;
        duration = fallback.duration;
      }

      if (!storyboard.length) {
        const fallback = buildDeterministicScaffold(normalizedTitle, goals);
        affirmations = fallback.affirmations;
        storyboard = normalizeStoryboard(fallback.storyboard);
        assets = fallback.assets;
        musicTrack = fallback.musicTrack;
        duration = fallback.duration;
      }

      setStepIndex(3);
      const movieId = await createMindMovie({
        title: normalizedTitle,
        goals,
        affirmations,
        storyboard,
        assets,
        duration: duration || storyboard.length * 10,
        musicTrack,
      });

      setSuccess('Your mind movie is ready to review.');
      setStepIndex(STEPS.length);
      setTimeout(() => router.push(`/mind-movies/${movieId}?created=1`), 800);
    } catch (err: any) {
      console.error('Create mind movie failed:', err);
      setError(err?.message || 'Could not create mind movie. Please try again.');
      setStepIndex(-1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </Link>
          <div className="flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary-400" /><span className="text-xl font-bold">Mindra</span></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl grid md:grid-cols-3 gap-6">
        <section className="md:col-span-2">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Create Your Mind Movie</h1>
            <p className="text-white/60">Two fields in. Premium scaffold out. Refine after generation.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
            <div>
              <label className="block text-sm text-white/70 mb-2">1) Movie Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., My 90-Day Career Leap" className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">2) Goals (one per line)</label>
              <textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={7} placeholder={'Get promoted to Senior PM\nSpeak confidently in leadership meetings\nExercise 5x weekly'} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500" />
              <p className="text-xs text-white/40 mt-2">Tip: 3-6 specific goals produces the best storyboard.</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}

            <button type="submit" disabled={isSubmitting} className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 disabled:cursor-not-allowed rounded-lg py-3 font-semibold flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Building your mind movie...</> : 'Generate Mind Movie'}
            </button>
          </form>
        </section>

        <aside className="bg-white/5 border border-white/10 rounded-xl p-5 h-fit">
          <h2 className="font-semibold mb-3">Generation Progress</h2>
          <ul className="space-y-3">
            {STEPS.map((step, i) => {
              const done = stepIndex > i;
              const active = stepIndex === i;
              return (
                <li key={step} className="flex items-center gap-2 text-sm">
                  {done ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : active ? <Loader2 className="w-4 h-4 text-primary-400 animate-spin" /> : <span className="w-4 h-4 rounded-full border border-white/20" />}
                  <span className={done || active ? 'text-white' : 'text-white/50'}>{step}</span>
                </li>
              );
            })}
          </ul>
        </aside>
      </main>
    </div>
  );
}
