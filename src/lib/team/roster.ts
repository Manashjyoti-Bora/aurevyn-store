import type { AgentDefinition, AgentId } from './types';

/**
 * The Aurevyn team.
 *
 * Every entry is a real, implemented area of the application — an agent that
 * reported on nothing would be theatre. The roster is ordered like a company:
 * the chief of staff first, then the departments.
 *
 * Guardrail that applies to all eight: an agent may read the store, compute,
 * queue safe work and write a briefing. It may not publish products, change
 * prices, refund money, message customers or alter settings. Those stay with
 * the owner — that is what "hands free" means: judgement, not authority.
 */
export const TEAM_ROSTER: readonly AgentDefinition[] = [
  {
    id: 'orion',
    name: 'Orion',
    role: 'Chief of Staff',
    mandate: 'What is stopping this store from making money today?',
    schedule: { cadence: 'Every 3 hours, and whenever the owner asks', cron: '0 */3 * * *' },
    decides: [
      'Ranks every open problem across the store into one ordered list',
      'Re-runs the launch-readiness gate after every cycle',
      'Escalates only the items that need the owner’s account or money',
    ],
    escalates: ['Launching the store', 'Spending money', 'Changing the brand or policies'],
  },
  {
    id: 'vesper',
    name: 'Vesper',
    role: 'Catalogue & Merchandising',
    mandate: 'Is every product good enough to sell, and is anything missing?',
    schedule: { cadence: 'Every 6 hours', cron: '15 */6 * * *' },
    decides: [
      'Flags drafts, missing images, empty categories and stale listings',
      'Reports which published pieces still have no supplier link',
      'Keeps the catalogue coverage numbers current',
    ],
    escalates: ['Publishing a product', 'Deleting or archiving a product'],
  },
  {
    id: 'kaizen',
    name: 'Kaizen',
    role: 'Pricing & Margin',
    mandate: 'Is any order quietly losing money?',
    schedule: { cadence: 'Every 6 hours', cron: '30 */6 * * *' },
    decides: [
      'Detects products priced at or below landed cost',
      'Detects products under the store’s minimum margin floor',
      'Reports coupon windows that are about to expire',
    ],
    escalates: ['Changing a selling price', 'Creating or editing a coupon'],
  },
  {
    id: 'lumen',
    name: 'Lumen',
    role: 'Growth & Discovery',
    mandate: 'Can a stranger find this store, trust it and buy?',
    schedule: { cadence: 'Every 12 hours', cron: '45 */12 * * *' },
    decides: [
      'Tracks review coverage and products still waiting for their first review',
      'Reports Merchant-feed and sitemap readiness from live catalogue data',
      'Flags catalogue gaps that weaken search and ads',
    ],
    escalates: ['Running paid ads', 'Publishing marketing claims'],
  },
  {
    id: 'anchor',
    name: 'Anchor',
    role: 'Customer Care',
    mandate: 'Is any customer waiting on us right now?',
    schedule: { cadence: 'Every 3 hours', cron: '10 */3 * * *' },
    decides: [
      'Counts unanswered messages and the age of the oldest one',
      'Flags returns and refunds that are waiting on a decision',
      'Surfaces orders past their promised dispatch window',
    ],
    escalates: ['Replying to a customer', 'Approving a refund or return'],
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    role: 'Reliability',
    mandate: 'Is anything in the machine broken or unconfigured?',
    schedule: { cadence: 'Every 3 hours', cron: '20 */3 * * *' },
    decides: [
      'Reads failed and backlogged background jobs',
      'Checks the cron secret, payment provider, e-mail and media storage',
      'Reports every launch blocker with the exact setting that fixes it',
    ],
    escalates: ['Changing environment variables', 'Rotating secrets'],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    role: 'Finance',
    mandate: 'Does the money in the ledger match the money in the bank?',
    schedule: { cadence: 'Every 12 hours', cron: '40 */12 * * *' },
    decides: [
      'Reports collected revenue, refunds and net for the rolling window',
      'Lists UPI payments waiting for the owner’s bank verification',
      'Flags failed payments that may still hold a customer’s money',
    ],
    escalates: ['Confirming a UPI payment', 'Issuing a refund', 'Filing tax'],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    role: 'Fulfilment & Supply',
    mandate: 'Can we actually ship what we sold?',
    schedule: { cadence: 'Every 6 hours', cron: '50 */6 * * *' },
    decides: [
      'Reports low and out-of-stock products before they sell out',
      'Reports supplier sync failures and unmapped supplier SKUs',
      'Flags paid orders that have not been dispatched in time',
    ],
    escalates: ['Placing a supplier order', 'Choosing a courier', 'Cancelling an order'],
  },
] as const;

export const TEAM_IDS: readonly AgentId[] = TEAM_ROSTER.map((agent) => agent.id);

export function getAgent(id: AgentId): AgentDefinition {
  const agent = TEAM_ROSTER.find((entry) => entry.id === id);
  if (!agent) throw new Error(`Unknown team agent: ${id}`);
  return agent;
}
