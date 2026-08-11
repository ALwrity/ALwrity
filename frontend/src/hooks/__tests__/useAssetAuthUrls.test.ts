import { renderHook, waitFor } from '@testing-library/react';
import { isAuthenticatedAssetUrl, useAssetAuthUrls } from '../useAssetAuthUrls';
import { setMediaAuthTokenGetter } from '../../utils/fetchMediaBlobUrl';
import { ContentAsset } from '../useContentAssets';

describe('useAssetAuthUrls', () => {
  beforeEach(() => {
    setMediaAuthTokenGetter(null);
  });

  afterEach(() => {
    setMediaAuthTokenGetter(null);
  });

  const mockAssets: ContentAsset[] = [
    {
      id: 1,
      user_id: 'user_a',
      asset_type: 'image',
      source_module: 'youtube_creator',
      filename: 'image1.png',
      file_url: '/api/youtube/images/scenes/image1.png',
      mime_type: 'image/png',
      title: 'Image 1',
    },
    {
      id: 2,
      user_id: 'user_a',
      asset_type: 'image',
      source_module: 'youtube_creator',
      filename: 'external.png',
      file_url: 'https://external-cdn.com/external.png',
      mime_type: 'image/png',
      title: 'External Image',
    },
  ];

  it('detects authenticated internal asset URLs correctly', () => {
    expect(isAuthenticatedAssetUrl('/api/youtube/images/avatars/a.png')).toBe(true);
    expect(isAuthenticatedAssetUrl('/api/podcast/images/a.png')).toBe(true);
    expect(isAuthenticatedAssetUrl('https://example.com/a.png')).toBe(false);
  });

  it('returns empty maps and nulls when open is false', () => {
    const { result } = renderHook(() =>
      useAssetAuthUrls(false, mockAssets, '/api/youtube/images/avatars/brand.png')
    );

    expect(result.current.imageAuthUrls.size).toBe(0);
    expect(result.current.loadingImages.size).toBe(0);
    expect(result.current.brandAvatarAuthUrl).toBeNull();
  });

  it('correctly resolves authenticated and external URLs when open is true', async () => {
    setMediaAuthTokenGetter(async () => 'mock-token-123');

    const { result } = renderHook(() =>
      useAssetAuthUrls(true, mockAssets, '/api/youtube/images/avatars/brand.png')
    );

    // Should initially mark authenticated assets as loading
    expect(result.current.loadingImages.has(1)).toBe(true);
    expect(result.current.loadingImages.has(2)).toBe(false); // External doesn't load

    await waitFor(() => {
      expect(result.current.loadingImages.size).toBe(0);
    });

    // Asset 1 (internal) should have token appended
    expect(result.current.imageAuthUrls.get(1)).toBe(
      '/api/youtube/images/scenes/image1.png?token=mock-token-123'
    );

    // Asset 2 (external) should be returned as-is
    expect(result.current.imageAuthUrls.get(2)).toBe('https://external-cdn.com/external.png');

    // Brand avatar should have token appended
    expect(result.current.brandAvatarAuthUrl).toBe(
      '/api/youtube/images/avatars/brand.png?token=mock-token-123'
    );
  });

  it('handles brand avatar being null or external correctly', async () => {
    setMediaAuthTokenGetter(async () => 'mock-token-123');

    const { result, rerender } = renderHook(
      ({ brandUrl }) => useAssetAuthUrls(true, [], brandUrl),
      { initialProps: { brandUrl: null as string | null } }
    );

    expect(result.current.brandAvatarAuthUrl).toBeNull();

    // Rerender with external URL
    rerender({ brandUrl: 'https://cdn.com/logo.png' });
    expect(result.current.brandAvatarAuthUrl).toBe('https://cdn.com/logo.png');
  });
});
