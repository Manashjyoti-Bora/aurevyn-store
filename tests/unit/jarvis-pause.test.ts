import { describe, it, expect } from 'vitest';
import { PAUSE_SWITCHES, isSwitchPaused } from '@/lib/jarvis/pause';

const settings = (over: Partial<Record<string, boolean>> = {}) => ({
  jarvis: {
    listingsPaused: false,
    messagesPaused: false,
    agentsPaused: false,
    automationsPaused: false,
    ...over,
  },
});

describe('pause switches', () => {
  it('exposes exactly four independent switches', () => {
    expect(PAUSE_SWITCHES.map((s) => s.key)).toEqual([
      'listings',
      'messages',
      'agents',
      'automations',
    ]);
  });

  it('defaults to not paused', () => {
    for (const sw of PAUSE_SWITCHES) expect(isSwitchPaused(settings(), sw.key)).toBe(false);
  });

  it('reads the matching setting only', () => {
    expect(isSwitchPaused(settings({ messagesPaused: true }), 'messages')).toBe(true);
    expect(isSwitchPaused(settings({ messagesPaused: true }), 'listings')).toBe(false);
  });

  it('fails open when the section is missing (older stored settings)', () => {
    expect(isSwitchPaused({}, 'listings')).toBe(false);
    expect(isSwitchPaused({ jarvis: undefined }, 'agents')).toBe(false);
  });

  it('treats only an explicit true as paused', () => {
    const weird = { jarvis: { listingsPaused: 'yes' as unknown as boolean } };
    expect(isSwitchPaused(weird, 'listings')).toBe(false);
  });
});
