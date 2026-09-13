import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import SeoToolsPanel from '../components/SeoToolsPanel/SeoToolsPanel';
import { seoApiService } from '../../../services/seoApiService';
import { SEO_TOOLS_HISTORY_KEY } from '../components/SeoToolsPanel/seoToolsHistory';

vi.mock('../../../services/seoApiService', () => ({
  seoApiService: {
    generateMetaDescriptions: vi.fn(),
    analyzePageSpeed: vi.fn(),
    analyzeSitemap: vi.fn(),
    generateImageAltText: vi.fn(),
    generateOpenGraphTags: vi.fn(),
    analyzeOnPageSEO: vi.fn(),
    analyzeTechnicalSEO: vi.fn(),
  },
  default: {},
}));

const mocked = (fn: unknown) => vi.mocked(fn as (...a: any[]) => Promise<any>);

// Phase T3 — result actions (copy / download) and per-tool run history with
// re-view and clear. History is display-only: seeding it never auto-runs a tool.
describe('Phase T3 — result actions and run history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // jsdom ships no clipboard API — provide a controllable writeText.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies meta descriptions as readable text', async () => {
    mocked(seoApiService.generateMetaDescriptions).mockResolvedValue({
      meta_descriptions: [{ text: 'Alpha description' }, { text: 'Beta description' }],
    });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/Keywords for meta descriptions/i), {
      target: { value: 'seo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Meta/ }));
    expect(await screen.findByText('Alpha description')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Alpha description\n\nBeta description',
    );
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('copies generated image alt text', async () => {
    mocked(seoApiService.generateImageAltText).mockResolvedValue({ alt_text: 'A red sports car' });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/Image URL/i), {
      target: { value: 'https://x.test/a.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Image Alt/ }));
    expect(await screen.findByText(/A red sports car/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('A red sports car');
  });

  it('downloads a JSON report per run', async () => {
    mocked(seoApiService.generateMetaDescriptions).mockResolvedValue({
      meta_descriptions: [{ text: 'Alpha description' }],
    });
    // Mock the download function to track calls
    const downloadJsonReportSpy = vi.fn();
    vi.mockImport('../components/SeoToolsPanel/ResultActions', () => ({
      downloadJsonReport: downloadJsonReportSpy,
    }));

    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/Keywords for meta descriptions/i), {
      target: { value: 'seo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Meta/ }));
    expect(await screen.findByText('Alpha description')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Download JSON/ }));

    expect(downloadJsonReportSpy).toHaveBeenCalledWith('meta', 'Meta Descriptions', { meta_descriptions: [{ text: 'Alpha description' }] });
  });

  it('re-views a persisted run without ever re-running the tool', async () => {
    localStorage.setItem(
      SEO_TOOLS_HISTORY_KEY,
      JSON.stringify([
        {
          id: 'seed-onpage',
          toolId: 'on-page',
          toolTitle: 'On-Page',
          siteUrl: 'https://example.com',
          ranAt: new Date().toISOString(),
          status: 'success',
          result: { overall_score: 91 },
        },
      ]),
    );

    render(<SeoToolsPanel siteUrl="https://example.com" />);

    fireEvent.click(await screen.findByRole('button', { name: 'View' }));
    expect(await screen.findByText('Overall 91')).toBeInTheDocument();
    expect(seoApiService.analyzeOnPageSEO).not.toHaveBeenCalled();
  });

  it('clear removes only that tool history, others untouched', async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      SEO_TOOLS_HISTORY_KEY,
      JSON.stringify([
        {
          id: 'o1',
          toolId: 'on-page',
          toolTitle: 'On-Page',
          ranAt: now,
          status: 'success',
          result: { overall_score: 80 },
        },
        {
          id: 'o2',
          toolId: 'on-page',
          toolTitle: 'On-Page',
          ranAt: now,
          status: 'error',
          error: 'boom',
        },
        {
          id: 'm1',
          toolId: 'meta',
          toolTitle: 'Meta Descriptions',
          ranAt: now,
          status: 'success',
          result: { ok: true },
        },
      ]),
    );

    render(<SeoToolsPanel siteUrl="https://example.com" />);

    // Find the Clear button for the on-page tool specifically
    const onPageCard = screen.getByText('On-Page').closest('.MuiCard-root') as HTMLElement;
    const onPageClearButton = within(onPageCard).getByRole('button', { name: 'Clear' });
    fireEvent.click(onPageClearButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'View' }, { within: onPageCard })).not.toBeInTheDocument();
    });
    const stored = JSON.parse(localStorage.getItem(SEO_TOOLS_HISTORY_KEY) ?? '[]') as Array<{
      toolId: string;
    }>;
    expect(stored.filter((r) => r.toolId === 'on-page')).toHaveLength(0);
    expect(stored.filter((r) => r.toolId === 'meta')).toHaveLength(1);
  });

  it('records a fresh successful run into history with Success state', async () => {
    mocked(seoApiService.generateMetaDescriptions).mockResolvedValue({
      meta_descriptions: [{ text: 'Alpha description' }],
    });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/Keywords for meta descriptions/i), {
      target: { value: 'seo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Meta/ }));

    expect(await screen.findByText('Success')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(SEO_TOOLS_HISTORY_KEY) ?? '[]') as Array<{
      toolId: string;
      status: string;
    }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ toolId: 'meta', status: 'success' });
  });
});