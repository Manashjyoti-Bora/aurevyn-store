'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { MicButton, useDictation, useSpeech } from '@/components/ui/voice-controls';
import type { VoiceBriefing } from '@/lib/cofounder/voice';
import type { CofounderAnswer } from '@/lib/cofounder/types';

const STORAGE_KEY = 'nirvora.cofounder.voice247';
const POLL_MS = 5 * 60_000;

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * The co-founder's always-on voice.
 *
 * The browser reads a server-built briefing on a timer and speaks only when a
 * measured number changed — so the 24×7 mode is useful instead of noisy. It
 * can also take a spoken question and answer from the same grounded facts as
 * the chat. No audio leaves the store's server: speech runs in the browser.
 */
export function CofounderVoice({ initial }: { initial: VoiceBriefing }) {
  const [briefing, setBriefing] = useState<VoiceBriefing>(initial);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastFingerprint = useRef(initial.fingerprint);
  const speech = useSpeech();
  const { speak } = speech;
  const dictation = useDictation(handleQuestion);
  const [question, setQuestion] = useState('');
  const handledRef = useRef<string>('');

  const refresh = useCallback(
    async ({ speakIt }: { speakIt: boolean }) => {
      try {
        const next = await apiFetch<VoiceBriefing>('/api/admin/cofounder/briefing');
        setBriefing(next);
        setError(null);
        if (speakIt && next.fingerprint !== lastFingerprint.current) {
          lastFingerprint.current = next.fingerprint;
          speak(next.script);
        }
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : 'Could not read the store for the voice.'
        );
      }
    },
    [speak]
  );

  // Restore the owner's choice; voice is only spoken after an explicit toggle.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY) === 'on') {
      setAlwaysOn(true);
      speech.toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!alwaysOn) return;
    const timer = window.setInterval(() => void refresh({ speakIt: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [alwaysOn, refresh]);

  function toggleAlwaysOn() {
    const next = !alwaysOn;
    setAlwaysOn(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    }
    if (next) {
      if (!speech.enabled) speech.toggle();
      void refresh({ speakIt: true });
      speak(briefing.script);
    } else {
      speech.stop();
    }
  }

  async function handleQuestion(text: string) {
    const clean = text.trim().slice(0, 300);
    if (!clean || busy || handledRef.current === clean) return;
    handledRef.current = clean;
    setQuestion(clean);
    setBusy(true);
    setError(null);
    try {
      const reply = await apiFetch<CofounderAnswer>('/api/admin/cofounder/chat', {
        body: { message: clean },
      });
      setAnswer(reply.message);
      if (speech.enabled) speak(reply.message);
      else if (!speech.supported) setAnswer(reply.message);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'The co-founder could not answer.');
    } finally {
      setBusy(false);
      window.setTimeout(() => {
        handledRef.current = '';
      }, 1500);
    }
  }

  return (
    <section className="aura-card relative overflow-hidden rounded-2xl border border-white/10 bg-[#08080A] p-5 text-cream-50 shadow-card">
      <div className="aura-orb" aria-hidden="true" />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-200 via-accent-300 to-accent-500 text-[#08080A]">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent-300/25" aria-hidden="true" />
              <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                <path strokeLinecap="round" d="M4 9.5h3L12 5v14l-5-4.5H4z" />
                <path strokeLinecap="round" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Co-founder voice</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-cream-50/50">
                Always on · grounded in live records
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleAlwaysOn}
            aria-pressed={alwaysOn}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              alwaysOn
                ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                : 'border-white/15 text-cream-50/70 hover:border-white/30'
            }`}
          >
            {alwaysOn ? '● 24×7 listening' : 'Start 24×7 voice'}
          </button>
        </div>

        <p className="text-sm leading-relaxed text-cream-50/85">{briefing.script}</p>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {briefing.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
              <dt className="text-[9px] font-semibold uppercase tracking-wider text-cream-50/45">
                {stat.label}
              </dt>
              <dd className="text-sm font-bold tabular-nums text-cream-50">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {briefing.orders.length > 0 && (
          <div className="space-y-1.5">
            {briefing.orders.slice(0, 4).map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs"
              >
                <span className="font-mono font-semibold">{order.orderNumber}</span>
                <span className="text-cream-50/60">
                  {order.city} · {inr(order.totalPaise)} · margin{' '}
                  <strong className="text-emerald-300">{inr(order.marginPaise)}</strong>
                </span>
                <Link
                  href={order.supplierOrderId ? `/admin/supplier-orders?focus=${order.supplierOrderId}` : '/admin/orders'}
                  className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream-50/80 hover:border-white/35"
                >
                  {order.placedOnMeesho ? 'Meesho placed' : 'Add Meesho ID'}
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {speech.supported ? (
            <button
              type="button"
              onClick={() => speak(briefing.script)}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cream-50/75 hover:border-white/35"
            >
              Speak now
            </button>
          ) : (
            <span className="text-[11px] text-cream-50/40">
              This browser has no speech engine; the script stays readable here.
            </span>
          )}
          <MicButton dictation={dictation} className="border-white/15 text-cream-50/70" />
          <span className="text-[11px] text-cream-50/45">
            {busy ? 'Reading the store…' : 'Ask out loud: “what should I do today?”'}
          </span>
          <button
            type="button"
            onClick={() => void refresh({ speakIt: true })}
            className="ml-auto text-[11px] font-medium text-cream-50/50 underline-offset-2 hover:text-cream-50/80 hover:underline"
          >
            Refresh
          </button>
        </div>

        {question && (
          <p className="text-[11px] text-cream-50/50">
            Heard: “{question}”
          </p>
        )}
        {answer && (
          <p className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs leading-relaxed text-cream-50/85">
            {answer}
          </p>
        )}
        {dictation.error && <p className="text-[11px] text-amber-300">{dictation.error}</p>}
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
