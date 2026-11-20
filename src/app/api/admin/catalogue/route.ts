import { apiRoute, jsonOk } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { assertRateLimit } from '@/lib/rate-limit';
import { curatedCatalogueStatus, installCuratedCatalogue } from '@/lib/catalog/curated';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Readiness snapshot for the curated launch catalogue. */
export const GET = apiRoute(async () => {
  await requireAdminWrite('catalogue-status');
  return jsonOk(await curatedCatalogueStatus());
});

/**
 * Install the curated launch catalogue. Idempotent: existing slugs are left
 * untouched, so re-running after edits never overwrites the owner's work.
 */
export const POST = apiRoute(async () => {
  const admin = await requireAdminWrite('catalogue-install');
  await assertRateLimit(`catalogue-install:${admin.id}`, { limit: 3, windowMs: 60 * 60_000 });
  const result = await installCuratedCatalogue({ id: admin.id, email: admin.email });
  return jsonOk(result);
});
