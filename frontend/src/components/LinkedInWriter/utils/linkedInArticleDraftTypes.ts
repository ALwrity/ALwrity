/**
 * Shared LinkedIn article draft types (avoids circular imports between utils).
 */

import type { ImageSuggestion } from "../../../services/linkedInWriterApi";
import type { LinkedInEditorImageBlock } from "./linkedInEditorDraftUtils";

export interface LinkedInArticleSection {
  id: string;
  heading: string;
  body: string;
}

export interface LinkedInArticleDraftState {
  title: string;
  intro?: string;
  sections: LinkedInArticleSection[];
  /** @deprecated Use `images` — migrated on load. */
  coverImageUrl?: string;
  images?: LinkedInEditorImageBlock[];
  imageSuggestions: ImageSuggestion[];
  readingTime?: number;
  seoMetadata?: Record<string, unknown>;
}

export function createArticleSectionId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
