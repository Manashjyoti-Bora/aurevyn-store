/**
 * The store's default social card (1200×630 PNG in /public).
 *
 * Every metadata block that declares its own `openGraph` must also declare an
 * image: Next.js replaces the object rather than deep-merging, and a crawler
 * that finds an OG title with no image falls back to a bare link preview.
 */
export const OG_IMAGE_PATH = '/og-image.png';

export function defaultOgImage(storeName: string, tagline?: string | null) {
  return {
    url: OG_IMAGE_PATH,
    width: 1200,
    height: 630,
    alt: `${storeName} — ${tagline || 'Quality products, honestly priced, delivered across India'}`,
  };
}
