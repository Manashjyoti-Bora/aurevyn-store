import {
  listActiveCategories,
  listStorefrontProducts,
  type CategoryTile,
  type ProductCardData,
} from '@/lib/catalog/storefront';
import { describePaymentProvider, resolveUpiConfig } from '@/lib/payments';
import { configuredSupportEmail, getSettings, type StoreSettings } from '@/lib/settings';
import { formatINR } from '@/lib/money';
import { buildGuidance, detectIntent, extractKeywords, parseBudgetPaise } from './knowledge';
import { phraseOpenEnded } from './model';
import type {
  AssistantAction,
  AssistantFacts,
  AssistantProduct,
  AssistantReply,
} from './types';

/**
 * Server-side concierge: retrieve from the live catalog, answer policy
 * questions from store settings, and optionally phrase only open-ended
 * messages with a configured model. Nothing here writes to the database.
 */

const CATALOG_INTENTS = new Set(['PRODUCT_SEARCH', 'RECOMMEND']);

export function factsFromSettings(settings: StoreSettings): AssistantFacts {
  const payments = describePaymentProvider(
    resolveUpiConfig(settings.payments),
    settings.payments
  );
  return {
    storeName: settings.storeName,
    supportEmail: configuredSupportEmail(settings),
    supportPhone: settings.supportPhone.trim() || null,
    pricesIncludeTax: settings.tax.pricesIncludeTax,
    shipping: {
      flatRatePaise: settings.shipping.flatRatePaise,
      freeAbovePaise: settings.shipping.freeAbovePaise,
      codEnabled: settings.shipping.codEnabled,
      codFeePaise: settings.shipping.codFeePaise,
      estimatedDaysMin: settings.shipping.estimatedDaysMin,
      estimatedDaysMax: settings.shipping.estimatedDaysMax,
    },
    policies: {
      returnWindowDays: settings.policies.returnWindowDays,
      cancellationWindowHours: settings.policies.cancellationWindowHours,
    },
    payments: { kind: payments.kind, label: payments.label, isTest: payments.isTest },
    demoMode: settings.demoMode,
  };
}

function toAssistantProduct(product: ProductCardData): AssistantProduct {
  return {
    slug: product.slug,
    name: product.name,
    pricePaise: product.pricePaise,
    compareAtPricePaise: product.compareAtPricePaise,
    imageUrl: product.imageUrls[0] ?? null,
    categoryName: product.categoryName,
    available: product.availability.purchasable,
  };
}

interface CategoryMatch {
  slug: string;
  name: string;
  tokens: Set<string>;
}

function matchCategory(message: string, categories: CategoryTile[]): CategoryMatch | null {
  const text = ` ${message
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

  let best: (CategoryMatch & { score: number }) | null = null;
  for (const category of categories) {
    const nameTokens = category.name
      .toLowerCase()
      .split(/[^\p{L}\p{M}\p{N}]+/u)
      .filter((token) => token.length > 2);
    const slugTokens = category.slug.split('-').filter((token) => token.length > 2);
    const allTokens = [...new Set([...nameTokens, ...slugTokens])];
    if (allTokens.length === 0) continue;

    const nameInText = text.includes(` ${category.name.toLowerCase()} `);
    const allTokensInText = allTokens.every((token) => text.includes(` ${token} `));
    if (!nameInText && !allTokensInText) continue;

    const score = category.name.length;
    if (!best || score > best.score) {
      best = {
        slug: category.slug,
        name: category.name,
        tokens: new Set(allTokens),
        score,
      };
    }
  }
  return best ? { slug: best.slug, name: best.name, tokens: best.tokens } : null;
}

function quote(value: string): string {
  return `“${value.length > 80 ? `${value.slice(0, 77)}…` : value}”`;
}

function catalogFollowUps(categories: CategoryTile[], matchedSlug: string | null): string[] {
  const picks = categories
    .filter((c) => c.slug !== matchedSlug && c.productCount > 0)
    .slice(0, 2)
    .map((c) => `Show me ${c.name}`);
  return [...picks, 'What are the delivery charges?', 'Show me new arrivals'].slice(0, 3);
}

export async function answerAssistant(message: string): Promise<AssistantReply> {
  const settings = await getSettings();
  const facts = factsFromSettings(settings);
  const intent = detectIntent(message);

  if (!CATALOG_INTENTS.has(intent)) {
    const guidance = buildGuidance(intent, facts);

    // Only a genuinely unclassified message may be phrased by a model, and
    // only if a provider is configured. Policy/product answers stay fixed.
    if (intent === 'UNKNOWN') {
      const phrased = await phraseOpenEnded({ message, facts });
      if (phrased) {
        return {
          message: phrased,
          intent,
          products: [],
          actions: guidance.actions,
          followUps: guidance.followUps,
          source: 'MODEL',
          modelUsed: true,
        };
      }
    }

    return {
      message: guidance.message,
      intent,
      products: [],
      actions: guidance.actions,
      followUps: guidance.followUps,
      source: guidance.source,
      modelUsed: false,
    };
  }

  const budget = parseBudgetPaise(message);
  const allKeywords = extractKeywords(message);
  const categories = await listActiveCategories();
  const matchedCategory = matchCategory(message, categories);
  const keywords = matchedCategory
    ? allKeywords.filter((token) => !matchedCategory.tokens.has(token))
    : allKeywords;
  const query = keywords.join(' ');
  const searchText = query || allKeywords.join(' ');

  const filters = {
    ...(query ? { q: query } : {}),
    ...(matchedCategory ? { categorySlug: matchedCategory.slug } : {}),
    ...(budget.maxPaise !== null ? { maxPricePaise: budget.maxPaise } : {}),
    ...(budget.minPaise !== null ? { minPricePaise: budget.minPaise } : {}),
    perPage: 4,
  };

  let items: ProductCardData[] = [];
  try {
    items = (await listStorefrontProducts(filters)).items;
    // Multi-word queries use AND-matching; retry with the first word before
    // concluding nothing exists.
    if (items.length === 0 && keywords.length > 1) {
      items = (
        await listStorefrontProducts({
          ...filters,
          q: keywords[0],
        })
      ).items;
    }
  } catch {
    items = [];
  }

  const available = items.filter((item) => item.availability.purchasable).slice(0, 4);
  // A real catalog match that cannot be bought is very different from no
  // match at all: say it is sold out instead of claiming it is not listed.
  const soldOutMatch = available.length === 0 && items.length > 0;
  const fallbackNeeded = available.length === 0 && !soldOutMatch;
  let fallback: ProductCardData[] = [];
  if (fallbackNeeded) {
    try {
      fallback = (
        await listStorefrontProducts({ perPage: 4, sort: intent === 'RECOMMEND' ? 'featured' : 'newest' })
      ).items.filter((item) => item.availability.purchasable);
    } catch {
      fallback = [];
    }
  }

  const shown = soldOutMatch
    ? items.slice(0, 2)
    : fallbackNeeded
      ? fallback.slice(0, 3)
      : available;

  const filterPhrases: string[] = [];
  if (matchedCategory) filterPhrases.push(`in ${matchedCategory.name}`);
  if (budget.maxPaise !== null) filterPhrases.push(`under ${formatINR(budget.maxPaise)}`);
  if (budget.minPaise !== null) filterPhrases.push(`above ${formatINR(budget.minPaise)}`);
  const filterText = filterPhrases.length > 0 ? ` ${filterPhrases.join(' ')}` : '';
  const taxNote = facts.pricesIncludeTax ? ' All prices are GST-inclusive.' : '';

  let reply: string;
  if (soldOutMatch) {
    reply =
      shown.length === 1
        ? `I found ${quote(searchText || 'that')}${filterText} in the catalog, but it is currently sold out. I have linked it below in case you want to check back.${taxNote}`
        : `I found ${shown.length} matches for ${quote(searchText || 'that')}${filterText} in the catalog, but they are currently sold out. I have linked them below in case you want to check back.${taxNote}`;
  } else if (!fallbackNeeded) {
    reply =
      searchText.length > 0
        ? `I found ${shown.length} live ${shown.length === 1 ? 'match' : 'matches'} for ${quote(
            searchText
          )}${filterText}.${taxNote}`
        : `Here ${shown.length === 1 ? 'is a live pick' : 'are live picks'} from the catalog${filterText}.${taxNote}`;
  } else if (shown.length > 0) {
    reply =
      searchText.length > 0
        ? `I could not find an available product for ${quote(
            searchText
          )}${filterText} in the live catalog — it may not be listed yet. Here are current picks instead.${taxNote}`
        : `I could not find an available product matching that${filterText}. Here are current picks instead.${taxNote}`;
  } else {
    reply =
      'I could not find an available product matching that in the live catalog. The catalog may still be getting set up — browse the shop or contact support and the team will help.';
  }

  const actions: AssistantAction[] = [];
  if (searchText.length > 0) {
    actions.push({ label: 'Open search', href: `/search?q=${encodeURIComponent(searchText)}` });
  }
  actions.push({
    label: matchedCategory ? `Browse ${matchedCategory.name}` : 'Browse the shop',
    href: matchedCategory ? `/categories/${matchedCategory.slug}` : '/shop',
  });

  return {
    message: reply,
    intent,
    products: shown.map(toAssistantProduct),
    actions,
    followUps: catalogFollowUps(categories, matchedCategory?.slug ?? null),
    source: 'CATALOG',
    modelUsed: false,
  };
}
