# LinkedIn Studio — Optimize Profile Usability

Three low-hanging improvements to the LinkedIn Studio Optimize Profile flow that turn the existing suggestion list into an actionable, prioritized todo. No new endpoints, no new LLM cost, no breaking schema changes.

## Features

### 1. "Edit on LinkedIn" deep-link button
Each `ProfileOptimizationCard` now renders a per-section deep-link that opens the relevant LinkedIn editor URL in a new tab.

Mappings: `headline`, `summary`, `profile_photo`, `custom_url`, `experience`, `skills`, `recommendations`, `education`, `certifications`, `featured`.

Removes 4 manual navigation steps (open profile > click pencil > pick section) per recommendation. The user copies the suggested text, clicks the link, pastes. Done.

### 2. Per-section score breakdown
A 10-row breakdown of the rubric score per profile section (Profile photo, Headline, Custom URL, Summary, Experience, Skills, Recommendations, Education, Certifications, Featured).

- New `compute_section_scores()` in `profile_optimization_rubric.py` returns 0-100 per section from detected gaps. Same severity-weighted penalty logic as the global score, applied per section.
- Surfaced as `section_scores` in the `ProfileValidationResult` TypedDict, the `ProfileValidationResponse` Pydantic model, and the `LinkedInProfileValidation` TypeScript interface. Optional field with `None` default — backward compatible.
- New `SectionScoresPanel` component renders the breakdown with color-coded scores (green >= 80, amber 50-79, red < 50) and a "N actions" badge on sections that have active recommendations in the current batch.
- Bonus: fixed a minor inconsistency where the Python TypedDict's `score_basis` literal was missing `"rubric_with_progress"`.

### 3. Re-check my profile (live verify)
Closes the accountability loop on the existing "Mark as done" / "Skip" actions.

- New `recheckProfile()` in `useLinkedInProfileOptimization` calls the existing `GET /api/linkedin-social/profile` endpoint with `refresh=true` (re-fetches from Unipile, re-runs the rubric, keeps LLM cache).
- `recheckDelta` state captures the previous and new score and renders a dismissable inline banner. Green if score improved, amber otherwise, with a one-line explanation.
- Pairs the existing `+3` progress boost with a real verification path. Users who mark items done without actually changing LinkedIn no longer auto-climb to 100% — the re-check will reveal the gap.

## Files changed (11 files, +516 / -3)

### Backend
- `backend/api/linkedin_social_routes.py` — surface `section_scores` in the validation response mapper
- `backend/models/linkedin_social_models.py` — add `section_scores` field to `ProfileValidationResponse`
- `backend/services/integrations/linkedin/profile_optimization_rubric.py` — add `compute_section_scores()` and `PROFILE_SECTIONS` constant
- `backend/services/integrations/linkedin/profile_validation_types.py` — add `section_scores` to `ProfileValidationResult` TypedDict; fix `score_basis` literal

### Frontend
- `frontend/src/api/linkedinSocial.ts` — add `section_scores` to `LinkedInProfileValidation`; add `refreshProfile` option to `runLinkedInProfileOptimization`
- `frontend/src/components/LinkedInWriter/components/ProfileCompletion/LinkedInProfileSetupPanel.tsx` — wire `publicIdentifier` and `section_scores` into the optimization panel
- `frontend/src/components/LinkedInWriter/components/ProfileOptimization/ProfileOptimizationCard.tsx` — `getLinkedInEditorUrl()` helper + "Edit on LinkedIn" link button
- `frontend/src/components/LinkedInWriter/components/ProfileOptimization/ProfileOptimizationPanel.tsx` — render `SectionScoresPanel`, re-check button, re-check delta banner
- `frontend/src/components/LinkedInWriter/components/ProfileOptimization/SectionScoresPanel.tsx` (new) — the 10-row breakdown component
- `frontend/src/hooks/useLinkedInProfileCompletion.ts` — expose `profile` from the foundation hook
- `frontend/src/hooks/useLinkedInProfileOptimization.ts` — `recheckProfile()`, `recheckDelta` state, `dismissRecheckDelta()`

## Risk and roll-out

- **Risk: low.** All changes are additive. The new `section_scores` field is optional with `None` default, so older API responses still validate.
- **No migration needed.** The DB schema is unchanged. Existing profile validation rows are read-only and will be regenerated on the next profile fetch.
- **No new LLM calls.** The re-check flow reuses the cached LLM recommendations. Only the rubric (deterministic) and the profile fetch (Unipile) re-run.
- **Feature flag:** none. Ship and observe.

## Test plan

- [ ] Connect LinkedIn, complete profile, click "Optimize Profile"
- [ ] Confirm "Edit on LinkedIn" button appears with the correct editor URL per section (headline, summary, skills, experience, etc.)
- [ ] Confirm per-section scores render with the right colors (green >= 80, amber 50-79, red < 50)
- [ ] Confirm "N actions" badges appear on sections that have active recommendations
- [ ] Mark an item done, click "Re-check my profile", confirm the banner shows the score delta
- [ ] Confirm the header ticker updates after re-check (event bus works)
- [ ] Confirm the rubric-only re-check is fast (< 2 seconds for a typical profile)
- [ ] No TypeScript errors, no Python errors

## Related docs

- `docs/OPEN_CORE_DUAL_REPO.md` — the open-core workflow that brought this PR to the prod repo
- `docs/ALwrity_vision.md` — the broader product vision
- `docs/linkedin/LinkedIn_Style.md` — the LinkedIn style guide
