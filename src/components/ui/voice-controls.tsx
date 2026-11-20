'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Browser-native voice for the assistants.
 *
 * Dictation uses the Web Speech API (Chrome/Edge/Safari); speech playback uses
 * speechSynthesis. Both are free and local to the browser — no audio is sent
 * to this store's server and no third-party key is involved. The browser may
 * still send audio to its own speech service; that is disclosed by the browser
 * permission prompt. Controls render only where the API exists.
 */

type SpeechAlternative = { transcript: string; confidence: number };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

export function useDictation(onText: (text: string) => void, lang = 'en-IN') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      return;
    }
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript ?? '';
      }
      const clean = transcript.replace(/\s+/g, ' ').trim();
      if (clean) onTextRef.current(clean);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone permission is blocked. Allow it in your browser, or type instead.'
          : 'Voice input stopped. You can type your message instead.'
      );
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || listening) return;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('Voice input is already starting. Try again in a moment.');
    }
  }, [listening]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped
    }
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, error, start, stop, toggle, setError };
}

export function useSpeech(lang = 'en-IN') {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) setSupported(true);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !supported) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const clean = text
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/[*_#>`|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600);
      if (!clean) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = 1.02;
      utterance.pitch = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [enabled, supported, lang]
  );

  const toggle = useCallback(() => {
    if (enabled) stop();
    setEnabled(!enabled);
  }, [enabled, stop]);

  return { supported, enabled, speaking, speak, stop, toggle };
}

function MicIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </svg>
  );
}

function SpeakerIcon({ muted, className = 'h-4 w-4' }: { muted: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9.5h3L12 5v14l-5-4.5H4z" />
      {muted ? (
        <path strokeLinecap="round" d="m16 9 5 6m0-6-5 6" />
      ) : (
        <path strokeLinecap="round" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
      )}
    </svg>
  );
}

export function MicButton({
  dictation,
  className,
}: {
  dictation: ReturnType<typeof useDictation>;
  className?: string;
}) {
  if (!dictation.supported) return null;
  return (
    <button
      type="button"
      onClick={dictation.toggle}
      aria-pressed={dictation.listening}
      aria-label={dictation.listening ? 'Stop voice input' : 'Speak your message'}
      title={dictation.listening ? 'Stop voice input' : 'Speak your message'}
      className={cn(
        'btn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors',
        dictation.listening
          ? 'border-accent-400/60 bg-accent-400/15 text-accent-200'
          : 'border-white/[0.12] text-ink-400 hover:border-white/25 hover:text-ink-900',
        className
      )}
    >
      <MicIcon />
    </button>
  );
}

export function SpeakToggle({
  speech,
  className,
}: {
  speech: ReturnType<typeof useSpeech>;
  className?: string;
}) {
  if (!speech.supported) return null;
  return (
    <button
      type="button"
      onClick={speech.toggle}
      aria-pressed={speech.enabled}
      aria-label={speech.enabled ? 'Turn spoken replies off' : 'Turn spoken replies on'}
      title={speech.enabled ? 'Spoken replies on' : 'Spoken replies off'}
      className={cn(
        'btn-press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors',
        speech.enabled
          ? 'border-accent-400/40 bg-accent-400/[0.08] text-accent-200'
          : 'border-white/[0.1] text-ink-400 hover:border-white/20 hover:text-ink-900',
        className
      )}
    >
      <SpeakerIcon muted={!speech.enabled} className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{speech.enabled ? 'Voice on' : 'Voice'}</span>
    </button>
  );
}
