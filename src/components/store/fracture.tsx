import { cn } from '@/lib/utils';

/**
 * Fracture — an engraved shard rule used to separate chapters.
 *
 * Pure decoration (aria-hidden, no text, no data): hand-plotted shard lines in
 * porcelain hairline with a single champagne seam. It scales fluidly with
 * preserveAspectRatio="none" and never intercepts pointer events.
 */
export function Fracture({ className, seam = true }: { className?: string; seam?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none relative w-full overflow-hidden', className)}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        fill="none"
        strokeWidth="1"
      >
        <path
          d="M0 44 L 210 44 L 252 20 L 300 52 L 372 52 L 410 34 L 468 58 L 560 58 L 604 26 L 648 47 L 742 47 L 786 16 L 826 47 L 918 47 L 962 30 L 1010 60 L 1104 60 L 1148 38 L 1198 52 L 1266 52 L 1308 22 L 1362 44 L 1440 44"
          stroke="rgba(245,243,236,0.11)"
        />
        <path d="M252 20 L 268 44 L 300 52" stroke="rgba(245,243,236,0.07)" />
        <path d="M786 16 L 806 44 L 826 47" stroke="rgba(245,243,236,0.07)" />
        <path d="M1308 22 L 1326 44 L 1362 44" stroke="rgba(245,243,236,0.07)" />
        {seam && (
          <>
            <path d="M604 26 L 648 47 L 618 60" stroke="rgba(198,173,122,0.45)" />
            <path d="M962 30 L 948 8" stroke="rgba(198,173,122,0.3)" strokeLinecap="round" />
            <path d="M1148 38 L 1168 62" stroke="rgba(198,173,122,0.22)" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}
