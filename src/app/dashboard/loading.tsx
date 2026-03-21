import { MovieCardSkeleton } from '@/components/skeletons';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <main className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="h-8 bg-white/10 rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-white/10 rounded w-64 animate-pulse" />
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
