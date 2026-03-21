'use client';

import { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { api } from '../../../convex/_generated/api';

export default function SettingsPage() {
  const router = useRouter();
  const updateSettings = useMutation(api.users.updateSettings);
  const [morningTime, setMorningTime] = useState('07:00');
  const [eveningTime, setEveningTime] = useState('21:00');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">Mindra</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* Reminder Settings */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Reminder Times
          </h2>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="font-medium">Morning Reminder</span>
              </label>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
              />
              <p className="text-sm text-white/40 mt-2">
                We'll remind you to watch your morning mind movie at this time.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="font-medium">Evening Reminder</span>
              </label>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
              />
              <p className="text-sm text-white/40 mt-2">
                We'll remind you to watch your evening mind movie at this time.
              </p>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-white/40">Receive reminders on your device</p>
              </div>
              <div className="w-12 h-6 bg-primary-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-white/40">Get updates via email</p>
              </div>
              <div className="w-12 h-6 bg-primary-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium">Daily Summary</p>
                <p className="text-sm text-white/40">Get a daily recap of your progress</p>
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
                Saving...
              </>
            ) : (
              <>
                {saved ? (
                  <>
                    <Check className="w-5 h-5" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
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
