import { formatINR } from '../money';
import type {
  AssistantFacts,
  AssistantGuidance,
  AssistantIntent,
  BudgetRange,
} from './types';

/**
 * Pure reasoning for the concierge: intent detection, budget parsing, keyword
 * extraction and the answers that come straight from store settings.
 *
 * No I/O and no model here, so every branch is unit-testable and the wording
 * can be checked against the settings that produced it.
 */

/** Rupee amount, optionally prefixed with ₹ / Rs / INR, allowing thousands commas. */
const AMOUNT = '(?:₹|rs\\.?|inr)?\\s*(\\d[\\d,]*(?:\\.\\d+)?)';

const MAX_REASONABLE_PAISE = 100_000_000; // ₹10,00,000 — above this it is not a budget.

function toPaise(raw: string): number {
  const value = Number.parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_REASONABLE_PAISE, Math.round(value * 100));
}

/**
 * Pull a price range out of a message: "under ₹2,000", "between 500 and 900",
 * "above 1500". Returns nulls when the message carries no budget.
 */
export function parseBudgetPaise(raw: string): BudgetRange {
  const text = raw.toLowerCase();

  const between = text.match(
    new RegExp(`(?:between|from)\\s*${AMOUNT}\\s*(?:and|to|–|-)\\s*${AMOUNT}`)
  );
  if (between?.[1] && between[2]) {
    const a = toPaise(between[1]);
    const b = toPaise(between[2]);
    if (a > 0 && b > 0) {
      return { minPaise: Math.min(a, b), maxPaise: Math.max(a, b) };
    }
  }

  const under = text.match(
    new RegExp(
      `(?:under|below|less than|cheaper than|upto|up to|within|max(?:imum)?|budget(?: of)?|se kam|tak)\\s*${AMOUNT}`
    )
  );
  const above = text.match(
    new RegExp(`(?:above|over|more than|starting (?:at|from))\\s*${AMOUNT}`)
  );

  return {
    minPaise: above?.[1] ? toPaise(above[1]) || null : null,
    maxPaise: under?.[1] ? toPaise(under[1]) || null : null,
  };
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'with', 'without', 'of', 'to', 'in', 'on',
  'at', 'by', 'is', 'are', 'am', 'be', 'been', 'being', 'do', 'does', 'did', 'can',
  'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must', 'i', 'im', "i'm",
  'me', 'my', 'mine', 'we', 'our', 'us', 'you', 'your', 'they', 'them', 'their', 'it',
  'its', 'this', 'that', 'these', 'those', 'have', 'has', 'had', 'there', 'here', 'what',
  'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'any', 'some', 'something',
  'anything', 'please', 'pls', 'plz', 'want', 'need', 'like', 'looking', 'look', 'find',
  'show', 'see', 'get', 'give', 'tell', 'know', 'about', 'from', 's', 't', 'also', 'just',
  'good', 'best', 'new', 'top', 'recommend', 'recommendation', 'suggest', 'suggestion',
  'gift', 'gifts', 'ideas', 'idea', 'buy', 'buying', 'shop', 'shopping', 'product',
  'products', 'item', 'items', 'price', 'prices', 'cost', 'much', 'many', 'under', 'below',
  'less', 'than', 'between', 'above', 'over', 'upto', 'within', 'max', 'maximum', 'budget',
  'rs', 'inr', 'rupee', 'rupees', 'store', 'online', 'available', 'availability', 'have',
  'has', 'stock', 'sell', 'selling', 'sale', 'cheap', 'cheapest', 'affordable', 'trending',
  'popular', 'picks', 'pick', 'options', 'option', 'something', 'really', 'very', 'too',
]);

/**
 * Meaningful search words from a message. Budget words, intent words and
 * stopwords are removed so the catalog query is not polluted.
 */
export function extractKeywords(raw: string): string[] {
  const cleaned = raw
    .toLowerCase()
    .replace(/[₹]/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\-+.]+/gu, ' ')
    .trim();
  if (!cleaned) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawToken of cleaned.split(/\s+/)) {
    const token = rawToken.replace(/^[-+.]+|[-+.]+$/g, '');
    if (token.length < 2 || /^\d/.test(token)) continue;
    if (STOPWORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= 6) break;
  }
  return out;
}

/** Classify a message. Policy intents win over product browsing. */
export function detectIntent(raw: string): AssistantIntent {
  const text = raw.toLowerCase().trim();
  if (!text) return 'UNKNOWN';

  if (/\b(hi|hii+|hey+|hello|helo|namaste|namaskar|good (morning|afternoon|evening))\b/.test(text)) {
    return 'GREETING';
  }
  if (/\b(thank you|thanks|thankyou|thx|ok(ay)?|cool|nice|great|awesome|bye|goodbye)\b/.test(text)) {
    return 'SMALLTALK';
  }
  if (/\b(what can you do|how can you help|what do you do|how do you work|what can i ask)\b/.test(text)) {
    return 'CAPABILITIES';
  }
  if (
    /\b(track|tracking|where is my (order|parcel|package)|order status|delivery status|shipped yet|shipment)\b/.test(
      text
    )
  ) {
    return 'TRACKING';
  }
  if (/\b(return|returns|refund|refunds|exchange|replace|replacement)\b/.test(text)) {
    return 'RETURNS';
  }
  if (
    /\b(cancel|cancellation|change my order|modify (my )?order|edit (my )?order|wrong address|change (the |my )?address)\b/.test(
      text
    )
  ) {
    return 'ORDER_CHANGE';
  }
  if (
    /\b(shipping|delivery|deliver|how long|dispatch|courier|cod|cash on delivery|shipping charge|shipping cost|delivery charge|delivery time)\b/.test(
      text
    )
  ) {
    return 'SHIPPING';
  }
  if (
    /\b(payment|payments|pay|upi|qr|credit card|debit card|net banking|prepaid|online payment|gst|tax)\b/.test(
      text
    )
  ) {
    return 'PAYMENTS';
  }
  if (
    /\b(contact|support|customer care|customer service|talk to (a )?human|real person|agent|email|phone number|helpline)\b/.test(
      text
    )
  ) {
    return 'CONTACT';
  }
  if (/\b(who are you|about (the )?store|where are you (located|based)|your (address|location))\b/.test(text)) {
    return 'STORE';
  }
  if (
    /\b(recommend|recommendation|suggest|suggestion|best|trending|popular|top picks?|what should i (buy|get)|ideas?)\b/.test(
      text
    )
  ) {
    return 'RECOMMEND';
  }
  if (
    /\b(show me|looking for|do you have|i want|i need|price of|how much|search|browse|new arrivals?|under|below|between)\b/.test(
      text
    )
  ) {
    return 'PRODUCT_SEARCH';
  }
  return 'UNKNOWN';
}

function deliveryRange(facts: AssistantFacts): string {
  const { estimatedDaysMin: min, estimatedDaysMax: max } = facts.shipping;
  if (max <= 0) return 'Delivery timing is confirmed at checkout.';
  if (min === max) {
    return `Delivery is estimated at ${max} business day${max === 1 ? '' : 's'} after your order is confirmed.`;
  }
  return `Delivery is estimated at ${Math.max(0, min)}–${max} business days after your order is confirmed.`;
}

function shippingLine(facts: AssistantFacts): string {
  const { flatRatePaise, freeAbovePaise } = facts.shipping;
  if (freeAbovePaise > 0) {
    return `Shipping is ${formatINR(flatRatePaise)} on orders below ${formatINR(
      freeAbovePaise
    )}, and free above that.`;
  }
  return flatRatePaise > 0
    ? `Shipping is ${formatINR(flatRatePaise)} per order.`
    : 'Shipping is free on all orders.';
}

function codLine(facts: AssistantFacts): string {
  if (!facts.shipping.codEnabled) {
    return 'Cash on Delivery is not offered at checkout right now.';
  }
  if (facts.shipping.codFeePaise > 0) {
    return `Cash on Delivery is available with a ${formatINR(facts.shipping.codFeePaise)} fee.`;
  }
  return 'Cash on Delivery is available.';
}

function paymentLine(facts: AssistantFacts): string {
  if (facts.payments.kind === 'UPI') {
    return 'Prepaid orders are paid by UPI: scan the QR with any UPI app and submit the reference number, which the store matches against its bank account before dispatch. Card details never touch this store.';
  }
  if (facts.payments.kind === 'TEST') {
    return 'Online payment on this deployment is running on a TEST provider, so no real money moves.';
  }
  return 'Online prepaid payment is not switched on for this deployment yet.';
}

const TAX_LINE = 'All prices are GST-inclusive, so the amount you see is the amount you pay.';

/**
 * Answers built only from `facts`. Every number in the output comes from
 * store settings, so the concierge cannot promise something the store does
 * not offer.
 */
export function buildGuidance(intent: AssistantIntent, facts: AssistantFacts): AssistantGuidance {
  const support = facts.supportEmail
    ? `You can reach the team at ${facts.supportEmail}.`
    : 'You can reach the team through the contact form and they will reply by email.';

  switch (intent) {
    case 'GREETING':
      return {
        message: `Hello — welcome to ${facts.storeName}. I can help you find something in the live catalog, explain delivery or returns, or point you to order tracking. What are you shopping for?`,
        actions: [],
        followUps: ['Show me new arrivals', 'What are the delivery charges?', 'How do returns work?'],
        source: 'GUIDANCE',
      };

    case 'CAPABILITIES':
      return {
        message:
          'I can search the live catalog with real prices and links, explain delivery charges and estimated timelines, walk you through returns and cancellations, list the payment options, and point you to order tracking. If something is not in the catalog or the store settings, I will say so rather than guess.',
        actions: [{ label: 'Browse the shop', href: '/shop' }],
        followUps: ['Show me new arrivals', 'What payment methods do you accept?', 'Track my order'],
        source: 'GUIDANCE',
      };

    case 'SHIPPING':
      return {
        message: [shippingLine(facts), deliveryRange(facts), codLine(facts)].join(' '),
        actions: [
          { label: 'Shipping policy', href: '/policies/shipping' },
          { label: 'Browse products', href: '/shop' },
        ],
        followUps: ['How do returns work?', 'What payment methods do you accept?', 'Where is my order?'],
        source: 'POLICY',
      };

    case 'RETURNS': {
      const returns =
        facts.policies.returnWindowDays > 0
          ? `You can request a return within ${facts.policies.returnWindowDays} day${
              facts.policies.returnWindowDays === 1 ? '' : 's'
            } of delivery from Account → Orders.`
          : 'This store does not currently accept returns — the returns policy has the details.';
      const cancellation =
        facts.policies.cancellationWindowHours > 0
          ? `Orders can be cancelled within ${facts.policies.cancellationWindowHours} hour${
              facts.policies.cancellationWindowHours === 1 ? '' : 's'
            } of placing them.`
          : 'Once an order is placed it cannot be cancelled online.';
      return {
        message: `${returns} ${cancellation} Once an approved return is received, the refund is issued to the original payment method.`,
        actions: [
          { label: 'Returns policy', href: '/policies/returns' },
          { label: 'Your orders', href: '/account/orders' },
        ],
        followUps: ['How do I track my order?', 'What are the delivery charges?', 'Contact support'],
        source: 'POLICY',
      };
    }

    case 'PAYMENTS':
      return {
        message: [
          paymentLine(facts),
          codLine(facts),
          facts.pricesIncludeTax ? TAX_LINE : '',
        ]
          .filter(Boolean)
          .join(' '),
        actions: [
          { label: 'FAQ', href: '/faq' },
          { label: 'Shipping policy', href: '/policies/shipping' },
        ],
        followUps: ['How do returns work?', 'What are the delivery charges?', 'Show me new arrivals'],
        source: 'POLICY',
      };

    case 'TRACKING':
      return {
        message:
          'Open Track order and enter your order number (it looks like RX-260905-XXXXXX) together with the email used at checkout. That page shows the latest shipping status recorded for your order.',
        actions: [
          { label: 'Track order', href: '/track' },
          { label: 'Your orders', href: '/account/orders' },
        ],
        followUps: ['How do returns work?', 'Contact support', 'What are the delivery charges?'],
        source: 'GUIDANCE',
      };

    case 'ORDER_CHANGE': {
      const window =
        facts.policies.cancellationWindowHours > 0
          ? `Orders can be cancelled from Account → Orders within ${facts.policies.cancellationWindowHours} hour${
              facts.policies.cancellationWindowHours === 1 ? '' : 's'
            } of placing them.`
          : 'Online cancellation is not available once an order is placed.';
      return {
        message: `${window} For an address change, contact support as soon as possible and the team will confirm whether the order can still be changed before dispatch.`,
        actions: [
          { label: 'Your orders', href: '/account/orders' },
          { label: 'Contact support', href: '/contact' },
        ],
        followUps: ['How do returns work?', 'How do I track my order?', 'What are the delivery charges?'],
        source: 'POLICY',
      };
    }

    case 'CONTACT': {
      const phone = facts.supportPhone ? ` You can also call ${facts.supportPhone}.` : '';
      return {
        message: `${support}${phone}`,
        actions: [
          { label: 'Contact page', href: '/contact' },
          { label: 'FAQ', href: '/faq' },
        ],
        followUps: ['How do returns work?', 'Where is my order?', 'Browse the shop'],
        source: 'GUIDANCE',
      };
    }

    case 'STORE':
      return {
        message: `${facts.storeName} is an online store with prices in Indian rupees${
          facts.pricesIncludeTax ? ', shown GST-inclusive' : ''
        }. ${support}`,
        actions: [
          { label: 'About the store', href: '/about' },
          { label: 'Contact', href: '/contact' },
        ],
        followUps: ['Show me new arrivals', 'What are the delivery charges?', 'What payment methods do you accept?'],
        source: 'GUIDANCE',
      };

    case 'SMALLTALK':
      return {
        message: 'Happy to help. Anything else I can look up for you?',
        actions: [],
        followUps: ['Show me new arrivals', 'What are the delivery charges?', 'How do returns work?'],
        source: 'GUIDANCE',
      };

    default:
      return {
        message:
          'I am not sure I understood that. I can search the live catalog, explain delivery, returns or payments, or help with an order. Try something like “headphones under ₹2,000”, or pick one of these:',
        actions: [
          { label: 'Browse the shop', href: '/shop' },
          { label: 'Contact support', href: '/contact' },
        ],
        followUps: ['Show me new arrivals', 'What are the delivery charges?', 'How do returns work?'],
        source: 'GUIDANCE',
      };
  }
}
