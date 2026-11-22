/**
 * Client-safe pause switch metadata.
 *
 * Imported by the admin toggle UI, so this file must never touch Prisma, the
 * database or `node:*`. The server-side readers live in `./pause`.
 */

export type PauseSwitch = 'listings' | 'messages' | 'agents' | 'automations';

export interface PauseSwitchMeta {
  key: PauseSwitch;
  setting: 'listingsPaused' | 'messagesPaused' | 'agentsPaused' | 'automationsPaused';
  label: string;
  description: string;
}

export const PAUSE_SWITCHES: readonly PauseSwitchMeta[] = [
  {
    key: 'listings',
    setting: 'listingsPaused',
    label: 'Pause listings',
    description:
      'Stops publishing new supplier products and automatic catalogue publication. Live products stay visible; nothing new goes live.',
  },
  {
    key: 'messages',
    setting: 'messagesPaused',
    label: 'Pause outbound messages',
    description:
      'Stops every outbound email (customer and owner). Orders still work; notifications queue nothing while paused.',
  },
  {
    key: 'agents',
    setting: 'agentsPaused',
    label: 'Pause agents',
    description: 'Stops autonomous team cycles, including scheduled cron briefings.',
  },
  {
    key: 'automations',
    setting: 'automationsPaused',
    label: 'Pause automations',
    description:
      'Stops automatic/scheduled catalogue imports. Manual imports by the owner still work.',
  },
] as const;

export type PauseSettings = {
  listingsPaused: boolean;
  messagesPaused: boolean;
  agentsPaused: boolean;
  automationsPaused: boolean;
};

export function isSwitchPaused(
  settings: { jarvis?: Partial<PauseSettings> },
  key: PauseSwitch
): boolean {
  const meta = PAUSE_SWITCHES.find((s) => s.key === key);
  if (!meta) return false;
  return settings.jarvis?.[meta.setting] === true;
}
