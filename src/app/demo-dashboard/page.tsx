"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Flame, Trophy, Plus, Play, TrendingUp } from "lucide-react";

type DemoMindMovie = {
  id: string;
  title: string;
  goals: string[];
  status: "draft";
  createdAt: number;
};

export default function DemoDashboardPage() {
  const searchParams = useSearchParams();
  const [demoMovies, setDemoMovies] = useState<DemoMindMovie[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mindra_demo_movies");
      setDemoMovies(raw ? JSON.parse(raw) : []);
    } catch {
      setDemoMovies([]);
    }
  }, []);

  const createdBanner = useMemo(() => searchParams.get("created") === "1", [searchParams]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">Mindra (Demo)</span>
          </div>
          <Link href="/" className="text-white/70 hover:text-white">Home</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, JC 👋</h1>
          <p className="text-white/60">Demo dashboard for flow testing while OAuth is being finalized.</p>
        </div>

        {createdBanner && (
          <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
            ✅ Mind Movie draft created successfully.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat icon={<TrendingUp className="w-4 h-4 text-primary-400" />} label="Level" value="3" sub="1240 / 1500 XP" />
          <Stat icon={<Flame className="w-4 h-4 text-orange-400" />} label="Streak" value="12" sub="days" />
          <Stat icon={<Sparkles className="w-4 h-4 text-accent-400" />} label="Mind Movies" value={String(4 + demoMovies.length)} sub="created" />
          <Stat icon={<Trophy className="w-4 h-4 text-yellow-400" />} label="Badges" value="2" sub="earned" />
        </div>

        <div className="mb-8 bg-white/5 rounded-xl p-5 border border-white/10">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Your Mind Movies (Demo)</h2>
            <Link href="/create" className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create New Mind Movie
            </Link>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex justify-between items-center">
              <div>
                <p className="font-medium">Financial Freedom Vision</p>
                <p className="text-sm text-white/60">Duration: 90s • Language: EN</p>
              </div>
              <button className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2">
                <Play className="w-4 h-4" /> Play
              </button>
            </div>

            {demoMovies.map((movie) => (
              <div key={movie.id} className="p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <p className="font-medium">{movie.title}</p>
                <p className="text-sm text-white/70">{movie.goals.length} goals • Status: {movie.status}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/50">Note: Demo mode bypasses login temporarily. OAuth+Convex Auth hardening continues in parallel.</p>
      </main>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/40">{sub}</p>
    </div>
  );
}
