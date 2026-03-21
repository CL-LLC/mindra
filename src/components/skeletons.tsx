export function CardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse">
      <div className="h-6 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-4 bg-white/10 rounded w-1/2 mb-4" />
      <div className="flex gap-2">
        <div className="h-8 bg-white/10 rounded flex-1" />
        <div className="h-8 bg-white/10 rounded flex-1" />
      </div>
    </div>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-video bg-white/10" />
      <div className="p-4">
        <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
        <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
        <div className="flex gap-2">
          <div className="h-8 bg-white/10 rounded flex-1" />
          <div className="h-8 bg-white/10 rounded flex-1" />
          <div className="h-8 bg-white/10 rounded flex-1" />
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-900 p-8 animate-pulse">
      <div className="max-w-4xl mx-auto">
        <div className="h-4 bg-white/10 rounded w-24 mb-6" />
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <div className="h-8 bg-white/10 rounded w-1/2 mb-2" />
          <div className="h-4 bg-white/10 rounded w-1/3" />
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="h-5 bg-white/10 rounded w-16 mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded w-full" />
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-4 bg-white/10 rounded w-5/6" />
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="h-5 bg-white/10 rounded w-24 mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded w-full" />
              <div className="h-4 bg-white/10 rounded w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
