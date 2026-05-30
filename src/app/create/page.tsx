'use client';

import { FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useAction, useQuery } from 'convex/react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, Wand2, Plus, X, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { buildDeterministicScaffold } from '@/lib/mindmovie/scaffold';
import { normalizeStoryboard, toManifestFormat } from '@/lib/mindmovie/storyboard';
import { generateAffirmationManifestFromNormalized } from '@/lib/video/renderer';
import { useLanguage } from '@/lib/hooks';

/** Allowed mime types for emotional image upload. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

type EmotionalImageUpload = {
  /** Convex storage ID after upload. */
  storageId: string;
  /** URL for display (generated after upload completes). */
  imageUrl: string;
  /** Index of the goal this image is attached to. */
  goalIndex: number;
  /** Optional scene index for exact placement. */
  sceneIndex?: number;
  /** Optional caption. */
  caption?: string;
  /** Whether to use directly as scene bg or as style reference. */
  usageMode: 'direct' | 'style_reference' | 'both';
  /** Local preview URL (Object URL) before upload completion. */
  previewUrl?: string;
  /** Whether this image is currently being uploaded. */
  uploading?: boolean;
  /** Upload error message if any. */
  uploadError?: string;
};

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

  const [mode, setMode] = useState<'intake' | 'review'>('intake');
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

  // Emotional image upload state
  const [emotionalImages, setEmotionalImages] = useState<EmotionalImageUpload[]>([]);
  const generateUploadUrl = useMutation(api.mindMovies.generateEmotionalImageUploadUrl);
  const getEmotionalImageUrl = useMutation(api.mindMovies.getEmotionalImageUrl);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const handleEmotionalImageSelect = async (goalIndex: number, file: File | null) => {
    if (!file) return;

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError(`Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP.`);
      return;
    }
    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max 5 MB.`);
      return;
    }

    setError(null);

    // Create a local preview
    const previewUrl = URL.createObjectURL(file);

    // Track upload in progress
    const uploadEntry: EmotionalImageUpload = {
      storageId: '',
      imageUrl: '',
      goalIndex,
      usageMode: 'both',
      previewUrl,
      uploading: true,
    };
    setEmotionalImages((prev) => [...prev.filter((e) => e.goalIndex !== goalIndex), uploadEntry]);

    try {
      // 1. Get upload URL from Convex storage
      const uploadUrl = await generateUploadUrl();

      // 2. Upload the file directly to Convex storage
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

      const { storageId } = await response.json() as { storageId: Id<'_storage'> };
      const imageUrl = await getEmotionalImageUrl({ storageId });

      // Update entry with resolved info
      setEmotionalImages((prev) =>
        prev.map((e) =>
          e.goalIndex === goalIndex
            ? { ...e, storageId, imageUrl, uploading: false, previewUrl: undefined }
            : e
        )
      );
    } catch (err: any) {
      console.error('Emotional image upload failed:', err);
      // Remove the pending entry on failure
      setEmotionalImages((prev) => prev.filter((e) => e.goalIndex !== goalIndex));
      setError(err?.message || 'Image upload failed. Please try again.');
    } finally {
      // Clean up preview Object URL after upload completes or fails
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  };

  const removeEmotionalImage = (goalIndex: number) => {
    setEmotionalImages((prev) => prev.filter((e) => e.goalIndex !== goalIndex));
    // Reset file input
    const input = fileInputRefs.current.get(goalIndex);
    if (input) input.value = '';
  };

  const getEmotionalImageForGoal = (goalIndex: number): EmotionalImageUpload | undefined => {
    return emotionalImages.find((e) => e.goalIndex === goalIndex);
  };
  const hasUploadingImages = emotionalImages.some((image) => image.uploading);

  const STEPS = [
    t('create.progress.validating'),
    t('create.progress.affirmations'),
    t('create.progress.storyboard'),
    t('create.progress.saving')
  ];

  // Trimmed/filtered goals for submission
  const goals = useMemo(() => goalsText.split('\n').map((g) => g.trim()).filter(Boolean), [goalsText]);
  // Raw lines for editing (preserves spaces during typing)
  const goalLines = useMemo(() => goalsText.split('\n'), [goalsText]);

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
      
      // Generate affirmation manifest for playback-layer overlay
      const affirmationManifest = generateAffirmationManifestFromNormalized(toManifestFormat(storyboard));
      
      const movieId = await createMindMovie({ 
        title: normalizedTitle, 
        language, 
        goals: nextGoals, 
        affirmations, 
        storyboard, 
        assets, 
        duration: duration || storyboard.length * 10, 
        musicTrack,
        affirmationManifest, // Pass manifest for playback-layer overlay
        // Pass uploaded emotional image metadata (only fully uploaded entries)
        emotionalImages: emotionalImages
          .filter((img) => !img.uploading && img.storageId)
          .map((img) => ({
            storageId: img.storageId as Id<'_storage'>,
            imageUrl: img.imageUrl,
            caption: img.caption,
            goalIndex: img.goalIndex,
            sceneIndex: img.sceneIndex,
            usageMode: img.usageMode,
          })),
      });
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
      const draft = await proposeCreateDraft({ 
        input: intake.trim(),
        preferredLanguage: user?.preferredLanguage as 'en' | 'es' | undefined,
      });
      setTitle(draft.title);
      setGoalsText(draft.goals.join('\n'));
      setDraftLanguage(draft.language);
      setMode('review');
    } catch (err: any) {
      console.error('Draft generation failed:', err);
      setError(err?.message || 'AI draft failed. Please try again.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleRegenerateGoals = async () => {
    if (!intake.trim()) return;
    setIsRegeneratingGoals(true);
    setError(null);
    try {
      const draft = await proposeCreateDraft({ 
        input: intake.trim(),
        preferredLanguage: user?.preferredLanguage as 'en' | 'es' | undefined,
      });
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
    // Add a placeholder that won't be filtered out
    setGoalsText((prev) => (prev ? prev + '\n' : '') + ' ');
  };

  const removeGoal = (index: number) => {
    setGoalsText((prev) => {
      const lines = prev.split('\n');
      lines.splice(index, 1);
      return lines.join('\n');
    });
    setEmotionalImages((prev) =>
      prev
        .filter((image) => image.goalIndex !== index)
        .map((image) => ({
          ...image,
          goalIndex: image.goalIndex > index ? image.goalIndex - 1 : image.goalIndex,
        }))
    );
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
              </div>
            </form>
          )}

          {mode === 'review' && (
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
                  {goalLines.map((goal, index) => {
                    const image = getEmotionalImageForGoal(index);
                    return (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1">
                          <input value={goal} onChange={(e) => {
                            const lines = goalsText.split('\n');
                            lines[index] = e.target.value;
                            setGoalsText(lines.join('\n'));
                          }} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500" />
                          {/* Emotional image preview / upload for this goal */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {image && !image.uploading && image.imageUrl ? (
                              <div className="relative group">
                                <img src={image.imageUrl} alt={image.caption || `Goal ${index + 1}`} className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                                <button
                                  type="button"
                                  onClick={() => removeEmotionalImage(index)}
                                  className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : image?.uploading ? (
                              <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                                <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
                              </div>
                            ) : null}
                            {(!image || image.uploading) && (
                              <label className="cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                                <ImageIcon className="w-3 h-3" />
                                Add Image
                                <input
                                  ref={(el) => { if (el) fileInputRefs.current.set(index, el); }}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    handleEmotionalImageSelect(index, file);
                                  }}
                                  disabled={image?.uploading}
                                />
                              </label>
                            )}
                            {image?.uploadError && (
                              <span className="text-xs text-red-400">{image.uploadError}</span>
                            )}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeGoal(index)} className="mt-1 p-2 rounded bg-white/5 text-white/50 hover:text-red-400 hover:bg-white/10"><X className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                  {goalLines.length === 0 && (
                    <textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={4} placeholder={t('create.goalsPlaceholder')} className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void runGeneration(title, goals)} disabled={isSubmitting || hasUploadingImages || goals.length === 0} className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 rounded-lg py-3 px-5 font-semibold flex items-center gap-2">{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{hasUploadingImages ? 'Uploading images...' : t('create.createMindMovie')}</button>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5"><h3 className="font-semibold mb-3">{t('create.progress')}</h3><ul className="space-y-2">{STEPS.map((step, i) => { const done = i < stepIndex; const active = i === stepIndex; return <li key={i} className="flex items-center gap-2 text-sm">{done ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : active ? <Loader2 className="w-4 h-4 text-primary-400 animate-spin" /> : <span className="w-4 h-4 rounded-full border border-white/20" />}<span className={done || active ? 'text-white' : 'text-white/50'}>{step}</span></li>; })}</ul></div>
        </aside>
      </main>
    </div>
  );
}
