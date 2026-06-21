# Legacy `services/agent_framework.py` Dedup Audit

## Status
**Audit complete. Code changes deferred. Do not delete or rewrite the legacy file
without addressing all items in this document.**

## Summary
The legacy module `backend/services/agent_framework.py` (961 lines) is a near-duplicate
of `backend/services/intelligence/agents/core_agent_framework.py` (1,219 lines). Both
define their own `AgentAction`, `MarketSignal`, and `BaseALwrityAgent`. The legacy
module predates the canonical one; the canonical module was extracted as part of
the SIF (Semantic Intelligence Framework) initiative.

## Import audit

### Search method
Searched the entire repository (Python, TypeScript, and Markdown files) for any
import of `services.agent_framework` (both `from` and dotted access forms).

### Result
**Zero importers.** No file in the repo imports anything from
`services.agent_framework`. The module is dead code from an import perspective.

## Risk assessment

Although no file currently imports from the legacy module, there is still risk in
deletion:

1. **Documentation references.** Public-facing docs or external systems may
   reference the legacy module path.
2. **Plugin entry points.** Python's entry-point mechanism (used by some plugins)
   can resolve modules by string name. If any third-party plugin references
   `services.agent_framework`, deletion breaks the plugin.
3. **Runtime import-by-name.** Some integrations load modules by path string at
   runtime; these would not show up in static analysis.
4. **Git history.** The legacy file is committed, so `git log -- services/agent_framework.py`
   still resolves, but a deletion is recoverable from history if needed.

## Recommendation

**Do not delete in this iteration.** Recommended path forward:

1. Convert `services/agent_framework.py` into a thin re-export shim that delegates
   every public symbol to `services.intelligence.agents.core_agent_framework`.
   This keeps any external references working while removing the duplicate logic.
2. Add a deprecation log message at module import time:
   `logger.warning("services.agent_framework is deprecated; import from services.intelligence.agents.core_agent_framework instead")`.
3. After one release cycle, check logs for any imports of the deprecated path.
   If zero, delete the shim and the file.

## Companion dedup work (separate)

The `MarketSignal` dataclass is defined in three places:

- `services/intelligence/agents/core_agent_framework.py`
- `services/intelligence/agents/market_signal_detector.py`
- `services/agent_framework.py` (legacy)

Consolidation requires:

- Pick the canonical definition (the one in `core_agent_framework.py` is the
  most feature-complete).
- Update `market_signal_detector.py` to import from canonical.
- Update the legacy module to re-export the canonical one (after the shim
  rewrite above).
- Update or remove any local `MarketSignal` instances that differ in field set.

This is a larger change and should be done as its own focused effort, not as
part of a quick-win pass.
