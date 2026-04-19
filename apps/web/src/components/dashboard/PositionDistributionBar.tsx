interface PositionDistributionBarProps {
  top10: number;
  top3: number;
  position1: number;
  total: number;
  showLabels?: boolean;
}

export function PositionDistributionBar({
  top10,
  top3,
  position1,
  total,
  showLabels = true
}: PositionDistributionBarProps) {
  if (total === 0) {
    return (
      <div className="space-y-1">
        <div className="h-6 w-full rounded-sm border bg-muted" />
        <p className="text-xs text-muted-foreground">No keywords tracked</p>
      </div>
    );
  }

  const pct1 = (position1 / total) * 100;
  const pct3 = ((top3 - position1) / total) * 100;
  const pct10 = ((top10 - top3) / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex h-6 w-full overflow-hidden rounded-sm border">
        {pct1 > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${pct1}%` }}
            title={`#1: ${position1} keywords`}
          />
        )}
        {pct3 > 0 && (
          <div
            className="bg-emerald-400 transition-all"
            style={{ width: `${pct3}%` }}
            title={`Top 3: ${top3 - position1} keywords`}
          />
        )}
        {pct10 > 0 && (
          <div
            className="bg-emerald-300 transition-all"
            style={{ width: `${pct10}%` }}
            title={`Top 10: ${top10 - top3} keywords`}
          />
        )}
        <div className="flex-1 bg-muted" />
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>#1: {position1}</span>
          <span>Top 3: {top3}</span>
          <span>Top 10: {top10}</span>
        </div>
      )}
    </div>
  );
}
