'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';

interface InstallResult {
  created: string[];
  skipped: string[];
  archived: string[];
  categoriesCreated: number;
  supplierCreated: boolean;
  demoModeDisabled: boolean;
}

/**
 * One-click launch catalogue. Shown on Admin → Products so the empty store can
 * become a real, sellable catalogue without a deploy or a spreadsheet.
 */
export function CatalogueInstaller({
  activeProducts,
  totalProducts,
  installed,
}: {
  activeProducts: number;
  totalProducts: number;
  installed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function install() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<InstallResult>('/api/admin/catalogue', { body: {} });
      setResult(res);
      setConfirming(false);
      toast(
        `${res.created.length} products published${res.skipped.length > 0 ? `, ${res.skipped.length} already present` : ''}`,
        res.created.length > 0 ? 'success' : 'info'
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Install failed');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Alert tone="success" title="Launch catalogue installed">
        <p className="text-sm">
          {result.created.length} product{result.created.length === 1 ? '' : 's'} published across{' '}
          {result.categoriesCreated > 0 ? result.categoriesCreated : 'the existing'} categor
          {result.categoriesCreated === 1 ? 'y' : 'ies'}
          {result.supplierCreated ? ', and the Meesho sourcing partner was created' : ''}.
          {result.archived.length > 0
            ? ` ${result.archived.length} retired product${result.archived.length === 1 ? '' : 's'} archived.`
            : ''}
          {result.demoModeDisabled ? ' Demo mode has been switched off.' : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/products"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Review the catalogue →
          </Link>
          <Link href="/" target="_blank" className="text-sm font-medium text-brand-700 hover:underline">
            Open the storefront ↗
          </Link>
        </div>
      </Alert>
    );
  }

  return (
    <div className="rounded-xl border border-ink-900/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">Meesho launch catalogue</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-500">
            Publishes eleven Meesho-sourced bestsellers across six low-return categories, every
            one under ₹800. Includes studio photography we own, real stock counts, stated sourcing
            cost and a fixed retail price you can edit afterwards. A fresh production database
            installs this automatically on deploy. Nothing is overwritten if a product exists.
          </p>
          <p className="mt-2 text-[11px] tabular-nums text-ink-400">
            {activeProducts} active · {totalProducts} total
            {installed ? ' · curated set already installed' : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {confirming ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={install}>
                Yes, publish 11 pieces
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              {installed ? 'Add missing pieces' : 'Install Meesho catalogue'}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
