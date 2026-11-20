import type { StoreSettings } from '@/lib/settings';
import { isPlaceholderEmail } from '@/lib/settings';

/**
 * Launch blockers and configuration gaps, derived from stored settings and
 * the validated environment. Pure: both admin pages (Health, Operations)
 * call this so they never disagree. Nothing here is a legal determination;
 * see docs/LAUNCH_READINESS.md for the owner-facing checklist.
 */
export interface LaunchReadiness {
  /** Must be fixed before real customers pay. */
  blockers: string[];
  /** Should be fixed; the store functions honestly without them. */
  configGaps: string[];
}

export interface LaunchReadinessEnv {
  NODE_ENV: string;
  EMAIL_PROVIDER: string;
  CRON_SECRET?: string;
  /** Store UPI ID used by the QR payment flow (public, not a secret). */
  UPI_VPA?: string;
  STORAGE_PROVIDER: string;
  SUPPORT_EMAIL?: string;
  EMAIL_FROM?: string;
  SMTP_HOST?: string;
}

/**
 * Extract the domain from an `EMAIL_FROM` value (`Name <mail@store.com>` or a
 * bare address). Returns null when no address can be found.
 */
export function senderDomain(emailFrom: string | undefined): string | null {
  if (!emailFrom) return null;
  const bracketed = emailFrom.match(/<([^>]+)>/);
  const address = (bracketed ? bracketed[1] : emailFrom).trim();
  const at = address.lastIndexOf('@');
  if (at === -1 || at === address.length - 1) return null;
  return address.slice(at + 1).toLowerCase();
}

/**
 * Reserved / internal domains that no external mailbox accepts. Sending
 * transactional mail from one of these is the classic reason "the app looks
 * fine" but customers never receive order confirmation.
 */
export function isUndeliverableSenderDomain(domain: string | null): boolean {
  if (!domain) return true;
  return (
    domain === 'localhost' ||
    domain.endsWith('.local') ||
    domain.endsWith('.internal') ||
    domain.endsWith('.invalid') ||
    domain.endsWith('.test') ||
    /(^|\.)example\.(com|net|org)$/.test(domain)
  );
}

export function collectLaunchReadiness(params: {
  settings: Pick<StoreSettings, 'demoMode' | 'supportEmail' | 'business'>;
  env: LaunchReadinessEnv;
  paymentConfigured: boolean;
  isProduction?: boolean;
}): LaunchReadiness {
  const { settings, env, paymentConfigured } = params;
  const isProduction = params.isProduction ?? env.NODE_ENV === 'production';
  const blockers: string[] = [];
  const configGaps: string[] = [];

  if (isProduction && !paymentConfigured)
    blockers.push('No payment method configured — set UPI_VPA or enable Cash on Delivery');
  if (isProduction && env.EMAIL_PROVIDER !== 'smtp')
    blockers.push('Email provider is console — customers would not receive emails');
  if (isProduction && env.EMAIL_PROVIDER === 'smtp') {
    if (!env.SMTP_HOST)
      blockers.push('EMAIL_PROVIDER is smtp but SMTP_HOST is empty — no email can be delivered');
    if (isUndeliverableSenderDomain(senderDomain(env.EMAIL_FROM)))
      blockers.push(
        'EMAIL_FROM uses a reserved/internal domain (localhost, .local, .test, .invalid, example.com) — verify your own domain with SPF and DKIM so order mail is not rejected or filed as spam'
      );
  }
  if (settings.demoMode && isProduction) blockers.push('Demo mode is ON in production');
  if (!env.CRON_SECRET) blockers.push('CRON_SECRET not set — /api/cron/jobs is unprotected or disabled');
  if (isPlaceholderEmail(settings.supportEmail))
    blockers.push(
      'Support e-mail is still the placeholder (support@example.com) — set a real address in Settings → Store or the SUPPORT_EMAIL environment variable; public pages link to the contact form until then'
    );

  const b = settings.business;
  const missingBusiness = [
    !b.legalName && 'legal/trading name',
    !b.addressLine && 'principal address',
    !b.gstin && 'GSTIN (if registered)',
  ].filter((x): x is string => Boolean(x));
  if (missingBusiness.length)
    configGaps.push(
      `Business details missing: ${missingBusiness.join(', ')} — required on policy pages by the Consumer Protection (E-Commerce) Rules once selling`
    );
  if (!env.UPI_VPA && !isProduction)
    configGaps.push(
      'UPI_VPA not set — UPI QR payments are hidden in development; set it to the store UPI ID to test the full flow'
    );
  if (isProduction && env.STORAGE_PROVIDER === 'local')
    configGaps.push('STORAGE_PROVIDER is local — uploaded media is ephemeral on serverless hosting');
  if (!isPlaceholderEmail(settings.supportEmail) && env.SUPPORT_EMAIL && settings.supportEmail === env.SUPPORT_EMAIL)
    configGaps.push('Support e-mail comes from the SUPPORT_EMAIL environment fallback — save it in Settings → Store to make it permanent');

  return { blockers, configGaps };
}
