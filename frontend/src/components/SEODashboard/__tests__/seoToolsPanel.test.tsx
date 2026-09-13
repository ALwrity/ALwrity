import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import SeoToolsPanel from '../components/SeoToolsPanel/SeoToolsPanel';
import { seoApiService } from '../../../services/seoApiService';

vi.mock('../../../services/seoApiService', () => ({
  seoApiService: {
    generateMetaDescriptions: vi.fn(),
    analyzePageSpeed: vi.fn(),
    analyzeSitemap: vi.fn(),
    generateImageAltText: vi.fn(),
    generateOpenGraphTags: vi.fn(),
    analyzeOnPageSEO: vi.fn(),
    analyzeTechnicalSEO: vi.fn(),
    analyzeSEO: vi.fn(),
  },
  default: {},
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');

const mocked = (fn: unknown) => vi.mocked(fn as (...a: any[]) => Promise<any>);

// Phase C: the 7 single-call tools are user-fired main UI (no Copilot),
// each calling seoApiService with an abortable request.
describe('Phase C — SeoToolsPanel user-fired tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['Meta Descriptions', 'generateMetaDescriptions'],
    ['PageSpeed', 'analyzePageSpeed'],
    ['Sitemap', 'analyzeSitemap'],
    ['Image Alt Text', 'generateImageAltText'],
    ['OpenGraph', 'generateOpenGraphTags'],
    ['On-Page', 'analyzeOnPageSEO'],
    ['Technical', 'analyzeTechnicalSEO'],
  ])('renders the %s tool card with a Run button', (title) => {
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /run/i }).length,
    ).toBeGreaterThanOrEqual(7);
  });

  it('fires on-page analysis with the site URL and shows the result', async () => {
    mocked(seoApiService.analyzeOnPageSEO).mockResolvedValue({ overall_score: 88 });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /run on-page/i }));
    await waitFor(() => {
      expect(seoApiService.analyzeOnPageSEO).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com' }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(await screen.findByText(/88/)).toBeInTheDocument();
  });

  it('fires technical audit with the site URL', async () => {
    mocked(seoApiService.analyzeTechnicalSEO).mockResolvedValue({ ok: true });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /run technical/i }));
    await waitFor(() => {
      expect(seoApiService.analyzeTechnicalSEO).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com' }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it('fires meta descriptions with parsed keywords', async () => {
    mocked(seoApiService.generateMetaDescriptions).mockResolvedValue({ ok: true });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/keywords.*meta/i), {
      target: { value: 'seo, tools, ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run meta/i }));
    await waitFor(() => {
      expect(seoApiService.generateMetaDescriptions).toHaveBeenCalledWith(
        expect.objectContaining({ keywords: ['seo', 'tools'] }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it('shows an error Alert when a tool fails (no silent failure)', async () => {
    mocked(seoApiService.analyzePageSpeed).mockRejectedValue(new Error('PSI down'));
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.click(screen.getByRole('button', { name: /run pagespeed/i }));
    expect(await screen.findByText(/PSI down/)).toBeInTheDocument();
  });

  // Phase 7 (8H): the batch tool — many URLs through the real BatchRequester.
  it('renders the Batch Analyzer card', () => {
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    expect(screen.getByRole('heading', { name: 'Batch Analyzer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run batch/i })).toBeDisabled();
  });

  it('runs every URL through the BatchRequester pipeline and renders per-url status', async () => {
    mocked(seoApiService.analyzeSEO).mockImplementation(async (url: string) => {
      if (url === 'https://bad.dev') throw new Error('boom');
      return { url, health_score: 70, status: 'completed' };
    });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/urls \(one per line\)/i), {
      target: { value: 'https://a.dev\nhttps://bad.dev\nhttps://b.dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run batch/i }));
    await waitFor(() => expect(seoApiService.analyzeSEO).toHaveBeenCalledTimes(3));
    // summary chips from the BatchRequester summary
    expect(await screen.findByText(/2 succeeded/i)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument();
    // per-url result rows (row text is "url — error" when failed): exact
    // matchers anchor on the ROW nodes, not the textarea content
    expect(screen.getByText('https://a.dev')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('https://bad.dev — boom')).toBeInTheDocument();
    });
  });

  it('rejects too many urls (cap 20) and fails fast without firing', () => {
    mocked(seoApiService.analyzeSEO as any).mockClear();
    const many = Array.from({ length: 21 }, (_, i) => `https://n${i}.dev`).join('\n');
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/urls \(one per line\)/i), { target: { value: many ? many : '' } });
    fireEvent.click(screen.getByRole('button', { name: /run batch/i }));
    expect(screen.getByText(/cap is 20/i)).toBeInTheDocument();
    expect(mocked(seoApiService.analyzeSEO as any)).not.toHaveBeenCalled();
  });

  it('blank batch keeps Run disabled; invalid urls fail fast without firing', async () => {
    mocked(seoApiService.analyzeSEO as any).mockClear();
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    // Blank batch -> required gating keeps the button disabled (no alert):
    expect(screen.getByRole('button', { name: /run batch/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/urls \(one per line\)/i), {
      target: { value: 'https://good.dev\nnot-a-url' },
    });
    // The `not-a-url` batch must never reach the service: fail LOCALLY first.
    fireEvent.click(screen.getByRole('button', { name: /run batch/i }));
    expect(await screen.findByText(/not a valid http\(s\) url/i)).toBeInTheDocument();
    expect(mocked(seoApiService.analyzeSEO as any)).not.toHaveBeenCalled();
  });

  it('is mounted in the Overview flow of the dashboard', () => {
    expect(dashSrc()).toMatch(/<SeoToolsPanel siteUrl=\{websiteUrl/);
  });
});
