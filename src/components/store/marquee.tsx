import { cn } from '@/lib/utils';

/**
 * Infinite editorial ticker. Pure CSS (transform-only), duplicated track for a
 * seamless loop, paused on hover, and stopped entirely under
 * prefers-reduced-motion. Content is passed in by the caller — never invented
 * here.
 */
export function Marquee({
  items,
  className,
  separator = '✦',
}: {
  items: string[];
  className?: string;
  separator?: string;
}) {
  if (items.length === 0) return null;

  const track = (
    <div className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center">
          <span className="whitespace-nowrap px-6 text-[11px] font-medium uppercase tracking-[0.24em] text-ink-400 sm:text-xs">
            {item}
          </span>
          <span className="shrink-0 text-[8px] text-accent-400/70" aria-hidden="true">
            {separator}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={cn('marquee', className)} aria-hidden="true">
      <div className="marquee-track">
        {track}
        {track}
      </div>
    </div>
  );
}
