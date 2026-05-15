export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="h-12 rounded-2xl bg-gradient-to-r from-white/[.03] via-white/[.08] to-white/[.03] bg-[length:200%_100%] animate-shimmer" />)}
    </div>
  );
}
