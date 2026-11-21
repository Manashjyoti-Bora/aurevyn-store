import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  supplierFind: vi.fn(),
  supplierCreate: vi.fn(),
  categoryFind: vi.fn(),
  categoryCreate: vi.fn(),
  productFind: vi.fn(),
  productUpdate: vi.fn(),
  saveProduct: vi.fn(),
  settings: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    supplier: { findUnique: mocks.supplierFind, create: mocks.supplierCreate },
    category: { findUnique: mocks.categoryFind, create: mocks.categoryCreate },
    product: { findUnique: mocks.productFind, update: mocks.productUpdate },
  },
}));
vi.mock('@/lib/audit', () => ({ auditLog: mocks.audit }));
vi.mock('@/lib/settings', () => ({ getSettings: mocks.settings }));
vi.mock('@/lib/catalog/products', () => ({ saveProduct: mocks.saveProduct }));

import { CURATED_PRODUCTS, installCuratedCatalogue } from '@/lib/catalog/curated';

describe('unverified starter catalogue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.supplierFind.mockResolvedValue({ id: 'supplier' });
    mocks.categoryFind.mockResolvedValue({ id: 'category' });
    mocks.productFind.mockResolvedValue(null);
    mocks.settings.mockResolvedValue({ storeName: 'Nirvora', demoMode: true });
    mocks.saveProduct.mockResolvedValue({ id: 'draft' });
    mocks.productUpdate.mockResolvedValue({});
    mocks.audit.mockResolvedValue(undefined);
  });

  it('creates only zero-stock drafts without archiving or changing settings', async () => {
    const result = await installCuratedCatalogue({ email: 'owner@example.com' });
    expect(result.created).toHaveLength(CURATED_PRODUCTS.length);
    expect(result.archived).toEqual([]);
    expect(result.demoModeDisabled).toBe(false);
    expect(mocks.saveProduct).toHaveBeenCalledTimes(CURATED_PRODUCTS.length);
    for (const [input] of mocks.saveProduct.mock.calls) expect(input.status).toBe('DRAFT');
    for (const [input] of mocks.productUpdate.mock.calls) expect(input.data.stock).toBe(0);
  });

  it('leaves existing products unchanged', async () => {
    mocks.productFind.mockResolvedValue({ id: 'existing' });
    const result = await installCuratedCatalogue({ email: 'owner@example.com' });
    expect(result.skipped).toHaveLength(CURATED_PRODUCTS.length);
    expect(mocks.saveProduct).not.toHaveBeenCalled();
    expect(mocks.productUpdate).not.toHaveBeenCalled();
  });
});
