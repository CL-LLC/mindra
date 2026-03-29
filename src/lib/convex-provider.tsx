'use client';

import { ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { useQuery, useConvexAuth } from "convex/react";
import { useEffect, useState, ReactNode } from "react";
import { LanguageProvider, useLanguage } from "@/lib/i18n/context";
import { LanguageOnboarding } from "@/components/LanguageOnboarding";
import { api } from "../../convex/_generated/api";
import { Sparkles } from "lucide-react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function HtmlLangSetter() {
  const { language } = useLanguage();
  
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);
  
  return null;
}

function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const { needsOnboarding } = useLanguage();
  
  const isLoading = authLoading || (isAuthenticated && user === undefined);
  
  // Show onboarding for new users without language preference
  if (!isLoading && needsOnboarding) {
    return <LanguageOnboarding />;
  }
  
  return <>{children}</>;
}

function InnerProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  
  const isLoading = authLoading || (isAuthenticated && user === undefined);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary-400 animate-pulse" />
          <span className="text-white/60">Loading...</span>
        </div>
      </div>
    );
  }
  
  return (
    <LanguageProvider
      userPreferredLanguage={user?.preferredLanguage ?? null}
      isAuthenticated={isAuthenticated}
    >
      <HtmlLangSetter />
      <LanguageWrapper>{children}</LanguageWrapper>
    </LanguageProvider>
  );
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ConvexAuthNextjsProvider client={convex}>
      <InnerProvider>{children}</InnerProvider>
    </ConvexAuthNextjsProvider>
  );
}
