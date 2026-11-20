'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { MicButton, SpeakToggle, useDictation, useSpeech } from '@/components/ui/voice-controls';
import { focusablesIn, lockBodyScroll, nextFocusTarget } from '@/lib/a11y/focus';
import { formatINR } from '@/lib/money';
import RemoteImage from '@/components/ui/remote-image';
import type { AssistantAction, AssistantProduct, AssistantReply } from '@/lib/assistant/types';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products: AssistantProduct[];
  actions: AssistantAction[];
  followUps: string[];
}

const MAX_MESSAGE_LENGTH = 500;

function welcomeTurn(storeName: string): ChatTurn {
  return {
    id: 'welcome',
    role: 'assistant',
    text: `Hi — I'm the ${storeName} concierge. I can find products from the live catalog, explain delivery and returns, or point you to order tracking. What are you looking for?`,
    products: [],
    actions: [],
    followUps: ['Show me new arrivals', 'What are the delivery charges?', 'How do returns work?'],
  };
}

function SparkleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.6c.4 0 .75.27.85.66l1.44 5.36a4.2 4.2 0 0 0 2.99 2.99l5.36 1.44a.87.87 0 0 1 0 1.7l-5.36 1.44a4.2 4.2 0 0 0-2.99 2.99l-1.44 5.36a.87.87 0 0 1-1.7 0l-1.44-5.36a4.2 4.2 0 0 0-2.99-2.99L3.36 14.7a.87.87 0 0 1 0-1.7l5.36-1.44a4.2 4.2 0 0 0 2.99-2.99l1.44-5.36A.87.87 0 0 1 12 2.6Z" />
    </svg>
  );
}

function SendIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

function ProductCard({ product }: { product: AssistantProduct }) {
  const hasDiscount =
    product.compareAtPricePaise !== null && product.compareAtPricePaise > product.pricePaise;
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex items-center gap-3 rounded-xl border border-ink-900/10 bg-white p-2 transition-colors hover:border-brand-300"
    >
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream-100">
        {product.imageUrl ? (
          <RemoteImage
            src={product.imageUrl}
            alt=""
            width={56}
            height={56}
            sizes="56px"
            className="h-14 w-14 object-cover transition-transform duration-300 ease-zenvora group-hover:scale-105"
          />
        ) : (
          <svg
            className="h-5 w-5 text-ink-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4L5.5 8Z"
            />
            <path strokeLinecap="round" d="M9 10V6.8a3 3 0 0 1 6 0V10" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-xs font-semibold leading-snug text-ink-900">
          {product.name}
        </span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs">
          <span className="font-bold tabular-nums text-ink-900">
            {formatINR(product.pricePaise)}
          </span>
          {hasDiscount && (
            <s className="text-[10px] tabular-nums text-ink-400">
              {formatINR(product.compareAtPricePaise as number)}
            </s>
          )}
          {product.categoryName && (
            <span className="truncate text-[10px] text-ink-400">· {product.categoryName}</span>
          )}
          {!product.available && (
            <span className="rounded-full bg-ink-900/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-500">
              Sold out
            </span>
          )}
        </span>
      </span>
      <svg
        className="h-4 w-4 shrink-0 text-ink-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-700"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </Link>
  );
}

function AssistantTurn({
  turn,
  onFollowUp,
}: {
  turn: ChatTurn;
  onFollowUp: (text: string) => void;
}) {
  const isUser = turn.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={isUser ? 'max-w-[85%]' : 'w-full max-w-[95%]'}>
        {!isUser && (
          <p className="mb-1 pl-1 text-[10px] font-semibold uppercase tracking-eyebrow text-brand-700">
            Concierge
          </p>
        )}
        <div
          className={
            isUser
              ? 'rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm leading-relaxed text-white shadow-soft'
              : 'rounded-2xl rounded-bl-md border border-ink-900/10 bg-cream-50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-800'
          }
        >
          <p className="whitespace-pre-line">{turn.text}</p>

          {turn.products.length > 0 && (
            <ul className="mt-2.5 space-y-2">
              {turn.products.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
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
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {!isUser && turn.followUps.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {turn.followUps.map((followUp) => (
              <button
                key={followUp}
                type="button"
                onClick={() => onFollowUp(followUp)}
                className="btn-press rounded-full border border-ink-900/10 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                {followUp}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Concierge({ storeName }: { storeName: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>(() => [welcomeTurn(storeName)]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation(setInput);
  const speech = useSpeech();
  const { speak, stop: stopSpeech } = speech;
  const { setError: setDictationError } = dictation;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const pathname = usePathname();

  const nextId = () => {
    idRef.current += 1;
    return `turn-${idRef.current}`;
  };

  const close = useCallback(() => setOpen(false), []);

  // Never leave the synthesizer talking after the sheet closes.
  useEffect(() => {
    if (!open) stopSpeech();
  }, [open, stopSpeech]);

  // Focus enters the panel on open, Tab stays inside, Escape closes, and the
  // page behind the sheet cannot scroll. Mirrors the app's other overlays.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    inputRef.current?.focus();

    const releaseScrollLock = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const target = nextFocusTarget(focusablesIn(panel), document.activeElement, event.shiftKey);
      if (!target) return;
      event.preventDefault();
      target.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      releaseScrollLock();
      trigger?.focus();
    };
  }, [open]);

  // Keep the transcript pinned to the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns, busy]);

  // Any navigation closes the sheet so it never covers a new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!text || busy) return;

      setInput('');
      setError(null);
      setDictationError(null);
      setBusy(true);
      setTurns((previous) => [
        ...previous,
        { id: nextId(), role: 'user', text, products: [], actions: [], followUps: [] },
      ]);

      try {
        const reply = await apiFetch<AssistantReply>('/api/assistant/chat', {
          body: {
            message: text,
            history: turns.slice(-4).map((turn) => ({
              role: turn.role,
              content: turn.text.slice(0, MAX_MESSAGE_LENGTH),
            })),
          },
        });
        setTurns((previous) => [
          ...previous,
          {
            id: nextId(),
            role: 'assistant',
            text: reply.message,
            products: Array.isArray(reply.products) ? reply.products : [],
            actions: Array.isArray(reply.actions) ? reply.actions : [],
            followUps: Array.isArray(reply.followUps) ? reply.followUps : [],
          },
        ]);
        speak(reply.message);
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'I could not reach the store just now. Please try again.';
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, speak, setDictationError]
  );

  // The assistant is not needed on the checkout flow (and would cover the
  // mobile pay button). Everything else in the storefront keeps it.
  if (pathname.startsWith('/checkout')) return null;

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="concierge-panel"
          aria-label={`Open ${storeName} concierge`}
          className="btn-press group fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-ink-900 py-1.5 pl-1.5 pr-2 text-cream-50 shadow-lift ring-1 ring-accent-300/35 sm:bottom-6 sm:right-6 sm:pr-4"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-200 via-accent-300 to-accent-500 text-cream-50">
            <SparkleIcon className="h-4 w-4" />
          </span>
          <span className="hidden text-xs font-semibold tracking-[0.14em] sm:inline">
            CONCIERGE
          </span>
          <span
            aria-hidden="true"
            className="mr-1 h-1.5 w-1.5 rounded-full bg-brand-400 shadow-[0_0_0_3px_rgba(119,201,193,0.18)] sm:hidden"
          />
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          id="concierge-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="concierge-title"
          className="motion-pop fixed inset-x-2 bottom-20 z-50 flex max-h-[min(78dvh,660px)] flex-col overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-lift sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[404px]"
        >
          <div className="relative overflow-hidden border-b border-white/[0.07] bg-[#08080A] px-3.5 py-3 text-ink-900">
            <div className="grain" aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-200 via-accent-300 to-accent-500 text-cream-50 ring-1 ring-white/20">
                <SparkleIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p id="concierge-title" className="truncate text-sm font-semibold tracking-tight">
                  {storeName} Concierge
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden="true" />
                  Live catalog · store policies
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close concierge"
                className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-ink-900"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto bg-white px-3 py-3"
            aria-live="polite"
            aria-relevant="additions"
          >
            {turns.map((turn) => (
              <AssistantTurn key={turn.id} turn={turn} onFollowUp={(text) => void send(text)} />
            ))}

            {busy && (
              <div className="flex items-center gap-2 pl-1 text-[11px] text-ink-400" role="status">
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-cream-200 border-t-brand-600"
                  aria-hidden="true"
                />
                Searching the live catalog…
              </div>
            )}

            {(error || dictation.error) && (
              <div className="rounded-xl border border-danger-600/20 bg-danger-50 px-3 py-2 text-[11px] leading-relaxed text-danger-600">
                {error || dictation.error}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="border-t border-ink-900/[0.07] bg-cream-50 px-3 pb-2.5 pt-2.5"
          >
            <div className="flex items-center gap-2">
              <label htmlFor="concierge-input" className="sr-only">
                Message the concierge
              </label>
              <input
                id="concierge-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Ask about a product, delivery, returns…"
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.12] bg-[#08080A] px-3.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-accent-400/60 focus:outline-none focus:ring-2 focus:ring-accent-400/20"
              />
              <MicButton dictation={dictation} />
              <button
                type="submit"
                disabled={busy || input.trim().length < 2}
                aria-label="Send message"
                className="btn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendIcon />
              </button>
            </div>
            <div className="mt-2 flex items-start justify-between gap-2 px-1">
              <p className="text-[10px] leading-relaxed text-ink-400">
                Answers come from this store&apos;s live products and policies — never invented.
              </p>
              <SpeakToggle speech={speech} />
            </div>
          </form>
        </div>
      )}
    </>
  );
}
