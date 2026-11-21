/**
 * Install the Meesho launch catalogue.
 *
 * Runs automatically at the end of `npm run build` (see scripts/release.ts), so
 * a production database with no active products becomes a sellable store in the
 * same deploy. Also safe to run by hand:
 *
 *   npm run catalogue:install
 *
 * Idempotent: products are matched by slug and never overwritten; retired slugs
 * are archived rather than deleted. Set AUTO_INSTALL_CATALOGUE=false to skip it
 * entirely (in the release build and here).
 */
import { prisma } from '../src/lib/db';
import { ensureLaunchCatalogue } from '../src/lib/catalog/curated';

async function main(): Promise<void> {
  if (process.env.AUTO_INSTALL_CATALOGUE === 'false') {
    console.log('[catalogue] skipped (AUTO_INSTALL_CATALOGUE=false)');
    return;
  }

  const result = await ensureLaunchCatalogue();
  if (!result) {
    console.log('[catalogue] skipped — the store is already selling the current catalogue');
    return;
  }

  console.log(
    `[catalogue] created ${result.created.length}, skipped ${result.skipped.length}, ` +
      `archived ${result.archived.length}, categories ${result.categoriesCreated}` +
      (result.demoModeDisabled ? ', demo mode off' : '')
  );
}

main()
  .catch((err) => {
    // A catalogue failure must not publish a broken store, but it must be loud.
    console.error('[catalogue] FAILED:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
