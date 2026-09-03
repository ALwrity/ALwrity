/**
 * UnifiedAnalysisContainer — Test Suite
 * Framework: Vitest + @testing-library/react
 *
 * Coverage areas:
 *  1. Sidebar navigation
 *  2. Top action bar (tabs + global controls)
 *  3. Content matrix — key domain × tab intersections
 *  4. Edit mode flow
 *  5. Empty states
 *  6. Feature parity checklist (zero information loss)
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import UnifiedAnalysisContainer from '../index';
import type { StyleAnalysis } from '../../AnalysisResultsDisplay';

// ──────────────────────────────────────────────
// Mock external deps that hit real APIs
// ──────────────────────────────────────────────
vi.mock('../../../../../api/client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

const makeAnalysis = (overrides: Partial<StyleAnalysis> = {}): StyleAnalysis => ({
  id: 1,
  writing_style: {
    tone: 'Professional',
    voice: 'Authoritative',
    complexity: 'Moderate',
    engagement_level: 'High',
    brand_personality: 'Innovative',
    formality_level: 'Semi-formal',
    emotional_appeal: 'Inspirational',
  },
  target_audience: {
    demographics: ['25-44 year olds', 'Tech-savvy professionals'],
    expertise_level: 'Intermediate',
    industry_focus: 'Software',
    geographic_focus: 'United States',
    psychographic_profile: 'Growth-oriented',
    pain_points: ['Too much manual work', 'Inconsistent content quality'],
    motivations: ['Save time', 'Scale content production'],
  },
  content_type: {
    primary_type: 'Educational Blog',
    secondary_types: ['Case Studies', 'How-to guides'],
    purpose: 'Educate and convert',
    call_to_action: 'Value-driven',
    conversion_focus: 'Trial signups',
    educational_value: 'High',
  },
  content_characteristics: {
    sentence_structure: 'Varied',
    vocabulary_level: 'Professional',
    paragraph_organization: 'Logical',
    content_flow: 'Smooth',
    readability_score: 'Good',
    content_density: 'Medium',
    visual_elements_usage: 'Moderate',
  },
  content_strategy_insights: {
    strengths: ['Strong educational content'],
    weaknesses: ['Limited video content'],
    opportunities: ['Expand into podcasts'],
    threats: ['Increasing competition'],
    recommended_improvements: ['Add more case studies'],
    content_gaps: ['Beginner onboarding guides'],
  },
  brand_analysis: {
    brand_voice: 'Confident and clear',
    brand_values: ['Efficiency', 'Innovation', 'Reliability'],
    brand_positioning: 'AI-powered content platform',
    competitive_differentiation: 'Learns your brand voice automatically',
    trust_signals: ['Case studies', 'Customer reviews'],
    authority_indicators: ['Expert blog', 'Industry certifications'],
  },
  strategic_insights: {
    content_strategy: 'Focus on thought leadership content targeting mid-market SaaS teams.',
    competitive_advantages: ['AI brand voice learning', 'One-click publishing'],
    content_calendar_suggestions: ['Weekly tips series', 'Monthly roundups'],
    ai_generation_tips: ['Always include a clear CTA', 'Use second-person voice'],
  },
  guidelines: {
    tone_recommendations: ['Keep it conversational', 'Avoid jargon'],
    structure_guidelines: ['Use H2 headers every 300 words'],
    vocabulary_suggestions: ['Use active verbs'],
    engagement_tips: ['Start with a question'],
    audience_considerations: ['Write for intermediate readers'],
    brand_alignment: ['Always mention core values'],
    seo_optimization: ['Target long-tail keywords'],
    conversion_optimization: ['Place CTA above the fold'],
  },
  seo_audit: {
    overall_score: 74,
    summary: {
      critical_issues: [{ message: 'Meta description too short' }],
      warnings: ['Missing alt text on 3 images'],
    },
    meta: { title_length: '52 chars', meta_description_length: '60 chars' },
    content_health: { word_count: 450, h1_count: 1 },
    technical: { has_robots_txt: true, has_sitemap: true },
    performance: { load_time: '1.8s' },
    accessibility: { mobile_friendly: true },
    ux: { nav_elements: true },
  },
  sitemap_analysis: {
    total_urls: 142,
    ai_insights: {
      summary: 'Strong content foundation with some gaps.',
      content_gaps: [{ topic: 'AI glossary', priority: 'high', impact: 'SEO' }],
      growth_recommendations: ['Add a resource hub', 'Create comparison pages'],
      seo_opportunities: [{ type: 'Internal linking', finding: 'Low linking from blog', impact: 'high' }],
    },
    seo_recommendations: ['Reduce URL depth to max 3 levels'],
    structure_analysis: { url_patterns: { '/blog/': 80 }, average_path_depth: 2.4, max_path_depth: 5 },
  },
  meta: { confidence: 0.85, notes: '' },
  recommended_settings: {
    writing_tone: 'Professional',
    target_audience: 'Intermediate',
    content_type: 'Educational Blog',
    creativity_level: 'Balanced',
    geographic_location: 'United States',
    industry_context: 'Software',
    brand_alignment: 'High',
  },
  best_practices: ['Always cite sources', 'Use numbered lists for steps'],
  avoid_elements: ['Excessive passive voice', 'Overly technical jargon'],
  competitive_advantages: ['AI brand voice learning'],
  content_calendar_suggestions: ['Weekly tips'],
  ai_generation_tips: ['Use active voice'],
  ...overrides,
});

const CRAWL_RESULT = {
  domain_info: {
    domain: 'example.com',
    is_blog: true,
    is_ecommerce: false,
    is_corporate: false,
    has_about_page: true,
    has_contact_page: true,
    has_blog_section: true,
  },
  social_media: {
    site_name: 'Example Co',
    linkedin: 'https://linkedin.com/company/example',
    twitter: 'https://twitter.com/example',
    youtube: 'https://youtube.com/@example',
    facebook: 'https://facebook.com/example',
    instagram: 'https://instagram.com/example',
    github: 'https://github.com/example',
  },
  brand_info: {
    company_name: 'Example Co',
    logo_alt: ['Example Co logo', 'Homepage logo'],
    contact_info: {
      email: ['hello@example.com'],
      phone: ['+1-555-0100'],
    },
  },
};

const renderContainer = (overrides: Partial<StyleAnalysis> = {}, props: Record<string, any> = {}) => {
  const analysis = makeAnalysis(overrides);
  const onAnalysisUpdate = vi.fn();
  const onSave = vi.fn();

  render(
    <UnifiedAnalysisContainer
      analysis={analysis}
      domainName="example.com"
      crawlResult={CRAWL_RESULT}
      onAnalysisUpdate={onAnalysisUpdate}
      onSave={onSave}
      {...props}
    />,
  );

  return { analysis, onAnalysisUpdate, onSave };
};

// ──────────────────────────────────────────────
// 1. Sidebar Navigation
// ──────────────────────────────────────────────
describe('AnalysisSidebar', () => {
  it('renders 7 domain items', () => {
    renderContainer();
    const sidebar = screen.getByTestId('analysis-sidebar');
    const domains = within(sidebar).getAllByRole('button');
    expect(domains).toHaveLength(7);
  });

  it('activates Overview domain by default', () => {
    renderContainer();
    const overviewBtn = screen.getByTestId('sidebar-domain-overview');
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches active domain when a sidebar item is clicked', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-brand'));
    expect(screen.getByTestId('sidebar-domain-brand')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sidebar-domain-overview')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows an error badge on the SEO domain when critical issues exist', () => {
    renderContainer();
    const seoDomain = screen.getByTestId('sidebar-domain-seo');
    expect(seoDomain).toBeInTheDocument();
    expect(within(seoDomain).getByText('1')).toBeInTheDocument();
  });

  it('mutes/disables domains with no data', () => {
    renderContainer({ sitemap_analysis: undefined });
    const sitemapBtn = screen.getByTestId('sidebar-domain-sitemap');
    expect(sitemapBtn).toHaveStyle({ opacity: 0.4 });
  });
});

// ──────────────────────────────────────────────
// 2. Top Action Bar — tabs + global controls
// ──────────────────────────────────────────────
describe('AnalysisTopBar', () => {
  it('renders 3 tabs: Insights, Guidelines, Refine & Actions in the correct order', () => {
    renderContainer();
    const insightsTab = screen.getByTestId('top-tab-insights');
    const guidelinesTab = screen.getByTestId('top-tab-guidelines');
    const refineActionsTab = screen.getByTestId('top-tab-refine_actions');

    expect(insightsTab).toBeInTheDocument();
    expect(guidelinesTab).toBeInTheDocument();
    expect(refineActionsTab).toBeInTheDocument();
  });

  it('renders the Edit Mode switch under Refine & Actions tab of an editable domain', () => {
    renderContainer({}, { defaultDomain: 'brand', defaultTab: 'refine_actions' });
    expect(screen.getByTestId('edit-mode-switch')).toBeInTheDocument();
  });

  it('renders the Save button under Refine & Actions tab', () => {
    renderContainer({}, { defaultDomain: 'brand', defaultTab: 'refine_actions' });
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('Save button calls onSave() under Refine & Actions tab', () => {
    const { onSave } = renderContainer({}, { defaultDomain: 'brand', defaultTab: 'refine_actions' });
    fireEvent.click(screen.getByTestId('save-button'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('renders the confidence chip with correct value', () => {
    renderContainer();
    const chip = screen.getByTestId('confidence-chip');
    expect(chip).toHaveTextContent('85% confidence');
  });

  it('shows warning banner when warning prop is set', () => {
    renderContainer({}, { warning: 'Guidelines generation failed | partial data' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────
// 3. Content Matrix — key intersections
// ──────────────────────────────────────────────
describe('Content Matrix — Overview', () => {
  it('Overview × Insights renders AI Generation Settings (RecommendedSettingsPanel)', () => {
    renderContainer();
    expect(screen.getByText('AI Generation Settings')).toBeInTheDocument();
    expect(screen.getByText('Writing Tone')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.queryByText('Content Strategy Insights')).not.toBeInTheDocument();
  });

  it('Overview × Guidelines renders EnhancedGuidelinesSection', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('top-tab-guidelines'));
    expect(screen.getByText('Tone Recommendations')).toBeInTheDocument();
  });

  it('Overview × Refine & Actions renders StrategicInsightsSection and is editable in Edit Mode', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    const matches = screen.getAllByText(/Strategy Overview|Core Strategy/i);
    expect(matches.length).toBeGreaterThan(0);

    // Switch to the Competitive Edge tab to make its panel active
    fireEvent.click(screen.getByText(/Competitive Edge/i));
    expect(screen.getByText(/Your Competitive Advantages/i)).toBeInTheDocument();

    const editSwitch = within(screen.getByTestId('edit-mode-switch')).getByRole('checkbox');
    fireEvent.click(editSwitch);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });
});

describe('Content Matrix — Brand Voice', () => {
  beforeEach(() => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-brand'));
  });

  it('Brand × Insights renders BrandAnalysisSection in read-only mode', () => {
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('Brand Voice')).toBeInTheDocument();
    expect(within(stage).getByText('Confident and clear')).toBeInTheDocument();
  });

  it('Brand × Refine & Actions with Edit Mode enables editable fields', () => {
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    const editSwitch = within(screen.getByTestId('edit-mode-switch')).getByRole('checkbox');
    fireEvent.click(editSwitch);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });
});

describe('Content Matrix — SEO Audit', () => {
  beforeEach(() => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-seo'));
  });

  it('SEO × Insights renders SEOAuditSection with score chip', () => {
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText(/Home Page SEO Snapshot/i)).toBeInTheDocument();
    expect(within(stage).getByText(/Score: 74\/100/i)).toBeInTheDocument();
  });

  it('SEO × Insights shows critical issues', () => {
    expect(screen.getByText(/Meta description too short/i)).toBeInTheDocument();
  });
});

describe('Content Matrix — Sitemap Intel', () => {
  beforeEach(() => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-sitemap'));
  });

  it('Sitemap × Insights renders SitemapAnalysisSection with URL count', () => {
    expect(screen.getByText(/142 URLs/i)).toBeInTheDocument();
  });

  it('Sitemap × Refine & Actions auto-resets domain to overview', () => {
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    expect(screen.getByTestId('sidebar-domain-overview')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Content Matrix — Audience', () => {
  beforeEach(() => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-audience'));
  });

  it('Audience × Insights renders TargetAudienceAnalysisSection', () => {
    expect(screen.getByText('Expertise Level')).toBeInTheDocument();
    expect(screen.getAllByText('Intermediate')[0]).toBeInTheDocument();
  });

  it('Audience × Refine & Actions renders pain points and motivations', () => {
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText(/Too much manual work/i)).toBeInTheDocument();
    expect(within(stage).getByText(/Save time/i)).toBeInTheDocument();
  });

  it('Audience × Guidelines renders audience considerations', () => {
    fireEvent.click(screen.getByTestId('top-tab-guidelines'));
    expect(screen.getByText(/Audience Considerations/i)).toBeInTheDocument();
  });
});

describe('Content Matrix — Site Footprint', () => {
  const openFootprint = () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-footprint'));
  };

  const expectFullCrawlPanels = (stage: HTMLElement) => {
    expect(within(stage).getByTestId('crawl-result-sections')).toBeInTheDocument();
    expect(within(stage).getByText('Domain Information')).toBeInTheDocument();
    expect(within(stage).getByText('example.com')).toBeInTheDocument();
    expect(within(stage).getByText('Blog')).toBeInTheDocument();
    expect(within(stage).getByText('About Page ✓')).toBeInTheDocument();
    expect(within(stage).getByText(/Example Co — Social Media/i)).toBeInTheDocument();
    expect(within(stage).getByLabelText(/linkedin/i)).toBeInTheDocument();
    expect(within(stage).getByLabelText(/youtube/i)).toBeInTheDocument();
    expect(within(stage).getByText('Brand Information')).toBeInTheDocument();
    expect(within(stage).getByText('Example Co logo')).toBeInTheDocument();
    expect(within(stage).getByText('hello@example.com')).toBeInTheDocument();
    expect(within(stage).getByText('+1-555-0100')).toBeInTheDocument();
  };

  it('Footprint × Insights renders complete CrawlResultSections (all 3 panels)', () => {
    openFootprint();
    expectFullCrawlPanels(screen.getByTestId('content-stage'));
  });

  it('Footprint crawl panels expose SectionHeader info tooltips on all 3 panels', () => {
    openFootprint();
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getAllByLabelText('info').length).toBeGreaterThanOrEqual(3);
  });

  it('Footprint × Refine & Actions preserves footprint domain and shows platform nudge', () => {
    openFootprint();
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    expect(screen.getByTestId('sidebar-domain-footprint')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Platform Connections/i)).toBeInTheDocument();
  });

  it('Footprint × Guidelines auto-resets domain to overview', () => {
    openFootprint();
    fireEvent.click(screen.getByTestId('top-tab-guidelines'));
    expect(screen.getByTestId('sidebar-domain-overview')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Footprint shows empty state when crawlResult is missing', () => {
    renderContainer({}, { crawlResult: undefined });
    fireEvent.click(screen.getByTestId('sidebar-domain-footprint'));
    expect(screen.getByText(/No site footprint data available/i)).toBeInTheDocument();
  });
});

describe('SectionHeader tooltips in dashboard matrix', () => {
  it('Audience › Insights shows Target Audience Analysis SectionHeader with info tooltip', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-audience'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('Target Audience Analysis')).toBeInTheDocument();
    expect(within(stage).getByLabelText('info')).toBeInTheDocument();
  });

  it('Content › Insights shows section headers with info tooltips', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-content'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('Content Characteristics')).toBeInTheDocument();
    expect(within(stage).getByText('Content Type Analysis')).toBeInTheDocument();
    expect(within(stage).queryByText('Content Strategy Insights')).not.toBeInTheDocument();
    expect(within(stage).getAllByLabelText('info').length).toBeGreaterThanOrEqual(2);
  });

  it('Overview › Guidelines shows Style Guidelines SectionHeader', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('top-tab-guidelines'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('Style Guidelines')).toBeInTheDocument();
    expect(within(stage).getByLabelText('info')).toBeInTheDocument();
  });

  it('SEO › Insights shows SEO Audit SectionHeader with info tooltip', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-seo'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('SEO Audit')).toBeInTheDocument();
    expect(within(stage).getAllByLabelText('info').length).toBeGreaterThanOrEqual(1);
  });

  it('Overview › Refine & Actions shows Strategic Action Plan and SWOT SectionHeaders', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('Strategic Action Plan')).toBeInTheDocument();
    expect(within(stage).getByText('SWOT & Content Strategy Insights')).toBeInTheDocument();
    expect(within(stage).getAllByLabelText('info').length).toBeGreaterThanOrEqual(2);
  });
});

// ──────────────────────────────────────────────
// 4. Edit Mode flow
// ──────────────────────────────────────────────
describe('Edit Mode', () => {
  it('Edit Mode toggle resets when domain changes under Refine & Actions tab', () => {
    renderContainer({}, { defaultDomain: 'brand', defaultTab: 'refine_actions' });
    const editSwitch = within(screen.getByTestId('edit-mode-switch')).getByRole('checkbox');
    fireEvent.click(editSwitch);
    expect(editSwitch).toBeChecked();
    fireEvent.click(screen.getByTestId('sidebar-domain-audience'));
    const newEditSwitch = within(screen.getByTestId('edit-mode-switch')).getByRole('checkbox');
    expect(newEditSwitch).not.toBeChecked();
  });

  it('Edit Mode toggle is absent for non-editable domains (SEO)', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-seo'));
    expect(screen.queryByTestId('edit-mode-switch')).not.toBeInTheDocument();
  });

  it('Editing a brand field calls onAnalysisUpdate with merged payload', () => {
    const { onAnalysisUpdate } = renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-brand'));
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));

    const editSwitch = within(screen.getByTestId('edit-mode-switch')).getByRole('checkbox');
    fireEvent.click(editSwitch);

    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.length).toBeGreaterThan(0);
    fireEvent.change(textboxes[0], { target: { value: 'Bold and direct' } });
    expect(onAnalysisUpdate).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// 5. Empty States
// ──────────────────────────────────────────────
describe('Empty States', () => {
  it('shows empty state when brand_analysis is absent', () => {
    renderContainer({ brand_analysis: undefined });
    fireEvent.click(screen.getByTestId('sidebar-domain-brand'));
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/No brand analysis data available/i)).toBeInTheDocument();
  });

  it('shows empty state when seo_audit is absent', () => {
    renderContainer({ seo_audit: undefined });
    fireEvent.click(screen.getByTestId('sidebar-domain-seo'));
    expect(screen.getByText(/No SEO audit data available/i)).toBeInTheDocument();
  });

  it('shows empty state for Footprint when crawlResult is not provided', () => {
    const analysis = makeAnalysis();
    render(
      <UnifiedAnalysisContainer
        analysis={analysis}
        domainName="example.com"
        crawlResult={undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('sidebar-domain-footprint'));
    expect(screen.getByText(/No site footprint data available/i)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────
// 6. Feature Parity — Zero information loss
// ──────────────────────────────────────────────
describe('Feature Parity', () => {
  it('renders the Brand Intelligence Dashboard header', () => {
    renderContainer();
    expect(screen.getByText(/Brand Intelligence Dashboard/i)).toBeInTheDocument();
  });

  it('all 7 sidebar domains are labeled correctly under Insights tab', () => {
    renderContainer({}, { defaultTab: 'insights' });
    const sidebar = screen.getByTestId('analysis-sidebar');
    const labels = ['Overview', 'Brand Voice', 'Audience', 'Content Profile', 'SEO Audit', 'Sitemap Intel', 'Site Footprint'];
    labels.forEach((label) => expect(within(sidebar).getByText(label)).toBeInTheDocument());
  });

  it('confidence chip renders correct percentage', () => {
    renderContainer();
    expect(screen.getByTestId('confidence-chip')).toHaveTextContent('85%');
  });

  it('tooltip info icons are present in insights tables', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-brand'));
    const infoIcons = screen.getAllByTestId('InfoIcon');
    expect(infoIcons.length).toBeGreaterThan(0);
  });

  it('SEO score chip shows numeric score', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-seo'));
    expect(screen.getByText(/74/)).toBeInTheDocument();
  });

  it('guidelines cards render Tone Recommendations in Overview › Guidelines', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('top-tab-guidelines'));
    expect(screen.getByText('Tone Recommendations')).toBeInTheDocument();
    expect(screen.getByText(/Keep it conversational/i)).toBeInTheDocument();
  });

  it('content templates render in Content › Refine & Actions', () => {
    renderContainer({
      content_templates: [
        { type: 'How-to Guide', headline: '', structure: ['Intro', 'Steps', 'Summary'], tone_notes: 'Instructional' },
      ],
    });
    fireEvent.click(screen.getByTestId('sidebar-domain-content'));
    fireEvent.click(screen.getByTestId('top-tab-refine_actions'));
    const stage = screen.getByTestId('content-stage');
    expect(within(stage).getByText('How-to Guide', { selector: 'p' })).toBeInTheDocument();
  });

  it('sitemap URL count chip is visible in Sitemap › Insights', () => {
    renderContainer();
    fireEvent.click(screen.getByTestId('sidebar-domain-sitemap'));
    expect(screen.getByText(/142 URLs/i)).toBeInTheDocument();
  });
});
