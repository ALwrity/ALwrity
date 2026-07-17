/**
 * Unit tests for LinkedIn publish readiness helpers.
 * Run manually: npx jest linkedInPublishReadiness.test.ts
 *
 * Kept under __tests__/ and excluded from CRA app typecheck (see tsconfig exclude).
 */

import {
  LINKEDIN_POST_HARD_LIMIT,
  LINKEDIN_POST_SEE_MORE_SOFT,
  LINKEDIN_PUBLISH_EMPTY_ERROR,
  LINKEDIN_PUBLISH_TOO_LONG_ERROR,
} from '../utils/linkedInPostFormatConstants';
import {
  assertHardPublishLimits,
  getCharReadiness,
  getHashtagReadiness,
  getPublishChecklist,
  getPublishPlainText,
} from '../utils/linkedInPublishReadiness';

describe('linkedInPublishReadiness', () => {
  test('getPublishPlainText strips markdown bold', () => {
    const plain = getPublishPlainText('Hello **world**');
    expect(plain).toBe('Hello world');
    expect(plain).not.toContain('**');
  });

  test('getCharReadiness empty', () => {
    const chars = getCharReadiness('   ');
    expect(chars.isEmpty).toBe(true);
    expect(chars.hardOk).toBe(false);
  });

  test('getCharReadiness soft see-more boundary', () => {
    const under = getCharReadiness('a'.repeat(LINKEDIN_POST_SEE_MORE_SOFT));
    expect(under.seeMoreSoftOk).toBe(true);
    expect(under.hardOk).toBe(true);

    const over = getCharReadiness('a'.repeat(LINKEDIN_POST_SEE_MORE_SOFT + 1));
    expect(over.seeMoreSoftOk).toBe(false);
    expect(over.hardOk).toBe(true);
  });

  test('getCharReadiness hard limit', () => {
    const atLimit = getCharReadiness('a'.repeat(LINKEDIN_POST_HARD_LIMIT));
    expect(atLimit.hardOk).toBe(true);

    const over = getCharReadiness('a'.repeat(LINKEDIN_POST_HARD_LIMIT + 1));
    expect(over.hardOk).toBe(false);
  });

  test('getHashtagReadiness soft max', () => {
    const ok = getHashtagReadiness('#one #two #three #four #five');
    expect(ok.count).toBe(5);
    expect(ok.softOk).toBe(true);

    const many = getHashtagReadiness('#a #b #c #d #e #f');
    expect(many.count).toBe(6);
    expect(many.softOk).toBe(false);
  });

  test('assertHardPublishLimits', () => {
    expect(assertHardPublishLimits('').error).toBe(LINKEDIN_PUBLISH_EMPTY_ERROR);
    expect(assertHardPublishLimits('a'.repeat(LINKEDIN_POST_HARD_LIMIT + 1)).error).toBe(
      LINKEDIN_PUBLISH_TOO_LONG_ERROR,
    );
    expect(assertHardPublishLimits('Ready to publish this post.').ok).toBe(true);
  });

  test('getPublishChecklist includes hard and soft items', () => {
    const items = getPublishChecklist(
      'Here is a strong opening hook about AI.\n\nWhat do you think?\n\n#ai #work',
      true,
    );
    expect(items.some((item) => item.id === 'hard_limit' && item.ok === true)).toBe(true);
    expect(items.some((item) => item.id === 'image' && item.ok === true)).toBe(true);
    expect(items.some((item) => item.severity === 'soft')).toBe(true);
  });
});
