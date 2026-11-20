'use client';

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  label = 'Quantity',
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const set = (v: number) => onChange(Math.min(Math.max(v, min), max));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-full border border-white/[0.14] bg-[#08080A]">
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="px-3 py-2 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-ink-900 disabled:opacity-30"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) set(n);
        }}
        className="w-11 border-x border-white/[0.08] bg-transparent py-2 text-center text-[13px] font-medium tabular-nums text-ink-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="px-3 py-2 text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-ink-900 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
