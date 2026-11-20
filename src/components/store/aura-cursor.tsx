'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Aura — a single light pool that trails the pointer inside its parent.
 *
 * Not a custom cursor: the real cursor is untouched. This is atmosphere, the
 * way a gallery spotlight follows a visitor. It is:
 *  - desktop fine-pointer only (never runs on touch or in reduced-motion),
 *  - transform-only, rAF-throttled, listener passive and removed on unmount,
 *  - parent-relative (position it inside a `relative` section),
 *  - skipped when the section is off screen, so it costs nothing once you
 *    have scrolled past the hero.
 */
export function AuraCursor({ className, size = 420 }: { className?: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let visible = false;
    let watching = false;

    const frame = () => {
      raf = 0;
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (Math.abs(tx - cx) > 0.6 || Math.abs(ty - cy) > 0.6) raf = requestAnimationFrame(frame);
    };

    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      tx = event.clientX - rect.left;
      ty = event.clientY - rect.top;
      if (!visible) {
        visible = true;
        cx = tx;
        cy = ty;
        el.style.opacity = '1';
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onLeave = () => {
      visible = false;
      el.style.opacity = '0';
    };

    const add = () => {
      if (watching) return;
      watching = true;
      host.addEventListener('pointermove', onMove, { passive: true });
      host.addEventListener('pointerleave', onLeave);
    };
    const remove = () => {
      if (!watching) return;
      watching = false;
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      onLeave();
    };

    // Only listen while the section is actually on screen.
    if (typeof IntersectionObserver === 'undefined') {
      add();
      return () => {
        remove();
        if (raf) cancelAnimationFrame(raf);
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) add();
          else remove();
        }
      },
      { rootMargin: '10% 0px' }
    );
    io.observe(host);

    return () => {
      io.disconnect();
      remove();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('spotlight', className)}
      style={{
        width: size,
        height: size,
        transform: 'translate3d(-9999px, 0, 0) translate(-50%, -50%)',
      }}
    />
  );
}
