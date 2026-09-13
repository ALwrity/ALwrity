import { seoApiService } from '../../../../services/seoApiService';
import { parseCommaList } from '../../seoFormParsers';
import { isValidHttpUrl } from '../../seoFormParsers';
import { BatchRequester } from '../../../../services/batchRequesters';

export interface ToolInputDef {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  kind?: 'text' | 'select' | 'file' | 'textarea';
  options?: string[];
  defaultFromSite?: boolean;
  /** 'url' enforces absolute http(s) URLs; 'chips' renders parsed entries. */
  validate?: 'url';
  chips?: boolean;
}

export interface ToolDef {
  id: string;
  title: string;
  description: string;
  runLabel: string;
  inputs: ToolInputDef[];
  /** Whole-card validation; return an error message or null when valid. */
  validate?: (values: Record<string, string>, files: Record<string, File | null>) => string | null;
  run: (
    values: Record<string, string>,
    siteUrl: string,
    signal: AbortSignal,
    files?: Record<string, File | null>,
  ) => Promise<unknown>;
}

const urlInput = (label: string): ToolInputDef => ({
  name: 'url',
  label,
  placeholder: 'https://example.com',
  defaultFromSite: true,
  validate: 'url',
});

// Single-call SEO tools as user-fired definitions (Phase C). Each maps to an
// already-wired seoApiService method; the panel only provides inputs,
// loading/error/result states, and abort support.
export const SEO_TOOL_DEFS: ToolDef[] = [
  {
    id: 'meta',
    title: 'Meta Descriptions',
    description: 'Generate SEO meta descriptions from target keywords.',
    runLabel: 'Run Meta',
    inputs: [
      {
        name: 'keywords',
        label: 'Keywords for meta descriptions (comma-separated)',
        required: true,
        placeholder: 'seo, tools',
        chips: true,
      },
      {
        name: 'tone',
        label: 'Tone',
        kind: 'select',
        options: ['General', 'Informative', 'Engaging', 'Humorous', 'Intriguing', 'Playful'],
      },
      {
        name: 'search_intent',
        label: 'Search intent',
        kind: 'select',
        options: ['Informational Intent', 'Commercial Intent', 'Transactional Intent', 'Navigational Intent'],
      },
    ],
    run: (values, _siteUrl, signal) =>
      seoApiService.generateMetaDescriptions(
        {
          keywords: parseCommaList(values.keywords ?? ''),
          tone: values.tone || undefined,
          search_intent: values.search_intent || undefined,
        },
        { signal },
      ),
  },
  {
    id: 'pagespeed',
    title: 'PageSpeed',
    description: 'PageSpeed Insights with Core Web Vitals.',
    runLabel: 'Run PageSpeed',
    inputs: [
      { ...urlInput('Site URL (PageSpeed)') },
      {
        name: 'strategy',
        label: 'Strategy (PageSpeed)',
        kind: 'select',
        options: ['desktop', 'mobile'],
      },
    ],
    run: (values, siteUrl, signal) =>
      seoApiService.analyzePageSpeed(
        {
          url: values.url || siteUrl,
          strategy: (values.strategy || 'desktop').toUpperCase() as 'DESKTOP' | 'MOBILE',
        },
        { signal },
      ),
  },
  {
    id: 'sitemap',
    title: 'Sitemap',
    description: 'Analyze sitemap structure and publishing patterns.',
    runLabel: 'Run Sitemap',
    inputs: [
      {
        name: 'sitemap_url',
        label: 'Sitemap URL',
        placeholder: 'https://example.com/sitemap.xml',
        defaultFromSite: true,
      },
    ],
    run: (values, siteUrl, signal) =>
      seoApiService.analyzeSitemap(
        { sitemap_url: values.sitemap_url || siteUrl },
        { signal },
      ),
  },
  {
    id: 'image-alt',
    title: 'Image Alt Text',
    description: 'Generate alt text for an image (URL or upload).',
    runLabel: 'Run Image Alt',
    inputs: [
      { name: 'image_url', label: 'Image URL', validate: 'url', placeholder: 'https://example.com/a.png' },
      { name: 'image_file', label: 'Upload image', kind: 'file' },
      { name: 'context', label: 'Context (Image Alt)', placeholder: 'Product photo' },
      { name: 'keywords', label: 'Keywords (Image Alt)', placeholder: 'seo, tools', chips: true },
    ],
    // XOR: the backend accepts exactly one of image_url / image_file; never
    // fire a request that is doomed to 400 ("Either image_file or image_url
    // must be provided") — fail fast instead.
    validate: (values, files) => {
      const hasUrl = Boolean((values.image_url ?? '').trim());
      const hasFile = Boolean(files?.image_file);
      if (hasUrl && hasFile) return 'Provide either an image URL or upload a file, not both.';
      if (!hasUrl && !hasFile) return 'Provide an image URL or upload a file.';
      return null;
    },
    run: (values, _siteUrl, signal, files) =>
      seoApiService.generateImageAltText(
        {
          image_url: values.image_url || undefined,
          image_file: files?.image_file ?? undefined,
          context: values.context || undefined,
          keywords: parseCommaList(values.keywords ?? '') || undefined,
        },
        { signal },
      ),
  },
  {
    id: 'opengraph',
    title: 'OpenGraph',
    description: 'Generate social preview tags for a URL.',
    runLabel: 'Run OpenGraph',
    inputs: [
      { ...urlInput('Site URL (OpenGraph)') },
      {
        name: 'platform',
        label: 'Platform (OpenGraph)',
        kind: 'select',
        options: ['General', 'Facebook', 'Twitter'],
      },
    ],
    run: (values, siteUrl, signal) =>
      seoApiService.generateOpenGraphTags(
        { url: values.url || siteUrl, platform: values.platform || undefined },
        { signal },
      ),
  },
  {
    id: 'on-page',
    title: 'On-Page',
    description: 'Audit on-page factors: meta, headings, content.',
    runLabel: 'Run On-Page',
    inputs: [
      { ...urlInput('Site URL (On-Page)') },
      { name: 'keywords', label: 'Target keywords (On-Page)', placeholder: 'seo, tools' },
    ],
    run: (values, siteUrl, signal) =>
      seoApiService.analyzeOnPageSEO(
        {
          url: values.url || siteUrl,
          target_keywords: parseCommaList(values.keywords ?? ''),
        },
        { signal },
      ),
  },
  {
    id: 'technical',
    title: 'Technical',
    description: 'Crawl a page for technical SEO issues.',
    runLabel: 'Run Technical',
    inputs: [{ ...urlInput('Site URL (Technical)') }],
    run: (values, siteUrl, signal) =>
      seoApiService.analyzeTechnicalSEO({ url: values.url || siteUrl }, { signal }),
  },
  // Phase 7 (8H): multi-URL batch analysis driven by the real BatchRequester
  // (T5 service): bounded concurrency, per-item retry on retryable kinds,
  // AbortSignal cancel. The panel-only validation keeps doomed batches local.
  {
    id: 'batch',
    title: 'Batch Analyzer',
    description: 'Bounded-concurrency SEO analysis for many URLs (one per line, cap 20).',
    runLabel: 'Run Batch',
    inputs: [
      {
        name: 'urls',
        label: 'URLs (one per line)',
        kind: 'textarea',
        required: true,
        placeholder: 'https://a.com\nhttps://b.com',
      },
    ],
    validate: (values) => {
      const urls = (values.urls ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      if (urls.length === 0) return 'Enter at least one URL (one per line).';
      if (urls.length > 20) return 'Batch cap is 20 URLs.';
      for (const url of urls) {
        if (!isValidHttpUrl(url)) return `"${url}" is not a valid http(s) URL.`;
      }
      return null;
    },
    run: (values, _siteUrl, signal) => {
      const urls = (values.urls ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      // Concurrency 2 + one transient retry keeps the backend and the
      // user's patience intact for 20-URL batches.
      return new BatchRequester().executeBatch(urls, {
        concurrency: 2,
        retryOptions: { maxRetries: 1, baseDelayMs: 2000 },
        signal,
      });
    },
  },
];
