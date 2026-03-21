"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { Mail, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const magicLinkEnabled = Boolean(process.env.NEXT_PUBLIC_MAGIC_LINK_ENABLED === "true");

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canSubmitMagicLink = useMemo(() => email.trim().length > 3 && email.includes("@"), [email]);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.replace("/dashboard");
    }
  }, [isAuthenticated]);

  async function handleOAuth(provider: "google" | "github") {
    if (isSubmitting) return;
    setMessage(null);
    setIsSubmitting(true);
    try {
      const { redirect } = await signIn(provider, { redirectTo: "/dashboard" });
      if (redirect && typeof window !== "undefined") {
        window.location.assign(redirect.toString());
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !canSubmitMagicLink) return;
    setMessage(null);
    setIsSubmitting(true);
    try {
      await signIn("resend", new FormData(event.currentTarget));
      setMessage(`Magic link sent to ${email.trim()}. Open that email in the same browser session and continue.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send magic link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Sparkles className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary-400" />
            <span className="text-2xl font-bold">Mindra</span>
          </div>
          <h2 className="text-3xl font-bold">Welcome back</h2>
          <p className="mt-2 text-white/60">Sign in to continue to your dashboard.</p>
        </div>

        <div className="space-y-4">
          {magicLinkEnabled && (
            <form onSubmit={handleMagicLink} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm text-white/70">Email magic link</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none ring-0 placeholder:text-white/30"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !canSubmitMagicLink}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                Send magic link
              </button>
              <p className="text-xs text-white/45">Temporary fallback while Google OAuth is being stabilized.</p>
            </form>
          )}

          {message && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              {message}
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleOAuth("google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FcGoogle className="w-5 h-5" />
            Continue with Google
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleOAuth("github")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FaGithub className="w-5 h-5" />
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
