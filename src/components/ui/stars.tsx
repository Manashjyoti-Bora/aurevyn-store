import { cn } from '@/lib/utils';

/**
 * Star rating. Rendered from a REAL average only - callers must not render this
 * without at least one published review (see ratingsForProducts).
 * The fractional part is drawn by clipping a second, filled star row.
 */
export function Stars({
  value,
  size = 14,
  className,
  label,
}: {
  value: number;
  size?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const width = (clamped / 5) * 100;
  return (
    <span
      className={cn('relative inline-flex shrink-0 align-middle', className)}
      role="img"
      aria-label={label ?? `${clamped.toFixed(1)} out of 5 stars`}
    >
      <StarRow size={size} className="text-white/20" />
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ width: `${width}%` }}
        aria-hidden="true"
      >
        <StarRow size={size} className="text-accent-400" />
      </span>
    </span>
  );
}

function StarRow({ size, className }: { size: number; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-[2px]', className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="currentColor"
          className="shrink-0"
        >
          <path d="M10 1.6l2.47 5.2 5.71.78-4.18 3.98 1.03 5.66L10 14.5l-5.03 2.72 1.03-5.66L1.82 7.58l5.71-.78L10 1.6Z" />
        </svg>
      ))}
    </span>
  );
}

/** Compact inline rating chip: stars + "4.7 (12)". */
export function RatingChip({
  average,
  count,
  className,
  size = 12,
}: {
  average: number;
  count: number;
  className?: string;
  size?: number;
}) {
  if (count <= 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Stars value={average} size={size} />
      <span className="text-[11px] font-medium tabular-nums text-ink-500">
        {average.toFixed(1)}
        <span className="text-ink-400"> ({count})</span>
      </span>
    </span>
  );
}
