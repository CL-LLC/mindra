"use client";

import { useConvexUser, useUserStats, useMindMovies, useActiveMindMovie, useAuth } from "@/lib/hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Flame, Trophy, Plus, Loader2, LogOut, Eye, Pencil, Play, ArchiveRestore, Archive } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const { user, isLoading: userLoading, isAuthenticated } = useConvexUser();
  const { stats, isLoading: statsLoading } = useUserStats();
  const { mindMovies, archivedMovies, isLoading: moviesLoading } = useMindMovies();
  const { isLoading: activeLoading } = useActiveMindMovie();
  const { signOut } = useAuth();
  const updateStatus = useMutation(api.mindMovies.updateStatus);
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdBanner = searchParams.get("created") === "1";
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [busyMovieId, setBusyMovieId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isLoading = userLoading || statsLoading || moviesLoading || activeLoading;

  const activeCount = useMemo(() => mindMovies?.length ?? 0, [mindMovies]);
  const archivedCount = useMemo(() => archivedMovies?.length ?? 0, [archivedMovies]);

  const toggleArchive = async (movieId: string, status: "ready" | "archived") => {
    setBusyMovieId(movieId);
    setActionError(null);
    try {
      if (status === "archived") {
        const ok = window.confirm("Archive this Mind Movie? It will disappear from the main dashboard, but you can restore it from Archived.");
        if (!ok) return;
        await updateStatus({ id: movieId as any, status: "archived" });
      } else {
        await updateStatus({ id: movieId as any, status: "ready" });
      }
    } catch (err: any) {
      setActionError(err?.message || "Could not update archive status.");
    } finally {
      setBusyMovieId(null);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-white/60">Loading...</p></div>;
  if (!isAuthenticated) {
    if (typeof window !== "undefined") window.location.replace("/sign-in");
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-white/60">Redirecting to sign in…</p></div>;
  }

  return <div className="min-h-screen bg-slate-900">{/* header */}
    <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50"><div className="container mx-auto px-4 py-4 flex justify-between items-center"><div className="flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary-400" /><span className="text-xl font-bold">Mindra</span></div><div className="flex items-center gap-4"><span className="text-white/80">{user?.name || user?.email?.split("@")[0] || "Dreamer"}</span><button onClick={async () => { try { await signOut(); } finally { router.replace("/sign-in"); } }} className="p-2 text-white/60 hover:text-white transition-colors" title="Sign Out"><LogOut className="w-5 h-5" /></button></div></div></header>
    <main className="container mx-auto px-4 py-8">
      {createdBanner && <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm">✅ Mind Movie created. Open it to review scenes and polish details.</div>}
      {actionError && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">{actionError}</div>}
      <div className="mb-8"><h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name || "Dreamer"}! 👋</h1><p className="text-white/60">Your vision library is ready.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><div className="bg-white/5 rounded-xl p-4 border border-white/10"><p className="text-sm text-white/60 mb-1">Level</p><p className="text-2xl font-bold">{stats?.level ?? 1}</p></div><div className="bg-white/5 rounded-xl p-4 border border-white/10"><div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-orange-400" /><span className="text-sm text-white/60">Streak</span></div><p className="text-2xl font-bold">{stats?.currentStreak ?? 0}</p></div><div className="bg-white/5 rounded-xl p-4 border border-white/10"><p className="text-sm text-white/60 mb-1">Active Mind Movies</p><p className="text-2xl font-bold">{activeCount}</p></div><div className="bg-white/5 rounded-xl p-4 border border-white/10"><div className="flex items-center gap-2 mb-2"><Trophy className="w-4 h-4 text-yellow-400" /><span className="text-sm text-white/60">Archived</span></div><p className="text-2xl font-bold">{archivedCount}</p></div></div>
      <div className="mb-8"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold">Your Mind Movies</h2><Link href="/create" className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"><Plus className="w-4 h-4" />Create New</Link></div>
        {!mindMovies || mindMovies.length === 0 ? <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center"><h3 className="text-lg font-semibold mb-2">No Active Mind Movies</h3><p className="text-white/60 mb-6 max-w-md mx-auto">Archived movies stay tucked away in the Archived section below.</p><Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 rounded-xl font-semibold transition-all"><Plus className="w-5 h-5" />Create Your First Mind Movie</Link></div> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{mindMovies.map((movie: any) => <div key={movie._id} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-primary-500/50 transition-colors"><div className="flex justify-between items-start mb-2"><h3 className="font-semibold">{movie.title}</h3><span className="px-2 py-1 rounded text-xs bg-white/10 text-white/70">{movie.status}</span></div><p className="text-sm text-white/60 mb-3">{movie.goals.length} goals • {movie.duration || 0}s</p><div className="flex gap-2"><Link href={`/mind-movies/${movie._id}`} className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-1"><Eye className="w-3 h-3" />View</Link><Link href={`/mind-movies/${movie._id}/watch`} className="flex-1 px-3 py-2 bg-blue-600/80 hover:bg-blue-600 rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-1"><Play className="w-3 h-3" />Watch</Link><Link href={`/mind-movies/${movie._id}/edit`} className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-1"><Pencil className="w-3 h-3" />Edit</Link><button disabled={busyMovieId === movie._id} onClick={() => toggleArchive(movie._id, "archived")} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors inline-flex items-center gap-1 disabled:opacity-60" title="Archive"><Archive className="w-3 h-3" />{busyMovieId === movie._id ? "..." : "Archive"}</button></div></div>)}</div>}
      </div>
      <section className="mt-10 border-t border-white/10 pt-8"><button onClick={() => setArchivedOpen((v) => !v)} className="mb-4 inline-flex items-center gap-2 text-white/80 hover:text-white"><ArchiveRestore className="w-4 h-4" />{archivedOpen ? "Hide" : "Show"} Archived ({archivedCount})</button>{archivedOpen && <div className="bg-white/5 rounded-xl p-4 border border-white/10">{archivedMovies && archivedMovies.length > 0 ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{archivedMovies.map((movie: any) => <div key={movie._id} className="bg-black/20 rounded-xl p-4 border border-white/10 opacity-90"><div className="flex justify-between items-start mb-2"><h3 className="font-semibold">{movie.title}</h3><span className="px-2 py-1 rounded text-xs bg-amber-500/15 text-amber-300">archived</span></div><p className="text-sm text-white/60 mb-3">{movie.goals.length} goals • {movie.duration || 0}s</p><div className="flex gap-2"><Link href={`/mind-movies/${movie._id}`} className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-1"><Eye className="w-3 h-3" />View</Link><button disabled={busyMovieId === movie._id} onClick={() => toggleArchive(movie._id, "ready")} className="flex-1 px-3 py-2 bg-primary-500/80 hover:bg-primary-500 rounded-lg text-white text-sm transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-60"><ArchiveRestore className="w-3 h-3" />{busyMovieId === movie._id ? "..." : "Unarchive"}</button></div></div>)}</div> : <p className="text-white/60">No archived Mind Movies yet.</p>}</div>}</section>
    </main>
  </div>;
}
