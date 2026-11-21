import type { SourcingCandidateInput } from './types';

/**
 * Reading Meesho evidence without an API.
 *
 * Meesho has no public catalogue API, so the honest path is: the owner copies
 * what the Meesho app already shows, and this module turns it into structured
 * candidates. Two input shapes are accepted, both copy-paste friendly:
 *
 *   Product name | 349 | 999 | 4.2 | 1830 | 5400 | 4 | https://www.meesho.com/...
 *
 * Columns: name, price, mrp, rating, reviews, units sold, return %, url.
 * Trailing columns may be omitted; separators may be `|` or a tab.
 */

const MEESHO_HOSTS = new Set(['meesho.com', 'www.meesho.com', 'm.meesho.com']);

/** Canonical Meesho search link for re-ordering a candidate by name. */
export function meeshoSearchUrl(query: string): string {
  return `https://www.meesho.com/search?q=${encodeURIComponent(query.trim())}`;
}

/** Extract the stable product slug from a Meesho product URL. */
export function parseMeeshoProductUrl(raw: string): { url: string; slug: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!MEESHO_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  const slug = segments[segments.length - 1] ?? '';
  if (!slug) return null;
  return { url: parsed.toString(), slug: slug.toLowerCase() };
}

/** A stable key so the same listing is never scored twice as two rows. */
export function externalKeyFor(input: SourcingCandidateInput): string {
  const fromUrl = input.meeshoUrl ? parseMeeshoProductUrl(input.meeshoUrl) : null;
  if (fromUrl) return `meesho:${fromUrl.slug}`;
  if (input.sku && input.sku.trim()) return `sku:${input.sku.trim().toLowerCase()}`;
  const name = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `name:${name}:${Math.round(input.supplierPricePaise)}`;
}

function toPaise(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '').replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export interface ParsedSourcingSheet {
  candidates: SourcingCandidateInput[];
  skipped: Array<{ line: number; reason: string }>;
}

/**
 * Parse one pasted Meesho sheet. Invalid rows are reported, never guessed:
 * a line without a usable price is skipped and named.
 */
export function parseMeeshoSheet(text: string): ParsedSourcingSheet {
  const candidates: SourcingCandidateInput[] = [];
  const skipped: Array<{ line: number; reason: string }> = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const rawCells = line.split(/\s*\|\s*|\t+/).map((cell) => cell.trim());
    if (rawCells.length < 2) {
      skipped.push({ line: index + 1, reason: 'Expected "name | price" at minimum' });
      return;
    }

    // A link may sit in any column; if one is present it must be Meesho.
    const urlCell = rawCells.find((cell) => /^https?:\/\//i.test(cell)) ?? null;
    const parsedUrl = urlCell ? parseMeeshoProductUrl(urlCell) : null;
    if (urlCell && !parsedUrl) {
      skipped.push({ line: index + 1, reason: `Not a Meesho product URL: ${urlCell.slice(0, 60)}` });
      return;
    }
    const cells = rawCells.filter((cell) => cell !== urlCell);
    const [name, priceCell, mrpCell, ratingCell, reviewCell, soldCell, returnCell] = cells;
    const supplierPricePaise = toPaise(priceCell ?? '');
    if (!name || supplierPricePaise === null) {
      skipped.push({ line: index + 1, reason: 'Missing product name or a usable price' });
      return;
    }

    const shippingRupees = 0; // Meesho shipping is usually baked into the price.
    candidates.push({
      name: name.slice(0, 200),
      supplierPricePaise,
      shippingPaise: shippingRupees,
      mrpPaise: mrpCell ? toPaise(mrpCell) : null,
      rating: ratingCell ? toNumber(ratingCell) : null,
      reviewCount: reviewCell ? Math.round(toNumber(reviewCell) ?? 0) : null,
      unitsSold: soldCell ? Math.round(toNumber(soldCell) ?? 0) : null,
      returnRatePercent: returnCell ? toNumber(returnCell) : null,
      meeshoUrl: parsedUrl?.url ?? null,
    });
  });

  return { candidates, skipped };
}
