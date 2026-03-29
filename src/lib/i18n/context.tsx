"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useMutation } from "convex/react";
import { Language, DEFAULT_LANGUAGE, t as translate } from "./dictionary";
import { api } from "../../../convex/_generated/api";

export type { Language };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  isLoading: boolean;
  needsOnboarding: boolean;
  completeOnboarding: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

interface LanguageProviderProps {
  children: ReactNode;
  userPreferredLanguage: Language | null | undefined;
  isAuthenticated: boolean;
}

export function LanguageProvider({
  children,
  userPreferredLanguage,
  isAuthenticated,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initial state: use user preference or default
    return userPreferredLanguage ?? DEFAULT_LANGUAGE;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  
  const updateLanguage = useMutation(api.users.updateLanguage);

  // Update local state when user preference changes (e.g., after login)
  useEffect(() => {
    if (userPreferredLanguage) {
      setLanguageState(userPreferredLanguage);
    }
  }, [userPreferredLanguage]);

  // Check if we need to show onboarding
  const needsOnboarding = isAuthenticated && !userPreferredLanguage && !onboardingDismissed;

  const setLanguage = useCallback(async (newLanguage: Language) => {
    setLanguageState(newLanguage);
    
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        await updateLanguage({ language: newLanguage });
      } catch (error) {
        console.error("Failed to update language:", error);
        // Revert on error
        setLanguageState(userPreferredLanguage ?? DEFAULT_LANGUAGE);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, updateLanguage, userPreferredLanguage]);

  const completeOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
  }, []);

  const t = useCallback((key: string) => {
    return translate(key, language);
  }, [language]);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t,
    isLoading,
    needsOnboarding,
    completeOnboarding,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
