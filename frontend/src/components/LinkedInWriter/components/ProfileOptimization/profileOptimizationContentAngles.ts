/** Target count shown in the Optimise Profile content-angles card. */
export const PROFILE_CONTENT_ANGLES_TARGET = 5;

function normalizeAngle(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Build up to {@link PROFILE_CONTENT_ANGLES_TARGET} display angles for the modal.
 * Prefer AI writing_opportunities; pad from profile intelligence fields when sparse.
 */
export function resolveContentAnglesForDisplay(
  writingOpportunities: string[] | null | undefined,
  knowledgeDomains: string[] | null | undefined,
  primaryExpertise: string[] | null | undefined,
  targetAudience: string[] | null | undefined,
  targetCount: number = PROFILE_CONTENT_ANGLES_TARGET,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const append = (value: string | null | undefined) => {
    if (!value || result.length >= targetCount) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = normalizeAngle(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };

  for (const opportunity of writingOpportunities ?? []) {
    append(opportunity);
  }
  for (const domain of knowledgeDomains ?? []) {
    append(domain);
  }
  for (const expertise of primaryExpertise ?? []) {
    append(expertise);
  }
  for (const audience of targetAudience ?? []) {
    append(audience);
  }

  return result;
}
