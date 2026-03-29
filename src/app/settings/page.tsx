'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  Bell,
  Clock,
  Save,
  Check,
  Loader2,
  Globe
} from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useConvexUser, useLanguage } from '@/lib/hooks';
import { Language } from '@/lib/i18n/dictionary';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useConvexUser();
  const { language, setLanguage, t, isLoading: langLoading } = useLanguage();
  const updateSettings = useMutation(api.users.updateSettings);
  const [morningTime, setMorningTime] = useState('07:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [langSaved, setLangSaved] = useState(false);

  // Initialize reminder times from user data
  useEffect(() => {
    if (user) {
      setMorningTime(user.morningReminderTime ?? '07:00');
      setEveningTime(user.eveningReminderTime ?? '21:00');
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings({
        morningReminderTime: morningTime,
        eveningReminderTime: eveningTime,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (newLanguage: Language) => {
    setLangSaved(false);
    await setLanguage(newLanguage);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t("dashboard.backToDashboard")}
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">{t("app.name")}</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">{t("settings.title")}</h1>

        {/* Language Settings */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t("settings.language")}
          </h2>
          <p className="text-sm text-white/40 mb-4">
            {t("settings.languageDesc")}
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleLanguageChange("en")}
              disabled={langLoading}
              className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-lg transition-all border ${
                language === "en"
                  ? "bg-primary-500/20 border-primary-500 text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
              } disabled:opacity-60`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇺🇸</span>
                <span className="font-medium">{t("settings.english")}</span>
              </div>
              {language === "en" && (
                <div className="flex items-center gap-2">
                  {langSaved && <Check className="w-4 h-4 text-green-400" />}
                  <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>

            <button
              onClick={() => handleLanguageChange("es")}
              disabled={langLoading}
              className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-lg transition-all border ${
                language === "es"
                  ? "bg-primary-500/20 border-primary-500 text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
              } disabled:opacity-60`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇪🇸</span>
                <span className="font-medium">{t("settings.spanish")}</span>
              </div>
              {language === "es" && (
                <div className="flex items-center gap-2">
                  {langSaved && <Check className="w-4 h-4 text-green-400" />}
                  <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Reminder Settings */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t("settings.reminderTimes")}
          </h2>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="font-medium">{t("settings.morningReminder")}</span>
              </label>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
              />
              <p className="text-sm text-white/40 mt-2">
                {t("settings.morningReminderDesc")}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="font-medium">{t("settings.eveningReminder")}</span>
              </label>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
              />
              <p className="text-sm text-white/40 mt-2">
                {t("settings.eveningReminderDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-semibold mb-6">{t("settings.notificationPreferences")}</h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium">{t("settings.pushNotifications")}</p>
                <p className="text-sm text-white/40">{t("settings.pushNotificationsDesc")}</p>
              </div>
              <div className="w-12 h-6 bg-primary-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium">{t("settings.emailNotifications")}</p>
                <p className="text-sm text-white/40">{t("settings.emailNotificationsDesc")}</p>
              </div>
              <div className="w-12 h-6 bg-primary-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium">{t("settings.dailySummary")}</p>
                <p className="text-sm text-white/40">{t("settings.dailySummaryDesc")}</p>
              </div>
              <div className="w-12 h-6 bg-primary-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("settings.saving")}
              </>
            ) : (
              <>
                {saved ? (
                  <>
                    <Check className="w-5 h-5" />
                    {t("settings.saved")}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {t("settings.saveChanges")}
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
