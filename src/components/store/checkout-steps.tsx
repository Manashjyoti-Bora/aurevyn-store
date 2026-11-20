import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@/components/ui/icons';

export type CheckoutStepId = 'cart' | 'checkout' | 'confirmation';

const STEPS: { id: CheckoutStepId; label: string; href?: string }[] = [
  { id: 'cart', label: 'Shopping bag', href: '/cart' },
  { id: 'checkout', label: 'Address & payment' },
  { id: 'confirmation', label: 'Confirmation' },
];

/**
 * Progress rail for the transaction flow. One lacquer capsule, champagne for
 * completed steps, porcelain for the current one — no second colour system.
 */
export function CheckoutSteps({ current }: { current: CheckoutStepId }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <nav
      aria-label="Checkout progress"
      className="overflow-hidden rounded-full border border-white/[0.07] bg-[#0A0A0C] px-3.5 py-2.5 sm:px-5"
    >
      <ol className="flex w-full items-center justify-between gap-1.5 text-[10px] sm:w-auto sm:justify-start sm:gap-4">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const badge = (
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums transition-colors sm:h-6 sm:w-6 sm:text-[10px]',
                isCompleted && 'bg-accent-300 text-cream-50',
                isCurrent && 'bg-ink-900 text-cream-50 ring-1 ring-accent-300/45',
                !isCompleted && !isCurrent && 'border border-white/[0.12] text-ink-400'
              )}
            >
              {isCompleted ? <CheckIcon className="h-3 w-3" /> : String(i + 1).padStart(2, '0')}
            </span>
          );

          const text = (
            <>
              <span
                className={cn(
                  'uppercase tracking-[0.14em]',
                  isCurrent ? 'inline' : 'hidden sm:inline',
                  isCurrent
                    ? 'font-medium text-ink-900'
                    : isCompleted
                      ? 'text-ink-500'
                      : 'text-ink-400'
                )}
              >
                {step.label}
              </span>
              {!isCurrent && <span className="sr-only sm:hidden">{step.label}</span>}
            </>
          );

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex min-w-0 items-center gap-1.5 sm:gap-2"
            >
              {isCompleted && step.href ? (
                <Link
                  href={step.href}
                  className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-ink-900 sm:gap-2"
                >
                  {badge}
                  {text}
                </Link>
              ) : (
                <span className="inline-flex min-w-0 items-center gap-1.5 sm:gap-2">
                  {badge}
                  {text}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'ml-0.5 hidden h-px w-4 sm:inline-block sm:w-6',
                    i < currentIdx ? 'bg-accent-400/50' : 'bg-white/[0.1]'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
