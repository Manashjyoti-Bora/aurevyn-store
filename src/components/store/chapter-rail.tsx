'use client';

import { useEffect, useState } from 'react';

/**
 * ChapterRail — a fixed editorial index for long pages (desktop only).
 *
 * Each entry is an anchor to a real section id that already exists on the page;
 * the active chapter is derived with one IntersectionObserver band at the middle
 * of the viewport (no scroll listeners). Nothing is invented: labels come from
 * the page's own section headings.
 */
export function ChapterRail({ chapters }: { chapters: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = chapters
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-46% 0px -46% 0px', threshold: [0, 0.5, 1] }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [chapters]);

  if (chapters.length === 0) return null;

  return (
    <nav
      aria-label="Page chapters"
      className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 xl:flex"
    >
      {chapters.map((chapter, i) => {
        const isActive = active === chapter.id;
        return (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            aria-current={isActive ? 'true' : undefined}
            className="group flex items-center gap-2.5"
          >
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.22em] text-ink-400 opacity-0 transition-all duration-300 ease-aurevyn group-hover:max-w-[9rem] group-hover:opacity-100 group-focus-visible:max-w-[9rem] group-focus-visible:opacity-100">
              {chapter.label}
            </span>
            <span
              className={`h-px transition-all duration-300 ease-aurevyn ${
                isActive
                  ? 'w-7 bg-accent-400'
                  : 'w-3.5 bg-white/25 group-hover:w-5 group-hover:bg-white/50'
              }`}
              aria-hidden="true"
            />
            <span
              className={`w-4 text-right text-[9px] tabular-nums tracking-[0.14em] transition-colors duration-300 ${
                isActive ? 'text-accent-300' : 'text-ink-300'
              }`}
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
