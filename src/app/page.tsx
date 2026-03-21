"use client";

import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (isLoading) return;
    window.location.replace(isAuthenticated ? "/dashboard" : "/sign-in");
  }, [isAuthenticated, isLoading]);

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <Sparkles className="w-7 h-7 text-primary-400 animate-pulse" />
          <span className="text-2xl font-bold">Mindra</span>
        </div>
        <p className="text-white/60">Preparing your experience…</p>
      </div>
    </main>
  );
}
