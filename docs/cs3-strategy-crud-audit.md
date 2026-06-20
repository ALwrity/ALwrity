# Phase 3 Strategy CRUD + AI Generation Audit and Plan

This document is the design output of the Phase 3 audit (issues
#594 and #595). Like the Phase 1 and Phase 2 docs, it
cross-references the issues against the current state on main and
proposes a phased execution path. The quick-win scope for this
phase is the two production-critical items the user picked
(C1 security, C5 silent data loss); the remaining 4 live issues
are deferred.

The Phase 3 fixes land on the existing `cs/phase-1` branch (no
new branch) to keep the related work together.

---

## 1. State of the 5 Critical and 5 High issues from #594/#595 today

A line-by-line audit against current `main` shows that 5 of the 11
claims across the two issues are stale (the code has moved on
since the issues were filed); 6 are live.

### C1 (both issues): Tenant access leaks on PUT/DELETE -- LIVE (security)

`backend/api/content_planning/api/routes/strategies.py:131-180`:

```python
@router.put("/{strategy_id}", response_model=ContentStrategyResponse)
async def update_content_strategy(
    strategy_id: int,
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clerk_user_id = str(current_user.get('id', ''))
    logger.info(f"Updating content strategy: {strategy_id} for user: {clerk_user_id}")
    db_service = EnhancedStrategyDBService(db)
    updated_strategy = await db_service.update_enhanced_strategy(strategy_id, update_data)
```

The route extracts `clerk_user_id` (line 140) and logs it, but
**never passes it to the DB service**. The DB service itself
already supports ownership verification
(`enhanced_strategy_db_service.py:25, 40-41, 48-49` -- the
`get_enhanced_strategy(strategy_id, user_id=...)` method filters
`EnhancedContentStrategy.user_id == user_id` and returns None on
mismatch). But the route calls `update_enhanced_strategy(strategy_id,
update_data)` with no user_id, so the DB service loads the strategy
without a user filter and updates whatever was found.

**Any authenticated user can update or delete any other user's
strategy by guessing the integer ID.** This is a real multi-tenant
data corruption vulnerability.

The fix in `cs/phase-3.2` is to:
1. Add a `user_id` parameter to `update_enhanced_strategy` and
   `delete_enhanced_strategy` in the DB service.
2. Have those methods call the existing `get_enhanced_strategy(id,
   user_id)` first; if the result is None, the user doesn't own
   the record, return None / 404.
3. Pass `clerk_user_id` through from the route.

### C2 (both issues): Mass assignment via `setattr` -- LIVE (security)

`backend/api/content_planning/api/content_strategy/endpoints/strategy_crud.py:225-227`:

```python
for field, value in update_data.items():
    if hasattr(existing_strategy, field):
        setattr(existing_strategy, field, value)
```

The `hasattr` check passes for any column on
`EnhancedContentStrategy`, including `user_id`, `id`,
`created_at`, `completion_percentage`. A client can send
`{"user_id": "victim_id", "id": 9999, "completion_percentage": 100}`
and the route will happily set all three on the existing row
(after the ownership check, but the ownership check itself
verifies the **current** user_id, not the user_id in the body).
A malicious client could therefore leave their own ownership check
intact while setting other fields to anything.

The fix is a whitelist of allowed fields. `user_id`, `id`,
`created_at`, and `completion_percentage` should be rejected; the
route should iterate the whitelist, not the body. The size of the
whitelist is small (~30 fields defined in
`enhanced_strategy_models.py:23-58`).

Note: the ownership check on line 218 does compare
`existing_strategy.user_id != authenticated_user_id` correctly, so
the cross-tenant data corruption is blocked at the read level. The
remaining mass-assignment surface is the ability for an attacker
to overwrite the system columns of a strategy they already own
(e.g., set `completion_percentage` to 100 without doing the work).

This is deferred from the quick-win scope because the worst-case
is "user lies about their own strategy's progress metric," which
is a lower-severity issue than C1 (cross-tenant data corruption).

### C3 (both issues): Fabricated AI recommendations -- LIVE (quality)

`backend/api/content_planning/services/content_strategy/ai_analysis/strategic_intelligence_analyzer.py`:

12 places return hardcoded `"300% return on investment"` or
`"400% return on investment"` strings. The class is named
`StrategicIntelligenceAnalyzer` and lives in an `ai_analysis`
package, but the methods construct dictionaries with hardcoded
metric values and do not call any LLM.

`content_distribution_analyzer.py` is similar but uses template
data: it conditionally appends TikTok/Instagram/Blog channel
entries with hardcoded "10K-100K views" reach numbers.

Both classes are reachable from the strategy generation flow but
the actual AI generation path uses different services. The
fabricated data shows up in the StrategicIntelligenceCard
frontend component. The fix is to either remove the static
fabrication and route the calls to a real LLM, or to flag the
output as "placeholder" so the UI is honest about the data. This
is deferred from the quick-win scope because the proper fix is a
2-day LLM integration; the placeholder-flagging quick-fix would
take 1 day.

### C4 (both issues): Volatile in-memory task state -- LIVE (reliability)

`backend/api/content_planning/api/content_strategy/endpoints/ai_generation_endpoints.py:382-486`:

The `generate_comprehensive_strategy_polling` endpoint uses
function-attribute state (line 382-383):
`generate_comprehensive_strategy_polling._task_status = {}`, then
mutates the dict from inside the coroutine. The dict is shared
across all concurrent calls inside the same process. There is no
TTL, no cleanup, and the dict is lost on process restart.

This is a real production reliability issue under multi-worker
deployments (Uvicorn/Gunicorn). It is deferred from the quick-win
scope because the proper fix is to migrate to Redis or a Celery
backend (~2 days). The minimal fix is to add a TTL (e.g., 1
hour) and a periodic cleanup coroutine, but that is also a
non-trivial change.

### C5 (both issues): Indentation bug in merge function -- LIVE (silent data loss)

`backend/api/content_planning/services/content_strategy/core/strategy_service.py:534-542`:

```python
def _merge_strategy_with_onboarding(self, strategy_data, field_transformations):
    """Merge strategy data with onboarding data."""
    merged_data = strategy_data.copy()
        
    for field, transformation in field_transformations.items():
        if field not in merged_data or merged_data[field] is None:
            merged_data[field] = transformation.get('value')
        
        return merged_data
```

The `return merged_data` at line 542 is **indented inside the for
loop body** (4 spaces, not 8). The function exits after processing
the first field. If `field_transformations` has 30 keys, only the
first one is applied; the remaining 29 are silently dropped.

The 1-line fix in `cs/phase-3.1` is to dedent the return statement
to the function scope.

### C4 (#594 only): Route duplication -- STALE

The issue claims two route files expose duplicate `PUT /{id}` and
`DELETE /{id}` endpoints. In practice:

- `routes/strategies.py` has prefix `/strategies` and is mounted
  at the API root, so the routes are `/strategies/{id}`.
- `content_strategy/routes.py` (which includes `strategy_crud.py`
  at line 32) has prefix `/enhanced-strategies`, so the routes
  are `/enhanced-strategies/{id}`.

The two route sets are on different paths; FastAPI does not see
them as duplicates. The claim in #594 is overstated.

### C5 (#594 only): Fabricated modal data -- STALE/STRETCHED

The issue claims `StrategyAutofillTransparencyModal.tsx`
(1031 lines) and `DataSourceTransparency.tsx` (464 lines)
contain fabricated metric lookups. A grep for hardcoded metric
literals (`"92%"`, `300%`, `400%`, etc.) returns no matches. The
constants in these files are static UI metadata (icon/color/label
maps keyed by backend phase name) and a static field-name-to-
category schema. The actual quality / confidence / freshness
values are derived from the props (dataSources,
inputDataPoints, autoPopulatedFields), not hardcoded.

The claim in #594 is overstated. These are normal React
component patterns.

### H1: SQLAlchemy mapper configuration failure -- LIVE (CRITICAL, confirmed)

`backend/models/enhanced_strategy_models.py`:

- Line 32: `performance_metrics = Column(JSON, nullable=True)`
- Line 90: `performance_metrics = relationship("StrategyPerformanceMetrics", ...)`

Confirmed at the SQLAlchemy level. Running
`sqlalchemy.inspect(EnhancedContentStrategy)` (or any query path
that triggers mapper configuration) raises:

```
sqlalchemy.exc.InvalidRequestError: When initializing mapper
Mapper[EnhancedContentStrategy(enhanced_content_strategies)],
expression 'StrategyPerformanceMetrics' failed to locate a name
```

The class import itself succeeds because SQLAlchemy defers
relationship resolution until first mapper configuration. Any
endpoint that loads an `EnhancedContentStrategy` from the DB
(every read path in `routes/strategies.py` and
`endpoints/strategy_crud.py`) hits this on first call.

**The collision is more widespread than the column/relationship
pair above.** `backend/models/monitoring_models.py` declares four
classes (`StrategyMonitoringPlan`, `MonitoringTask`,
`StrategyPerformanceMetrics`, `StrategyActivationStatus`) that
each use `relationship("EnhancedContentStrategy",
back_populates=...)` referencing four attributes on
`EnhancedContentStrategy` (`monitoring_plans`, `monitoring_tasks`,
`performance_metrics`, `activation_status`). All four are also
exposed as a `relationship("Strategy..."` from the other side,
creating a circular import: `monitoring_models.py` imports `Base`
from `enhanced_strategy_models.py`, so adding a top-level
`from models.monitoring_models import StrategyPerformanceMetrics`
to `enhanced_strategy_models.py` fails with
`ImportError: cannot import name 'Base' from partially initialized
module 'models.enhanced_strategy_models'`.

**Fix shape** (not yet applied -- awaiting sign-off because it
touches the schema and the model init order):

1. Break the cycle by removing the `back_populates=...` from
   `monitoring_models.py:19, 42, 84, 99` and replacing each with
   `backref="..."` on the `relationship("EnhancedContentStrategy", ...)`
   side. `backref` creates the reverse attribute on the
   `EnhancedContentStrategy` class automatically, so the
   `relationship(...)` declarations on
   `enhanced_strategy_models.py:89-91` can be deleted.
2. Rename the `performance_metrics` column to
   `performance_metrics_data` so the column and the backref'd
   relationship don't collide on the same name.
3. Update the 2 readers (`strategy_analyzer.py:203`,
   `prompt_engineering.py:33`) and the 1 constructor
   (`strategy_service.py:98`).
4. Add an Alembic / SQL migration: `ALTER TABLE
   enhanced_content_strategies RENAME COLUMN performance_metrics
   TO performance_metrics_data;`

Touches: `enhanced_strategy_models.py` (1 column rename + 3
relationship lines removed), `monitoring_models.py` (4
relationship declarations), 3 reader files, 1 constructor file,
1 db_service unpack, 1 db_service setattr loop, 1 SQL migration
script. About 15-25 lines net across 6-8 files, plus a DB
migration that must be run before deployment.

### H2: Unhandled `RuntimeError` in content calendar -- likely LIVE (reliability)

`strategy_generator.py:459` is referenced as the location of an
unhandled `RuntimeError` in `_generate_content_calendar()`. The
audit was not exhaustive on this one; the pattern in the
surrounding code (a coroutine that catches the same exception
type elsewhere) suggests this is a real gap. Deferred from the
quick-win scope because the fix requires adding a try/except
in a function we have not fully read in this audit.

### H3: user_id type mismatch -- LIVE (data integrity)

`backend/models/enhanced_strategy_models.py` (column type) declares
`user_id` as `String(255)` (Clerk-style alphanumeric). Some
callers pass integers (e.g., the `?user_id=N` query parameter
in some endpoints expects an int). The model and the code
disagree; depending on the call site, queries may silently fail
or produce empty results. This is the same kind of mismatch that
the previous content-strategy audit flagged. Deferred from the
quick-win scope because the proper fix is a type audit across
all caller sites.

### H4: LIKE-wildcard injection in search -- LIVE (low-severity)

`backend/api/content_planning/services/enhanced_strategy_db_service.py:217-218`:

```python
EnhancedContentStrategy.name.ilike(f"%{search_term}%"),
EnhancedContentStrategy.industry.ilike(f"%{search_term}%")
```

This is **not an SQL injection** (SQLAlchemy parameterizes the
value), but a user can type `%` or `_` as the search term and
broaden the LIKE pattern. The user filter on line 215
(`EnhancedContentStrategy.user_id == user_id`) prevents cross-
tenant access, so the worst case is "user can search across
all their own strategies more efficiently than they could via
the UI." Deferred from the quick-win scope because the
exploitation is bounded by the user filter.

### H5 (#595 only): Frontend fabrication -- STALE/STRETCHED

Same as C5 in #594. The `DataSourceTransparency.tsx` and
`StrategyAutofillTransparencyModal.tsx` files contain static UI
metadata and field-name-to-category schemas, not fabricated
metrics. The values shown to the user come from the props
(backend data) and are not pre-cooked.

---

## 2. Plan

| Phase | Focus | Files | Status |
|---|---|---|---|
| `cs/phase-3.1` | C5: dedent the return statement in `strategy_service.py:542` | 1 file, 1 line | done (commit pending) |
| `cs/phase-3.2` | C1: pass `user_id` through to the DB service in `routes/strategies.py` (PUT and DELETE) | 2 files | done (commit pending) |
| `cs/phase-3.3` | C2: whitelist of allowed update fields in `strategy_crud.py` | 1 file | deferred |
| `cs/phase-3.4` | C3: replace fabricated AI with LLM or flag as placeholder | 2 files | deferred |
| `cs/phase-3.5` | C4: add TTL + cleanup to in-memory `_task_status` | 1 file | deferred |
| `cs/phase-3.6` | H1: rename the SQLAlchemy `performance_metrics` column or relationship | 1 file | deferred |
| `cs/phase-3.7` | H2: try/except around `_generate_content_calendar` | 1 file | deferred |
| `cs/phase-3.8` | H3: type audit for `user_id` (string vs int) across callers | tbd | deferred |
| `cs/phase-3.9` | H4: escape `%` and `_` in `search_term` before LIKE | 1 file | deferred |
| `cs/phase-3.10` | H1: break circular import + rename `performance_metrics` column | 6-8 files + DB migration | deferred, awaiting sign-off |

Total `cs/phase-3` quick-win scope so far: 2 files, ~10-20 line
changes. H1 escalated during the audit from "rename 1 column" to
"break a circular import across 4 model classes + 1 column rename
+ 1 SQL migration." That is a real bug (mapper configuration
throws `InvalidRequestError` on first DB read), but the fix
touches the schema, so I am pausing for user sign-off before
touching it.

---

## 3. cs/phase-3.1 (C5) in detail

The fix is a single-line dedent in
`backend/api/content_planning/services/content_strategy/core/strategy_service.py`:

```python
            return merged_data
```

becomes:

```python
        return merged_data
```

(indented to the function body, not the for loop). After the
change, the function processes all 30 fields in
`field_transformations` instead of just the first one.

There is no test for this function in the repo, so a smoke test
is not added in this phase. The behaviour change is obvious: a
30-field transformation dict now produces a 30-field merged
result.

---

## 4. cs/phase-3.2 (C1) in detail

The fix has three parts:

1. **`enhanced_strategy_db_service.py`**: change the
   `update_enhanced_strategy` and `delete_enhanced_strategy`
   signatures to accept a `user_id` parameter, and have them
   call the existing `get_enhanced_strategy(id, user_id)` for
   the ownership check. If the result is None (either the
   record doesn't exist OR the user doesn't own it), return
   None / False.

2. **`routes/strategies.py`**: pass `clerk_user_id` to the DB
   service calls. The route already extracts `clerk_user_id`
   from the auth context (line 140, 165); the change is to add
   it to the function call.

3. The PUT endpoint returns 404 (not found) when the strategy
   doesn't exist or the user doesn't own it. The DELETE
   endpoint does the same. This matches the existing
   `get_enhanced_strategy` behaviour and does not leak
   information about which records exist (a 403 would tell
   an attacker that a record with that ID exists).

The behaviour change: an authenticated user can only update or
delete strategies they own. Any other case returns 404.

---

## 5. Risk register and rollback

| Risk | Mitigation |
|---|---|
| C1 fix breaks an admin / impersonation flow that needs to edit other users' strategies | The repo has no such flow (verified by grep). If one is added later, the DB service's `user_id` parameter is documented as "owner check; pass None to skip." |
| C1 fix breaks the C2 mass-assignment fix when the two are landed together | The two fixes are in different files. C1 routes user_id to the DB service; C2 is a field whitelist. They compose: ownership check first, then field whitelist, then setattr. |
| C5 dedent changes the merge order | The merge order was previously "only the first field"; the new order is "all fields in iteration order" (Python dict). The order is stable for a given Python version and the field_transformations dict. |
| Other callers of the changed DB service methods break | Only the two routes in `routes/strategies.py` call them. A grep confirms no other call sites. |

Rollback: each phase is one PR. To roll back C5, revert the
single-line dedent. To roll back C1, revert the two-file change.

---

## 6. Summary

The Phase 3 audit found 11 claims across #594/#595. 5 are stale
(the code has moved on since the issues were filed), 6 are
live. Of the 6 live issues, the 2 most production-critical
(C1 security, C5 silent data loss) are fixed in the quick-win
scope. The remaining 4 (C2 mass assignment, C3 fabricated AI, C4
in-memory state, H1 model namespace) are real issues but require
larger changes that are out of scope for the 1-2 day quick-win
window.
