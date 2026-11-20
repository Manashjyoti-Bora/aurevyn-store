import Link from 'next/link';
import { WarnIcon } from '@/components/ui/icons';

/**
 * Demo-mode banner. Shown whenever settings.demoMode is true so nobody can
 * mistake test data / TEST payments for a live production store.
 */
export function DemoBanner({ demoMode }: { demoMode: boolean }) {
  if (!demoMode) return null;
  return (
    <div
      className="border-b border-accent-400/20 bg-[#0B0B0E] px-3 py-2 text-center text-[10px] font-medium sm:px-4 sm:text-[11px]"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-300">
          <WarnIcon className="h-3 w-3 shrink-0 text-accent-400" />
          Demo mode
        </span>
        <span className="text-ink-400">
          Sample catalogue &amp; test payments only — no real orders are fulfilled.
        </span>
        <Link
          href="/faq#demo-mode"
          className="font-medium text-accent-300 underline decoration-accent-400/40 underline-offset-2 transition-colors hover:text-accent-200"
        >
          What is this?
        </Link>
      </div>
    </div>
  );
}
