import { describe, it, expect } from 'vitest';
import {
  isBlockedHostname,
  isPrivateAddress,
  isSafeOutboundBaseUrl,
} from '@/lib/net/host-guard';

describe('SSRF host guard', () => {
  it('blocks loopback, private, link-local and metadata addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '127.10.0.5',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('blocks intranet hostnames and unbracketed single labels', () => {
    for (const host of [
      'localhost',
      'metadata.google.internal',
      'db.local',
      'redis',
      'host.docker.internal',
      'kubernetes.default.svc',
    ]) {
      expect(isBlockedHostname(host), host).toBe(true);
    }
    expect(isBlockedHostname('supplier.example.org')).toBe(false);
  });

  it('accepts only public https base URLs', () => {
    expect(isSafeOutboundBaseUrl('https://api.supplier.co.in/v1')).toBe(true);
    expect(isSafeOutboundBaseUrl('http://api.supplier.co.in/v1')).toBe(false);
    expect(isSafeOutboundBaseUrl('https://localhost:4000')).toBe(false);
    expect(isSafeOutboundBaseUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeOutboundBaseUrl('https://user:pass@api.supplier.co.in')).toBe(false);
    expect(isSafeOutboundBaseUrl('file:///etc/passwd')).toBe(false);
  });
});
