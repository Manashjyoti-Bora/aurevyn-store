import { getSettings } from '../settings';
import { isSwitchPaused, type PauseSwitch } from './pause-config';

/**
 * Emergency pause switches (blueprint §11).
 *
 * Four independent stops: listings, outbound messages, agents, automations.
 * Each check reads the cached store settings — cheap, and it fails open only
 * because `getSettings` never throws (it falls back to the defaults, which are
 * all "not paused").
 */

export {
  PAUSE_SWITCHES,
  isSwitchPaused,
  type PauseSettings,
  type PauseSwitch,
  type PauseSwitchMeta,
} from './pause-config';

/** Read the persisted switches (cached 30 s by getSettings). */
export async function pauseState(): Promise<Record<PauseSwitch, boolean>> {
  const settings = await getSettings();
  return {
    listings: isSwitchPaused(settings, 'listings'),
    messages: isSwitchPaused(settings, 'messages'),
    agents: isSwitchPaused(settings, 'agents'),
    automations: isSwitchPaused(settings, 'automations'),
  };
}

export async function isPaused(key: PauseSwitch): Promise<boolean> {
  const settings = await getSettings();
  return isSwitchPaused(settings, key);
}
