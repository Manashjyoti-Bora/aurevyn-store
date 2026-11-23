import { describe, it, expect } from 'vitest';
import { resolvePublicOrigin, originFromHeaders } from '@/lib/site-url';

describe('resolvePublicOrigin', () => {
  it('keeps APP_URL when Vercel injects no production host (local dev)', () => {
    expect(resolvePublicOrigin({ appUrl: 'http://localhost:3000' })).toBe('http://localhost:3000');
  });

  it('replaces a stale *.vercel.app APP_URL with the live production host', () => {
    // The real incident: renamed project, APP_URL still on the old host, which
    // returned DEPLOYMENT_NOT_FOUND to every crawler following the canonical.
    expect(
      resolvePublicOrigin({
        appUrl: 'https://zenvorastore.vercel.app',
        vercelProductionHost: 'aurevynstore.vercel.app',
      })
    ).toBe('https://aurevynstore.vercel.app');
  });

  it('keeps an explicit custom domain even when Vercel reports a vercel.app host', () => {
    expect(
      resolvePublicOrigin({
        appUrl: 'https://aurevyn.com',
        vercelProductionHost: 'aurevynstore.vercel.app',
      })
    ).toBe('https://aurevyn.com');
  });

  it('is a no-op when APP_URL already matches the production host', () => {
    expect(
      resolvePublicOrigin({
        appUrl: 'https://aurevynstore.vercel.app/',
        vercelProductionHost: 'aurevynstore.vercel.app',
      })
    ).toBe('https://aurevynstore.vercel.app');
  });

  it('never returns a trailing slash (canonicals must not double-slash)', () => {
    expect(
      resolvePublicOrigin({ appUrl: 'https://example.com/', vercelProductionHost: undefined })
    ).toBe('https://example.com');
  });

  it('falls back to the production host when APP_URL is unparseable', () => {
    expect(
      resolvePublicOrigin({ appUrl: 'not-a-url', vercelProductionHost: 'aurevynstore.vercel.app' })
    ).toBe('https://aurevynstore.vercel.app');
  });

  it('does not treat a lookalike domain as a vercel host', () => {
    expect(
      resolvePublicOrigin({
        appUrl: 'https://notvercel.app',
        vercelProductionHost: 'aurevynstore.vercel.app',
      })
    ).toBe('https://notvercel.app');
  });
});

describe('originFromHeaders', () => {
  const fallback = 'https://fallback.example';

  it('prefers the forwarded host and https scheme', () => {
    expect(
      originFromHeaders({
        forwardedHost: 'aurevynstore.vercel.app',
        host: 'internal:3000',
        forwardedProto: 'https',
        fallback,
      })
    ).toBe('https://aurevynstore.vercel.app');
  });

  it('falls back to the Host header', () => {
    expect(originFromHeaders({ host: 'shop.example.com', fallback })).toBe('https://shop.example.com');
  });

  it('uses the first entry of a comma-separated forwarded host', () => {
    expect(
      originFromHeaders({ forwardedHost: 'shop.example.com, proxy.internal', fallback })
    ).toBe('https://shop.example.com');
  });

  it('keeps localhost on http for local development', () => {
    expect(originFromHeaders({ host: 'localhost:3000', fallback })).toBe('http://localhost:3000');
  });

  it('honours an explicit http forwarded proto', () => {
    expect(
      originFromHeaders({ forwardedHost: 'shop.example.com', forwardedProto: 'http', fallback })
    ).toBe('http://shop.example.com');
  });

  it('rejects a Host header that is not a hostname (header injection)', () => {
    // These are the shapes an attacker uses to poison a canonical tag.
    for (const hostile of [
      'evil.com/"><script>alert(1)</script>',
      'evil.com path',
      'https://evil.com',
      'evil.com:99999',
      'javascript:alert(1)',
    ]) {
      expect(originFromHeaders({ host: hostile, fallback })).toBe(fallback);
    }
  });

  it('uses the fallback when no host header is present', () => {
    expect(originFromHeaders({ fallback })).toBe(fallback);
  });
});
