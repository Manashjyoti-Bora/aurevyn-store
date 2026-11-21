'use client';

import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/lib/money';
import { toast } from '@/components/ui/toaster';

/**
 * Owner order voice-alert.
 *
 * Polls the recent-orders endpoint every 20s while an admin is signed in. Any
 * order that has not been announced yet is read aloud through the browser's
 * speechSynthesis (the same free, local, no-key voice the storefront concierge
 * uses) and surfaced as a toast. This is the "system a voice a muk kobo" half
 * of the Meesho resale loop: the owner hears the order number, customer,
 * amount and their margin the moment it lands, then places it on Meesho.
 *
 * Nothing is sent to any server for speech — it is 100% in-browser. The toggle
 * is persisted locally; turning it off cancels any in-flight speech.
 */

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  grandTotalPaise: number;
  estimatedProfitPaise: number;
}

const ENABLED_KEY = 'zenvora-voice-orders';
const SEEN_KEY = 'zenvora-voice-seen';
const POLL_MS = 20_000;

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-200)));
  } catch {
    /* ignore */
  }
}

export function OwnerVoiceAlert() {
  const [enabled, setEnabled] = useState(true);
  const seenRef = useRef<Set<string>>(loadSeen());
  const enabledRef = useRef(true);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    const stored = localStorage.getItem(ENABLED_KEY);
    const on = stored === null ? true : stored === '1';
    setEnabled(on);
    enabledRef.current = on;
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
    try {
      localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [enabled]);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (cancelled) return;
      try {
        const since = new Date(Date.now() - 15 * 60_000).toISOString();
        const res = await fetch(`/api/admin/operations/recent-orders?since=${encodeURIComponent(since)}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { orders: RecentOrder[] };
        for (const o of data.orders) {
          if (seenRef.current.has(o.id)) continue;
          seenRef.current.add(o.id);
          if (enabledRef.current) {
            speakOrder(o);
            toast(`New order ${o.orderNumber} · ${formatINR(o.grandTotalPaise)}`, 'info');
          }
        }
        saveSeen(seenRef.current);
      } catch {
        /* network blip — try again next poll */
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [supported]);

  function speakOrder(o: RecentOrder) {
    try {
      const text =
        `New Zenvora order ${o.orderNumber}, from ${o.customerName}. ` +
        `Amount ${formatINR(o.grandTotalPaise)}. ` +
        `Your estimated profit ${formatINR(o.estimatedProfitPaise)}. ` +
        `Please place it on Meesho.`;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-IN';
      u.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const voice =
        voices.find((v) => v.lang?.toLowerCase().startsWith('en-in')) ??
        voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    } catch {
      /* speech unavailable */
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled((e) => !e)}
      aria-pressed={enabled}
      title={enabled ? 'Order voice alerts ON' : 'Order voice alerts OFF'}
      className="btn-press fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-[75] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0e0e11]/80 text-ink-700 shadow-lift backdrop-blur lg:bottom-6"
      style={{ color: enabled ? '#c6ad7a' : undefined }}
    >
      {enabled ? <SpeakerIcon className="h-5 w-5" /> : <SpeakerOffIcon className="h-5 w-5" />}
      <span className="sr-only">Toggle order voice alerts</span>
    </button>
  );
}

function SpeakerIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9.5v5a1.5 1.5 0 0 0 1.5 1.5H8l4 3.5V6L8 9.5H5.5A1.5 1.5 0 0 0 4 11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

function SpeakerOffIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9.5v5a1.5 1.5 0 0 0 1.5 1.5H8l4 3.5V6L8 9.5H5.5A1.5 1.5 0 0 0 4 11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m16 9.5 5 5m0-5-5 5" />
    </svg>
  );
}
