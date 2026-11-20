import { z } from 'zod';

/**
 * Centralised, validated environment configuration.
 * Every secret used by the application is read from here - never from
 * process.env scattered across the codebase, and never exposed to the client
 * except for keys explicitly prefixed with NEXT_PUBLIC_.
 */

/**
 * NPCI-style VPA shape: `handle@psp`. Shared by the environment schema and the
 * admin-editable store setting so one definition decides what is payable.
 */
export const UPI_VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,64}$/;

const boolStr = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true' || v === '1'))
  .default(false);

const optionalNonEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional().transform((value): z.infer<T> | undefined =>
    typeof value === 'string' && value.trim() === '' ? undefined : value
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().min(1).default('Zenvora'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  ADMIN_EMAIL: optionalNonEmpty(z.string().email()),
  ADMIN_PASSWORD: optionalNonEmpty(z.string().min(8)),

  PAYMENTS_TEST_MODE: boolStr,
  /**
   * Store-owned UPI Virtual Payment Address (e.g. `zenvora@okhdfcbank`).
   * The customer scans a QR that pays THIS address directly; money never
   * passes through a third-party gateway and no gateway credentials exist.
   * Absent = UPI QR is unavailable and checkout honestly falls back to COD.
   */
  UPI_VPA: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .max(120)
      .regex(UPI_VPA_PATTERN, 'UPI_VPA must look like name@bank')
      .optional()
  ),
  /** Payee name shown in the customer's UPI app (defaults to APP_NAME). */
  UPI_PAYEE_NAME: optionalNonEmpty(z.string().max(80)),

  SUPPLIER_DEMO_MODE: boolStr,
  SUPPLIER_WEBHOOK_SECRET: optionalNonEmpty(z.string()),

  CRON_SECRET: optionalNonEmpty(z.string()),

  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  S3_BUCKET: optionalNonEmpty(z.string()),
  S3_REGION: optionalNonEmpty(z.string()),
  S3_ENDPOINT: optionalNonEmpty(z.string()),
  S3_PUBLIC_BASE_URL: optionalNonEmpty(z.string()),
  S3_ACCESS_KEY_ID: optionalNonEmpty(z.string()),
  S3_SECRET_ACCESS_KEY: optionalNonEmpty(z.string()),
  CLOUDINARY_CLOUD_NAME: optionalNonEmpty(z.string()),
  CLOUDINARY_API_KEY: optionalNonEmpty(z.string()),
  CLOUDINARY_API_SECRET: optionalNonEmpty(z.string()),
  CLOUDINARY_FOLDER: optionalNonEmpty(z.string()),
  SMTP_HOST: optionalNonEmpty(z.string()),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: boolStr,
  SMTP_USER: optionalNonEmpty(z.string()),
  SMTP_PASS: optionalNonEmpty(z.string()),
  EMAIL_FROM: z.string().default('Zenvora <no-reply@zenvora.local>'),
  EMAIL_REPLY_TO: optionalNonEmpty(z.string()),

  /**
   * Owner-supplied support mailbox. Used ONLY while the stored store setting
   * is still the shipped `support@example.com` placeholder, so a deployment
   * can advertise a real contact before anyone has saved Admin → Settings.
   * A value saved in the admin UI always wins.
   */
  SUPPORT_EMAIL: optionalNonEmpty(z.string().email().max(160)),


  // --- Optional AI narrative provider (AI CEO) -------------------------------
  // Absent by default: the AI CEO runs deterministically (see
  // src/lib/ai-ceo/provider.ts). Setting these does NOT enable execution of
  // consequential actions; that remains an owner decision in Settings.aiCeo.
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'openai-compatible']).optional(),
  AI_API_KEY: optionalNonEmpty(z.string()),
  AI_MODEL: optionalNonEmpty(z.string()),
  AI_BASE_URL: optionalNonEmpty(z.string().url()),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(50).max(2_000).default(500),

});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\nSee .env.example for guidance.`
    );
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDev = env.NODE_ENV === 'development';

/**
 * UPI QR payments need exactly one thing: the store's own UPI VPA. There are
 * no API keys, no gateway account and no webhook for this flow — the customer
 * pays the VPA directly and quotes the UTR, which an admin verifies against
 * the bank statement before the order is marked paid.
 * Returns null when usable, otherwise the reason (safe to show to an admin).
 */
export function upiConfigIssue(): string | null {
  if (!env.UPI_VPA) {
    return 'UPI_VPA is not configured — set the store UPI ID to enable QR payments';
  }
  return null;
}

/** True when the store can show a payable UPI QR. */
export function isUpiConfigured(): boolean {
  return upiConfigIssue() === null;
}

/** Display name encoded in the UPI intent (never a secret). */
export function upiPayeeName(): string {
  return env.UPI_PAYEE_NAME ?? env.APP_NAME;
}

/**
 * Test payment provider is allowed ONLY outside production. In production a
 * fake payment success must never be possible, even by misconfiguration:
 * this function is the single gate that enforces that rule.
 */
export function isTestPaymentsAllowed(): boolean {
  return env.PAYMENTS_TEST_MODE && !isProduction;
}

/** Demo supplier adapter gate - same rule as test payments. */
export function isDemoSupplierAllowed(): boolean {
  return env.SUPPLIER_DEMO_MODE && !isProduction;
}

export interface AiProviderConfig {
  provider: 'openai' | 'anthropic' | 'openai-compatible';
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

/**
 * Resolve the AI narrative provider. Returns null (disabled) unless a provider,
 * key, model and base URL are ALL present — a half-configured provider is a
 * configuration error, not a silent fallback to some default endpoint.
 * Secrets are never logged or returned to a client.
 */
export function aiProviderConfig(): AiProviderConfig | null {
  const provider = env.AI_PROVIDER;
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL;
  if (!provider || !apiKey || !model) return null;
  const baseUrl =
    env.AI_BASE_URL ??
    (provider === 'anthropic'
      ? 'https://api.anthropic.com'
      : 'https://api.openai.com');
  return {
    provider,
    apiKey,
    model,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    timeoutMs: env.AI_TIMEOUT_MS,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
  };
}
