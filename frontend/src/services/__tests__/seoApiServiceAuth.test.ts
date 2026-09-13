import type { Mock } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { seoApiService } from '../seoApiService';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Phase 1D — SEO frontend auth unify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes POST analysis through apiClient (Clerk auth), not raw fetch', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { ok: true } });

    await seoApiService.analyzeSEO('https://example.com');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/seo-dashboard/analyze-comprehensive',
      expect.objectContaining({ url: 'https://example.com' }),
      expect.objectContaining({}),
    );
  });

  it('routes GET health score through apiClient.get', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { health_score: 90 } });

    await seoApiService.getSEOHealthScore();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/seo-dashboard/health-score',
      expect.objectContaining({}),
    );
  });

  it('PageAuditList uses apiClient, not raw axios (no Clerk bypass)', () => {
    const src = readFileSync(
      resolve(SRC_ROOT, 'components/SEODashboard/components/PageAuditList.tsx'),
      'utf-8',
    );
    expect(src).not.toMatch(/from ['"]axios['"]/);
    expect(src).toMatch(/apiClient\.(get|post)/);
    expect(src).not.toMatch(/axios\.(get|post)\(['"]\/api\/seo/);
  });

  it('seoApiService has no raw fetch fallback', () => {
    const src = readFileSync(resolve(SRC_ROOT, 'services/seoApiService.ts'), 'utf-8');
    expect(src).toMatch(/from ['"].*api\/client['"]/);
    expect(src).not.toMatch(/await fetch\(url/);
  });
});

describe('Phase T2 — service multipart upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts FormData with the file when image_file is provided', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { ok: true } });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await seoApiService.generateImageAltText({ image_file: file, context: 'pets' }, {});
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body] = (apiClient.post as Mock).mock.calls[0];
    expect(url).toBe('/api/seo/image-alt-text');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('image_file')).toBe(file);
    expect((body as FormData).get('context')).toBe('pets');
  });

  it('posts JSON when no file is provided (unchanged behavior)', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { ok: true } });
    await seoApiService.generateImageAltText({ image_url: 'https://x.test/a.png' }, {});
    const [url, body] = (apiClient.post as Mock).mock.calls[0];
    expect(url).toBe('/api/seo/image-alt-text');
    expect(body).toEqual(expect.objectContaining({ image_url: 'https://x.test/a.png' }));
    expect(body).not.toBeInstanceOf(FormData);
  });
});
