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
  failed: string[];
  archived: string[];
  categoriesCreated: number;
  supplierCreated: boolean;
  demoModeDisabled: boolean;
}

/**
 * Create unverified starter ideas as drafts, never as live listings.
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
        `${res.created.length} drafts created${res.skipped.length > 0 ? `, ${res.skipped.length} already present` : ''}`,
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
      <Alert tone="success" title="Starter drafts created">
        <p className="text-sm">
          {result.created.length} product{result.created.length === 1 ? '' : 's'} created across{' '}
          {result.categoriesCreated > 0 ? result.categoriesCreated : 'the existing'} categor
          {result.categoriesCreated === 1 ? 'y' : 'ies'}
          {result.supplierCreated ? ', and the Meesho sourcing partner was created' : ''}.
          {result.archived.length > 0
            ? ` ${result.archived.length} retired product${result.archived.length === 1 ? '' : 's'} archived.`
            : ''}
          {result.failed.length > 0
            ? ` ${result.failed.length} piece${result.failed.length === 1 ? '' : 's'} could not be created — see the server log.`
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
          <Link
            href="/"
            target="_blank"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
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
          <p className="text-sm font-semibold text-ink-900">Meesho sourcing ideas</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-500">
            Creates eleven unverified ideas as drafts with zero stock. These are not confirmed
            Meesho listings or proven bestsellers. Before publishing, verify the exact supplier
            listing, specifications, costs, availability, delivery and image rights. Existing
            products and settings are not changed. Deploys do not install this catalogue.
          </p>
          <p className="mt-2 text-[11px] tabular-nums text-ink-400">
            {activeProducts} active · {totalProducts} total
            {installed ? ' · curated set already installed' : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {confirming ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={install}>
                Yes, create drafts
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              {installed ? 'Add missing pieces' : 'Create starter drafts'}
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
