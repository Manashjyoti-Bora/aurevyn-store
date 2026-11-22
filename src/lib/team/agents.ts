/**
 * Aurevyn operations team — the full bench.
 *
 * This is the roster the workflow planner assigns work from. Every entry is a
 * defined job with one question to answer, not a personality: an agent that
 * could not be given a concrete task would be decoration.
 *
 * Autonomy is explicit and never inferred:
 *  - AUTO    reads the store, computes, and queues reversible work on its own.
 *  - PROPOSE prepares the change and waits for the owner to approve it.
 *  - OWNER   never acts: it assembles the evidence and hands the decision over.
 *
 * The eight agents in `roster.ts` are the ones currently on live duty, with
 * briefings computed from real records. The rest of this bench is the work
 * queue that `workflow.ts` plans — the same rule applies to all of them: no
 * publishing, no price changes, no refunds and no customer messages without the
 * owner.
 */

export type Autonomy = 'AUTO' | 'PROPOSE' | 'OWNER';

export type Department =
  | 'Leadership'
  | 'Catalogue'
  | 'Pricing'
  | 'Growth'
  | 'Content'
  | 'Support'
  | 'Supply'
  | 'Finance'
  | 'Reliability'
  | 'Data';

export interface Specialist {
  id: string;
  /** Stable short handle shown next to the role, e.g. CAT-04. */
  callsign: string;
  department: Department;
  role: string;
  /** The single question this role exists to answer. */
  mandate: string;
  autonomy: Autonomy;
}

export const AUTONOMY_LABELS: Record<Autonomy, string> = {
  AUTO: 'Acts alone (reversible)',
  PROPOSE: 'Prepares, owner approves',
  OWNER: 'Owner-only decision',
};

export const DEPARTMENT_ORDER: readonly Department[] = [
  'Leadership',
  'Catalogue',
  'Pricing',
  'Growth',
  'Content',
  'Support',
  'Supply',
  'Finance',
  'Reliability',
  'Data',
];

function sp(
  id: string,
  callsign: string,
  department: Department,
  role: string,
  mandate: string,
  autonomy: Autonomy
): Specialist {
  return { id, callsign, department, role, mandate, autonomy };
}

const LEADERSHIP: Specialist[] = [
  sp(
    'lead-chief',
    'LEAD-01',
    'Leadership',
    'Chief of Staff',
    'What is the one thing that unblocks the store today?',
    'PROPOSE'
  ),
  sp(
    'lead-planning',
    'LEAD-02',
    'Leadership',
    'Workflow Planner',
    'Which tasks can run in parallel, and which must wait?',
    'AUTO'
  ),
  sp(
    'lead-objectives',
    'LEAD-03',
    'Leadership',
    'Objectives & OKRs',
    'Are this quarter’s goals measurable and still right?',
    'PROPOSE'
  ),
  sp(
    'lead-priorities',
    'LEAD-04',
    'Leadership',
    'Priority Arbitration',
    'When two agents disagree, which work goes first?',
    'PROPOSE'
  ),
  sp(
    'lead-delegation',
    'LEAD-05',
    'Leadership',
    'Delegation',
    'Does every open task have exactly one owner?',
    'AUTO'
  ),
  sp(
    'lead-resources',
    'LEAD-06',
    'Leadership',
    'Resource Allocation',
    'Is the store spending effort where the money is?',
    'PROPOSE'
  ),
  sp(
    'lead-blockers',
    'LEAD-07',
    'Leadership',
    'Blocker Escalation',
    'What is waiting on the owner and for how long?',
    'AUTO'
  ),
  sp(
    'lead-risk',
    'LEAD-08',
    'Leadership',
    'Risk Register',
    'What could hurt the store that nobody is watching?',
    'AUTO'
  ),
  sp(
    'lead-review',
    'LEAD-09',
    'Leadership',
    'Weekly Review',
    'What did we actually finish, and what slipped?',
    'AUTO'
  ),
  sp(
    'lead-brief',
    'LEAD-10',
    'Leadership',
    'Owner Briefing',
    'What does the owner need to know in sixty seconds?',
    'AUTO'
  ),
];

const CATALOGUE: Specialist[] = [
  sp(
    'cat-intake',
    'CAT-01',
    'Catalogue',
    'Meesho Intake',
    'Is every pasted Meesho row complete enough to score?',
    'AUTO'
  ),
  sp(
    'cat-clean',
    'CAT-02',
    'Catalogue',
    'Title & Attribute Cleanup',
    'Can a stranger understand this title without the supplier text?',
    'AUTO'
  ),
  sp(
    'cat-specs',
    'CAT-03',
    'Catalogue',
    'Specification Sheet',
    'Are material, size and weight taken from the listing only?',
    'AUTO'
  ),
  sp(
    'cat-images',
    'CAT-04',
    'Catalogue',
    'Image Sourcing & QA',
    'Does every product have real, sharp photography?',
    'PROPOSE'
  ),
  sp(
    'cat-variants',
    'CAT-05',
    'Catalogue',
    'Variant Matrix',
    'Are size and colour options priced and stocked correctly?',
    'AUTO'
  ),
  sp(
    'cat-category',
    'CAT-06',
    'Catalogue',
    'Category Placement',
    'Is this in the category a customer would look in?',
    'AUTO'
  ),
  sp(
    'cat-dedupe',
    'CAT-07',
    'Catalogue',
    'Duplicate Detection',
    'Are we listing the same product twice?',
    'AUTO'
  ),
  sp(
    'cat-stock',
    'CAT-08',
    'Catalogue',
    'Stock & Availability',
    'Can we honour this stock promise today?',
    'AUTO'
  ),
  sp(
    'cat-draft',
    'CAT-09',
    'Catalogue',
    'Draft Completeness',
    'Is the draft ready for the owner’s publish button?',
    'AUTO'
  ),
  sp(
    'cat-quality',
    'CAT-10',
    'Catalogue',
    'Listing Quality Score',
    'Would this listing survive a sceptical buyer?',
    'AUTO'
  ),
  sp(
    'cat-archive',
    'CAT-11',
    'Catalogue',
    'Archive & Retire',
    'Which old listings must leave the store?',
    'OWNER'
  ),
  sp(
    'cat-publish',
    'CAT-12',
    'Catalogue',
    'Publish Gate',
    'Has the owner approved this exact product to go live?',
    'OWNER'
  ),
  sp(
    'cat-bulk',
    'CAT-13',
    'Catalogue',
    'Bulk Import',
    'Did the CSV import fail on any row, and why?',
    'AUTO'
  ),
  sp(
    'cat-collection',
    'CAT-14',
    'Catalogue',
    'Collections',
    'Are the home and category shelves still curated?',
    'PROPOSE'
  ),
  sp(
    'cat-import-audit',
    'CAT-15',
    'Catalogue',
    'Catalogue Audit',
    'Does the live catalogue match the intended catalogue?',
    'AUTO'
  ),
];

const PRICING: Specialist[] = [
  sp(
    'price-cost',
    'PRC-01',
    'Pricing',
    'Landed Cost',
    'What does this product really cost us delivered?',
    'AUTO'
  ),
  sp(
    'price-margin',
    'PRC-02',
    'Pricing',
    'Margin Floor',
    'Does this price clear the store’s minimum margin?',
    'AUTO'
  ),
  sp(
    'price-rule',
    'PRC-03',
    'Pricing',
    'Pricing Rules',
    'Do the pricing rules still round and floor correctly?',
    'PROPOSE'
  ),
  sp(
    'price-coupon',
    'PRC-04',
    'Pricing',
    'Coupon Impact',
    'Which discount is quietly eating the margin?',
    'AUTO'
  ),
  sp(
    'price-shipping',
    'PRC-05',
    'Pricing',
    'Shipping Model',
    'Is shipping costed per zone, not guessed?',
    'AUTO'
  ),
  sp(
    'price-return',
    'PRC-06',
    'Pricing',
    'Return-Cost Risk',
    'Which product’s return rate would erase its margin?',
    'AUTO'
  ),
  sp(
    'price-anchor',
    'PRC-07',
    'Pricing',
    'MRP & Anchoring',
    'Is the struck-through price honest and defensible?',
    'OWNER'
  ),
  sp(
    'price-reprice',
    'PRC-08',
    'Pricing',
    'Bulk Reprice',
    'What would this reprice do across the catalogue?',
    'PROPOSE'
  ),
  sp(
    'price-floor',
    'PRC-09',
    'Pricing',
    'Below-Cost Detection',
    'Is anything selling for less than it costs?',
    'AUTO'
  ),
  sp(
    'price-report',
    'PRC-10',
    'Pricing',
    'Margin Report',
    'Where is the profit actually coming from?',
    'AUTO'
  ),
];

const GROWTH: Specialist[] = [
  sp(
    'grow-sitemap',
    'GRW-01',
    'Growth',
    'Sitemap',
    'Is every sellable URL in sitemap.xml, and nothing else?',
    'AUTO'
  ),
  sp(
    'grow-robots',
    'GRW-02',
    'Growth',
    'Robots & Indexing',
    'Is anything important accidentally blocked?',
    'AUTO'
  ),
  sp(
    'grow-canonical',
    'GRW-03',
    'Growth',
    'Canonical URLs',
    'Does every page declare one correct canonical?',
    'AUTO'
  ),
  sp(
    'grow-meta',
    'GRW-04',
    'Growth',
    'Titles & Descriptions',
    'Would this snippet earn the click in a result page?',
    'AUTO'
  ),
  sp(
    'grow-schema',
    'GRW-05',
    'Growth',
    'Structured Data',
    'Does the JSON-LD match what is visibly on the page?',
    'AUTO'
  ),
  sp(
    'grow-og',
    'GRW-06',
    'Growth',
    'Social Cards',
    'Does a shared link look deliberate, not broken?',
    'AUTO'
  ),
  sp(
    'grow-links',
    'GRW-07',
    'Growth',
    'Internal Linking',
    'Can a crawler reach every product in three clicks?',
    'AUTO'
  ),
  sp(
    'grow-broken',
    'GRW-08',
    'Growth',
    'Link Health',
    'Is any internal link returning an error?',
    'AUTO'
  ),
  sp(
    'grow-cwv',
    'GRW-09',
    'Growth',
    'Core Web Vitals',
    'Is the store fast on a mid-range phone?',
    'AUTO'
  ),
  sp(
    'grow-mobile',
    'GRW-10',
    'Growth',
    'Mobile Experience',
    'Does the store work with a thumb and one hand?',
    'AUTO'
  ),
  sp(
    'grow-https',
    'GRW-11',
    'Growth',
    'HTTPS & Security Headers',
    'Is every request forced onto a secure origin?',
    'AUTO'
  ),
  sp(
    'grow-slugs',
    'GRW-12',
    'Growth',
    'URL Slugs',
    'Are the URLs short, stable and human-readable?',
    'AUTO'
  ),
  sp(
    'grow-gsc',
    'GRW-13',
    'Growth',
    'Search Console',
    'Are new pages discovered and indexed?',
    'OWNER'
  ),
  sp(
    'grow-backlinks',
    'GRW-14',
    'Growth',
    'Backlinks',
    'Where would a real, relevant citation come from?',
    'OWNER'
  ),
  sp(
    'grow-feed',
    'GRW-15',
    'Growth',
    'Merchant Feed',
    'Would this feed be rejected by Google Merchant?',
    'AUTO'
  ),
  sp(
    'grow-analytics',
    'GRW-16',
    'Growth',
    'Analytics',
    'Are we measuring visits without tracking people?',
    'AUTO'
  ),
];

const CONTENT: Specialist[] = [
  sp(
    'content-copy',
    'CNT-01',
    'Content',
    'Product Copy',
    'Does this description say only what we can prove?',
    'AUTO'
  ),
  sp(
    'content-brand',
    'CNT-02',
    'Content',
    'Brand Voice',
    'Does this sentence sound like Aurevyn?',
    'AUTO'
  ),
  sp(
    'content-policy',
    'CNT-03',
    'Content',
    'Policy Pages',
    'Do the policies match what we actually do?',
    'OWNER'
  ),
  sp(
    'content-faq',
    'CNT-04',
    'Content',
    'FAQ',
    'Which question do customers keep asking that we never answer?',
    'AUTO'
  ),
  sp(
    'content-about',
    'CNT-05',
    'Content',
    'About Page',
    'Is the story true and specific?',
    'OWNER'
  ),
  sp(
    'content-email',
    'CNT-06',
    'Content',
    'Email Templates',
    'Does every transactional email state the next step?',
    'AUTO'
  ),
  sp(
    'content-notifications',
    'CNT-07',
    'Content',
    'Notification Copy',
    'Is this message useful at 2 a.m.?',
    'AUTO'
  ),
  sp(
    'content-seo-titles',
    'CNT-08',
    'Content',
    'SEO Copy',
    'Is the target phrase in the title and the first line?',
    'AUTO'
  ),
  sp(
    'content-alt',
    'CNT-09',
    'Content',
    'Alt Text',
    'Can someone who cannot see the photo still shop?',
    'AUTO'
  ),
  sp(
    'content-photo',
    'CNT-10',
    'Content',
    'Photography Brief',
    'What shot would make this product feel worth its price?',
    'PROPOSE'
  ),
  sp(
    'content-social',
    'CNT-11',
    'Content',
    'Social Captions',
    'Is this post an invitation to shop or noise?',
    'PROPOSE'
  ),
  sp(
    'content-guide',
    'CNT-12',
    'Content',
    'Owner Documentation',
    'Can the owner run this without asking anyone?',
    'AUTO'
  ),
];

const SUPPORT: Specialist[] = [
  sp('care-inbox', 'SUP-01', 'Support', 'Inbox Triage', 'Who is waiting on us right now?', 'AUTO'),
  sp(
    'care-sla',
    'SUP-02',
    'Support',
    'Response SLA',
    'Which message has breached its promised reply time?',
    'AUTO'
  ),
  sp(
    'care-template',
    'SUP-03',
    'Support',
    'Reply Drafts',
    'Is this reply accurate and free of promises we cannot keep?',
    'PROPOSE'
  ),
  sp(
    'care-status',
    'SUP-04',
    'Support',
    'Order Status',
    'Does the customer know where their parcel is?',
    'PROPOSE'
  ),
  sp(
    'care-returns',
    'SUP-05',
    'Support',
    'Return Requests',
    'Is this return inside the stated policy?',
    'OWNER'
  ),
  sp(
    'care-refunds',
    'SUP-06',
    'Support',
    'Refund Decisions',
    'Has the money actually gone back?',
    'OWNER'
  ),
  sp(
    'care-whatsapp',
    'SUP-07',
    'Support',
    'WhatsApp Channel',
    'Is the number on the site one we answer?',
    'OWNER'
  ),
  sp(
    'care-phone',
    'SUP-08',
    'Support',
    'Phone Support',
    'Are support hours published and honest?',
    'OWNER'
  ),
  sp(
    'care-faq-gap',
    'SUP-09',
    'Support',
    'FAQ Gap Detection',
    'What are we explaining one customer at a time?',
    'AUTO'
  ),
  sp(
    'care-escalation',
    'SUP-10',
    'Support',
    'Escalation',
    'Which unhappy customer needs a human today?',
    'AUTO'
  ),
  sp(
    'care-review',
    'SUP-11',
    'Support',
    'Review Requests',
    'Did a delivered customer get a fair chance to review?',
    'PROPOSE'
  ),
  sp(
    'care-feedback',
    'SUP-12',
    'Support',
    'Feedback Loop',
    'What did complaints change in the store?',
    'AUTO'
  ),
];

const SUPPLY: Specialist[] = [
  sp(
    'supply-meesho',
    'SPL-01',
    'Supply',
    'Meesho Ordering',
    'Which paid order must be placed on Meesho now?',
    'OWNER'
  ),
  sp(
    'supply-id',
    'SPL-02',
    'Supply',
    'Order ID Hand-off',
    'Is the Meesho confirmation ID recorded for every order?',
    'AUTO'
  ),
  sp(
    'supply-tracking',
    'SPL-03',
    'Supply',
    'Tracking',
    'Does the tracking number resolve?',
    'PROPOSE'
  ),
  sp(
    'supply-courier',
    'SPL-04',
    'Supply',
    'Courier Choice',
    'Which courier actually serves this pincode?',
    'PROPOSE'
  ),
  sp(
    'supply-rto',
    'SPL-05',
    'Supply',
    'RTO Handling',
    'What happens to a parcel that comes back?',
    'OWNER'
  ),
  sp(
    'supply-stock-alert',
    'SPL-06',
    'Supply',
    'Stock Alerts',
    'What will sell out before we can restock?',
    'AUTO'
  ),
  sp(
    'supply-sync',
    'SPL-07',
    'Supply',
    'Supplier Sync',
    'Did the supplier catalogue sync fail quietly?',
    'AUTO'
  ),
  sp(
    'supply-sku',
    'SPL-08',
    'Supply',
    'SKU Mapping',
    'Is every sold SKU mapped to a buyable one?',
    'AUTO'
  ),
  sp(
    'supply-dispatch-sla',
    'SPL-09',
    'Supply',
    'Dispatch SLA',
    'Which order is about to miss its dispatch promise?',
    'AUTO'
  ),
  sp(
    'supply-packaging',
    'SPL-10',
    'Supply',
    'Packaging',
    'Does the parcel arrive undamaged and unbranded correctly?',
    'PROPOSE'
  ),
  sp(
    'supply-damage',
    'SPL-11',
    'Supply',
    'Damage & Claims',
    'Who pays for a broken delivery?',
    'OWNER'
  ),
  sp(
    'supply-cancel',
    'SPL-12',
    'Supply',
    'Cancellations',
    'Is cancelling cheaper than fulfilling?',
    'OWNER'
  ),
];

const FINANCE: Specialist[] = [
  sp(
    'fin-upi',
    'FIN-01',
    'Finance',
    'UPI Verification',
    'Has this UPI reference been matched to a bank credit?',
    'OWNER'
  ),
  sp(
    'fin-reconcile',
    'FIN-02',
    'Finance',
    'Reconciliation',
    'Do the ledger and the bank agree?',
    'AUTO'
  ),
  sp(
    'fin-refund',
    'FIN-03',
    'Finance',
    'Refund Accounting',
    'Was the refund recorded and evidenced?',
    'AUTO'
  ),
  sp(
    'fin-cod',
    'FIN-04',
    'Finance',
    'COD Settlement',
    'Has the courier paid out what they collected?',
    'OWNER'
  ),
  sp(
    'fin-payout',
    'FIN-05',
    'Finance',
    'Payout Tracking',
    'Which payout is still outstanding?',
    'AUTO'
  ),
  sp(
    'fin-tax',
    'FIN-06',
    'Finance',
    'Tax & Invoicing',
    'Does every invoice carry the right details?',
    'OWNER'
  ),
  sp(
    'fin-cost-audit',
    'FIN-07',
    'Finance',
    'Cost Audit',
    'Is any recorded cost out of date?',
    'AUTO'
  ),
  sp(
    'fin-fraud',
    'FIN-08',
    'Finance',
    'Fraud Signals',
    'Is this order pattern suspicious?',
    'PROPOSE'
  ),
  sp('fin-close', 'FIN-09', 'Finance', 'Daily Close', 'Is today’s money accounted for?', 'AUTO'),
  sp('fin-report', 'FIN-10', 'Finance', 'Owner P&L', 'What did the store actually earn?', 'AUTO'),
];

const RELIABILITY: Specialist[] = [
  sp(
    'rel-health',
    'REL-01',
    'Reliability',
    'Health Checks',
    'Is the store up and answering?',
    'AUTO'
  ),
  sp(
    'rel-jobs',
    'REL-02',
    'Reliability',
    'Job Queue',
    'Is any background job stuck or failing?',
    'AUTO'
  ),
  sp(
    'rel-cron',
    'REL-03',
    'Reliability',
    'Scheduling',
    'Did the scheduled work actually run?',
    'AUTO'
  ),
  sp(
    'rel-db',
    'REL-04',
    'Reliability',
    'Database',
    'Is the database healthy and reachable?',
    'AUTO'
  ),
  sp('rel-backup', 'REL-05', 'Reliability', 'Backups', 'Could we restore yesterday?', 'OWNER'),
  sp(
    'rel-payments',
    'REL-06',
    'Reliability',
    'Payment Provider',
    'Can a customer actually pay?',
    'AUTO'
  ),
  sp('rel-email', 'REL-07', 'Reliability', 'Email Delivery', 'Are order emails arriving?', 'AUTO'),
  sp(
    'rel-storage',
    'REL-08',
    'Reliability',
    'Media Storage',
    'Will uploaded images survive a redeploy?',
    'AUTO'
  ),
  sp(
    'rel-cache',
    'REL-09',
    'Reliability',
    'Caching',
    'Is stale content being served as fresh?',
    'AUTO'
  ),
  sp(
    'rel-errors',
    'REL-10',
    'Reliability',
    'Error Log',
    'What broke that no customer reported?',
    'AUTO'
  ),
  sp(
    'rel-security',
    'REL-11',
    'Reliability',
    'Security Headers',
    'Is the browser policy still tight?',
    'AUTO'
  ),
  sp(
    'rel-deps',
    'REL-12',
    'Reliability',
    'Dependencies',
    'Is any dependency vulnerable or abandoned?',
    'PROPOSE'
  ),
];

const DATA: Specialist[] = [
  sp(
    'data-signals',
    'DAT-01',
    'Data',
    'Signal Snapshot',
    'Is every number on the dashboard traceable?',
    'AUTO'
  ),
  sp(
    'data-metrics',
    'DAT-02',
    'Data',
    'Metric Definitions',
    'Do two reports define revenue the same way?',
    'AUTO'
  ),
  sp('data-funnel', 'DAT-03', 'Data', 'Funnel', 'Where do visitors stop?', 'AUTO'),
  sp(
    'data-trends',
    'DAT-04',
    'Data',
    'Search Demand',
    'What are people searching for that we do not sell?',
    'PROPOSE'
  ),
  sp(
    'data-carts',
    'DAT-05',
    'Data',
    'Abandoned Carts',
    'Why did a filled cart never become an order?',
    'PROPOSE'
  ),
  sp(
    'data-cohort',
    'DAT-06',
    'Data',
    'Repeat Buyers',
    'Who comes back, and what did they buy?',
    'AUTO'
  ),
  sp('data-export', 'DAT-07', 'Data', 'Exports', 'Can the owner take their data out?', 'AUTO'),
  sp(
    'data-integrity',
    'DAT-08',
    'Data',
    'Data Integrity',
    'Are orders, items and payments internally consistent?',
    'AUTO'
  ),
  sp('data-privacy', 'DAT-09', 'Data', 'Privacy', 'Are we keeping data we no longer need?', 'AUTO'),
  sp(
    'data-anomaly',
    'DAT-10',
    'Data',
    'Anomaly Watch',
    'What changed today that normally does not?',
    'AUTO'
  ),
];

/** The whole bench. Ids are unique; the planner refuses to run otherwise. */
export const SPECIALISTS: readonly Specialist[] = [
  ...LEADERSHIP,
  ...CATALOGUE,
  ...PRICING,
  ...GROWTH,
  ...CONTENT,
  ...SUPPORT,
  ...SUPPLY,
  ...FINANCE,
  ...RELIABILITY,
  ...DATA,
];

export const SPECIALIST_COUNT = SPECIALISTS.length;

const BY_ID = new Map(SPECIALISTS.map((s) => [s.id, s]));

export function getSpecialist(id: string): Specialist {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown specialist: ${id}`);
  return found;
}

export function specialistsByDepartment(): { department: Department; agents: Specialist[] }[] {
  return DEPARTMENT_ORDER.map((department) => ({
    department,
    agents: SPECIALISTS.filter((s) => s.department === department),
  })).filter((group) => group.agents.length > 0);
}
