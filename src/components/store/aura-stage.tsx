import { cn } from '@/lib/utils';

/**
 * The chromatic atmosphere layer (2026 refresh).
 *
 * Three slow, blurred colour fields — violet, cyan and rose — under a grain
 * wash. Static blur, transform-only animation, and fully disabled by the global
 * prefers-reduced-motion rule. Purely decorative: aria-hidden, no pointer
 * events, no layout, no content.
 */
export function AuraStage({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="aura-orb left-[4%] top-[-16%] h-[34rem] w-[34rem] bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.55),transparent_68%)]" />
      <div
        className="aura-orb right-[-8%] top-[6%] h-[28rem] w-[28rem] bg-[radial-gradient(circle_at_60%_40%,rgba(34,211,238,0.38),transparent_70%)]"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="aura-orb bottom-[-22%] left-[36%] h-[30rem] w-[30rem] bg-[radial-gradient(circle_at_50%_50%,rgba(251,113,133,0.3),transparent_70%)]"
        style={{ animationDelay: '-13s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent_35%,rgba(8,8,10,0.72)_100%)]" />
    </div>
  );
}
