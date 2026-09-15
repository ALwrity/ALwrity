/**
 * Phase 4: the canonical_profile block registry.
 *
 * The Identity view renders the full structural SSOT as an icon-card grid.
 * BLOCK_ORDER must cover the 20 content blocks built by
 * canonical_profile_builder.py, with a label + icon per block, and must
 * exclude `sources` (that key is provenance metadata, rendered as badges).
 */
import { describe, it, expect } from 'vitest';
import { BLOCK_ORDER } from '../BrandBrainBlocks';

describe('BrandBrainBlocks — Phase 4: block registry', () => {
  it('exports 20 blocks matching the canonical_profile contract', () => {
    expect(BLOCK_ORDER).toHaveLength(20);
    const keys = BLOCK_ORDER.map((b) => b.key);
    for (const key of [
      'industry',
      'target_audience',
      'writing_tone',
      'writing_voice',
      'writing_complexity',
      'writing_engagement',
      'content_types',
      'brand_colors',
      'brand_values',
      'visual_style',
      'strategy_insights',
      'seo_profile',
      'competitive_intelligence',
      'platform_preferences',
      'research_depth',
      'auto_research',
      'factual_content',
      'business_info',
      'persona',
      'brand_voice',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('gives every block a human label and a renderable icon', () => {
    for (const block of BLOCK_ORDER) {
      expect(block.label).toBeTruthy();
      expect(block.icon).toBeTruthy();
    }
  });

  it('excludes `sources` from block cards (provenance badges only)', () => {
    expect(BLOCK_ORDER.map((b) => b.key)).not.toContain('sources');
  });
});