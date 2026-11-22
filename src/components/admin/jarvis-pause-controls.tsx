'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Badge } from '@/components/ui/badge';
import { PAUSE_SWITCHES, type PauseSwitch } from '@/lib/jarvis/pause-config';

/**
 * Four independent stop buttons. Each flips one boolean in store settings;
 * the enforcement lives in the code that performs the action, so a paused
 * switch takes effect on the very next publish / email / cycle / sync.
 */
export function JarvisPauseControls({ initial }: { initial: Record<PauseSwitch, boolean> }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<PauseSwitch | null>(null);

  async function toggle(key: PauseSwitch, paused: boolean) {
    setBusy(key);
    try {
      await apiFetch('/api/admin/jarvis/pauses', { body: { key, paused } });
      setState((s) => ({ ...s, [key]: paused }));
      toast(paused ? 'Paused' : 'Resumed', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : 'Could not change the switch', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="divide-y divide-ink-900/5">
      {PAUSE_SWITCHES.map((sw) => {
        const paused = state[sw.key];
        return (
          <li key={sw.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 max-w-xl">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                {sw.label}
                <Badge tone={paused ? 'red' : 'green'}>{paused ? 'Paused' : 'Running'}</Badge>
              </p>
              <p className="mt-0.5 text-xs text-ink-500">{sw.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={paused}
              aria-label={sw.label}
              disabled={busy === sw.key}
              onClick={() => toggle(sw.key, !paused)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                paused ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  paused ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
