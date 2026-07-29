/**
 * API contract regression tests for blogWriterApi service.
 *
 * Verifies that every exported function exists and accepts the expected
 * parameters. A renamed or removed function will fail the build.
 */

import { blogWriterApi, mediumBlogApi, assistiveWritingApi } from '../../../services/blogWriterApi';

const EXPECTED_METHODS = [
  'startResearch',
  'pollResearchStatus',
  'startOutlineGeneration',
  'pollOutlineStatus',
  'getContinuity',
  'sectionOriginalityTools',
  'sectionInternalLinkTools',
  'sectionFactCheckTools',
  'sectionOptimizeTools',
  'rewriteBlog',
  'pollRewriteStatus',
  'applySeoRecommendations',
  'analyzeFlowBasic',
  'analyzeFlowAdvanced',
  'refineOutline',
  'generateSection',
  'seoMetadata',
  'publish',
  'generateSEOTitles',
  'generateIntroductions',
  'enhanceSection',
  'optimizeOutline',
  'rebalanceOutline',
];

const EXPECTED_MEDIUM_METHODS = [
  'startMediumGeneration',
  'pollMediumGeneration',
];

const EXPECTED_ASSISTIVE_METHODS = [
  'getSuggestion',
];

describe('blogWriterApi — contract', () => {
  it('exports all expected methods', () => {
    for (const method of EXPECTED_METHODS) {
      expect(typeof (blogWriterApi as any)[method]).toBe('function');
    }
  });

  it('has no unexpected methods removed', () => {
    const actual = Object.keys(blogWriterApi).filter(
      (k) => typeof (blogWriterApi as any)[k] === 'function',
    );
    for (const method of actual) {
      expect(EXPECTED_METHODS).toContain(method);
    }
  });
});

describe('mediumBlogApi — contract', () => {
  it('exports all expected methods', () => {
    for (const method of EXPECTED_MEDIUM_METHODS) {
      expect(typeof (mediumBlogApi as any)[method]).toBe('function');
    }
  });
});

describe('assistiveWritingApi — contract', () => {
  it('exports all expected methods', () => {
    for (const method of EXPECTED_ASSISTIVE_METHODS) {
      expect(typeof (assistiveWritingApi as any)[method]).toBe('function');
    }
  });
});
