export function StatCardSkeleton() {
  return (
    <div className="card p-4 min-h-[100px]">
      <div className="animate-pulse flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="w-16 h-3 rounded bg-skeleton" />
          <div className="w-20 h-6 rounded bg-skeleton" />
          <div className="w-12 h-3 rounded bg-skeleton" />
        </div>
        <div className="w-9 h-9 rounded-xl bg-skeleton" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }) {
  return (
    <div className="card p-6">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="w-32 h-5 rounded bg-skeleton" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-10 h-7 rounded-lg bg-skeleton" />
            ))}
          </div>
        </div>
        <div className="w-full rounded-xl bg-skeleton h-[200px] sm:h-[280px]" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }) {
  return (
    <div className="flex items-center gap-4 px-4 py-4 animate-pulse border-b border-surface-border">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-4 rounded bg-skeleton"
          style={{ maxWidth: `${[72, 56, 88, 64, 80][i % 5]}%` }}
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ items = 5 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-skeleton">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-skeleton" />
            <div className="space-y-1.5">
              <div className="w-24 h-4 rounded bg-skeleton" />
              <div className="w-16 h-3 rounded bg-skeleton" />
            </div>
          </div>
          <div className="w-16 h-5 rounded-full bg-skeleton" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-6">
      <div className="animate-pulse space-y-4">
        <div className="w-3/5 h-5 rounded bg-skeleton" />
        <div className="w-full h-4 rounded bg-skeleton" />
        <div className="w-4/5 h-4 rounded bg-skeleton" />
      </div>
    </div>
  );
}
