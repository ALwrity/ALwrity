=== Plan Review: Gaps and Improvements ===

## Phase 1 - CORRECTNESS (CONFIRMED IMPLEMENTED)

**Verified facts (code):**
- HeaderSection.tsx:119 uses `const dataQualityScore = dataQuality;` (no fabrication)
- ContentStrategyBuilder.tsx:337-346 computes `dataQualityPercent` from `pipelineDataQuality?.overall_score`
- autofill_service.py:127,171 returns `data_quality` in the response
- 5 strategic categories confirmed in STRATEGIC_INPUT_FIELDS config

## Phase 2 - Gaps

**G2-1 (A2 plan bug):** "Onboarding sources: N" using `new Set(Object.values(dataSources)).size`
- ACTUAL: dataSources values are ACTION TYPES ("autofill", "ai_generated", "onboarding"), not source documents
- Real distinct sources = the action types (~3-4), not "onboarding sources"
- Fix: rename to "Field sources: N" or "Source types: N" (database icon), or expose a separate field from the backend

**G2-2 (real categories progress):** plan uses reviewedCategories from useCategoryReview
- hook returns `Set<string>` and `isMarkingReviewed: boolean` - both available
- 5 categories confirmed (audience_intelligence, business_context, competitive_intelligence, content_strategy, performance_analytics)
- Need to THREAD `reviewedCategories` (and the 5-category list) to HeaderSection via props
- Also need progress bar between Row 1 and Row 2 (per plan) but the real "5 of 5" count is already exposed via `reviewedCategoriesCount`

**G2-3 (dead button location):** "Continue with Present Values" is in ContentStrategyBuilder.tsx:362-365 (NOT HeaderSection)
- Handler: `console.log("Continuing with present autofilled values")`
- Plan says "delete the chips row entirely" but this is a BUTTON, not a chip - target the right file

## Phase 3 - Gaps

**G3-1 (handleScrollToReview scope):** plan says "scrolls to first unreviewed category"
- ACTUAL: existing handler scrolls to `reviewSectionRef` (the review SECTION, not a specific category)
- Need a NEW handler `handleScrollToNextUnreviewedCategory` that:
  1. Reads `reviewedCategories` (Set<string>) and STRATEGIC_INPUT_FIELDS categories list
  2. Finds the first category NOT in reviewedCategories
  3. Calls `setActiveCategory(thatCategory)` + scrollIntoView on that category's ref
- Also need per-category refs (CategoryList or CategoryDetailView must forward refs)

**G3-2 (toast infrastructure missing):** plan adds "success toast" after strategy creation
- Project has NO useSnackbar / notistack / sonner
- Existing: useDashboardStore has `snackbar` state + `showSnackbar` action
- Fix: use existing `showSnackbar(message, severity)` from useDashboardStore - no new dep

**G3-3 (CTA copy adaptation):** plan says "primary CTA label adapts"
- Need to verify the "Create Strategy" label doesn't conflict with `originalHandleCreateStrategy` flow
- The existing label "Review Strategy Inputs & Create Strategy" (sentence) IS confusing - confirm the new adaptive label

## Cross-phase gaps (plan doesn't address)

**X-1 (accessibility):** HeaderSection uses gradient TEXT on gradient BACKGROUND (line 161-165)
- WebkitBackgroundClip: text + gradient on body + white text fill = contrast risk
- Add WCAG AA check: 4.5:1 contrast ratio for body text, 3:1 for large text
- Compact redesign should fix this

**X-2 (prefers-reduced-motion):** line 145 has `animation: shimmer 3s ease-in-out infinite`
- No `prefers-reduced-motion` media query guard
- Plan doesn't mention this - should add the @media guard when compacting

**X-3 (tooltip overload):** every stat card has a Tooltip; new compact design needs to decide: keep one Tooltip, one "Why these numbers?" link, or none (with numbers self-explanatory)

**X-4 (error state):** plan doesn't address what the banner shows when:
- autofill fails (error state) - show retry CTA
- backend unreachable - show network error
- session expires - show re-auth CTA
- Currently the banner just shows 0% / 0 fields with no error context

**X-5 (real-time updates):** reviewedCategories is localStorage-persisted; on page reload, the banner must read it
- useCategoryReview loads from localStorage on mount - good
- But HeaderSection only updates when prop changes - need to ensure reviewedCategories prop is threaded correctly

**X-6 (label inconsistency):** line 476-481 "10 categories" chip TOOLTIP says "5 strategic categories"
- Internal contradiction the plan should call out for BOTH a count fix AND a label fix
- Or better: the chip should show "5 of 5 reviewed" directly, no tooltip needed

**X-7 (mobile/responsive):** plan mentions "Target banner height ~200px" but doesn't address mobile
- Grid `xs={6} sm={3}` means 2x2 on mobile - need 1x4 or different layout for small screens
- Gradient/shimmer may not render well on low-end devices

**X-8 (redundancy):** "10 Fields Auto-populated" card and "10 fields auto-populated" chip are redundant
- Also: "10 of 30" appears in the compact stats strip plan - need to ensure only one place shows this

**X-9 (persist progress to backend):** reviewedCategories lives in localStorage only
- If user clears browser data, they lose all review progress
- Long-term: persist to backend (user_preferences table or strategy state)
- For this PR: document as future work

## Test gaps (plan doesn't address)

**T-1:** No test for HeaderSection component (vitest)
- Phase 1+2 changes to dataQuality prop, sources count, categories count - no test
- Should add: HeaderSection.test.tsx with props-driven tests for each stat card

**T-2:** No test for the new compact layout (Phase 2)
- Should add: snapshot test for the new 2-row + actions layout

**T-3:** No test for context-aware CTA (Phase 3)
- Should add: render with various reviewedCategories states, assert CTA label
- Should add: click test for handleScrollToNextUnreviewedCategory (if added)

**T-4:** Backend dataQuality is in the response but no test for it
- autofill_service.py:127,171 returns data_quality - no test asserts the shape
- backend/tests/api/test_onboarding_summary.py covers onboarding endpoint, but not autofill
- Should add: autofill response shape test (data_quality field present and well-formed)
