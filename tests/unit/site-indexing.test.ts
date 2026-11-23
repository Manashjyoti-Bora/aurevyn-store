import { describe, expect, it } from 'vitest';
import { isIndexableDeployment } from '@/lib/site-indexing';

describe('isIndexableDeployment', () => {
  it('allows only a Vercel production deployment', () => {
    expect(isIndexableDeployment('production')).toBe(true);
  });

  it('refuses preview deployments, which have their own public hostname', () => {
    expect(isIndexableDeployment('preview')).toBe(false);
  });

  it('refuses development deployments', () => {
    expect(isIndexableDeployment('development')).toBe(false);
  });

  it('treats a missing scope as indexable (local dev, self-hosted, tests)', () => {
    expect(isIndexableDeployment(undefined)).toBe(true);
    expect(isIndexableDeployment(null)).toBe(true);
    expect(isIndexableDeployment('   ')).toBe(true);
  });

  it('normalises case and whitespace instead of being fooled by them', () => {
    expect(isIndexableDeployment(' Production ')).toBe(true);
    expect(isIndexableDeployment('PREVIEW')).toBe(false);
  });

  it('refuses anything it does not recognise rather than defaulting to public', () => {
    expect(isIndexableDeployment('staging')).toBe(false);
    expect(isIndexableDeployment('prod')).toBe(false);
  });
});
