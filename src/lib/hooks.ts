"use client";

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useLanguage } from "./i18n/context";

export function useConvexUser() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const createOrUpdate = useMutation(api.users.createOrUpdate);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user === undefined) {
      setIsSyncing(true);
      createOrUpdate({}).finally(() => setIsSyncing(false));
    }
  }, [isAuthenticated, user, createOrUpdate]);

  return { user, isLoading: authLoading || user === undefined || isSyncing, isAuthenticated };
}

export function useUserStats() {
  const { isAuthenticated } = useConvexAuth();
  const stats = useQuery(api.users.getStats, isAuthenticated ? {} : "skip");
  return { stats, isLoading: stats === undefined };
}

export function useMindMovies() {
  const { isAuthenticated } = useConvexAuth();
  const mindMovies = useQuery(api.mindMovies.list, isAuthenticated ? {} : "skip");
  const archivedMovies = useQuery(api.mindMovies.listArchived, isAuthenticated ? {} : "skip");
  return { mindMovies, archivedMovies, isLoading: mindMovies === undefined || archivedMovies === undefined };
}

export function useActiveMindMovie() {
  const { isAuthenticated } = useConvexAuth();
  const activeMovies = useQuery(api.mindMovies.getActive, isAuthenticated ? {} : "skip");
  return { activeMindMovie: activeMovies?.[0] ?? null, isLoading: activeMovies === undefined };
}

export function useStreak(mindMovieId?: Id<"mindMovies">) {
  const { isAuthenticated } = useConvexAuth();
  const streak = useQuery(api.streaks.getByMindMovie, mindMovieId && isAuthenticated ? { mindMovieId } : "skip");
  return { streak, isLoading: streak === undefined };
}

export function useTodayTracking(mindMovieId?: Id<"mindMovies">) {
  const { isAuthenticated } = useConvexAuth();
  const tracking = useQuery(api.tracking.getToday, mindMovieId && isAuthenticated ? { mindMovieId } : "skip");
  return { tracking, isLoading: tracking === undefined };
}

export function useAuth() {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  return { signIn, signOut, isAuthenticated, isLoading };
}

// Re-export i18n hook for convenience
export { useLanguage } from "./i18n/context";
