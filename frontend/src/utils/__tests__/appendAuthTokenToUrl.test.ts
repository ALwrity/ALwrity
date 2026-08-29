/**
 * Tests for appendAuthTokenToUrl helper in fetchMediaBlobUrl.ts
 *
 * Verifies that:
 * - Token is appended as ?token= for relative API paths
 * - Token is appended correctly when URL already has query params (&token=)
 * - Falls back to original URL when no authTokenGetter is set
 * - Falls back gracefully when the token getter throws
 * - Absolute http/https URLs are handled correctly
 * - setMediaAuthTokenGetter wires the getter used by appendAuthTokenToUrl
 */

import { appendAuthTokenToUrl, setMediaAuthTokenGetter } from '../fetchMediaBlobUrl';

describe('appendAuthTokenToUrl', () => {
  beforeEach(() => {
    // Reset getter before each test
    setMediaAuthTokenGetter(null);
  });

  afterEach(() => {
    setMediaAuthTokenGetter(null);
  });

  it('returns original path unchanged when no token getter is registered', async () => {
    const url = await appendAuthTokenToUrl('/api/youtube/images/avatars/test.png');
    expect(url).toBe('/api/youtube/images/avatars/test.png');
  });

  it('appends ?token=<value> to a relative path', async () => {
    setMediaAuthTokenGetter(async () => 'my-jwt-token');

    const url = await appendAuthTokenToUrl('/api/youtube/images/avatars/avatar.png');
    expect(url).toBe('/api/youtube/images/avatars/avatar.png?token=my-jwt-token');
  });

  it('appends &token=<value> when URL already has query params', async () => {
    setMediaAuthTokenGetter(async () => 'my-jwt-token');

    const url = await appendAuthTokenToUrl('/api/youtube/images/scenes/scene.png?w=100');
    expect(url).toBe('/api/youtube/images/scenes/scene.png?w=100&token=my-jwt-token');
  });

  it('URL-encodes the token value', async () => {
    setMediaAuthTokenGetter(async () => 'token with spaces & special=chars');

    const url = await appendAuthTokenToUrl('/api/youtube/images/avatars/a.png');
    expect(url).toContain('token=token%20with%20spaces%20%26%20special%3Dchars');
  });

  it('returns original URL when token getter returns null', async () => {
    setMediaAuthTokenGetter(async () => null);

    const url = await appendAuthTokenToUrl('/api/youtube/images/avatars/test.png');
    expect(url).toBe('/api/youtube/images/avatars/test.png');
  });

  it('falls back to original URL when token getter throws', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setMediaAuthTokenGetter(async () => { throw new Error('Auth error'); });

    const url = await appendAuthTokenToUrl('/api/youtube/images/avatars/test.png');
    expect(url).toBe('/api/youtube/images/avatars/test.png');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[appendAuthTokenToUrl]'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('handles absolute http URLs correctly', async () => {
    setMediaAuthTokenGetter(async () => 'abc123');

    const url = await appendAuthTokenToUrl('https://cdn.example.com/image.png');
    expect(url).toBe('https://cdn.example.com/image.png?token=abc123');
  });

  it('prepends leading slash to relative paths without one', async () => {
    setMediaAuthTokenGetter(async () => 'tok');

    const url = await appendAuthTokenToUrl('api/youtube/images/scenes/s.png');
    expect(url).toContain('/api/youtube/images/scenes/s.png');
    expect(url).toContain('?token=tok');
  });
});
