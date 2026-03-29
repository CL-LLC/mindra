"use client";

import { useState } from "react";
import { Sparkles, Globe } from "lucide-react";
import { useLanguage, Language } from "@/lib/i18n/context";

export function LanguageOnboarding() {
  const { t, setLanguage, language, isLoading } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  const handleSelect = (lang: Language) => {
    setSelectedLanguage(lang);
  };

  const handleContinue = async () => {
    if (selectedLanguage) {
      await setLanguage(selectedLanguage);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary-400" />
            <span className="text-2xl font-bold">Mindra</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">{t("onboarding.welcome")}</h2>
          <p className="text-white/60">{t("onboarding.chooseLanguage")}</p>
          <p className="text-sm text-white/40 mt-1">{t("onboarding.languageDesc")}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleSelect("en")}
            disabled={isLoading}
            className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-lg transition-all border ${
              selectedLanguage === "en"
                ? "bg-primary-500/20 border-primary-500 text-white"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
            } disabled:opacity-60`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇺🇸</span>
              <span className="font-medium text-lg">English</span>
            </div>
            {selectedLanguage === "en" && (
              <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          <button
            onClick={() => handleSelect("es")}
            disabled={isLoading}
            className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-lg transition-all border ${
              selectedLanguage === "es"
                ? "bg-primary-500/20 border-primary-500 text-white"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
            } disabled:opacity-60`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇪🇸</span>
              <span className="font-medium text-lg">Español</span>
            </div>
            {selectedLanguage === "es" && (
              <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {!selectedLanguage && (
          <p className="text-center text-sm text-white/40">
            {t("onboarding.selectLanguage")}
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedLanguage || isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Globe className="w-4 h-4" />
          {isLoading ? "..." : t("onboarding.continue")}
        </button>
      </div>
    </div>
  );
}
