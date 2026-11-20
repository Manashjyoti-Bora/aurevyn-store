'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { MicButton, SpeakToggle, useDictation, useSpeech } from '@/components/ui/voice-controls';
import type { CofounderAnswer, CofounderStat } from '@/lib/cofounder/types';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  stats: CofounderStat[];
  actions: Array<{ label: string; href: string }>;
  followUps: string[];
}

const SUGGESTIONS = [
  'What should I do today?',
  'How are sales this month?',
  'Any stock alerts?',
  'Any cart abandonments?',
  'Any orders stuck?',
  'Any supplier issues?',
];

const TONE_CLASS: Record<NonNullable<CofounderStat['tone']>, string> = {
  neutral: 'text-ink-900',
  positive: 'text-emerald-700',
  warning: 'text-amber-700',
  negative: 'text-danger-600',
};

function SparkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.6c.4 0 .75.27.85.66l1.44 5.36a4.2 4.2 0 0 0 2.99 2.99l5.36 1.44a.87.87 0 0 1 0 1.7l-5.36 1.44a4.2 4.2 0 0 0-2.99 2.99l-1.44 5.36a.87.87 0 0 1-1.7 0l-1.44-5.36a4.2 4.2 0 0 0-2.99-2.99L3.36 14.7a.87.87 0 0 1 0-1.7l5.36-1.44a4.2 4.2 0 0 0 2.99-2.99l1.44-5.36A.87.87 0 0 1 12 2.6Z" />
    </svg>
  );
}

export function CofounderChat({ storeName, headline }: { storeName: string; headline: string }) {
  const [turns, setTurns] = useState<Turn[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello — I read ${storeName} live, not from memory. Right now: ${headline}. Ask me anything about sales, orders, stock, carts, suppliers or what to do next.`,
      stats: [],
      actions: [],
      followUps: ['What should I do today?', 'How are sales this month?', 'Any stock alerts?'],
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation(setInput);
  const speech = useSpeech();
  const { speak, stop: stopSpeech } = speech;
  const { setError: setDictationError } = dictation;
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const idRef = useRef(0);

  const nextId = () => {
    idRef.current += 1;
    return `cf-${idRef.current}`;
  };

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns, busy]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 400);
      if (!text || busy) return;
      setInput('');
      setError(null);
      setDictationError(null);
      setBusy(true);
      setTurns((previous) => [
        ...previous,
        { id: nextId(), role: 'user', text, stats: [], actions: [], followUps: [] },
      ]);

      try {
        const answer = await apiFetch<CofounderAnswer>('/api/admin/cofounder/chat', {
          body: { message: text },
        });
        setTurns((previous) => [
          ...previous,
          {
            id: nextId(),
            role: 'assistant',
            text: answer.message,
            stats: Array.isArray(answer.stats) ? answer.stats : [],
            actions: Array.isArray(answer.actions) ? answer.actions : [],
            followUps: Array.isArray(answer.followUps) ? answer.followUps : [],
          },
        ]);
        speak(answer.message);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not read the store just now. Nothing was guessed — try again.'
        );
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, speak, setDictationError]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-card">
      <div className="relative overflow-hidden border-b border-white/[0.07] bg-[#08080A] px-4 py-3.5 text-ink-900">
        <div className="grain" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-200 via-accent-300 to-accent-500 text-cream-50">
            <SparkIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight">AI Cofounder</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden="true" />
              Reads live store records · read-only
            </p>
          </div>
          <span className="rounded-full border border-accent-300/25 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-300">
            Grounded
          </span>
        </div>
      </div>

      <div
        ref={listRef}
        className="max-h-[460px] space-y-3 overflow-y-auto px-3 py-3 sm:px-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {turns.map((turn) => (
          <div key={turn.id} className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={turn.role === 'user' ? 'max-w-[85%]' : 'w-full max-w-[92%]'}>
              <div
                className={
                  turn.role === 'user'
                    ? 'rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2 text-sm leading-relaxed text-white'
                    : 'rounded-2xl rounded-bl-md border border-ink-900/10 bg-cream-50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-800'
                }
              >
                <p className="whitespace-pre-line">{turn.text}</p>

                {turn.stats.length > 0 && (
                  <dl className="mt-2.5 flex flex-wrap gap-1.5">
                    {turn.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-ink-900/10 bg-white px-2 py-1"
                      >
                        <dt className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                          {stat.label}
                        </dt>
                        <dd
                          className={`text-xs font-bold tabular-nums ${TONE_CLASS[stat.tone ?? 'neutral']}`}
                        >
                          {stat.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {turn.actions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {turn.actions.map((action) => (
                      <Link
                        key={action.href + action.label}
                        href={action.href}
                        className="btn-press inline-flex items-center gap-1 rounded-full border border-brand-600/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:border-brand-600/40 hover:text-brand-800"
                      >
                        {action.label}
                        <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {turn.role === 'assistant' && turn.followUps.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {turn.followUps.map((followUp) => (
                    <button
                      key={followUp}
                      type="button"
                      onClick={() => void send(followUp)}
                      className="btn-press rounded-full border border-ink-900/10 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-brand-300 hover:text-brand-700"
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 pl-1 text-[11px] text-ink-400" role="status">
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-cream-200 border-t-brand-600"
              aria-hidden="true"
            />
            Reading your store…
          </div>
        )}

        {(error || dictation.error) && (
          <div className="rounded-xl border border-danger-600/20 bg-danger-50 px-3 py-2 text-[11px] leading-relaxed text-danger-600">
            {error || dictation.error}
          </div>
        )}
      </div>

      <div className="border-t border-ink-900/[0.07] bg-cream-50 px-3 py-3 sm:px-4">
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className="btn-press shrink-0 rounded-full border border-ink-900/10 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-brand-300 hover:text-brand-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="cofounder-input" className="sr-only">
            Ask your AI cofounder
          </label>
          <input
            id="cofounder-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={400}
            autoComplete="off"
            placeholder="Ask about sales, orders, stock, carts…"
            className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.12] bg-[#08080A] px-3.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-accent-400/60 focus:outline-none focus:ring-2 focus:ring-accent-400/20"
          />
          <MicButton dictation={dictation} />
          <button
            type="submit"
            disabled={busy || input.trim().length < 2}
            className="btn-press flex h-10 items-center justify-center rounded-full bg-ink-900 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-cream-50 transition-colors hover:bg-accent-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-[10px] leading-relaxed text-ink-400">
            Answers come from this store&apos;s records and bounded counts. I never invent a number
            and never take an action without you.
          </p>
          <SpeakToggle speech={speech} />
        </div>
      </div>
    </div>
  );
}
