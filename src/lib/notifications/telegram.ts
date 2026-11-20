import { env } from '../env';
import { logger } from '../logger';

/**
 * Instant owner alerts.
 *
 * Email already works through the durable notification queue, but a payment
 * claim is time-sensitive: the sooner the owner matches the UTR against the
 * bank statement, the sooner the order ships. Telegram delivers in a second
 * on a phone, which is what actually happens in this business.
 *
 * Both channels are optional and independent:
 *  - Email: uses the existing queue (retries, delivery status in Admin).
 *  - Telegram: only when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.
 *    Failures are logged and never break the customer's request.
 *
 * No secret is ever logged. The message text is built from real order data by
 * the caller.
 */

export interface TelegramResult {
  sent: boolean;
  reason?: string;
}

function telegramConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramAlert(text: string): Promise<TelegramResult> {
  if (!telegramConfigured()) {
    return { sent: false, reason: 'not-configured' };
  }
  if (text.trim().length === 0) return { sent: false, reason: 'empty' };

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: text.slice(0, 4000),
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      logger.warn('Telegram alert was refused', { status: res.status });
      return { sent: false, reason: `http-${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    logger.warn('Telegram alert failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: 'transport' };
  }
}

/** True when the owner can receive instant pushes (used by Admin → Health). */
export function telegramAlertsConfigured(): boolean {
  return telegramConfigured();
}
