import { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();

  return {
    name: settings.storeName,
    short_name: settings.storeName,
    description: settings.storeTagline || 'Quality products, delivered to you',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080A',
    theme_color: '#08080A',
    id: '/',
    scope: '/',
    lang: 'en-IN',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}