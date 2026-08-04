/**
 * Toolbar image-generation seed helpers (publish popover / POST IMAGE flow).
 * Aligns with editor text-selection flow: full formatted draft, not a 200-char slice.
 */

import {
  buildPromptFromSelection,
  resolveLinkedInImageSeedText,
} from '../../../services/linkedInImageService';
import { formatDraftForPublish } from './linkedInPublishFormatters';

export interface LinkedInToolbarImageSeedResult {
  seedText: string;
  prompt: string;
}

/**
 * Build seed text and initial prompt from a publish draft (toolbar "Generate with AI").
 */
export function buildToolbarImageSeedFromDraft(
  draft: string,
  topic?: string,
  industry?: string,
): LinkedInToolbarImageSeedResult {
  try {
    const plainText = formatDraftForPublish(draft);
    const seedText = resolveLinkedInImageSeedText(plainText);
    const prompt = buildPromptFromSelection(seedText, topic, industry);

    console.debug('[LinkedInToolbarImageSeed] built seed from draft', {
      draftLength: draft.length,
      plainLength: plainText.length,
      seedLength: seedText.length,
      hasTopic: Boolean(topic),
      hasIndustry: Boolean(industry),
    });

    return { seedText, prompt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '[LinkedInToolbarImageSeed] failed to build seed from draft',
      { draftLength: draft?.length ?? 0, error: message },
    );
    const seedText = resolveLinkedInImageSeedText('');
    return {
      seedText,
      prompt: buildPromptFromSelection(seedText, topic, industry),
    };
  }
}
