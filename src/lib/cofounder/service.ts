import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { formatINR } from '@/lib/money';
import { loadAiCeoSnapshotSafe } from '@/lib/ai-ceo/snapshot';
import { buildAiCeoReport } from '@/lib/ai-ceo/engine';
import type { AiCeoReport, Recommendation } from '@/lib/ai-ceo/contracts';
import type {
  CofounderAnswer,
  CofounderFacts,
  CofounderIntent,
  CofounderStat,
  ProductAlert,
} from './types';

/**
 * The cofounder reads the store for the owner.
 *
 * Two data sources only:
 *  1. the deterministic AI CEO report (revenue, orders, risks, readiness);
 *  2. bounded counts read here for things the report does not carry (carts
 *     holding items, low/out-of-stock local products, active coupons).
 *
 * It never sends messages, never changes a price and never claims an action it
 * did not take. Anything consequential stays a link to the admin screen where
 * a human performs it.
 */

const STALE_CART_HOURS = 2;
const LOW_STOCK_FALLBACK_THRESHOLD = 5;
const INVENTORY_SAMPLE = 300;

function recommendationHref(rec: Recommendation): string {
  switch (rec.category) {
    case 'OPERATIONS':
      return '/admin/operations';
    case 'CATALOG':
    case 'DATA':
      return '/admin/products';
    case 'SUPPLIER':
      return '/admin/suppliers';
    case 'COMMERCE':
      return '/admin/analytics';
    case 'READINESS':
      return '/admin/health';
    default:
      return '/admin/ai-ceo';
  }
}

function buildFacts(
  report: AiCeoReport,
  extras: {
    storeName: string;
    carts: { active: number; stale: number };
    inventory: { lowStock: ProductAlert[]; outOfStock: ProductAlert[] };
    coupons: { active: number };
    actionsEnabled: boolean;
    dailyActionLimit: number;
    activeProducts: number;
    activeWithoutImage: number;
    orders: CofounderFacts['orders'];
    jobs: CofounderFacts['jobs'];
    supportOpen: number;
  }
): CofounderFacts {
  return {
    storeName: extras.storeName,
    windowDays: report.windowDays,
    headline: report.headline,
    overallLevel: report.overallLevel,
    sales: {
      paidOrders: report.sales.paidOrderCount,
      netRevenuePaise: report.sales.netRevenuePaise,
      contributionPaise: report.sales.contributionPaise,
      aovPaise: report.sales.averageOrderValuePaise,
      basis: report.sales.basis,
      caveatCount: report.sales.caveats.length,
      codCommittedOrders: report.sales.committedCodOrderCount,
    },
    orders: extras.orders,
    risks: report.risks.map((risk) => ({
      title: risk.title,
      severity: risk.severity,
      impact: risk.impact,
      href: risk.adminHref,
    })),
    recommendations: report.recommendations.map((rec) => ({
      priority: rec.priority,
      issue: rec.issue,
      actionLabel: rec.proposedAction.label,
      href: recommendationHref(rec),
      requiresApproval: rec.proposedAction.requiresApproval,
    })),
    launchBlockers: report.readiness
      .filter((item) => item.blocks.includes('LAUNCH') && item.status !== 'PASS')
      .map((item) => ({ label: item.label, ownerAction: item.ownerAction })),
    catalog: {
      activeProducts: extras.activeProducts,
      activeWithoutImage: extras.activeWithoutImage,
      activeWithoutSupplier: report.catalog.unlinked,
      staleSupplierRows: report.catalog.stale,
      outOfStockSupplierRows: report.catalog.outOfStock,
    },
    carts: extras.carts,
    inventory: extras.inventory,
    coupons: extras.coupons,
    support: { open: extras.supportOpen },
    jobs: extras.jobs,
    actionsEnabled: extras.actionsEnabled,
    dailyActionLimit: extras.dailyActionLimit,
    dataGaps: report.dataGaps,
  };
}

/** Bounded reads for the two surfaces the AI CEO report does not cover. */
async function loadExtras(): Promise<{
  carts: { active: number; stale: number };
  inventory: { lowStock: ProductAlert[]; outOfStock: ProductAlert[] };
  coupons: { active: number };
  activeProducts: number;
  activeWithoutImage: number;
}> {
  const staleBefore = new Date(Date.now() - STALE_CART_HOURS * 3600e3);

  const [activeCarts, staleCarts, couponCount, products, activeProducts, activeWithoutImage] =
    await Promise.all([
      prisma.cart.count({ where: { convertedOrderId: null, items: { some: {} } } }),
      prisma.cart.count({
        where: {
          convertedOrderId: null,
          updatedAt: { lt: staleBefore },
          items: { some: {} },
        },
      }),
      prisma.coupon.count({ where: { isActive: true } }),
      prisma.product.findMany({
        where: { status: 'ACTIVE', hasVariants: false, stockMode: 'LOCAL' },
        select: { name: true, slug: true, stock: true, lowStockThreshold: true },
        orderBy: { stock: 'asc' },
        take: INVENTORY_SAMPLE,
      }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'ACTIVE', images: { none: {} } } }),
    ]);

  const lowStock: ProductAlert[] = [];
  const outOfStock: ProductAlert[] = [];
  for (const product of products) {
    if (product.stock <= 0) {
      outOfStock.push({
        name: product.name,
        slug: product.slug,
        stock: product.stock,
        threshold: product.lowStockThreshold,
      });
      continue;
    }
    const threshold = product.lowStockThreshold || LOW_STOCK_FALLBACK_THRESHOLD;
    if (product.stock <= threshold) {
      lowStock.push({
        name: product.name,
        slug: product.slug,
        stock: product.stock,
        threshold,
      });
    }
  }

  return {
    carts: { active: activeCarts, stale: staleCarts },
    inventory: { lowStock, outOfStock },
    coupons: { active: couponCount },
    activeProducts,
    activeWithoutImage,
  };
}

export async function loadCofounderFacts(): Promise<
  { ok: true; facts: CofounderFacts } | { ok: false; error: string }
> {
  const loaded = await loadAiCeoSnapshotSafe();
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const report = buildAiCeoReport(loaded.snapshot);
  const settings = await getSettings();
  const extras = await loadExtras();

  const facts = buildFacts(report, {
    storeName: settings.storeName,
    carts: extras.carts,
    inventory: extras.inventory,
    coupons: extras.coupons,
    actionsEnabled: settings.aiCeo.enabled && settings.aiCeo.actionsEnabled,
    dailyActionLimit: settings.aiCeo.dailyActionLimit,
    activeProducts: extras.activeProducts,
    activeWithoutImage: extras.activeWithoutImage,
    orders: {
      byStatus: loaded.snapshot.orders.countsByStatus,
      pendingPaymentOlderThan24h: loaded.snapshot.orders.pendingPaymentOlderThan24h,
    },
    jobs: {
      failedLast24h: loaded.snapshot.jobs.failedLast24h,
      pending: loaded.snapshot.jobs.counts.PENDING ?? 0,
    },
    supportOpen: loaded.snapshot.supportMessages.open,
  });

  return { ok: true, facts };
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

export function detectCofounderIntent(raw: string): CofounderIntent {
  const text = raw.toLowerCase().trim();
  if (!text) return 'UNKNOWN';

  if (/\b(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(text)) return 'GREETING';
  if (/\b(what can you do|how can you help|what do you do|help)\b/.test(text)) return 'CAPABILITIES';
  if (/\b(what should i do|what next|today|priorit|focus|start with|where do i start)\b/.test(text)) {
    return 'PRIORITIES';
  }
  if (
    /\b(revenue|sales|sell|selling|sold|earn|earned|income|money|profit|margin|aov|average order)\b/.test(
      text
    )
  ) {
    return 'SALES';
  }
  if (/\b(orders?|fulfil|pending|shipped|delivery status|stuck|payment pending)\b/.test(text)) {
    return 'ORDERS';
  }
  if (/\b(stock|inventory|sold out|out of stock|restock|low stock)\b/.test(text)) return 'INVENTORY';
  if (/\b(carts?|abandon|checkout drop|customers?|leads?)\b/.test(text)) return 'CARTS';
  if (/\b(catalog|products?|images?|listings?)\b/.test(text)) return 'CATALOG';
  if (/\b(suppliers?|sync|sourcing)\b/.test(text)) return 'SUPPLIERS';
  if (/\b(launch|ready|blockers?|go live|compliance)\b/.test(text)) return 'LAUNCH';
  if (/\b(support|messages?|tickets?|complaints?)\b/.test(text)) return 'SUPPORT';
  if (/\b(marketing|growth|sale|discount|coupon|campaign|promo|instagram|ads?|viral)\b/.test(text)) {
    return 'MARKETING';
  }
  if (/\b(risks?|problems?|wrong|failing|broken)\b/.test(text)) return 'RISKS';

  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Answers — every number below comes from `facts`
// ---------------------------------------------------------------------------

const CAPABILITY_ANSWER =
  'I read your store and report what is actually there: revenue and contribution, pending orders, carts holding items, stock alerts, catalog and supplier gaps, support messages, risks and launch blockers. I can also show you what I would do next. I cannot price, refund, publish or message customers — those stay with you.';

function salesAnswer(facts: CofounderFacts): CofounderAnswer {
  const { sales } = facts;
  if (sales.paidOrders === 0) {
    return {
      message: `No paid order in the last ${facts.windowDays} days, so revenue and margin are not measurable yet — I will not show a zero as if it were a result. ${sales.codCommittedOrders} COD order(s) are committed but not collected.`,
      intent: 'SALES',
      stats: [
        { label: 'Paid orders', value: '0' },
        { label: 'COD committed', value: String(sales.codCommittedOrders) },
      ],
      actions: [{ label: 'Open analytics', href: '/admin/analytics' }],
      followUps: ['What should I do today?', 'How many orders are pending?', 'Any stock alerts?'],
    };
  }

  const contribution =
    sales.contributionPaise !== null
      ? ` Contribution is ${formatINR(sales.contributionPaise)} (${sales.basis.toLowerCase()} basis).`
      : ' Contribution is not measurable because costs are not booked for every order.';
  const aov = sales.aovPaise !== null ? ` Average order value is ${formatINR(sales.aovPaise)}.` : '';
  const caveat =
    sales.caveatCount > 0
      ? ` Read the ${sales.caveatCount} caveat(s) on the report before quoting these numbers externally.`
      : '';

  return {
    message: `In the last ${facts.windowDays} days: ${formatINR(sales.netRevenuePaise)} net revenue from ${sales.paidOrders} paid order(s).${aov}${contribution}${caveat} ${sales.codCommittedOrders} COD order(s) are committed but not collected.`,
    intent: 'SALES',
    stats: [
      { label: 'Net revenue', value: formatINR(sales.netRevenuePaise), tone: 'positive' },
      { label: 'Paid orders', value: String(sales.paidOrders) },
      {
        label: 'Contribution',
        value: sales.contributionPaise !== null ? formatINR(sales.contributionPaise) : 'Not measurable',
        tone:
          sales.contributionPaise !== null && sales.contributionPaise < 0 ? 'negative' : 'neutral',
      },
    ],
    actions: [{ label: 'Open analytics', href: '/admin/analytics' }],
    followUps: ['What should I do today?', 'Any stock alerts?', 'Any orders stuck?'],
  };
}

function ordersAnswer(facts: CofounderFacts): CofounderAnswer {
  const entries = Object.entries(facts.orders.byStatus)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const pending = facts.orders.pendingPaymentOlderThan24h;
  const summary =
    entries.length > 0
      ? entries.map(([status, count]) => `${status.replace(/_/g, ' ').toLowerCase()}: ${count}`).join(' · ')
      : 'no orders recorded yet';

  return {
    message: `Order book — ${summary}.${
      pending > 0
        ? ` ${pending} payment(s) have been pending for more than 24 hours: that is an abandoned-checkout signal worth reviewing.`
        : ' No payment has been pending for more than 24 hours.'
    }`,
    intent: 'ORDERS',
    stats: [
      { label: 'Pending payments', value: String(pending), tone: pending > 0 ? 'warning' : 'neutral' },
      { label: 'Failed jobs (24h)', value: String(facts.jobs.failedLast24h), tone: facts.jobs.failedLast24h > 0 ? 'negative' : 'neutral' },
    ],
    actions: [
      { label: 'Open orders', href: '/admin/orders' },
      { label: 'Job queue', href: '/admin/logs/jobs' },
    ],
    followUps: ['What should I do today?', 'How are sales?', 'Any cart abandonments?'],
  };
}

function inventoryAnswer(facts: CofounderFacts): CofounderAnswer {
  const { lowStock, outOfStock } = facts.inventory;
  if (lowStock.length === 0 && outOfStock.length === 0) {
    return {
      message:
        'No local-stock product is at or below its threshold right now. Supplier-synced availability is tracked separately on the catalogue report.',
      intent: 'INVENTORY',
      stats: [
        { label: 'Active products', value: String(facts.catalog.activeProducts) },
        { label: 'Stock alerts', value: '0', tone: 'positive' },
      ],
      actions: [{ label: 'Open inventory', href: '/admin/inventory' }],
      followUps: ['What should I do today?', 'Any supplier issues?', 'How are sales?'],
    };
  }

  const lines = [
    ...outOfStock.map((item) => `${item.name} — sold out`),
    ...lowStock.map((item) => `${item.name} — ${item.stock} left (threshold ${item.threshold})`),
  ];

  return {
    message: `${outOfStock.length} product(s) are sold out and ${lowStock.length} are at or below their low-stock threshold. ${lines.slice(0, 4).join('; ')}. Supplier-synced products report availability separately.`,
    intent: 'INVENTORY',
    stats: [
      { label: 'Sold out', value: String(outOfStock.length), tone: 'negative' },
      { label: 'Low stock', value: String(lowStock.length), tone: 'warning' },
    ],
    actions: [{ label: 'Open inventory', href: '/admin/inventory' }],
    followUps: ['What should I do today?', 'How are sales?', 'Any supplier issues?'],
  };
}

function cartsAnswer(facts: CofounderFacts): CofounderAnswer {
  const { active, stale } = facts.carts;
  if (active === 0) {
    return {
      message: 'No saved cart currently holds an item. There is nothing to recover.',
      intent: 'CARTS',
      stats: [{ label: 'Carts with items', value: '0' }],
      actions: [{ label: 'Open customers', href: '/admin/customers' }],
      followUps: ['What should I do today?', 'How are sales?', 'Any stock alerts?'],
    };
  }

  return {
    message: `${active} saved cart(s) hold at least one item; ${stale} have not changed in ${STALE_CART_HOURS}+ hours. This store does not send automated cart-recovery messages, so I will not pretend a reminder went out — the next step would be deciding whether to add that automation or review the customers manually.`,
    intent: 'CARTS',
    stats: [
      { label: 'Carts with items', value: String(active) },
      { label: `Stale ${STALE_CART_HOURS}h+`, value: String(stale), tone: stale > 0 ? 'warning' : 'neutral' },
    ],
    actions: [{ label: 'Open customers', href: '/admin/customers' }],
    followUps: ['What should I do today?', 'Can I run a flash sale?', 'How are sales?'],
  };
}

function catalogAnswer(facts: CofounderFacts): CofounderAnswer {
  const { catalog } = facts;
  return {
    message: `${catalog.activeProducts} active product(s). ${catalog.activeWithoutImage} active product(s) have no image and ${catalog.activeWithoutSupplier} have no supplier link. ${catalog.staleSupplierRows} supplier row(s) are stale and ${catalog.outOfStockSupplierRows} report out of stock.`,
    intent: 'CATALOG',
    stats: [
      { label: 'Active products', value: String(catalog.activeProducts) },
      { label: 'Missing images', value: String(catalog.activeWithoutImage), tone: catalog.activeWithoutImage > 0 ? 'warning' : 'positive' },
    ],
    actions: [
      { label: 'Open products', href: '/admin/products' },
      { label: 'Supplier mapping', href: '/admin/supplier-products' },
    ],
    followUps: ['What should I do today?', 'Any supplier issues?', 'Any stock alerts?'],
  };
}

function supplierAnswer(facts: CofounderFacts): CofounderAnswer {
  return {
    message: `${facts.catalog.staleSupplierRows} supplier row(s) are stale and ${facts.catalog.outOfStockSupplierRows} report out of stock. Open Suppliers for sync status per supplier; a dry run is available from the AI CEO action console.`,
    intent: 'SUPPLIERS',
    stats: [
      { label: 'Stale rows', value: String(facts.catalog.staleSupplierRows), tone: facts.catalog.staleSupplierRows > 0 ? 'warning' : 'neutral' },
      { label: 'Out of stock', value: String(facts.catalog.outOfStockSupplierRows) },
    ],
    actions: [
      { label: 'Open suppliers', href: '/admin/suppliers' },
      { label: 'AI CEO actions', href: '/admin/ai-ceo' },
    ],
    followUps: ['What should I do today?', 'Any stock alerts?', 'How are sales?'],
  };
}

function launchAnswer(facts: CofounderFacts): CofounderAnswer {
  if (facts.launchBlockers.length === 0) {
    return {
      message:
        'No launch blocker is open in the configuration checklist. That is a configuration statement, not a legal or tax certification.',
      intent: 'LAUNCH',
      stats: [{ label: 'Launch blockers', value: '0', tone: 'positive' }],
      actions: [{ label: 'System health', href: '/admin/health' }],
      followUps: ['What should I do today?', 'Any risks?', 'How are sales?'],
    };
  }
  return {
    message: `${facts.launchBlockers.length} launch blocker(s) are open. ${facts.launchBlockers
      .slice(0, 3)
      .map((b) => b.label)
      .join('; ')}. Each one needs an owner action, and some need professional review.`,
    intent: 'LAUNCH',
    stats: [{ label: 'Launch blockers', value: String(facts.launchBlockers.length), tone: 'negative' }],
    actions: [{ label: 'Open readiness', href: '/admin/health' }],
    followUps: ['What should I do today?', 'Any risks?', 'Any supplier issues?'],
  };
}

function supportAnswer(facts: CofounderFacts): CofounderAnswer {
  return {
    message:
      facts.support.open > 0
        ? `${facts.support.open} support message(s) are open in the admin inbox.`
        : 'No open support message right now.',
    intent: 'SUPPORT',
    stats: [{ label: 'Open messages', value: String(facts.support.open), tone: facts.support.open > 0 ? 'warning' : 'neutral' }],
    actions: [{ label: 'Open messages', href: '/admin/messages' }],
    followUps: ['What should I do today?', 'How are sales?', 'Any orders stuck?'],
  };
}

function marketingAnswer(facts: CofounderFacts): CofounderAnswer {
  const stale = facts.carts.stale;
  return {
    message: `${facts.coupons.active} coupon(s) are active. A flash sale runs through Admin → Coupons, and the pricing engine still enforces your configured margin floor — I will not promise a discount the margin rules would refuse.${
      stale > 0
        ? ` ${stale} cart(s) have been idle for ${STALE_CART_HOURS}+ hours; automated cart reminders are not part of this store yet, so that would be a decision, not something I can silently do.`
        : ''
    }`,
    intent: 'MARKETING',
    stats: [
      { label: 'Active coupons', value: String(facts.coupons.active) },
      { label: `Idle carts ${STALE_CART_HOURS}h+`, value: String(stale), tone: stale > 0 ? 'warning' : 'neutral' },
    ],
    actions: [
      { label: 'Coupons', href: '/admin/coupons' },
      { label: 'Analytics', href: '/admin/analytics' },
    ],
    followUps: ['What should I do today?', 'How are sales?', 'Any stock alerts?'],
  };
}

function prioritiesAnswer(facts: CofounderFacts): CofounderAnswer {
  const stats: CofounderStat[] = [
    {
      label: 'Open risks',
      value: String(facts.risks.length),
      tone: facts.risks.length > 0 ? 'warning' : 'neutral',
    },
    { label: 'Recommendations', value: String(facts.recommendations.length) },
    {
      label: 'Stock alerts',
      value: String(facts.inventory.lowStock.length + facts.inventory.outOfStock.length),
    },
  ];

  if (facts.recommendations.length === 0) {
    return {
      message:
        'Nothing currently meets the evidence threshold for a recommendation. The next useful move is to keep the catalogue and order pipeline clean; I will speak up when a measured issue appears.',
      intent: 'PRIORITIES',
      stats,
      actions: [{ label: 'Full AI CEO report', href: '/admin/ai-ceo' }],
      followUps: ['How are sales?', 'Any stock alerts?', 'Any risks?'],
    };
  }

  const top = facts.recommendations.slice(0, 3);
  const clip = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
  return {
    message: `I rank by measured risk, not by what sounds exciting.\n\n${top
      .map(
        (rec, index) =>
          `${index + 1}) ${clip(rec.issue, 130)} → ${clip(rec.actionLabel, 80)}${
            rec.requiresApproval ? ' (needs your approval)' : ''
          }`
      )
      .join('\n')}`,
    intent: 'PRIORITIES',
    stats,
    actions: [
      { label: 'Full AI CEO report', href: '/admin/ai-ceo' },
      { label: 'System health', href: '/admin/health' },
    ],
    followUps: ['Any stock alerts?', 'Any orders stuck?', 'How are sales?'],
  };
}

function risksAnswer(facts: CofounderFacts): CofounderAnswer {
  if (facts.risks.length === 0) {
    return {
      message: 'No confirmed risk is open right now. Every measured operational surface is within its threshold.',
      intent: 'RISKS',
      stats: [{ label: 'Open risks', value: '0', tone: 'positive' }],
      actions: [{ label: 'System health', href: '/admin/health' }],
      followUps: ['What should I do today?', 'How are sales?', 'Any stock alerts?'],
    };
  }
  return {
    message: `${facts.risks.length} confirmed risk(s): ${facts.risks
      .slice(0, 3)
      .map((risk) => `${risk.title} (${risk.severity.toLowerCase()})`)
      .join('; ')}. Each one states its evidence on the report.`,
    intent: 'RISKS',
    stats: [{ label: 'Open risks', value: String(facts.risks.length), tone: 'warning' }],
    actions: [{ label: 'Full AI CEO report', href: '/admin/ai-ceo' }],
    followUps: ['What should I do today?', 'Any supplier issues?', 'Any orders stuck?'],
  };
}

export function answerFromFacts(message: string, facts: CofounderFacts): CofounderAnswer {
  const intent = detectCofounderIntent(message);

  switch (intent) {
    case 'GREETING':
      return {
        message: `Hello. I am your cofounder for ${facts.storeName}. Current state: ${facts.headline}. Ask me about sales, orders, stock, carts, suppliers or what to do next.`,
        intent,
        stats: [
          { label: 'Net revenue', value: formatINR(facts.sales.netRevenuePaise) },
          { label: 'Open risks', value: String(facts.risks.length) },
        ],
        actions: [{ label: 'Full AI CEO report', href: '/admin/ai-ceo' }],
        followUps: ['What should I do today?', 'How are sales?', 'Any stock alerts?'],
      };
    case 'CAPABILITIES':
      return {
        message: CAPABILITY_ANSWER,
        intent,
        stats: [],
        actions: [{ label: 'Full AI CEO report', href: '/admin/ai-ceo' }],
        followUps: ['What should I do today?', 'How are sales?', 'Any cart abandonments?'],
      };
    case 'SALES':
      return salesAnswer(facts);
    case 'ORDERS':
      return ordersAnswer(facts);
    case 'INVENTORY':
      return inventoryAnswer(facts);
    case 'CARTS':
      return cartsAnswer(facts);
    case 'CATALOG':
      return catalogAnswer(facts);
    case 'SUPPLIERS':
      return supplierAnswer(facts);
    case 'LAUNCH':
      return launchAnswer(facts);
    case 'SUPPORT':
      return supportAnswer(facts);
    case 'MARKETING':
      return marketingAnswer(facts);
    case 'RISKS':
      return risksAnswer(facts);
    case 'PRIORITIES':
      return prioritiesAnswer(facts);
    default:
      return {
        message:
          'I can answer from your store records: sales and contribution, pending orders, carts holding items, stock alerts, catalogue and supplier gaps, support messages, risks and launch blockers. Try one of these:',
        intent: 'UNKNOWN',
        stats: [
          { label: 'Net revenue', value: formatINR(facts.sales.netRevenuePaise) },
          { label: 'Open risks', value: String(facts.risks.length) },
        ],
        actions: [{ label: 'Full AI CEO report', href: '/admin/ai-ceo' }],
        followUps: ['What should I do today?', 'How are sales?', 'Any stock alerts?'],
      };
  }
}

/** Loads real facts and answers; used by the admin chat endpoint. */
export async function answerCofounder(
  message: string
): Promise<{ ok: true; answer: CofounderAnswer } | { ok: false; error: string }> {
  const loaded = await loadCofounderFacts();
  if (!loaded.ok) return { ok: false, error: loaded.error };
  return { ok: true, answer: answerFromFacts(message, loaded.facts) };
}
