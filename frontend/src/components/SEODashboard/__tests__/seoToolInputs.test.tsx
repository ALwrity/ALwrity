import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { isValidHttpUrl } from '../seoFormParsers';
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
  },
  default: {},
}));


const mocked = (fn: unknown) => vi.mocked(fn as (...a: any[]) => Promise<any>);

// Phase T2 — input hardening: validate before firing, never send invalid
// requests; file upload for image-alt; selects match backend enums.
describe('Phase T2 — tool input hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isValidHttpUrl accepts http(s) URLs only', () => {
    expect(isValidHttpUrl('https://example.com/a')).toBe(true);
    expect(isValidHttpUrl('http://localhost:3000')).toBe(true);
    expect(isValidHttpUrl('notaurl')).toBe(false);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
    expect(isValidHttpUrl('  https://example.com  ')).toBe(true);
  });

  it('invalid URL blocks firing with an error, service never called', async () => {
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/Site URL \(On-Page\)/i), {
      target: { value: 'notaurl' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run on-page/i }));
    expect(await screen.findByText(/valid http.*url/i)).toBeInTheDocument();
    expect(seoApiService.analyzeOnPageSEO).not.toHaveBeenCalled();
  });

  it('meta tone select offers backend tones and sends the chosen tone', async () => {
    mocked(seoApiService.generateMetaDescriptions).mockResolvedValue({ ok: true });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    // MUI renders Select options lazily — open the dropdown to reveal them.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /tone/i }));
    for (const tone of ['Informative', 'Engaging', 'Humorous']) {
      expect(await screen.findByRole('option', { name: tone })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('option', { name: 'Engaging' }));
    fireEvent.change(screen.getByLabelText(/keywords for meta/i), {
      target: { value: 'seo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run meta/i }));
    await waitFor(() => {
      expect(seoApiService.generateMetaDescriptions).toHaveBeenCalledWith(
        expect.objectContaining({ keywords: ['seo'], tone: 'Engaging' }),
        expect.anything(),
      );
    });
  });

  it('opengraph platform select matches the backend enum', async () => {
    mocked(seoApiService.generateOpenGraphTags).mockResolvedValue({ ok: true });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /platform/i }));
    for (const platform of ['General', 'Facebook', 'Twitter']) {
      expect(await screen.findByRole('option', { name: platform })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('option', { name: 'Twitter' }));
    fireEvent.click(screen.getByRole('button', { name: /run opengraph/i }));
    await waitFor(() => {
      expect(seoApiService.generateOpenGraphTags).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'Twitter' }),
        expect.anything(),
      );
    });
  });

  it('typed keywords render as chips', async () => {
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/keywords for meta/i), {
      target: { value: 'seo, tools' },
    });
    expect(await screen.findByText('seo', { selector: 'span' })).toBeInTheDocument();
  });

  it('image-alt requires exactly one of URL or file (XOR)', async () => {
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    expect(screen.getByLabelText(/upload image/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.com/a.png' },
    });
    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /run image alt/i }));
    expect(await screen.findByText(/either.*or.*not both/i)).toBeInTheDocument();
    expect(seoApiService.generateImageAltText).not.toHaveBeenCalled();
  });

  it('image-alt with file only calls the service (no URL needed)', async () => {
    mocked(seoApiService.generateImageAltText).mockResolvedValue({ alt_text: 'x' });
    render(<SeoToolsPanel siteUrl="https://example.com" />);
    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /run image alt/i }));
    await waitFor(() => {
      expect(seoApiService.generateImageAltText).toHaveBeenCalled();
    });
  });
});
