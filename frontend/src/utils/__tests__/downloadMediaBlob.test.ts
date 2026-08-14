/**
 * Tests for downloadMediaBlob in fetchMediaBlobUrl.ts
 *
 * Ensures downloads use a cloned object URL and do not revoke the cached preview blob.
 */

import {
  clearMediaCache,
  downloadMediaBlob,
  fetchMediaBlobUrl,
  setMediaAuthTokenGetter,
} from '../fetchMediaBlobUrl';

jest.mock('../../api/client', () => ({
  aiApiClient: {
    get: jest.fn(),
  },
}));

import { aiApiClient } from '../../api/client';

const mockedGet = aiApiClient.get as jest.MockedFunction<typeof aiApiClient.get>;

describe('downloadMediaBlob', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalFetch = global.fetch;

  let createObjectURLMock: jest.Mock;
  let revokeObjectURLMock: jest.Mock;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    clearMediaCache();
    setMediaAuthTokenGetter(null);

    createObjectURLMock = jest
      .fn()
      .mockReturnValueOnce('blob:cached-preview')
      .mockReturnValueOnce('blob:download-clone');
    revokeObjectURLMock = jest.fn();

    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: jest.fn().mockResolvedValue(new Blob(['video-bytes'], { type: 'video/mp4' })),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    mockedGet.mockResolvedValue({
      data: new Blob(['video-bytes'], { type: 'video/mp4' }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    clearMediaCache();
    setMediaAuthTokenGetter(null);
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('creates a separate download URL and revokes only the clone', async () => {
    const mediaUrl = '/api/youtube/videos/scene_1.mp4';
    const cachedPreviewUrl = await fetchMediaBlobUrl(mediaUrl);
    expect(cachedPreviewUrl).toBe('blob:cached-preview');

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    await downloadMediaBlob(mediaUrl, 'scene-1.mp4');

    expect(fetchMock).toHaveBeenCalledWith('blob:cached-preview');
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:download-clone');
    expect(revokeObjectURLMock).not.toHaveBeenCalledWith('blob:cached-preview');
    expect(debugSpy).toHaveBeenCalledWith(
      '[downloadMediaBlob] Revoked download clone URL',
      expect.objectContaining({ url: mediaUrl }),
    );

    clickSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('leaves cached preview blob URL intact after download', async () => {
    const mediaUrl = '/api/youtube/videos/final.mp4';
    const cachedPreviewUrl = await fetchMediaBlobUrl(mediaUrl);

    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadMediaBlob(mediaUrl, 'final.mp4');
    jest.advanceTimersByTime(1000);

    const previewAfterDownload = await fetchMediaBlobUrl(mediaUrl);
    expect(previewAfterDownload).toBe(cachedPreviewUrl);
  });

  it('returns early when cached blob URL is unavailable', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    clearMediaCache();
    mockedGet.mockRejectedValueOnce({ response: { status: 404 } });

    await downloadMediaBlob('/api/youtube/videos/missing.mp4');

    expect(clickSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[downloadMediaBlob] No blob URL available for download',
      expect.objectContaining({ url: '/api/youtube/videos/missing.mp4' }),
    );
    consoleSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('throws when cached blob fetch returns a non-ok response', async () => {
    const mediaUrl = '/api/youtube/videos/scene_bad.mp4';
    await fetchMediaBlobUrl(mediaUrl);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      blob: jest.fn(),
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(downloadMediaBlob(mediaUrl, 'scene-bad.mp4')).rejects.toThrow(
      'Failed to read cached blob for download (500)',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[downloadMediaBlob] Failed to read cached blob for download',
      expect.objectContaining({ url: mediaUrl, status: 500 }),
    );
    errorSpy.mockRestore();
  });

  it('throws when cached blob is empty', async () => {
    const mediaUrl = '/api/youtube/videos/scene_empty.mp4';
    await fetchMediaBlobUrl(mediaUrl);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: jest.fn().mockResolvedValue(new Blob([], { type: 'video/mp4' })),
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(downloadMediaBlob(mediaUrl, 'scene-empty.mp4')).rejects.toThrow(
      'Cached media blob is empty',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[downloadMediaBlob] Cached blob is empty',
      expect.objectContaining({ url: mediaUrl }),
    );
    errorSpy.mockRestore();
  });
});

describe('fetchMediaBlobUrl 401', () => {
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    clearMediaCache();
    setMediaAuthTokenGetter(null);
    URL.createObjectURL = jest.fn().mockReturnValue('blob:preview');
  });

  afterEach(() => {
    clearMediaCache();
    URL.createObjectURL = originalCreateObjectURL;
    jest.clearAllMocks();
  });

  it('logs unauthorized status and rethrows so callers can use token fallback', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGet.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(fetchMediaBlobUrl('/api/youtube/videos/scene.mp4')).rejects.toEqual({
      response: { status: 401 },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[fetchMediaBlobUrl] Media request unauthorized (401), caller may use token fallback',
      expect.objectContaining({ url: '/api/youtube/videos/scene.mp4' }),
    );
    warnSpy.mockRestore();
  });
});
