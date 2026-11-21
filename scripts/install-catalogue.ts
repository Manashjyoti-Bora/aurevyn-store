/** Create unverified starter ideas as drafts; never run automatically on deploy. */
import { prisma } from '../src/lib/db';
import { ensureLaunchCatalogue } from '../src/lib/catalog/curated';

async function main(): Promise<void> {
  if (process.env.AUTO_INSTALL_CATALOGUE === 'false') {
    console.log('[catalogue] skipped (AUTO_INSTALL_CATALOGUE=false)');
    return;
  }

  const result = await ensureLaunchCatalogue();
  if (!result) {
    console.log('[catalogue] skipped — existing active catalogue detected; no drafts created');
    return;
  }

  console.log(
    `[catalogue] created ${result.created.length}, skipped ${result.skipped.length}, ` +
      `failed ${result.failed.length}, archived ${result.archived.length}, ` +
      `categories ${result.categoriesCreated}` +
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
