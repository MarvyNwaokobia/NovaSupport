export function ProfileCardSkeleton() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-7 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10" />
          <div className="space-y-3">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-8 w-48 rounded bg-white/10" />
            <div className="h-4 w-64 rounded bg-white/10" />
          </div>
        </div>
        <div className="w-full sm:w-64 h-24 rounded-3xl bg-white/5" />
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="flex gap-3">
          <div className="h-10 w-20 rounded-full bg-white/5" />
          <div className="h-10 w-20 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function MilestoneSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-3 w-48 rounded bg-white/5" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="w-full bg-white/5 h-2 rounded-full" />
        <div className="flex justify-between">
          <div className="h-3 w-20 rounded bg-white/5" />
          <div className="h-3 w-10 rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function SupportPanelSkeleton() {
  return (
    <div className="rounded-[2rem] border border-gold/25 bg-gold/10 p-7 animate-pulse">
      <div className="h-4 w-24 rounded bg-white/10 mb-6" />
      <div className="h-8 w-48 rounded bg-white/10 mb-8" />
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-white/5" />
          <div className="h-12 w-full rounded-xl bg-white/5" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-white/5" />
          <div className="h-12 w-full rounded-xl bg-white/5" />
        </div>
        <div className="h-12 w-full rounded-full bg-white/10 mt-6" />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="mt-6 rounded-3xl border border-white/5 bg-white/[0.02] p-6 animate-pulse">
      <div className="h-3 w-32 rounded bg-white/10 mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="h-4 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
      <div className="space-y-12">
        <div className="space-y-3">
          <ProfileCardSkeleton />
          <div className="px-2">
            <div className="h-10 w-full rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>

        <div className="px-2 space-y-4">
          <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
          <div className="space-y-4">
            <MilestoneSkeleton />
            <MilestoneSkeleton />
          </div>
        </div>

        <div className="px-2">
          <div className="h-10 w-64 rounded bg-white/5 animate-pulse" />
        </div>
      </div>

      <aside className="sticky top-24 space-y-6">
        <SupportPanelSkeleton />
        <LeaderboardSkeleton />
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 animate-pulse">
            <div className="h-3 w-32 rounded bg-white/10 mb-4" />
            <div className="space-y-4">
                <div className="flex justify-between"><div className="h-4 w-20 rounded bg-white/5"/><div className="h-4 w-16 rounded bg-white/5"/></div>
                <div className="flex justify-between"><div className="h-4 w-20 rounded bg-white/5"/><div className="h-4 w-16 rounded bg-white/5"/></div>
                <div className="h-1.5 w-full rounded-full bg-white/5 mt-2" />
            </div>
        </div>
      </aside>
    </div>
  );
}
