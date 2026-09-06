import { describe, expect, it } from 'vitest';
import {
  buildWebsiteSessionKey,
  isSameWebsiteSession,
  normalizeOnboardingUrl,
  parseWebsiteSessionKey,
} from './onboardingSessionKey';

describe('normalizeOnboardingUrl', () => {
  it('normalizes equivalent URLs to the same value', () => {
    expect(normalizeOnboardingUrl('https://www.Example.com/')).toBe(
      normalizeOnboardingUrl('http://example.com')
    );
  });

  it('returns empty string for blank input', () => {
    expect(normalizeOnboardingUrl('')).toBe('');
    expect(normalizeOnboardingUrl('   ')).toBe('');
  });
});

describe('buildWebsiteSessionKey', () => {
  it('includes normalized URL and analysis id when available', () => {
    const key = buildWebsiteSessionKey('https://acme.com', { id: 42 });
    expect(key).toContain('acme.com');
    expect(key).toContain('42');
  });

  it('uses updated_at when analysis id is missing', () => {
    const key = buildWebsiteSessionKey('https://acme.com', {
      updated_at: '2026-03-28T10:00:00Z',
    });
    expect(key).toContain('acme.com');
    expect(key).toContain('2026-03-28T10:00:00Z');
  });

  it('returns url-only key when analysis is null', () => {
    const key = buildWebsiteSessionKey('https://acme.com', null);
    expect(key).toBe('acme.com:');
  });

  it('produces different keys when analysis id changes for the same URL', () => {
    const keyA = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    const keyB = buildWebsiteSessionKey('https://acme.com', { id: 2 });
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys when URL changes for the same analysis id', () => {
    const keyA = buildWebsiteSessionKey('https://site-a.com', { id: 1 });
    const keyB = buildWebsiteSessionKey('https://site-b.com', { id: 1 });
    expect(keyA).not.toBe(keyB);
  });
});

describe('isSameWebsiteSession', () => {
  it('returns true for identical keys', () => {
    const key = buildWebsiteSessionKey('https://acme.com', { id: 7 });
    expect(isSameWebsiteSession(key, key)).toBe(true);
  });

  it('returns false when keys differ', () => {
    const keyA = buildWebsiteSessionKey('https://acme.com', { id: 1 });
    const keyB = buildWebsiteSessionKey('https://acme.com', { id: 2 });
    expect(isSameWebsiteSession(keyA, keyB)).toBe(false);
  });

  it('returns false when either key is missing', () => {
    expect(isSameWebsiteSession(null, 'acme.com:1')).toBe(false);
    expect(isSameWebsiteSession('acme.com:1', undefined)).toBe(false);
  });
});

describe('parseWebsiteSessionKey', () => {
  it('splits url and analysis token', () => {
    expect(parseWebsiteSessionKey('acme.com:42')).toEqual({
      url: 'acme.com',
      analysisToken: '42',
    });
  });
});
