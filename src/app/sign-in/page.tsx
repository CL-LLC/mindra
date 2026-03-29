'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/lib/hooks';
import { useLanguage } from '@/lib/hooks';
import { Sparkles, Loader2, Mail } from 'lucide-react';

export default function SignInPage() {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [magicEmail, setMagicEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn('google', { redirectTo: '/dashboard' });
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHub = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn('github', { redirectTo: '/dashboard' });
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn('resend', { email: magicEmail.trim(), redirectTo: '/dashboard' });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary-400" />
            <span className="text-2xl font-bold">{t('app.name')}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('auth.welcomeBack')}</h1>
          <p className="text-white/60">{t('auth.signInToContinue')}</p>
        </div>

        {sent ? (
          <div className="bg-emerald-500/15 border border-emerald-400/20 rounded-xl p-6 text-center">
            <p className="text-emerald-200">Check your email for a magic link to sign in.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <button
                onClick={handleGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-slate-900 rounded-lg font-medium transition-colors disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.continueWithGoogle')}
              </button>

              <button
                onClick={handleGitHub}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-lg font-medium transition-colors disabled:opacity-60"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                {t('auth.continueWithGitHub')}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-white/40">or</span>
              </div>
            </div>

            <form onSubmit={handleMagicEmail} className="space-y-3">
              <label className="block text-sm text-white/70 mb-2">{t('auth.emailLabel')}</label>
              <input
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={isLoading || !magicEmail.trim()}
                className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {t('auth.sendMagicLink')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
