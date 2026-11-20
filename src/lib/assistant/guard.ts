/**
 * Output guards for the optional model path. Kept free of environment imports
 * so the rules are unit-testable without any provider configuration.
 */

export function sanitizeModelText(raw: unknown, maxChars = 600): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 20) return null;
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars).trimEnd()}…` : cleaned;
}

/**
 * Hard honesty gate for model output. A digit anywhere means the model tried
 * to state a fact this path is not allowed to state (a price, a delivery
 * window, a discount, an order number), so the reply is dropped.
 */
export function isSafeOpenEndedReply(text: string): boolean {
  if (text.length < 20 || text.length > 700) return false;
  if (/[0-9₹$€£]/.test(text)) return false;
  if (/https?:\/\//i.test(text)) return false;
  if (/\b(guarantee|guaranteed|best price|lowest price|free of cost)\b/i.test(text)) return false;
  return true;
}
