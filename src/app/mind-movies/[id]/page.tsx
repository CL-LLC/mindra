'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Play, Film, Loader2, Archive, ArchiveRestore, Mic, Square, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { getSceneCopy, normalizeStoryboard } from '@/lib/mindmovie/storyboard';
import { useLanguage } from '@/lib/hooks';

type Recording = { affirmationIndex: number; recordedAt: number; mimeType: string; audioDataUrl: string; durationMs?: number };

export default function Page() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const movieId = useMemo(() => params.id as Id<'mindMovies'>, [params.id]);
  const movie = useQuery(api.mindMovies.getById, isAuthenticated ? { id: movieId } : 'skip');
  const updateStatus = useMutation(api.mindMovies.updateStatus);
  const upsertVoiceRecording = useMutation(api.mindMovies.upsertVoiceRecording);
  const removeVoiceRecording = useMutation(api.mindMovies.removeVoiceRecording);
  const { t } = useLanguage();

  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'stopping'>('idle');
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const recordings = (movie?.voiceRecordings ?? []) as Recording[];
  const recordingMap = useMemo(() => new Map(recordings.map((r) => [r.affirmationIndex, r])), [recordings]);
  const affirmations = movie?.affirmations ?? [];
  const recordedCount = affirmations.filter((_, i) => recordingMap.has(i)).length;
  const allRecorded = affirmations.length > 0 && recordedCount === affirmations.length;
  const missing = affirmations.map((_, i) => i).filter((i) => !recordingMap.has(i));

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const resetRecorder = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setRecordingIndex(null);
    setRecordingState('idle');
    setSeconds(0);
  };

  const startRecording = async (index: number) => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) return setError('Microphone recording is not supported in this browser.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const parts: BlobPart[] = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecordingIndex(index);
      setRecordingState('recording');
      timerRef.current = window.setInterval(() => setSeconds(Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000))), 250);
      recorder.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      recorder.onstop = async () => {
        try {
          setBusyIndex(index);
          const blob = new Blob(parts, { type: recorder.mimeType || 'audio/webm' });
          const audioDataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Failed to read recording.')); r.readAsDataURL(blob); });
          await upsertVoiceRecording({ id: movieId, recording: { affirmationIndex: index, recordedAt: Date.now(), mimeType: blob.type || 'audio/webm', audioDataUrl, durationMs: Date.now() - startedAtRef.current } });
          router.refresh();
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not save recording.'); }
        finally { setBusyIndex(null); resetRecorder(); }
      };
      recorder.start();
    } catch (e) { resetRecorder(); setError(e instanceof Error ? e.message : 'Could not start recording.'); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && recordingState === 'recording') { setRecordingState('stopping'); mediaRecorderRef.current.stop(); } };
  const deleteRecording = async (index: number) => { try { await removeVoiceRecording({ id: movieId, affirmationIndex: index }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete recording.'); } };
  const renderMovie = async () => {
    if (!allRecorded) return setError(`${t('movie.recordAllAffirmations')} ${t('movie.missingCount')} ${missing.length} ${t('movie.more')}.`);
    setRendering(true); setError(null);
    try { const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: movieId }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Render failed'); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Render failed'); }
    finally { setRendering(false); }
  };
  const setArchived = async (status: 'ready' | 'archived') => { if (!movie) return; if (status === 'archived' && !window.confirm(t('dashboard.archiveConfirm'))) return; await updateStatus({ id: movie._id, status }); router.refresh(); };

  // Status label helper
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('status.draft');
      case 'rendering': return t('status.rendering');
      case 'ready': return t('status.ready');
      case 'archived': return t('status.archived');
      default: return status;
    }
  };

  // Status tone classes
  const statusTone: Record<string, string> = {
    draft: 'bg-slate-500/15 text-slate-200 border-slate-400/20',
    rendering: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/20',
    ready: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
    archived: 'bg-amber-500/15 text-amber-200 border-amber-400/20'
  };

  if (!isLoading && !isAuthenticated) return <div className="min-h-screen bg-slate-900" />;
  if (movie === undefined) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">{t('movie.loading')}</div>;
  if (!movie) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">{t('movie.movieNotFound')}</div>;
  const showWatch = movie.status === 'ready' && Boolean(movie.videoUrl);

  return <div className="min-h-screen bg-slate-900 text-white p-8"><div className="max-w-5xl mx-auto space-y-6">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <Link href="/dashboard" className="text-slate-300 hover:text-white inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" />{t('movie.dashboard')}</Link>
      <div className="flex gap-2 flex-wrap">
        {movie.status === 'archived' ? <button onClick={() => setArchived('ready')} className="px-4 py-2 rounded-lg bg-white/10 inline-flex items-center gap-2"><ArchiveRestore className="w-4 h-4" />{t('movie.unarchive')}</button> : <button onClick={() => setArchived('archived')} className="px-4 py-2 rounded-lg bg-white/10 inline-flex items-center gap-2"><Archive className="w-4 h-4" />{t('movie.archive')}</button>}
        {showWatch && <Link href={`/mind-movies/${movie._id}/watch`} className="px-4 py-2 rounded-lg bg-blue-600 inline-flex items-center gap-2"><Play className="w-4 h-4" />{t('movie.watchNow')}</Link>}
        {movie.status !== 'rendering' && !movie.videoUrl && <button onClick={renderMovie} disabled={!allRecorded || rendering} className="px-4 py-2 rounded-lg bg-purple-600 disabled:bg-purple-600/50 inline-flex items-center gap-2"><Film className="w-4 h-4" />{rendering ? t('movie.rendering') : t('movie.renderVideo')}</button>}
        {movie.status === 'rendering' && <span className="px-4 py-2 rounded-lg bg-yellow-600/30 text-yellow-300 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('status.rendering')}</span>}
      </div>
    </div>

    <div className={`rounded-lg border px-4 py-3 ${statusTone[movie.status]}`}>
      <div className="font-semibold capitalize">{getStatusLabel(movie.status)}</div>
      <div className="text-sm opacity-90">{!allRecorded ? `${t('movie.recordAllAffirmations')} ${t('movie.missingCount')} ${missing.length}.` : t('movie.allRecorded')}</div>
    </div>

    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5" /><span>{error}</span></div>}

    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('movie.voiceAffirmations')}</h2>
        <div className="text-sm text-slate-400">{recordedCount}/{affirmations.length} {t('movie.recorded')}</div>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${affirmations.length ? (recordedCount / affirmations.length) * 100 : 0}%` }} /></div>
      {affirmations.map((affirmation, index) => {
        const recording = recordingMap.get(index);
        const isCurrent = recordingIndex === index && recordingState !== 'idle';
        return <div key={index} className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{t('movie.affirmation')} {index + 1}</div>
              <div className="font-medium">{affirmation}</div>
            </div>
            {recording ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200"><CheckCircle2 className="w-4 h-4" />{t('movie.recordedBadge')}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-3 py-1 text-sm text-slate-300">{t('movie.notRecorded')}</span>}
          </div>
          {isCurrent && <div className="text-sm text-amber-300">{t('movie.recording')} {seconds}s</div>}
          {recording && <audio controls src={recording.audioDataUrl} className="w-full" />}
          <div className="flex gap-2 flex-wrap">
            {isCurrent ? <button onClick={stopRecording} className="px-3 py-2 rounded-lg bg-rose-600 inline-flex items-center gap-2"><Square className="w-4 h-4" />{t('movie.stop')}</button> : <button onClick={() => startRecording(index)} disabled={busyIndex !== null || recordingState !== 'idle'} className="px-3 py-2 rounded-lg bg-white/10 inline-flex items-center gap-2"><Mic className="w-4 h-4" />{recording ? t('movie.reRecord') : t('movie.record')}</button>}
            {recording && <button onClick={() => deleteRecording(index)} className="px-3 py-2 rounded-lg bg-white/10 inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" />{t('movie.clear')}</button>}
          </div>
        </div>;
      })}
    </section>

    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{allRecorded ? t('movie.finalRenderUnlocked') : `${t('movie.finalRenderLocked')} ${t('movie.missingCount')} ${missing.length}.`}</div>
  </div></div>;
}
