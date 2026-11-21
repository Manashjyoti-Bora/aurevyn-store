import Link from 'next/link';
import { WarnIcon } from '@/components/ui/icons';

/**
 * Shown on the home page and FAQ while settings.demoMode is true.
 * Keeps the demo/production boundary unmistakable while staying compact
 * and legible at 320px–390px mobile viewports.
 */
export function DemoExplainer({ activeCount }: { activeCount?: number } = {}) {
  const hasProducts = activeCount === undefined || activeCount > 0;

  return (
    <div
      role="note"
      aria-label="Demo mode notice"
      className="rounded-2xl border border-accent-400/25 bg-cream-100 p-4 text-ink-800 shadow-hair sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-400/15 text-accent-300 ring-1 ring-accent-400/30">
            <WarnIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-300 sm:text-[11px]">
              This store is running in demo mode
            </p>
            <p className="text-[11px] text-ink-500 sm:text-xs">
              Evaluation environment — test payments only, no real orders are fulfilled.
            </p>
          </div>
        </div>
        <Link
          href="/admin/settings"
          className="rounded-full border border-white/[0.14] px-3.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-700 transition-colors hover:border-accent-400/50 hover:text-ink-950"
        >
          Admin → Settings
        </Link>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[0.08] pt-4 text-xs text-ink-400 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-1.5">
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
          <span>
            {hasProducts
              ? 'Products shown are sample catalog entries for evaluating the platform.'
              : 'No active storefront products are published yet; sample or live catalog items can be added from Admin.'}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
          <span>
            Payments (when enabled) run through a clearly-labelled TEST provider — no real money
            moves.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
          <span>Orders placed here are not fulfilled or shipped.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
          <span>
            The owner can switch off demo mode in <strong>Admin → Settings</strong> once real
            products, payment credentials and shipping arrangements are configured (see
            docs/OWNER_RUNBOOK.md).
          </span>
        </li>
      </ul>
    </div>
  );
}
