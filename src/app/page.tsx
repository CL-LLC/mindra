import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Sparkles, Play, Target, Trophy } from 'lucide-react';

export default function Home() {
  const { userId } = auth();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-sm bg-slate-900/50 border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">Mindra</span>
          </div>
          <div className="flex items-center gap-4">
            {userId ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-white/80 hover:text-white transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">
                    Get Started
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance animate-fade-in">
            Visualize Your Dreams.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
              Make Them Reality.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-8 max-w-2xl mx-auto">
            AI-powered mind movies that you actually watch. Gamified tracking keeps you consistent. 
            Watch your goals come to life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignUpButton mode="modal">
              <button className="px-8 py-4 bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 rounded-xl font-semibold text-lg transition-all transform hover:scale-105">
                Create Your Mind Movie
              </button>
            </SignUpButton>
            <button className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
              <Play className="w-5 h-5" />
              See How It Works
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Mindra Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Created Videos</h3>
              <p className="text-white/60">
                Describe your dreams, and AI generates a personalized mind movie with affirmations, 
                images, and music.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-accent-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-accent-500/20 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-accent-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Daily Habit Tracking</h3>
              <p className="text-white/60">
                Morning and evening reminders. Streak tracking. Rewards for consistency. 
                Penalties for skipping.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-green-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Evolve & Grow</h3>
              <p className="text-white/60">
                Goals achieved? Level up. Not working? AI suggests improvements. 
                Your mind movie grows with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-white/10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Life?
            </h2>
            <p className="text-white/70 mb-8">
              Join thousands who are manifesting their dreams with Mindra.
            </p>
            <SignUpButton mode="modal">
              <button className="px-8 py-4 bg-white text-slate-900 hover:bg-white/90 rounded-xl font-semibold text-lg transition-colors">
                Start Free Today
              </button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="container mx-auto text-center text-white/50">
          <p>© 2026 Mindra. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
