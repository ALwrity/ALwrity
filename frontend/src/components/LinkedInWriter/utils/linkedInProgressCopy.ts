/**
 * Content-type-aware copy for LinkedIn Studio ProgressTracker modal.
 */

import type { LinkedInDraftContentType } from "./linkedInDraftLibraryUtils";
import { normalizeDraftContentType } from "./linkedInDraftContentTypeStorage";

export const DEFAULT_PROGRESS_CONTENT_TYPE: LinkedInDraftContentType = "post";

const HEADER_SUBTITLE_ACTIVE =
  "AI is researching, writing, and optimizing your content with source-backed citations.";
const HEADER_SUBTITLE_ERROR =
  "Something went wrong during generation. Please try again.";

export const POST_STEP_EDUCATION: Record<string, string> = {
  personalize:
    "Analyzing your topic, industry, and audience to craft a personalized content strategy that resonates with your LinkedIn network.",
  prepare_queries:
    "Building intelligent research queries to surface the most relevant, authoritative sources for your content.",
  research:
    "Searching trusted sources for statistics, trends, case studies, and real-world insights to make your content credible and data-backed.",
  grounding:
    "Cross-referencing every claim and data point against original sources — ensuring your post is accurate and authoritative.",
  content_generation:
    "Writing your LinkedIn post with a strong hook, scannable formatting, professional tone, and engagement-driving elements tailored to your voice.",
  citations:
    "Adding visible source citations to factual claims — building transparency and credibility with your professional audience.",
  quality_analysis:
    "Reviewing your content for engagement potential, readability, LinkedIn best practices, and alignment with your chosen tone and persona.",
  finalize:
    "Applying final formatting, hashtag suggestions, and platform-specific optimizations — your content is almost ready!",
};

export const ARTICLE_STEP_EDUCATION: Record<string, string> = {
  personalize:
    "Analyzing your topic, industry, and audience to shape a thought-leadership angle and article structure for LinkedIn readers.",
  prepare_queries:
    "Building intelligent research queries to surface authoritative sources for long-form article depth.",
  research:
    "Searching trusted sources for statistics, trends, and expert insights to support a credible, in-depth article.",
  grounding:
    "Cross-referencing every claim and data point against original sources — ensuring your article is accurate and authoritative.",
  content_generation:
    "Writing your LinkedIn article with clear sections, headings, and scannable structure suited to long-form reading.",
  citations:
    "Adding visible source citations to factual claims — building transparency and credibility with your professional audience.",
  quality_analysis:
    "Reviewing structure, readability, SEO-friendly flow, and alignment with your tone and persona.",
  finalize:
    "Polishing the title, section flow, and reading experience — your article is almost ready!",
};

/** Resolve progress modal content type; article/post only for copy maps — others use post. */
export function resolveProgressContentType(
  raw: unknown,
): LinkedInDraftContentType {
  const normalized = normalizeDraftContentType(raw);
  if (normalized === "article") return "article";
  return DEFAULT_PROGRESS_CONTENT_TYPE;
}

export function getProgressStepEducation(
  stepId: string,
  contentType: LinkedInDraftContentType,
): string {
  const map =
    contentType === "article" ? ARTICLE_STEP_EDUCATION : POST_STEP_EDUCATION;
  return map[stepId] ?? "";
}

export function getProgressHeaderTitle(options: {
  active: boolean;
  hasError: boolean;
  contentType: LinkedInDraftContentType;
}): string {
  const { active, hasError, contentType } = options;
  if (hasError) return "Generation Failed";
  if (active) {
    return contentType === "article"
      ? "Generating Your Article"
      : "Generating Your Post";
  }
  return "Content Ready";
}

export function getProgressHeaderSubtitle(options: {
  active: boolean;
  hasError: boolean;
  contentType: LinkedInDraftContentType;
}): string {
  const { active, hasError, contentType } = options;
  if (hasError) return HEADER_SUBTITLE_ERROR;
  if (active) return HEADER_SUBTITLE_ACTIVE;
  return contentType === "article"
    ? "Content generation complete — your article is ready below."
    : "Content generation complete — your post is ready below.";
}

export function getProgressCompletionFooter(
  contentType: LinkedInDraftContentType,
): string {
  return contentType === "article"
    ? "✓ Your LinkedIn article is ready — check it out below"
    : "✓ Your LinkedIn post is ready — check it out below";
}

export function getProgressActiveFooterTip(
  contentType: LinkedInDraftContentType,
): string {
  return contentType === "article"
    ? "Each step uses AI research with real citations — your article will be structured for depth and credibility."
    : "Each step uses AI research with real source citations — your audience gets data-backed, trustworthy content.";
}
