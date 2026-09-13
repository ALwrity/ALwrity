export interface GuidelinesShape {
  tone_recommendations?: string[];
  structure_guidelines?: string[];
  vocabulary_suggestions?: string[];
  engagement_tips?: string[];
  audience_considerations?: string[];
  brand_alignment?: string[];
  seo_optimization?: string[];
  conversion_optimization?: string[];
}

export function hasArrayContent(items?: string[] | null): boolean {
  return Array.isArray(items) && items.length > 0;
}

interface RenderableExtras {
  bestPractices?: string[];
  avoidElements?: string[];
  contentTemplates?: unknown[];
  headlineFormulas?: unknown[];
  contentBriefs?: unknown[];
  competitiveAngles?: unknown[];
}

export function hasRenderableGuidelines(
  guidelines?: GuidelinesShape | null,
  extras?: RenderableExtras
): boolean {
  if (!guidelines) return false;

  const guidelineArrays = [
    guidelines.tone_recommendations,
    guidelines.structure_guidelines,
    guidelines.vocabulary_suggestions,
    guidelines.engagement_tips,
    guidelines.audience_considerations,
    guidelines.brand_alignment,
    guidelines.seo_optimization,
    guidelines.conversion_optimization,
  ];

  if (guidelineArrays.some(hasArrayContent)) return true;

  if (hasArrayContent(extras?.bestPractices)) return true;
  if (hasArrayContent(extras?.avoidElements)) return true;
  if ((extras?.contentTemplates?.length ?? 0) > 0) return true;
  if ((extras?.headlineFormulas?.length ?? 0) > 0) return true;
  if ((extras?.contentBriefs?.length ?? 0) > 0) return true;
  if ((extras?.competitiveAngles?.length ?? 0) > 0) return true;

  return false;
}
