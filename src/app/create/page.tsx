'use client';

import { FormEvent, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useAction, useQuery } from 'convex/react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, Wand2, Plus, X, RefreshCw } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { buildDeterministicScaffold } from '@/lib/mindmovie/scaffold';
import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';
import { useLanguage } from '@/lib/hooks';
import { Language } from '@/lib/i18n/dictionary';

function detectLanguage(texts: string[]) {
  const sample = texts.join(' ').toLowerCase();
  const spanishSignals = [' el ', ' la ', ' los ', ' las ', ' tengo ', ' quiero ', ' estoy ', ' ser ', ' conmigo', ' éxito', ' confianza', ' trabajo', ' dinero', ' salud', ' familia', ' mi ', ' mis '];
  const englishSignals = [' the ', ' and ', ' to ', ' my ', ' is ', ' am ', ' want ', ' become ', ' confidence', ' career', ' health', ' money', ' family', ' daily '];
  const spanishScore = spanishSignals.reduce((sum, s) => sum + (sample.includes(s) ? 1 : 0), 0);
  const englishScore = englishSignals.reduce((sum, s) => sum + (sample.includes(s) ? 1 : 0), 0);
  return spanishScore > englishScore ? 'es' : 'en';
}

export default function CreatePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createMindMovie = useMutation(api.mindMovies.create);
  const proposeCreateDraft = useAction(api.aiFunctions.proposeCreateDraft);
  const generateAffirmations = useAction(api.aiFunctions.generateAffirmations);
  const generateStoryboard = useAction(api.aiFunctions.generateStoryboard);
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : 'skip');

  const { t, language: uiLanguage } = useLanguage();

  const [mode, setMode] = useState<'intake' | 'review' | 'manual'>('intake');
  const [intake, setIntake] = useState('');
  const [title, setTitle] = useState('');
  const [goalsText, setGoalsText] = useState('');
  const [draftLanguage, setDraftLanguage] = useState<'en' | 'es' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isRegeneratingGoals, setIsRegeneratingGoals] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const STEPS = [
    t('create.progress.validating'),
    t('create.progress.affirmations'),
    t('create.progress.storyboard'),
    t('create.progress.saving')
  ];

  const goals = useMemo(() => goalsText.split('\n').map((g) => g.trim()).filter(Boolean), [goalsText]);

  if (!authLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') window.location.replace('/sign-in');
    return <div className="min-h-screen bg-slate-900" />;
  }

  const runGeneration = async (nextTitle: string, nextGoals: string[]) => {
    const normalizedTitle = nextTitle.trim() || t('create.untitled');
    if (nextGoals.length === 0) throw new Error(t('create.error.addGoal'));

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      setStepIndex(0);
      // Use user's saved language preference, fallback to detected language
      const language = (user?.preferredLanguage ?? draftLanguage ?? detectLanguage([normalizedTitle, ...nextGoals, intake])) as 'en' | 'es';

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
      setSuccess(t('create.success.ready'));
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
    if (!intake.trim()) return setError(t('create.error.tellMe'));
    
    setIsGeneratingDraft(true);
    try {
      const draft = await proposeCreateDraft({ input: intake.trim() });
      setTitle(draft.title);
      setGoalsText(draft.goals.join('\n'));
      setDraftLanguage(draft.language);
      setMode('review');
    } catch (err: any) {
      console.error('Draft generation failed:', err);
      setError(err?.message || 'AI draft failed. Use manual entry below.');
      setMode('manual');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleRegenerateGoals = async () => {
    if (!intake.trim()) return;
    setIsRegeneratingGoals(true);
    setError(null);
    try {
      const draft = await proposeCreateDraft({ input: intake.trim() });
      setTitle(draft.title);
      setGoalsText(draft.goals.join('\n'));
      setDraftLanguage(draft.language);
    } catch (err: any) {
      console.error('Regenerate failed:', err);
      setError(err?.message || 'Could not regenerate goals.');
    } finally {
      setIsRegeneratingGoals(false);
    }
  };

  const addGoal = () => {
    setGoalsText((prev) => (prev ? prev + '\n' : ''));
  };

  const removeGoal = (index: number) => {
    setGoalsText((prev) => {
      const lines = prev.split('\n');
      lines.splice(index, 1);
      return lines.join('\n');
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" />{t('dashboard.backToDashboard')}</Link>
          <div className="flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary-400" /><span className="text-xl font-bold">{t('app.name')}</span></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('create.title')}</h1>
            <p className="text-white/60">{t('create.subtitleSimple')}</p>
          </div>

          {mode === 'intake' && (
            <form onSubmit={handleDraftGenerate} className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
              <div>
                <label className="block text-sm text-white/70 mb-2">{t('create.whatDoYouWant')}</label>
                <textarea value={intake} onChange={(e) => setIntake(e.target.value)} rows={5} placeholder={t('create.placeholder')} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500" />
                <p className="text-xs text-white/40 mt-2">{t('create.oneLineIsEnough')}</p>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={isGeneratingDraft} className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 rounded-lg py-3 px-5 font-semibold flex items-center gap-2">
                  {isGeneratingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isGeneratingDraft ? t('create.generatingDraft') : t('create.continue')}
                </button>
                <button type="button" onClick={() => setMode('manual')} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">{t('create.useManualEntry')}</button>
              </div>
            </form>
          )}

          {(mode === 'review' || mode === 'manual') && (
            <div className="space-y-5 bg-white/5 border border-white/10 rounded-xl p-6">
              <div><h2 className="text-xl font-semibold mb-1">{t('create.reviewDraft')}</h2><p className="text-sm text-white/50">{t('create.reviewDesc')}</p></div>
              {success && <p className="text-green-400 text-sm">{success}</p>}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div><label className="block text-sm text-white/70 mb-2">{t('create.titleField')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" /></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-white/70">{t('create.goals')}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={addGoal} className="text-xs px-2 py-1 rounded bg-white/10 text-white/70 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" />{t('create.addGoal')}</button>
                    {mode === 'review' && <button type="button" onClick={handleRegenerateGoals} disabled={isRegeneratingGoals} className="text-xs px-2 py-1 rounded bg-white/10 text-white/70 hover:text-white flex items-center gap-1 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${isRegeneratingGoals ? 'animate-spin' : ''}`} />{t('create.regenerateGoals')}</button>}
                  </div>
                </div>
                <div className="space-y-2">
                  {goals.map((goal, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-1">
                        <input value={goal} onChange={(e) => {
                          const lines = goalsText.split('\n');
                          lines[index] = e.target.value;
                          setGoalsText(lines.join('\n'));
                        }} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500" />
                      </div>
                      <button type="button" onClick={() => removeGoal(index)} className="mt-1 p-2 rounded bg-white/5 text-white/50 hover:text-red-400 hover:bg-white/10"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {goals.length === 0 && (
                    <textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={4} placeholder={t('create.goalsPlaceholder')} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void runGeneration(title, goals)} disabled={isSubmitting || goals.length === 0} className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 rounded-lg py-3 px-5 font-semibold flex items-center gap-2">{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{t('create.createMindMovie')}</button>
                {mode === 'review' && <button type="button" onClick={() => setMode('manual')} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">{t('create.useManualEntry')}</button>}
                {mode === 'manual' && <button type="button" onClick={() => { if (intake.trim()) setMode('review'); }} className="rounded-lg py-3 px-5 font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30">{t('create.skipToManual')}</button>}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5"><h3 className="font-semibold mb-3">{t('create.progress')}</h3><ul className="space-y-2">{STEPS.map((step, i) => { const done = i < stepIndex; const active = i === stepIndex; return <li key={i} className="flex items-center gap-2 text-sm">{done ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : active ? <Loader2 className="w-4 h-4 text-primary-400 animate-spin" /> : <span className="w-4 h-4 rounded-full border border-white/20" />}<span className={done || active ? 'text-white' : 'text-white/50'}>{step}</span></li>; })}</ul></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5"><h3 className="font-semibold mb-3">{t('create.notes')}</h3><p className="text-sm text-white/60">One line is enough. AI will generate a title and goals you can edit, add to, or regenerate.</p></div>
        </aside>
      </main>
    </div>
  );
}
