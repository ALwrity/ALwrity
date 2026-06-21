"""Read-only virtual filesystem facade for agent flat context documents.

This adapter provides shell-like primitives (`list_context`, `search_context`,
`read_context_file`) over the JSON documents managed by AgentFlatContextStore.
"""

from __future__ import annotations

import json
import re
import os
import sys
import contextlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque
from fnmatch import fnmatch
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from services.intelligence.agent_flat_context import AgentFlatContextStore

# Phase 3.2: cross-platform advisory file locking. Pre-3.2 this
# module imported ``fcntl`` at module top, which crashes on Windows
# (this project runs on win32 per the env). We now lazy-import the
# right backend based on ``sys.platform`` and provide a single
# ``_advisory_lock`` context manager used at both call sites.
if sys.platform == "win32":
    import msvcrt  # noqa: F401
    _LOCK_BACKEND = "msvcrt"
else:
    import fcntl  # noqa: F401
    _LOCK_BACKEND = "fcntl"


@contextlib.contextmanager
def _advisory_lock(file_handle, exclusive: bool = True):
    """Cross-platform advisory file lock.

    Phase 3.2: wraps the platform-specific locking API.
      * On POSIX, ``fcntl.flock(fd, LOCK_EX | LOCK_UN)``.
      * On Windows, ``msvcrt.locking(fd, LK_NBLCK, 1)`` for
        exclusive lock. We use a single byte (1) and treat the
        operation as a mutex over the file (POSIX ``flock`` is
        whole-file).

    Falls back to a no-op if the platform backend is missing
    (e.g. on a stripped-down POSIX without ``fcntl``). The caller
    still gets correct behavior under no-op (best-effort serialised
    appends may race in adversarial conditions, but the file is
    always closed and the chmod/sync operations still run).
    """
    if _LOCK_BACKEND == "fcntl":
        try:
            import fcntl as _fcntl
            op = _fcntl.LOCK_EX if exclusive else _fcntl.LOCK_SH
            _fcntl.flock(file_handle.fileno(), op)
            try:
                yield
            finally:
                _fcntl.flock(file_handle.fileno(), _fcntl.LOCK_UN)
        except ImportError:
            yield
    else:
        try:
            import msvcrt as _msvcrt
            # ``_locking`` expects a 32-bit count. Use 1 byte as
            # the lock region; this serialises writers but the
            # critical section is short (a few KB append).
            LK_NBLCK = 0x80000000  # non-blocking flag, ignored
            LK_LOCK = 0x80000000 | 1  # exclusive lock, 1 byte
            LK_UNLCK = 0x80000000 | 2  # unlock
            # 32-bit count: 0xFFFFFFFF = 1 file
            _msvcrt.locking(file_handle.fileno(), LK_LOCK, 0xFFFFFFFF)
            try:
                yield
            finally:
                _msvcrt.locking(file_handle.fileno(), LK_UNLCK, 0xFFFFFFFF)
        except ImportError:
            yield


class SmartGrepEngine:
    """Streaming grep engine with regex fallback and contextual snippets."""

    def __init__(self, context_window: int = 1):
        self.context_window = max(0, int(context_window))

    @staticmethod
    def _compile_pattern(pattern: str) -> re.Pattern:
        try:
            return re.compile(pattern, re.IGNORECASE)
        except re.error:
            return re.compile(re.escape(pattern), re.IGNORECASE)

    @staticmethod
    def _truncate(text: str, limit: int = 180) -> str:
        text = " ".join(text.split())
        if len(text) <= limit:
            return text
        return text[:limit] + "..."

    def stream_file(self, file_path: Path, pattern: str, *, path_label: str) -> List[Dict[str, Any]]:
        regex = self._compile_pattern(pattern)
        matches: List[Dict[str, Any]] = []
        prev = deque(maxlen=self.context_window)
        active: List[Dict[str, Any]] = []

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, start=1):
                # Fill trailing context for active matches.
                for item in active:
                    if item["remaining_after"] > 0:
                        item["after"].append(line.rstrip("\n"))
                        item["remaining_after"] -= 1

                # Detect a new match on current line.
                if regex.search(line):
                    current = line.rstrip("\n")
                    record = {
                        "path": path_label,
                        "line": line_no,
                        "before": list(prev),
                        "match_line": current,
                        "after": [],
                        "remaining_after": self.context_window,
                    }
                    active.append(record)
                    matches.append(record)

                prev.append(line.rstrip("\n"))

        formatted: List[Dict[str, Any]] = []
        for m in matches:
            snippet_parts = [*m["before"], m["match_line"], *m["after"]]
            snippet = self._truncate(" | ".join([p for p in snippet_parts if p is not None]))
            line_l = m["match_line"].lower()
            is_high_signal = any(k in line_l for k in ("agent_summary", "high_signal_terms", "quick_facts"))
            formatted.append(
                {
                    "path": m["path"],
                    "line": m["line"],
                    "snippet": snippet,
                    "relevance": "High Relevance" if is_high_signal else "Supporting Detail",
                    "reason": "matched summary field in stream" if is_high_signal else "matched streamed body line",
                    "score": 70 if is_high_signal else 50,
                }
            )
        return formatted


class AgentContextVFS:
    """Read-only adapter that maps virtual paths to flat context documents."""

    VIRTUAL_MAP = {
        "/steps/website": AgentFlatContextStore.STEP2_FILENAME,
        "/steps/research": AgentFlatContextStore.STEP3_FILENAME,
        "/steps/persona": AgentFlatContextStore.STEP4_FILENAME,
        "/steps/integrations": AgentFlatContextStore.STEP5_FILENAME,
    }
    HIGH_SIGNAL_MARKERS = ("agent_summary", "high_signal_terms", "quick_facts", "context_type")

    def __init__(self, user_id: str, project_id: Optional[str] = None):
        self.user_id = user_id
        self.project_id = project_id
        self.store = AgentFlatContextStore(user_id)
        self.grep_engine = SmartGrepEngine(context_window=1)

    @staticmethod
    def _safe_slug(value: Optional[str], fallback: str) -> str:
        raw = str(value or "").strip()
        safe = "".join(c for c in raw if c.isalnum() or c in ("-", "_"))
        return safe or fallback

    def _manifest_docs(self) -> List[Dict[str, Any]]:
        manifest = self.store.load_context_manifest() or {"documents": []}
        docs = manifest.get("documents")
        return docs if isinstance(docs, list) else []

    def _workspace_root(self) -> Path:
        if self.project_id:
            root_dir = Path(__file__).resolve().parents[3]
            safe_project = self._safe_slug(self.project_id, "default_project")
            project_root = root_dir / "workspace" / f"project_{safe_project}"
            project_root.mkdir(parents=True, exist_ok=True)
            os.chmod(project_root, 0o700)
            return project_root
        return self.store._workspace_dir()

    def _scratchpad_dir(self) -> Path:
        scratch = self._workspace_root() / "scratchpad"
        scratch.mkdir(parents=True, exist_ok=True)
        os.chmod(scratch, 0o700)
        return scratch

    def _allowlisted_workspace_files(self) -> List[Path]:
        """Return sandboxed files eligible for streaming search."""
        files: List[Path] = []
        workspace = self._workspace_root()
        context_dir = self.store._context_dir()

        # 1) manifest-backed onboarding context files
        for item in self._manifest_docs():
            if not isinstance(item, dict):
                continue
            rel = str(item.get("path") or "")
            if not rel:
                continue
            try:
                candidate = self.store._safe_resolve_under(context_dir, rel)
                if candidate.exists() and candidate.is_file():
                    files.append(candidate)
            except Exception:
                continue

        # 2) workspace text artifacts (README, operator notes, etc.)
        for candidate in workspace.glob("*.txt"):
            if candidate.is_file():
                files.append(candidate.resolve())
        readme = workspace / "README.md"
        if readme.exists() and readme.is_file():
            files.append(readme.resolve())

        # dedupe
        seen = set()
        unique: List[Path] = []
        for p in files:
            rp = str(p)
            if rp in seen:
                continue
            seen.add(rp)
            unique.append(p)
        return unique

    @staticmethod
    def _query_variants(query: str) -> List[str]:
        """Generate normalized and synonym-expanded query variants."""
        base = (query or "").strip().lower()
        if not base:
            return []
        synonyms = {
            "tone": ["brand voice", "writing tone"],
            "voice": ["brand voice", "writing style"],
            "competitor": ["competition", "rival"],
            "seo": ["search", "metadata"],
            "persona": ["audience profile", "target audience"],
        }
        variants = [base]
        tokens = base.split()
        for idx, tok in enumerate(tokens):
            if tok in synonyms:
                for repl in synonyms[tok]:
                    new_tokens = tokens.copy()
                    new_tokens[idx] = repl
                    variants.append(" ".join(new_tokens))
        variants.extend([base.replace("-", " "), base.replace("_", " ")])
        # dedupe, preserve order
        seen = set()
        out: List[str] = []
        for v in variants:
            vv = v.strip()
            if not vv or vv in seen:
                continue
            seen.add(vv)
            out.append(vv)
        return out

    @staticmethod
    def _freshness_score(updated_at: Optional[str]) -> float:
        if not updated_at:
            return 0.3
        try:
            from datetime import datetime, timezone

            ts = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            days = max(0.0, (datetime.now(timezone.utc) - ts).total_seconds() / 86400.0)
            if days <= 1:
                return 1.0
            if days <= 7:
                return 0.9
            if days <= 30:
                return 0.75
            if days <= 90:
                return 0.6
            return 0.4
        except Exception:
            return 0.3

    def _cluster_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deduplicate repeated hits by file + reason and keep strongest evidence."""
        buckets: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for r in results:
            path = str(r.get("path") or "")
            reason = str(r.get("reason") or "")
            key = (path, reason)
            existing = buckets.get(key)
            if not existing:
                buckets[key] = {**r, "hit_count": 1}
                continue
            existing["hit_count"] = int(existing.get("hit_count", 1)) + 1
            if int(r.get("score", 0)) > int(existing.get("score", 0)):
                existing.update({k: v for k, v in r.items() if k != "hit_count"})
                existing["hit_count"] = int(existing.get("hit_count", 1))
        clustered = list(buckets.values())
        clustered.sort(key=lambda r: (-int(r.get("score", 0)), str(r.get("path") or "")))
        return clustered

    def _keyword_density(self, snippet: str, query: str) -> float:
        if not snippet or not query:
            return 0.0
        query_tokens = [t for t in query.lower().split() if t]
        if not query_tokens:
            return 0.0
        text = snippet.lower()
        hits = sum(text.count(tok) for tok in query_tokens)
        words = max(1, len(text.split()))
        return hits / words

    def _static_triage(self, results: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
        """Semgrep-style static heuristic triage before main agent consumption."""
        triaged: List[Dict[str, Any]] = []
        for r in results:
            snippet = str(r.get("snippet") or "")
            density = self._keyword_density(snippet, query)
            marker_hit = any(marker in snippet.lower() for marker in self.HIGH_SIGNAL_MARKERS)
            low_probability = bool(density < 0.01 and not marker_hit)
            item = dict(r)
            item["keyword_density"] = round(density, 4)
            item["low_probability"] = low_probability
            triaged.append(item)
        triaged.sort(
            key=lambda x: (
                bool(x.get("low_probability")),
                -float(x.get("confidence", 0)),
                -int(x.get("score", 0)),
            )
        )
        return triaged

    @staticmethod
    def _llm_router_stub(results: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        """Fast local triage stub (drop low-probability first; keep strongest candidates)."""
        ranked = sorted(
            results,
            key=lambda x: (
                bool(x.get("low_probability")),
                -float(x.get("confidence", 0)),
                -int(x.get("score", 0)),
            ),
        )
        return ranked[: max(1, top_k)]

    @staticmethod
    def _resolve_json_path(data: Any, path_query: str) -> Any:
        """Resolve dot/bracket JSON path such as 'data.seo_audit.recommendations[0]'."""
        if not path_query:
            return data

        current = data
        query = path_query.strip()
        parts: List[str] = []
        buf = ""
        in_brackets = False
        for ch in query:
            if ch == "." and not in_brackets:
                if buf:
                    parts.append(buf)
                    buf = ""
                continue
            if ch == "[":
                in_brackets = True
            elif ch == "]":
                in_brackets = False
            buf += ch
        if buf:
            parts.append(buf)

        for part in parts:
            if "[" in part and part.endswith("]"):
                key, idx_raw = part.split("[", 1)
                idx = int(idx_raw[:-1])
                if key:
                    if not isinstance(current, dict):
                        raise KeyError(key)
                    current = current[key]
                if not isinstance(current, list):
                    raise IndexError(idx)
                current = current[idx]
            else:
                if not isinstance(current, dict):
                    raise KeyError(part)
                current = current[part]
        return current

    def _resolve_path(self, path: str) -> Tuple[str, Optional[str]]:
        normalized = (path or "").strip()
        if not normalized:
            return "", None
        if normalized == "/env/summary":
            return "virtual_summary", None
        if normalized in self.VIRTUAL_MAP:
            return "file", self.VIRTUAL_MAP[normalized]
        if ".." in normalized or "\\" in normalized:
            return "", None
        if normalized.startswith("/"):
            candidate = normalized.rsplit("/", 1)[-1]
        else:
            candidate = normalized
        if "/" in candidate:
            return "", None
        allowed = AgentFlatContextStore.ALLOWED_CONTEXT_FILES - {AgentFlatContextStore.MANIFEST_FILENAME}
        if candidate not in allowed:
            return "", None
        return "file", candidate

    def list_context(self) -> Dict[str, Any]:
        """List available context files (ls-equivalent)."""
        docs = self._manifest_docs()
        items = []
        for d in docs:
            if not isinstance(d, dict):
                continue
            items.append(
                {
                    "path": d.get("path"),
                    "type": d.get("type"),
                    "updated_at": d.get("updated_at"),
                    "size_bytes": d.get("size_bytes", 0),
                }
            )
        items.sort(key=lambda x: str(x.get("path") or ""))
        result = {
            "workspace_hint": "Use this list to see which onboarding steps are complete.",
            "tip": "Use `search_context` to find specific keywords across all steps.",
            "virtual_paths": ["/env/summary", *sorted(self.VIRTUAL_MAP.keys())],
            "files": items,
            "collaboration": {
                "scratchpad_dir": str(self._scratchpad_dir()),
                "activity_log": "scratchpad/activity_log.jsonl",
            },
        }
        logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=list_context files={len(items)}")
        return result

    @staticmethod
    def _flatten_strings(data: Any, limit: int = 2000) -> str:
        pieces: List[str] = []

        def walk(v: Any) -> None:
            if len(pieces) >= limit:
                return
            if isinstance(v, dict):
                for key, value in v.items():
                    pieces.append(str(key))
                    walk(value)
            elif isinstance(v, list):
                for item in v:
                    walk(item)
            elif isinstance(v, (str, int, float, bool)):
                pieces.append(str(v))

        walk(data)
        return " ".join(pieces)

    @staticmethod
    def _extract_search_fields(doc: Dict[str, Any]) -> Tuple[List[str], Dict[str, Any], str]:
        summary = doc.get("agent_summary") if isinstance(doc.get("agent_summary"), dict) else {}
        hints = summary.get("retrieval_hints") if isinstance(summary.get("retrieval_hints"), dict) else {}
        quick_facts = summary.get("quick_facts") if isinstance(summary.get("quick_facts"), dict) else {}
        high_terms = hints.get("high_signal_terms") if isinstance(hints.get("high_signal_terms"), list) else []
        body = AgentContextVFS._flatten_strings(doc.get("data") if isinstance(doc.get("data"), dict) else {})
        return [str(t).lower() for t in high_terms], quick_facts, body.lower()

    def search_context(self, query: str, *, limit: int = 10, path_glob: Optional[str] = None) -> Dict[str, Any]:
        """Smart grep with coarse-to-fine ranking and parallel stream scans."""
        normalized = (query or "").strip()
        if not normalized:
            return {"query": query, "results": []}
        self.store._audit_event("vfs_search", normalized, "started")
        try:
            variants = self._query_variants(normalized)
            attempted_queries: List[str] = []
            scored: List[Dict[str, Any]] = []

            for candidate_query in variants:
                attempted_queries.append(candidate_query)
                needle = candidate_query.lower()

                # Pass 1: summary-first ranking (high relevance)
                docs = self._manifest_docs()
                variant_scored: List[Dict[str, Any]] = []
                for item in docs:
                    if not isinstance(item, dict):
                        continue
                    path = str(item.get("path") or "")
                    if not path:
                        continue
                    if path_glob and not fnmatch(path, path_glob):
                        continue
                    doc = self.store.load_context_document(path) or {}
                    high_terms, quick_facts, _ = self._extract_search_fields(doc)

                    high_match = any(needle in term for term in high_terms)
                    quick_match = any(needle in str(v).lower() for v in quick_facts.values()) if isinstance(quick_facts, dict) else False
                    if not (high_match or quick_match):
                        continue

                    score = 100 if high_match else 80
                    reason = "matched high_signal_terms" if high_match else "matched quick_facts"
                    variant_scored.append(
                        {
                            "path": path,
                            "line": None,
                            "snippet": f"{reason}: {candidate_query}"[:100],
                            "type": item.get("type"),
                            "updated_at": item.get("updated_at"),
                            "relevance": "High Relevance",
                            "reason": reason,
                            "score": score,
                        }
                    )

                # Pass 2: parallelized stream scan over allowlisted workspace files.
                allowlisted = self._allowlisted_workspace_files()
                body_matches: List[Dict[str, Any]] = []
                if allowlisted:
                    with ThreadPoolExecutor(max_workers=min(8, max(1, len(allowlisted)))) as pool:
                        future_map = {}
                        for p in allowlisted:
                            path_label = p.name
                            if path_glob and not fnmatch(path_label, path_glob):
                                continue
                            future = pool.submit(self.grep_engine.stream_file, p, candidate_query, path_label=path_label)
                            future_map[future] = path_label

                        for future in as_completed(future_map):
                            try:
                                body_matches.extend(future.result() or [])
                            except Exception:
                                continue

                variant_scored.extend(body_matches)
                if variant_scored:
                    scored = variant_scored
                    break

            scored = self._cluster_results(scored)

            # Add confidence based on score + freshness + hit density.
            for r in scored:
                base = min(1.0, max(0.0, float(r.get("score", 0)) / 100.0))
                freshness = self._freshness_score(r.get("updated_at"))
                density = min(1.0, 0.2 + (int(r.get("hit_count", 1)) * 0.1))
                confidence = round((base * 0.6) + (freshness * 0.25) + (density * 0.15), 3)
                r["confidence"] = confidence

            scored.sort(key=lambda r: (-int(r.get("score", 0)), str(r.get("path") or "")))
            matched_files = sorted({str(r.get("path") or "") for r in scored if r.get("path")})
            capped_results = scored[: max(1, limit)]
            notice = None
            if len(matched_files) > 10:
                notice = f"Found {len(matched_files)} matches. Showing top 10. Use a more specific keyword to narrow down."
                capped_results = scored[:10]

            # Token/length budgeting (~2000 tokens ~= ~8000 chars).
            budget_chars = 8000
            bounded_results = []
            used = 0
            for r in capped_results:
                snippet = str(r.get("snippet") or "")
                cost = len(snippet) + 120  # account for metadata fields
                if bounded_results and used + cost > budget_chars:
                    break
                bounded_results.append(r)
                used += cost

            result = {
                "query": normalized,
                "attempted_queries": attempted_queries,
                "matched_files_count": len(matched_files),
                "results": self._static_triage(bounded_results, normalized),
                "notice": notice,
                "char_budget_used": used,
                "can_answer": bool(bounded_results),
            }
            result["triage_top5"] = self._llm_router_stub(result["results"], top_k=5)
            logger.info(
                f"[vfs_audit] user={self.store.safe_user_id} action=search_context query={normalized!r} results={len(result['results'])}"
            )
            self.store._audit_event("vfs_search", normalized, f"success_{len(result['results'])}_hits")
            return result
        except Exception as exc:
            self.store._audit_event("vfs_search", normalized, f"failed_{exc.__class__.__name__}")
            return {"query": normalized, "matched_files_count": 0, "results": [], "notice": "Search failed.", "can_answer": False}

    @staticmethod
    def _strip_technical_metadata(doc: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {
            "context_type": doc.get("context_type"),
            "updated_at": doc.get("updated_at"),
            "journey": ((doc.get("document_context") or {}).get("journey") or {}) if isinstance(doc.get("document_context"), dict) else {},
            "agent_summary": doc.get("agent_summary") if isinstance(doc.get("agent_summary"), dict) else {},
            "data": doc.get("data") if isinstance(doc.get("data"), dict) else {},
        }
        return sanitized

    def inspect_file(self, path: str, *, key: Optional[str] = None, small_file_bytes: int = 5 * 1024) -> Dict[str, Any]:
        """Smart reader (cat/head equivalent) with summary-first behavior."""
        kind, resolved = self._resolve_path(path)
        if kind == "virtual_summary":
            result = {
                "path": "/env/summary",
                "mode": "summary",
                "data": self.store.generate_total_summary(),
            }
            logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=read_context_file path=/env/summary mode=summary")
            return result

        if not resolved:
            logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=read_context_file path={path!r} status=rejected")
            return {"error": "File not found", "path": path}

        # JSON context doc path
        doc = self.store.load_context_document(resolved)
        if doc:
            view = self._strip_technical_metadata(doc)
            data = view.get("data") if isinstance(view.get("data"), dict) else {}
            raw_size = self.store.estimate_size_bytes(view)

            if key:
                if key in data:
                    result = {
                        "path": resolved,
                        "mode": "key",
                        "key": key,
                        "agent_summary": view.get("agent_summary"),
                        "data": data.get(key),
                    }
                    logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=inspect_file path={resolved} mode=key")
                    return result
                logger.info(
                    f"[vfs_audit] user={self.store.safe_user_id} action=inspect_file path={resolved} mode=key_missing key={key}"
                )
                return {
                    "path": resolved,
                    "mode": "key_missing",
                    "key": key,
                    "available_keys": sorted(list(data.keys())),
                    "message": "Requested key not found. Choose one of available_keys.",
                }

            if raw_size <= small_file_bytes:
                result = {
                    "path": resolved,
                    "mode": "full",
                    "data": view,
                }
                logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=inspect_file path={resolved} mode=full")
                return result

            result = {
                "path": resolved,
                "mode": "summary_plus_keys",
                "size_bytes": raw_size,
                "agent_summary": view.get("agent_summary"),
                "keys": sorted(list(data.keys())),
                "message": "File is large. Re-run with key to inspect a specific section.",
            }
            logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=inspect_file path={resolved} mode=summary_plus_keys")
            return result

        logger.info(f"[vfs_audit] user={self.store.safe_user_id} action=inspect_file path={resolved} status=not_found")
        return {"error": "File not found", "path": path, "resolved": resolved}

    def read_context_file(self, path: str, *, subkey: Optional[str] = None) -> Dict[str, Any]:
        """Backward-compatible alias for inspect_file."""
        return self.inspect_file(path, key=subkey)

    def write_context_file(self, *_args: Any, **_kwargs: Any) -> None:
        """Disallow writes from the agent-facing VFS."""
        raise OSError("EROFS: read-only file system")

    # Backward-compat function name requested in design docs.
    inspect = inspect_file

    def write_shared_note(self, note: str, *, agent_id: str = "agent", filename: str = "collaboration.md") -> Dict[str, Any]:
        """Append a shared project note with advisory locking in scratchpad."""
        safe_name = Path(filename).name
        if safe_name != filename or ".." in filename or "/" in filename or "\\" in filename:
            self.store._audit_event("write_shared_note", filename, "rejected_filename")
            return {"ok": False, "error": "Invalid filename"}

        scratch = self._scratchpad_dir()
        target = (scratch / safe_name).resolve()
        if scratch.resolve() not in target.parents:
            self.store._audit_event("write_shared_note", filename, "rejected_path")
            return {"ok": False, "error": "Unsafe path"}

        lock_path = scratch / f".{safe_name}.lock"
        ts = datetime.now(timezone.utc).isoformat()
        header = f"\n## {ts} | {self._safe_slug(agent_id, 'agent')}\n"
        payload = header + str(note).rstrip() + "\n"

        try:
            with open(lock_path, "w", encoding="utf-8") as lf:
                with _advisory_lock(lf, exclusive=True):
                    with open(target, "a", encoding="utf-8") as tf:
                        tf.write(payload)
                        tf.flush()
                        os.fsync(tf.fileno())
                    os.chmod(target, 0o600)
            self.store._audit_event("write_shared_note", safe_name, "success")
            self.append_activity_log(
                event_type="shared_note_written",
                actor=agent_id,
                details={"file": safe_name, "bytes": len(payload)},
            )
            return {"ok": True, "file": safe_name, "bytes_written": len(payload)}
        except Exception as exc:
            self.store._audit_event("write_shared_note", safe_name, f"failed_{exc.__class__.__name__}")
            return {"ok": False, "error": str(exc)}

    def append_activity_log(self, *, event_type: str, actor: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Write append-only project activity log entry in JSONL format."""
        scratch = self._scratchpad_dir()
        target = (scratch / "activity_log.jsonl").resolve()
        lock_path = scratch / ".activity_log.jsonl.lock"
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": str(event_type),
            "actor": self._safe_slug(actor, "agent"),
            "project_id": self._safe_slug(self.project_id, "none") if self.project_id else None,
            "details": details or {},
        }
        line = json.dumps(entry, ensure_ascii=False) + "\n"
        try:
            with open(lock_path, "w", encoding="utf-8") as lf:
                with _advisory_lock(lf, exclusive=True):
                    with open(target, "a", encoding="utf-8") as tf:
                        tf.write(line)
                        tf.flush()
                        os.fsync(tf.fileno())
                    os.chmod(target, 0o600)
            return {"ok": True}
        except Exception as exc:
            logger.warning(f"Failed to append activity log: {exc}")
            return {"ok": False, "error": str(exc)}

    def read_struct(self, filename: str, path_query: str) -> Dict[str, Any]:
        """AST-style structural reader for JSON context files with dependency context injection."""
        resolved_kind, resolved = self._resolve_path(filename)
        if resolved_kind == "virtual_summary" or not resolved:
            return {"ok": False, "error": "Invalid file"}

        doc = self.store.load_context_document(resolved)
        if not isinstance(doc, dict):
            return {"ok": False, "error": "File not found"}

        try:
            extracted = self._resolve_json_path(doc, path_query)
        except Exception as exc:
            return {"ok": False, "error": f"path_query resolution failed: {exc}"}

        # Lightweight dependency context: inject brand voice from step2 when reading persona structures.
        dependency_context: Dict[str, Any] = {}
        if "persona" in path_query.lower() or resolved == AgentFlatContextStore.STEP4_FILENAME:
            step2 = self.store.load_step2_context_document() or {}
            step2_data = step2.get("data") if isinstance(step2.get("data"), dict) else {}
            brand = step2_data.get("brand_analysis") if isinstance(step2_data.get("brand_analysis"), dict) else {}
            dependency_context["brand_voice"] = brand.get("brand_voice")

        return {
            "ok": True,
            "file": resolved,
            "path_query": path_query,
            "data": extracted,
            "dependency_context": dependency_context,
            "context": "Extracted via structural parse to save tokens.",
        }



def build_filesystem_header(user_id: str) -> str:
    """Generate compact prompt header with available files and priority hints."""
    try:
        store = AgentFlatContextStore(user_id)
        manifest = store.load_context_manifest() or {"documents": []}
        docs = manifest.get("documents") if isinstance(manifest.get("documents"), list) else []
        available = [str(d.get("path")) for d in docs if isinstance(d, dict) and d.get("path")]
        files = ", ".join(sorted(available)) if available else "none"
        return (
            "Workspace Context: You have access to a local flat-file store. "
            f"Available Files: {files}. "
            "Instructions: For style guidelines, prioritize step4_persona_data.json. "
            "For technical site data, prioritize step2_website_analysis.json."
        )
    except Exception as exc:
        logger.warning(f"Failed to build filesystem header for user {user_id}: {exc}")
        return "Workspace Context: local flat-file store unavailable."
