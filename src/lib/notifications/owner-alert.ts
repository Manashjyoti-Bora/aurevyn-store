import { env } from '../env';
import { configuredSupportEmail, getSettings } from '../settings';
import { logger } from '../logger';
import { queueNotification } from './notify';
import { sendTelegramAlert } from './telegram';

/**
 * Owner alerts — one call, both channels.
 *
 * Used for events the owner must act on quickly (a UPI reference waiting to
 * be matched, a fulfilment failure). Email goes through the durable queue so
 * it is retried and visible in Admin → Messages; Telegram is a best-effort
 * instant push. Neither channel blocking the other is intentional: a broken
 * Telegram bot must never stop the email, and a missing mailbox must never
 * stop the push.
 *
 * Returns which channels were actually attempted, so callers can log honestly.
 */
export interface OwnerAlertInput {
  title: string;
  summary: string;
  details?: string;
  /** Absolute path or URL the owner should open. */
  url?: string;
  ctaLabel?: string;
  orderId?: string | null;
  dedupeExtra?: string;
}

export interface OwnerAlertResult {
  emailQueued: boolean;
  telegramSent: boolean;
}

export async function alertOwner(input: OwnerAlertInput): Promise<OwnerAlertResult> {
  const settings = await getSettings();
  const recipient = configuredSupportEmail(settings) ?? env.ADMIN_EMAIL ?? null;

  let emailQueued = false;
  if (recipient) {
    const notificationId = await queueNotification({
      template: 'OWNER_ALERT',
      email: recipient,
      orderId: input.orderId ?? null,
      dedupeExtra: input.dedupeExtra,
      skipIfNoEmail: true,
      vars: {
        title: input.title,
        summary: input.summary,
        details: input.details ?? '',
        url: input.url ? absoluteUrl(input.url) : '',
        ctaLabel: input.ctaLabel ?? 'Open admin console',
      },
    });
    emailQueued = Boolean(notificationId);
  } else {
    logger.info('Owner alert email skipped: no owner mailbox configured', {
      title: input.title,
    });
  }

  const telegram = await sendTelegramAlert(
    [`${input.title}`, input.summary, input.details ?? '', input.url ? absoluteUrl(input.url) : '']
      .filter(Boolean)
      .join('\n\n')
  );

  return { emailQueued, telegramSent: telegram.sent };
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.APP_URL.replace(/\/$/, '')}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}
