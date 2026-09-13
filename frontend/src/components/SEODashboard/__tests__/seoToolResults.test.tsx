import { render, screen } from '@testing-library/react';
import { ToolResultView } from '../components/SeoToolsPanel/toolResults';

// Fixtures mirror verified backend shapes (services/seo_tools/*).
// Every renderer must also survive a partial/empty payload (no crash,
// honest empty state) — cf. EnterpriseAuditResults hardening.
const FIXTURES: Record<string, any> = {
  meta: {
    meta_descriptions: [
      { text: 'Discover 10 proven SEO tools for 2026 growth', character_count: 44, word_count: 8, length_status: 'short', seo_score: 65, recommendations: [] },
      { text: 'Boost rankings fast with these expert SEO tactics today', character_count: 55, word_count: 9, length_status: 'short', seo_score: 72, recommendations: ['Add numbers'] },
    ],
    analysis: { average_length: 49.5, average_seo_score: 68.5, best_description: {} },
  },
  pagespeed: {
    url: 'https://example.com',
    strategy: 'DESKTOP',
    core_web_vitals: { lcp: 1.8, cls: 0.05, inp: 120 },
    category_scores: { performance: 92, seo: 100 },
    opportunities: [{ title: 'Serve images in next-gen formats', savings: '1.2s' }],
  },
  sitemap: {
    total_urls: 3,
    url_list: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
    structure_analysis: {},
  },
  'image-alt': {
    alt_text: 'A cat sitting on a wall',
    context_used: 'pets',
    keywords_included: ['cat'],
    confidence: 0.85,
    suggestions: ['Add breed detail'],
  },
  opengraph: {
    og_tags: { 'og:title': 'T', 'og:description': 'D', 'og:url': 'https://example.com', 'og:type': 'website' },
    platform_optimized: 'General',
    recommendations: ['Add custom image'],
    validation: { valid: true, issues: [] },
  },
  'on-page': {
    overall_score: 90,
    meta: { score: 90, issues: ['Title length (5 chars) should be 30-60 chars'] },
    technical: { score: 90, issues: [] },
    content_health: { score: 90, word_count: 407 },
  },
  technical: {
    technical_issues: [{ type: 'Multiple H1 Tags', severity: 'Medium', pages_affected: 1 }],
    site_structure: { h1_count: 2, internal_links: 1, external_links: 1 },
  },
};

describe('Phase T1 — rich per-tool results', () => {
  it('meta lists descriptions with counts and average score', () => {
    render(<ToolResultView toolId="meta" data={FIXTURES.meta} />);
    expect(screen.getByText(/Discover 10 proven SEO tools/)).toBeInTheDocument();
    expect(screen.getByText(/44 chars/)).toBeInTheDocument();
    expect(screen.getByText(/68.5/)).toBeInTheDocument();
  });

  it('pagespeed shows vitals, category scores, and opportunities', () => {
    render(<ToolResultView toolId="pagespeed" data={FIXTURES.pagespeed} />);
    expect(screen.getByText(/1\.8s?/)).toBeInTheDocument();
    expect(screen.getByText(/performance/i)).toBeInTheDocument();
    expect(screen.getByText(/92/)).toBeInTheDocument();
    expect(screen.getByText(/next-gen formats/)).toBeInTheDocument();
  });

  it('sitemap shows totals and sample URLs', () => {
    render(<ToolResultView toolId="sitemap" data={FIXTURES.sitemap} />);
    expect(screen.getByText(/3 urls?/i)).toBeInTheDocument();
    expect(screen.getByText(/example\.com\/a/)).toBeInTheDocument();
  });

  it('image-alt shows text, confidence, and suggestions', () => {
    render(<ToolResultView toolId="image-alt" data={FIXTURES['image-alt']} />);
    expect(screen.getByText(/A cat sitting on a wall/)).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(screen.getByText(/Add breed detail/)).toBeInTheDocument();
  });

  it('opengraph renders a tag table and validation', () => {
    render(<ToolResultView toolId="opengraph" data={FIXTURES.opengraph} />);
    expect(screen.getByText('og:title')).toBeInTheDocument();
    expect(screen.getByText(/Add custom image/)).toBeInTheDocument();
  });

  it('on-page shows overall and section scores with issues', () => {
    render(<ToolResultView toolId="on-page" data={FIXTURES['on-page']} />);
    expect(screen.getByText(/Overall.*90|90.*overall/i)).toBeInTheDocument();
    expect(screen.getByText(/Title length/)).toBeInTheDocument();
  });

  it('technical lists issues with severity and structure counts', () => {
    render(<ToolResultView toolId="technical" data={FIXTURES.technical} />);
    expect(screen.getByText(/Multiple H1 Tags/)).toBeInTheDocument();
    expect(screen.getByText(/Medium/)).toBeInTheDocument();
    expect(screen.getByText(/H1.*2|2.*H1/i)).toBeInTheDocument();
  });

  it.each(Object.keys(FIXTURES))('renders %s without crashing on empty payload', (toolId) => {
    const { container } = render(<ToolResultView toolId={toolId} data={{}} />);
    expect(container.textContent ?? '').toMatch(/no .* (yet|available)|nothing to show/i);
  });

  it('falls back to raw JSON for unknown tool ids', () => {
    render(<ToolResultView toolId="mystery" data={{ hello: 'world' }} />);
    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });
});
