import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getApiBaseUrl, resolveApiUrl } from './apiUrl';

const originalApiUrl = process.env.REACT_APP_API_URL;
const originalApiBaseUrl = process.env.REACT_APP_API_BASE_URL;
const originalNodeEnv = process.env.NODE_ENV;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

describe('API URL resolution', () => {
  beforeEach(() => {
    delete process.env.REACT_APP_API_URL;
    delete process.env.REACT_APP_API_BASE_URL;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    restoreEnv('REACT_APP_API_URL', originalApiUrl);
    restoreEnv('REACT_APP_API_BASE_URL', originalApiBaseUrl);
    restoreEnv('NODE_ENV', originalNodeEnv);
    jest.restoreAllMocks();
  });

  it('prefers REACT_APP_API_URL when both API URL variables are set', () => {
    process.env.REACT_APP_API_URL = 'https://canonical.example.com';
    process.env.REACT_APP_API_BASE_URL = 'https://legacy.example.com';

    expect(getApiBaseUrl()).toBe('https://canonical.example.com');
  });

  it('uses REACT_APP_API_BASE_URL as a backward-compatible fallback', () => {
    process.env.NODE_ENV = 'production';
    process.env.REACT_APP_API_BASE_URL = 'https://legacy.example.com';

    expect(getApiBaseUrl()).toBe('https://legacy.example.com');
  });

  it('preserves the production error when neither variable is configured', () => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => getApiBaseUrl()).toThrow(
      'REACT_APP_API_URL environment variable is required for production.'
    );
  });

  it('preserves the development localhost fallback when no variable is configured', () => {
    expect(getApiBaseUrl()).toBe('http://localhost:8000');
  });

  it('resolves relative video paths beginning with a slash against the shared API base URL', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    expect(resolveApiUrl('/media/video.mp4')).toBe('https://api.example.com/media/video.mp4');
  });

  it('resolves relative video paths without a leading slash against the shared API base URL', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com/proxy/';

    expect(resolveApiUrl('media/video.mp4')).toBe(
      'https://api.example.com/proxy/media/video.mp4'
    );
  });

  it('adds the token to same-origin absolute video URLs', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    const resolvedUrl = new URL(
      resolveApiUrl('https://api.example.com/media/video.mp4?download=1', 'auth token')
    );

    expect(resolvedUrl.origin).toBe('https://api.example.com');
    expect(resolvedUrl.searchParams.get('download')).toBe('1');
    expect(resolvedUrl.searchParams.get('token')).toBe('auth token');
  });

  it('does not add the token to absolute external video URLs', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    const resolvedUrl = new URL(
      resolveApiUrl('https://cdn.example.com/media/video.mp4?signature=abc', 'auth token')
    );

    expect(resolvedUrl.origin).toBe('https://cdn.example.com');
    expect(resolvedUrl.searchParams.get('signature')).toBe('abc');
    expect(resolvedUrl.searchParams.has('token')).toBe(false);
  });

  it('does not add the token to protocol-relative external video URLs', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    const resolvedUrl = new URL(
      resolveApiUrl('//cdn.example.com/media/video.mp4?signature=abc', 'auth token')
    );

    expect(resolvedUrl.origin).toBe('https://cdn.example.com');
    expect(resolvedUrl.searchParams.get('signature')).toBe('abc');
    expect(resolvedUrl.searchParams.has('token')).toBe(false);
  });

  it('preserves API base path prefixes when resolving relative video URLs', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com/proxy/';

    expect(resolveApiUrl('/media/video.mp4')).toBe(
      'https://api.example.com/proxy/media/video.mp4'
    );
  });

  it('adds the token to relative URLs on the API origin and preserves existing query parameters', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    const resolvedUrl = new URL(resolveApiUrl('/media/video.mp4?download=1', 'new token'));

    expect(resolvedUrl.origin).toBe('https://api.example.com');
    expect(resolvedUrl.searchParams.get('download')).toBe('1');
    expect(resolvedUrl.searchParams.get('token')).toBe('new token');
  });

  it('replaces an existing token query parameter instead of duplicating it', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';

    const resolvedUrl = new URL(
      resolveApiUrl('/media/video.mp4?download=1&token=old&token=older', 'current')
    );

    expect(resolvedUrl.searchParams.get('download')).toBe('1');
    expect(resolvedUrl.searchParams.getAll('token')).toEqual(['current']);
  });
});
