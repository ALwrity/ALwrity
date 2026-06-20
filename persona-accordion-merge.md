# Design: Merge the Persona Quality + Evidence Accordions

**Status:** Phase 1 (planning) — no code yet
**Authors:** opencode (audit + proposal), with user review
**Last updated:** 2026-06-20

## Background

The Step 4 persona preview currently surfaces three places where the user
sees a percentage score or "quality" indicator:

1. **"Identity & Brand Voice" accordion header** — chip with `X% Quality`
   (renders `qualityMetrics.overall_score`).
2. **"How well did we capture your voice?" accordion** — chip with the
   same `overall_score` + a `QualityMetricsDisplay` body (4 sub-scores:
   Brand Voice Accuracy, Platform Consistency, Platform Optimization,
   Linguistic Quality).
3. **"How we built this persona" accordion** — chip with `X% confidence`
   (blended from `persona.confidence` 60% + `completeness.structural_score`
   40%, with a gap count) + the evidence layer (Why-this-name / Why-this-
   archetype / verbatim phrases / data gaps).

Places (1) and (2) show the same number. Places (2) and (3) live
side-by-side with different numbers, different framings, and different
purposes — which the user finds confusing.

## Why merge (and not just delete one)

The evidence layer provides real value the quality score alone doesn't:

- Links each persona claim to a specific data source (Why-this-name / etc.)
- Surfaces verbatim phrases the LLM lifted from the user's own content
- Honestly reports which data sections were empty (so the user can fill them)
- Blends LLM self-rated confidence with structural completeness for a
  calibrated "is this a guess or a grounded claim?" signal

Dropping the evidence layer would re-introduce the black-box problem the
"Your Core Writing Style" Phase 1 plan set out to fix.

## Target shape

A single accordion titled **"How we built this persona"** (name kept) with
this structure:

```
┌─────────────────────────────────────────────────────────────┐
│ [icon] How we built this persona?                           │
│        Output quality, evidence, and data gaps.             │
│        85% output quality · 85% confidence · 5 gaps [chip]  │
├─────────────────────────────────────────────────────────────┤
│ ▼ (expanded)                                                │
│                                                             │
│  1. Output quality                                          │
│     ┌─────────────────────────────────────────────────┐    │
│     │ 4 sub-scores (cards / rows):                    │    │
│     │   - Brand Voice Accuracy   (30% of overall)     │    │
│     │   - Platform Consistency   (25% of overall)     │    │
│     │   - Platform Optimization  (25% of overall)     │    │
│     │   - Linguistic Quality     (20% of overall)     │    │
│     │ Each with: value, weight, "what this means",     │    │
│     │ "how derived", and a tooltip.                   │    │
│     │ Bottom: overall_score as the section's headline  │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│  2. Confidence & evidence                                   │
│     ┌─────────────────────────────────────────────────┐    │
│     │ - Persona confidence progress bar                │    │
│     │   (blended: 60% LLM, 40% structural)            │    │
│     │ - "Why the AI said what it said"                 │    │
│     │   4 Why-rows: name / archetype / belief / tone  │    │
│     │   with per-question icons                       │    │
│     │ - "Phrases the AI lifted from your content"     │    │
│     │   chip array (verbatim_phrases_used)            │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│  3. Data we didn't have                                     │
│     ┌─────────────────────────────────────────────────┐    │
│     │ - Amber section with "N gaps" chip in header    │    │
│     │ - Chips: "we didn't have brand voice analysis"  │    │
│     │   (normalized via missingLabel() helper)        │    │
│     │ - "Add this data →" CTA (custom event)          │    │
│     │ - OR green "no gaps reported" positive state    │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Locked decisions (from user)

| Decision | Value |
|---|---|
| Accordion title | **"How we built this persona"** (kept) |
| Header chip format | `X% output quality · Y% confidence · N gaps` (two scores + gap count) |
| Existing persona-header "X% Quality" chip | **Drop** (the new accordion's chip replaces it) |
| Default expand state | **Collapsed** (matches current behavior) |

## Implementation phases

### Phase 1 — Plan (this doc)

- Lock the merge contract above
- No code changes
- User review

### Phase 2 — Build behind a feature flag

- New file: `frontend/src/components/OnboardingWizard/PersonaStep/sections/HowWeBuiltThisPersona.tsx`
- Move the contents of `EvidenceAccordion.tsx` and the accordion shell
  of `QualityMetricsDisplay.tsx` into it
- Sub-section 1 renders the existing 4 quality sub-scores (no new
  math, just a moved shell)
- Sub-section 2 renders the existing evidence layer (confidence bar +
  Why-rows + phrases chips)
- Sub-section 3 renders the existing data-gaps section (with the
  `missingLabel()` fix from PR #732)
- `PersonaPreviewSection.tsx` gains a `useFeatureFlag('merged-persona-evidence-accordion')` guard
- When flag is on: render the new component
- When flag is off: render the existing 2 accordions (current behavior)
- Tests: render the new component with realistic persona +
  completeness + quality metrics; assert all 3 sub-sections render, the
  chip shows the right numbers, and the gap count is correct

### Phase 3 — Migrate and clean up

- Flip the feature flag on by default
- Delete `EvidenceAccordion.tsx` (or keep as internal helper if reused)
- Inline the `QualityMetricsDisplay` accordion shell into the new
  component (or keep as a sub-component called from the new one)
- Remove the persona-header "X% Quality" chip from
  `PersonaPreviewSection.tsx`
- Remove the `EvidenceAccordion` + `QualityMetricsDisplay` imports
- Update tests; remove obsolete tests for the deleted components
- Type-check + smoke-test on a regenerated persona

### Phase 4 — Polish based on real usage

- Add an "expand by default" toggle if the merged accordion proves
  too hidden
- Add a "Pin / collapse all" button so users can scan the 5+1 persona
  accordions quickly
- Confirm the existing `alwrity:navigate-to-step` event from the
  "Add this data →" CTA still works in the new layout
- Re-test: regenerate a persona with rich data, regenerate one with
  thin data, screenshot both
- Re-test: the green "no gaps reported" positive state from PR #732
  still renders

## Risks

- **Phase 2 (feature flag)** — if the new component has a bug, the
  flag flips off and the user is back to the old behavior. No risk
  to production.
- **Phase 3 (delete old code)** — if anything still imports
  `EvidenceAccordion` or `QualityMetricsDisplay` from the deleted
  file paths, TypeScript will catch it. The `tsc --noEmit` gate
  is sufficient.
- **The persona-header chip drop** — some users may be used to seeing
  the at-a-glance number in the header. The merged accordion's
  header chip replaces it (and shows more info), but the visual
  position changes. Worth screenshotting before/after.

## Out of scope

- Renaming the persona sub-accordions (1-5) — separate concern
- Adding more quality dimensions to the 4 sub-scores — out of scope
- Restructuring the persona display beyond accordion 6 — separate work
- The PR #729 (LinkedIn Unipile) work — orthogonal

## Test plan

- **Unit tests:** all the existing tests for `EvidenceAccordion` and
  `QualityMetricsDisplay` should still pass after Phase 2 (the new
  component reuses the same logic).
- **New tests:** render the merged component with three personas
  (rich data, thin data, no data) and assert the chip + sub-sections
  render correctly.
- **Manual:** regenerate a persona, expand the merged accordion,
  verify:
  - Chip shows two scores + gap count
  - Output quality sub-section shows 4 sub-scores with their weights
  - Confidence & evidence sub-section shows the progress bar + 4 Why-rows + phrases
  - Data we didn't have sub-section shows gaps OR green "no gaps" state
  - "Add this data →" CTA still emits `alwrity:navigate-to-step`
- **Regression:** persona-header no longer shows the old "X% Quality"
  chip (this is the only visual change outside the merged accordion)
- **Accessibility:** accordion remains keyboard-navigable, focus
  indicators intact, screen-reader labels describe all 3 sub-sections

## Open questions

None currently. The plan above is ready for review. If anything looks
off, push back before Phase 2 starts.
