'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useAction } from 'convex/react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { buildDeterministicScaffold } from '@/lib/mindmovie/scaffold';
import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';

function detectLanguage(texts: string[]) {
  const sample = texts.join(' ').toLowerCase();
  const spanishSignals = [' el ', ' la ', ' los ', ' las ', ' tengo ', ' quiero ', ' estoy ', ' ser ', ' conmigo', ' éxito', ' confianza', ' trabajo', ' dinero', ' salud', ' familia', ' mi ', ' mis '];
  const englishSignals = [' the ', ' and ', ' to ', ' my ', ' is ', ' am ', ' want ', ' become ', ' confidence', ' career', ' health', ' money', ' family', ' daily '];
  const spanishScore = spanishSignals.reduce((sum, s) => sum + (sample.includes(s) ? 1 : 0), 0);
  const englishScore = englishSignals.reduce((sum, s) => sum + (sample.includes(s) ? 1 : 0), 0);
  return spanishScore > englishScore ? 'es' : 'en';
}

const STEPS = ['Validating your inputs', 'Generating premium affirmations', 'Composing cinematic storyboard', 'Saving your mind movie'];
const splitGoals = (text: string) => text.split('\n').map((g) => g.trim()).filter(Boolean);

export default function CreatePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createMindMovie = useMutation(api.mindMovies.create);
  const refineCreateBrief = useAction(api.aiFunctions.refineCreateBrief);
  const proposeCreateDraft = useAction(api.aiFunctions.proposeCreateDraft);
  const generateAffirmations = useAction(api.aiFunctions.generateAffirmations);
  const generateStoryboard = useAction(api.aiFunctions.generateStoryboard);

  const [mode, setMode] = useState<'intake' | 'clarity' | 'review' | 'manual'>('intake');
  const [intake, setIntake] = useState('');
  const [clarityAnswers, setClarityAnswers] = useState(['', '', '']);
  const [clarityQuestions] = useState([
    'What matters most?',
    'What is the main constraint?',
    'What would success look like?'
  ]);
  const [title, setTitle] = useState('');
  const [goalsText, setGoalsText] = useState('');
  const [draftLanguage, setDraftLanguage] = useState<'en' | 'es' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const goals = useMemo(() => splitGoals(goalsText), [goalsText]);

  if (!authLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') window.location.replace('/sign-in');
    return <div className="min-h-screen bg-slate-900" />;
  }

  const runGeneration = async (nextTitle: string, nextGoals: string[]) => {
    const normalizedTitle = nextTitle.trim() || 'My Mind Movie';
    if (nextGoals.length === 0) throw new Error('Add at least one goal to continue.');

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      setStepIndex(0);
      const language = detectLanguage([normalizedTitle, ...nextGoals]) as 'en' | 'es';

      setStepIndex(1);
      let affirmations = await generateAffirmations({ goals: nextGoals, language });
      if (!affirmations?.length) affirmations = buildDeterministicScaffold(normalizedTitle, nextGoals, language).affirmations;

      setStepIndex(2);
      let storyboard: any[] = [];
      let assets: any[] = [];
      let musicTrack: string | undefined;
      let duration = 0;

      try {
        const generated = await generateStoryboard({ title: normalizedTitle, goals: nextGoals, affirmations, duration: Math.max(affirmations.length * 10, 30), language });
        storyboard = normalizeStoryboard(generated.storyboard || []);
        assets = generated.assets || [];
        musicTrack = generated.musicTrack;
        duration = storyboard.reduce((sum, scene) => sum + (scene.duration || 10), 0);
      } catch {
        const fallback = buildDeterministicScaffold(normalizedTitle, nextGoals, language);
        affirmations = fallback.affirmations;
        storyboard = normalizeStoryboard(fallback.storyboard);
        assets = fallback.assets;
        musicTrack = fallback.musicTrack;
        duration = fallback.duration;
      }

      if (!storyboard.length) {
        const fallback = buildDeterministicScaffold(normalizedTitle, nextGoals, language);
        affirmations = fallback.affirmations;
        storyboard = normalizeStoryboard(fallback.storyboard);
        assets = fallback.assets;
        musicTrack = fallback.musicTrack;
        duration = fallback.duration;
      }

      setStepIndex(3);
      const movieId = await createMindMovie({ title: normalizedTitle, language, goals: nextGoals, affirmations, storyboard, assets, duration: duration || storyboard.length * 10, musicTrack });
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

  const handleDraftGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!intake.trim()) return setError('Tell me in one line what you want to accomplish.');
    setIsGeneratingDraft(true);
    try {
      setMode('clarity');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const submitClarity = async () => {
    setError(null);
    setSuccess(null);
    setIsGeneratingDraft(true);
    try {
      const refined = await refineCreateBrief({ intake: intake.trim(), answers: clarityAnswers });
      const draft = await proposeCreateDraft({ input: refined.brief });
      setTitle(draft.title);
      setGoalsText(draft.goals.join('\n'));
      setDraftLanguage(draft.language);
      setMode('review');
    } catch (err: any) {
      console.error('Clarity step failed:', err);
      setError(err?.message || 'AI draft failed. Use manual entry below.');
      setMode('manual');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" />Back to Dashboard</Link>
          <div className="flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary-400" /><span className="text-xl font-bold">Mindra</span></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Create Your Mind Movie</h1>
            <p className="text-white/60">Start with one line, let AI suggest the title and goals, then edit before you generate.</p>
          </div>

          {mode === 'intake' && (
            <form onSubmit={handleDraftGenerate} className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
              <div>
                <label className="block text-sm text-white/70 mb-2">What do you want to accomplish?</label>
                <textarea value={intake} onChange={(e) => setIntake(e.target.value)} rows={5} placeholder="Example: I want to land a better role, feel confident in interviews, and rebuild my fitness routine." className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500" />
                <p className="text-xs text-white/40 mt-2">One sentence is enough. You can skip the clarity step and jump straight to AI drafting.</p>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={isGeneratingDraft} className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 disabled:cursor-not-allowed rounded-lg py-3 px-5 font-semibold flex items-center justify-center gap-2">{isGeneratingDraft ? <><Loader2 className="w-4 h-4 animate-spin" />Opening clarity step...</> : <><Wand2 className="w-4 h-4" />Continue</>}</button>
                <button type="button" onClick={() => setMode('manual')} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">Use manual entry instead</button>
              </div>
            </form>
          )}

          {mode === 'clarity' && (
            <div className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Quick clarity step</h2>
                <p className="text-sm text-white/50">Answer up to 3 short questions, or skip this step and continue.</p>
              </div>
              <div className="space-y-4">
                {clarityQuestions.map((question, index) => (
                  <div key={question}>
                    <label className="block text-sm text-white/70 mb-2">{question}</label>
                    <input value={clarityAnswers[index]} onChange={(e) => setClarityAnswers((prev) => prev.map((item, i) => i === index ? e.target.value : item))} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500" placeholder="Short answer" />
                  </div>
                ))}
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={submitClarity} disabled={isGeneratingDraft} className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 disabled:cursor-not-allowed rounded-lg py-3 px-5 font-semibold flex items-center justify-center gap-2">{isGeneratingDraft ? <><Loader2 className="w-4 h-4 animate-spin" />Refining brief...</> : 'Submit clarity answers'}</button>
                <button type="button" onClick={submitClarity} disabled={isGeneratingDraft} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">Skip clarity step</button>
                <button type="button" onClick={() => setMode('intake')} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">Back</button>
              </div>
            </div>
          )}

          {mode === 'review' && (
            <div className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
              <div><h2 className="text-xl font-semibold mb-1">Review your draft</h2><p className="text-sm text-white/50">AI suggested this in {draftLanguage === 'es' ? 'Spanish' : 'English'}. Edit anything before continuing.</p></div>
              <div><label className="block text-sm text-white/70 mb-2">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" /></div>
              <div><label className="block text-sm text-white/70 mb-2">Goals</label><textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={8} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" /><p className="text-xs text-white/40 mt-2">Add or remove lines as needed. One goal per line.</p></div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {success && <p className="text-green-400 text-sm">{success}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => { setMode('intake'); setError(null); setSuccess(null); setTitle(''); setGoalsText(''); setDraftLanguage(null); }} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">Back</button>
                <button type="button" onClick={async () => {
                  const updatedGoals = splitGoals(goalsText);
                  if (!updatedGoals.length) { setError('Add at least one goal before approving.'); return; }
                  await runGeneration(title, updatedGoals);
                }} disabled={isSubmitting} className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 disabled:cursor-not-allowed rounded-lg py-3 px-5 font-semibold flex items-center justify-center gap-2">{isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Building...</> : 'Approve and continue'}</button>
                <button type="button" onClick={async () => {
                  setIsGeneratingDraft(true);
                  setError(null);
                  try {
                    const draft = await proposeCreateDraft({ input: intake.trim() || `${title}\n${goalsText}` });
                    setTitle(draft.title);
                    setGoalsText(draft.goals.join('\n'));
                    setDraftLanguage(draft.language);
                  } catch (err: any) {
                    setError(err?.message || 'Regeneration failed. Switch to manual mode if needed.');
                  } finally {
                    setIsGeneratingDraft(false);
                  }
                }} disabled={isGeneratingDraft} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30 flex items-center gap-2">{isGeneratingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}</button>
              </div>
            </div>
          )}

          {mode === 'manual' && (
            <form onSubmit={(e) => { e.preventDefault(); runGeneration(title, goals); }} className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Manual entry</h2>
                <p className="text-sm text-white/50">Fallback and advanced path. The existing generation pipeline stays the same.</p>
              </div>
              <div><label className="block text-sm text-white/70 mb-2">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" /></div>
              <div><label className="block text-sm text-white/70 mb-2">Goals</label><textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={8} placeholder={'Goal one\nGoal two\nGoal three'} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" /></div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={isSubmitting} className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 disabled:cursor-not-allowed rounded-lg py-3 px-5 font-semibold flex items-center justify-center gap-2">{isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Building...</> : 'Generate Mind Movie'}</button>
                <button type="button" onClick={() => setMode('intake')} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">Back to intake</button>
              </div>
            </form>
          )}
        </section>

        <aside className="bg-white/5 border border-white/10 rounded-xl p-5 h-fit space-y-3">
          <h2 className="font-semibold mb-3">Generation Progress</h2>
          <p className="text-xs text-white/50">Language lock: preserves Spanish when the input is Spanish.</p>
          <p className="text-xs text-white/50">Scene cap and render/audio pipeline remain unchanged downstream.</p>
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
