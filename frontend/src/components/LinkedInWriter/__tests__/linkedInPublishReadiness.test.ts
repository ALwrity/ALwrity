/**
 * Unit tests for LinkedIn publish readiness helpers.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=linkedInPublishReadiness
 *
 * Kept under __tests__/ and excluded from CRA app typecheck (see tsconfig exclude).
 */

import {
  DEFAULT_ARTICLE_WORD_TARGET,
  LINKEDIN_ARTICLE_SOFT_MAX,
  LINKEDIN_ARTICLE_SOFT_MIN,
  LINKEDIN_POST_HARD_LIMIT,
  LINKEDIN_POST_SEE_MORE_SOFT,
  LINKEDIN_PUBLISH_EMPTY_ERROR,
  LINKEDIN_PUBLISH_TOO_LONG_ERROR,
} from "../utils/linkedInPostFormatConstants";
import {
  assertHardPublishLimits,
  countDraftWords,
  formatWordCountLabel,
  getCharReadiness,
  getHashtagReadiness,
  getPublishChecklist,
  getPublishPlainText,
  getWordReadiness,
  isArticleUnipilePublishBlocked,
  resolveArticleWordTarget,
} from "../utils/linkedInPublishReadiness";

describe("linkedInPublishReadiness", () => {
  test("getPublishPlainText strips markdown bold", () => {
    const plain = getPublishPlainText("Hello **world**");
    expect(plain).toBe("Hello world");
    expect(plain).not.toContain("**");
  });

  test("getCharReadiness empty", () => {
    const chars = getCharReadiness("   ");
    expect(chars.isEmpty).toBe(true);
    expect(chars.hardOk).toBe(false);
  });

  test("getCharReadiness soft see-more boundary", () => {
    const under = getCharReadiness("a".repeat(LINKEDIN_POST_SEE_MORE_SOFT));
    expect(under.seeMoreSoftOk).toBe(true);
    expect(under.hardOk).toBe(true);

    const over = getCharReadiness("a".repeat(LINKEDIN_POST_SEE_MORE_SOFT + 1));
    expect(over.seeMoreSoftOk).toBe(false);
    expect(over.hardOk).toBe(true);
  });

  test("getCharReadiness hard limit", () => {
    const atLimit = getCharReadiness("a".repeat(LINKEDIN_POST_HARD_LIMIT));
    expect(atLimit.hardOk).toBe(true);

    const over = getCharReadiness("a".repeat(LINKEDIN_POST_HARD_LIMIT + 1));
    expect(over.hardOk).toBe(false);
  });

  test("getHashtagReadiness soft max", () => {
    const ok = getHashtagReadiness("#one #two #three #four #five");
    expect(ok.count).toBe(5);
    expect(ok.softOk).toBe(true);

    const many = getHashtagReadiness("#a #b #c #d #e #f");
    expect(many.count).toBe(6);
    expect(many.softOk).toBe(false);
  });

  test("assertHardPublishLimits", () => {
    expect(assertHardPublishLimits("").error).toBe(
      LINKEDIN_PUBLISH_EMPTY_ERROR,
    );
    expect(
      assertHardPublishLimits("a".repeat(LINKEDIN_POST_HARD_LIMIT + 1)).error,
    ).toBe(LINKEDIN_PUBLISH_TOO_LONG_ERROR);
    expect(assertHardPublishLimits("Ready to publish this post.").ok).toBe(
      true,
    );
  });

  test("getPublishChecklist includes hard and soft items", () => {
    const items = getPublishChecklist(
      "Here is a strong opening hook about AI.\n\nWhat do you think?\n\n#ai #work",
      true,
    );
    expect(
      items.some((item) => item.id === "hard_limit" && item.ok === true),
    ).toBe(true);
    expect(items.some((item) => item.id === "image" && item.ok === true)).toBe(
      true,
    );
    expect(items.some((item) => item.severity === "soft")).toBe(true);
  });

  test("countDraftWords ignores extra whitespace", () => {
    expect(countDraftWords("one two three")).toBe(3);
    expect(countDraftWords("  one   two  ")).toBe(2);
    expect(countDraftWords("   ")).toBe(0);
  });

  test("resolveArticleWordTarget uses prefs or default", () => {
    expect(resolveArticleWordTarget({ word_count: 800 })).toBe(800);
    expect(resolveArticleWordTarget({ word_count: "1500" })).toBe(1500);
    expect(resolveArticleWordTarget({})).toBe(DEFAULT_ARTICLE_WORD_TARGET);
  });

  test("getWordReadiness empty draft", () => {
    const words = getWordReadiness("   ", 1500);
    expect(words.isEmpty).toBe(true);
    expect(words.count).toBe(0);
    expect(words.target).toBe(1500);
  });

  test("getWordReadiness soft min and max bands", () => {
    const shortText = "word ".repeat(100).trim();
    const short = getWordReadiness(shortText, 800);
    expect(short.count).toBe(100);
    expect(short.softMinOk).toBe(false);
    expect(short.softMaxOk).toBe(true);

    const longText = "word ".repeat(LINKEDIN_ARTICLE_SOFT_MAX + 50).trim();
    const long = getWordReadiness(longText, 3000);
    expect(long.softMaxOk).toBe(false);
    expect(long.softMinOk).toBe(true);
  });

  test("getWordReadiness near target within tolerance", () => {
    const text = "word ".repeat(1500).trim();
    const words = getWordReadiness(text, 1500);
    expect(words.nearTargetOk).toBe(true);
    expect(words.softMinOk).toBe(true);
    expect(words.softMaxOk).toBe(true);
  });

  test("formatWordCountLabel", () => {
    expect(formatWordCountLabel(1200, 1500)).toBe("1,200 / 1,500 words");
  });

  test("isArticleUnipilePublishBlocked", () => {
    expect(isArticleUnipilePublishBlocked("article")).toBe(true);
    expect(isArticleUnipilePublishBlocked("linkedin_article" as never)).toBe(true);
    expect(isArticleUnipilePublishBlocked("post")).toBe(false);
    expect(isArticleUnipilePublishBlocked(undefined)).toBe(false);
  });
});
