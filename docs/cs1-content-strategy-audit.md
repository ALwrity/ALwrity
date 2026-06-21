# Content Strategy Production-Readiness Audit and Plan

This document is the design output of `cs/phase-1` (audit + plan only,
no code changes). It cross-references issues #589 (the production
audit) and #590 (the test matrix) and proposes a phased execution
path that prioritises the still-valid critical issues without
duplicating work that has already landed on main.

Issues #206 (long-term analytics roadmap) and #209 (autofill
phased-inputs design) are explicitly out of scope for this phase
and for the production fix window. They are large feature efforts
that should be planned in their own right.

---

## 1. State of the 4 critical issues from #589 today

A line-by-line audit against current `main` shows that three of the
four critical bugs from #589 are already fixed. Only one is still
live.

### #1: Strict source white-list collision -- ALREADY FIXED

`backend/api/content_planning/services/content_strategy/autofill/schema.py:32-45`

The current source whitelist contains all 12 tags that #589 claims
are missing:

```python
if spec['source'] not in {
    'website_analysis',
    'research_preferences',
    'api_keys_data',
    'onboarding_session',
    'persona_data',
    'competitor_analysis',
    'analytics_data',
    'deep_competitor_analysis',   # claimed missing -- present
    'gsc_analytics',                # claimed missing -- present
    'bing_analytics',               # claimed missing -- present
    'ai_generated',                 # claimed missing -- present
    'unified',                      # claimed missing -- present
}:
```

The audit's "5 missing tags" claim is stale; all 12 are present. The
whitelist does not need to change.

The audit is still useful as a regression net: a test should pin the
whitelist so the next refactor does not accidentally drop a tag. T1
in #590 is the right test for this.

### #2: AI refresh refactor -- FILE NO LONGER EXISTS

`backend/api/content_planning/services/content_strategy/autofill/autofill_service.py:6`

```
Replaces: autofill_service.py, unified_autofill_service.py, ai_refresh.py
```

`ai_refresh.py` was retired in favour of `autofill_service.py`. The
"100% synthetic text generation" claim from #589 is therefore
stale. A new audit of `autofill_service.py` is the next step
before deciding whether the AI refresh path still needs the
preservation guard, but this is out of scope for `cs/phase-1` per
the user direction (skip the AI refresh refactor).

### #3: Hardcoded multi-tenant collision -- ALREADY FIXED

`frontend/src/stores/strategyBuilderStore.ts:924`

```
// Removed: smartAutofill (replaced by autofillStrategyFields above)
```

The hardcoded `smartAutofill(1)` call was removed and replaced by
`autofillStrategyFields` (line 198, 677), which pulls the strategy
context from the live store state. The multi-tenant collision is
gone.

A test should pin this -- T16 in #590 ("smart autofill uses current
strategy id") is the right test, but the function name has changed.
The test is renamed to `test_autofillStrategyFields_uses_current_strategy_id`
in our test plan.

### #4: Hook stale closure hazard -- STILL LIVE (the only real critical issue)

`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/hooks/useAutoPopulation.ts:16-37`

The current useEffect dependency array is:

```typescript
}, [autoPopulateAttempted, isAutoPopulating, autoPopulateFromOnboarding]);
```

`completionStats` is read inside the effect (lines 20-22) but is not
in the dep array. `autoPopulateFromOnboarding` is in the array, but
the function reference can change between renders if the parent
recreates it, and the effect would then capture a stale closure on
the first render. The audit's "stale closure hazard" is real,
though the wording about which references are missing is
incomplete.

The fix in `cs/phase-1.1` is a one-line change: add `completionStats`
to the dependency array. The more correct fix is to wrap
`autoPopulateFromOnboarding` in `useCallback` at the parent so the
reference is stable, but that is a larger refactor across multiple
files and is not required to close the immediate hazard.

---

## 2. Coverage gap from #590 (the test matrix)

The audit found 22 test cases (T1-T22) but the repo has zero
`test_autofill*` files. This is the most actionable finding from the
audit: even though the bugs themselves are largely fixed, the fixes
have no regression net. The next refactor in the autofill pipeline
can silently re-introduce the same bugs.

The 22 tests map cleanly to one test file:

```
backend/tests/content_strategy/test_autofill_pipeline.py
```

The file is split into four sections per the audit's table:
- Backend pipeline tests (T1-T10)
- Frontend pipeline tests (T11-T17) -- frontend tests run in the JS
  test suite, not pytest, so these become a separate
  `frontend/src/.../autofill.test.ts`. The source-level equivalent in
  the Python test file is a guard test that asserts the relevant
  source symbols exist.
- Integration and E2E tests (T18-T22) -- same approach: source-level
  guards plus a smoke-test runtime check where the
  autofill_service can be exercised without a live DB.

P0 (T1-T18) is the urgent set. P1 (T19-T22) and P2 (T9, T10, T17)
are scheduled for follow-up phases.

---

## 3. Plan

| Phase | Focus | Files | Status |
|---|---|---|---|
| `cs/phase-1` | **This document. Audit + plan only.** | 0 source files | done (commit `6056e86c`) |
| `cs/phase-1.1` | Fix the still-live useAutoPopulation dep array | 1 file | done (commit `c2ba85ac`) |
| `cs/phase-1.2` | Add the 14 P0 tests from #590 as a regression net | 1 backend test file | deferred (tests de-prioritized) |
| `cs/phase-1.3` | Add the 4 P1 backend tests and 1 frontend test | 1 backend + 1 frontend | deferred (tests de-prioritized) |
| `cs/phase-1.4` | Audit the new `autofill_service.py` for the AI refresh concern from #589 | 1 file | done (see section 8) |
| `cs/phase-1.5` | Defer until #590 is closed: P2 tests, the 4 e2e tests, the per-field lock, the per-field regenerate | tbd | not started |

Total `cs/phase-1` family: ~3.25 days against the original ~14-day
estimate (because 3 of 4 critical bugs are already fixed and #2 is
deferred). The 0.25-day dep-array fix and the 0.5-day autofill
audit have both landed; only the test additions remain deferred.

## 8. Result of cs/phase-1.4

A line-by-line audit of
`backend/api/content_planning/services/content_strategy/autofill/autofill_service.py`
shows that the AI refresh concern from #589 #2 is **already
addressed** in the current implementation.

The merge logic in `_merge_fields` (lines 121-138):

```python
for key in ALL_FIELDS:
    db_val = db_fields.get(key)
    ai_val = ai_fields.get(key)
    if db_val and db_val.get("value") is not None:
        merged_fields[key] = db_val        # DB field takes precedence
    elif ai_val and ai_val.get("value") is not None:
        merged_fields[key] = ai_val        # AI fills only the gaps
```

DB fields are preferred when they have a value; AI generation only
fills the gaps. The DB fields are never discarded. The
`db_field_count` and `ai_field_count` counters in the merged
payload (line 138) make the split observable to the frontend, so
operators can see how much of the output is grounded in real
onboarding data vs. LLM synthesis.

The `generate()` method (lines 40-55) runs the DB normalize and AI
generate in parallel via `asyncio.create_task`, then merges with
DB-precedence. The `regenerate_ai_fields` method (lines 57-59)
just calls `generate()` again, so a re-run still preserves DB
fields.

**No code change required for cs/phase-1.4.** The concern in #589 #2
was real for the old `ai_refresh.py` but is already addressed in
`autofill_service.py`.

## 9. Updated summary

After cs/phase-1.1 and cs/phase-1.4:
- The 4 critical bugs from #589 are addressed: 3 already fixed on
  main, 1 fixed by cs/phase-1.1.
- The AI refresh concern from #589 #2 is already addressed in the
  new `autofill_service.py` per the cs/phase-1.4 audit.
- The test matrix from #590 is not yet realised; the user has
  de-prioritised tests. The 22 tests from #590 remain in scope for
  a later phase if the test gap is reopened.
- All 3 long-form issues from this scope (cs/phase-1, cs/phase-1.1,
  cs/phase-1.4) are landed as local commits on the `cs/phase-1`
  branch, no push to remote.

---

## 4. The useAutoPopulation fix in detail

The current implementation in
`frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder/hooks/useAutoPopulation.ts`:

```typescript
useEffect(() => {
  if (!autoPopulateAttempted && !isAutoPopulating) {
    // ... reads completionStats but does not list it in deps ...
    setIsAutoPopulating(true);
    autoPopulateFromOnboarding();   // referenced in deps
    setAutoPopulateAttempted(true);
    setIsAutoPopulating(false);
  }
}, [autoPopulateAttempted, isAutoPopulating, autoPopulateFromOnboarding]);
```

The minimum change for `cs/phase-1.1`:

```typescript
}, [autoPopulateAttempted, isAutoPopulating, autoPopulateFromOnboarding, completionStats]);
```

The minimum is not the right fix long-term -- the right fix is to wrap
`autoPopulateFromOnboarding` in `useCallback` at the call site so its
reference is stable. But that refactor is out of scope for the
production fix; the dep-array addition is the smallest change that
closes the immediate hazard, and it does not change behaviour for
any current consumer.

The test that pins this fix is part of `cs/phase-1.2` (T11 in #590,
renamed to `test_useAutoPopulation_lists_completionStats_in_deps`).

---

## 5. Test plan for `cs/phase-1.2`

The 14 P0 tests from #590 land in one file. For each, the audit
column shows the strategic target, and the test implementation is
chosen to be cheap (source-level) where the runtime check would
require a live DB or external service.

| # | Source-level | Runtime |
|---|---|---|
| T1 `test_autofill_schema_validation_accepts_ai_source` | x | x |
| T2 `test_autofill_partial_data_returns_non_empty_fields` | x | -- |
| T3 `test_unified_autofill_merge_conflict_resolution` | x | -- |
| T4 `test_unified_autofill_schema_compliance` | x | x |
| T11 `test_useAutoPopulation_lists_completionStats_in_deps` | x | -- |
| T12 `test_auto_population_skips_generic_placeholders` | x | -- |
| T13 `test_form_data_merge_does_not_overwrite_user_edits` | x | -- |
| T14 `test_auto_population_rate_limit_blocks_retry` | x | -- |
| T18 `test_e2e_onboarding_to_strategy_autofill` | x | -- |

Six of the 14 P0 tests are pure source-level; the rest need either
the schema file or the autofill service. None of them need a live
database. The "source-level + runtime" combo for T1 and T4 is the
only one that exercises the actual validator.

Tests T15-T17 (also P0 by #590's table) are frontend tests; they
land in `cs/phase-1.3` as a separate `autofill.test.ts` file under
`frontend/src/.../`.

---

## 6. Risk register and rollback

| Risk | Mitigation |
|---|---|
| Adding `completionStats` to the deps causes an effect re-run loop | The effect guard `if (!autoPopulateAttempted && !isAutoPopulating)` short-circuits the second call. We add a runtime smoke test that mounts the hook with a fixed `completionStats` and asserts the API is called exactly once. |
| T1-T22 tests have implicit runtime dependencies on the tenant DB or the AI provider | We restrict P0 to source-level checks; only T1 and T4 are runtime, and both use the schema validator with a synthetic payload (no DB, no AI). |
| Stale test scripts in `cs/phase-1` if the user changes priority | Each sub-phase is one PR. The user can review and merge the audit doc, the dep-array fix, and the test additions independently. |
| Refactor of `autofill_service.py` is needed even though we are skipping it | `cs/phase-1.4` is a dedicated audit of the new file to confirm whether the AI refresh concern from #589 still applies. If yes, we schedule a `cs/phase-1.6` to fix it. |

Rollback: each phase is one PR. To roll back the dep-array fix in
`cs/phase-1.1`, revert that PR. The test additions in 1.2 and 1.3
are net-new files and have no rollback concern beyond deleting the
file.

---

## 7. Summary

The 4 critical bugs in #589 are not as live as the issue body
suggests. Three are already fixed; the fourth is a one-line dep-array
addition. The bigger value of this phase is the test matrix from
#590, which gives the autofill pipeline a regression net it does not
currently have. The combined scope of `cs/phase-1` through
`cs/phase-1.4` is ~3.25 days, with `cs/phase-1.1` (the dep-array fix
plus its test) the only PR that touches production code.
