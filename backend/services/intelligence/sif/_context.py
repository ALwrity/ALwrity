"""Onboarding context retrieval mixin for SIFIntegrationService.

Holds the step 2-5 context getters (``get_step*_context``) and the
flat-context helpers (``get_flat_context_manifest``, ``get_merged_flat_context``).
Each step getter follows the strict fallback chain: flat file -> database
-> SIF semantic index, raising :class:`SIFContextMissing` when all three
tiers are exhausted (see ``sif_integration.py`` for the failure-mode contract).
"""

import json
from typing import Dict, Any
from loguru import logger
from sqlalchemy import select, desc

from services.database import get_session_for_user
from models.onboarding import (
    WebsiteAnalysis,
    OnboardingSession,
    ResearchPreferences,
    PersonaData,
)
from services.intelligence.sif_errors import SIFContextMissing, SIFError
from services.intelligence.agent_flat_context import AgentFlatContextStore


class SIFContextMixin:
    """Step 2-5 onboarding context getters + flat-context helpers."""

    async def get_step2_website_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 2 website context with a strict fallback chain:
        flat file -> database -> SIF semantic index.

        Returns:
            A dict with at least ``source`` and ``data`` keys. The
            ``source`` is one of ``"flat_file"``, ``"database"``,
            ``"sif_semantic"`` (each indicating which tier produced
            the data), or, pre-1.2.3, ``"none"`` (no tier had data).
            The Phase 1.2.3 contract raises :class:`SIFContextMissing`
            instead of returning the ``"none"`` stub.

        Raises:
            SIFContextMissing: All three tiers returned no data. This
                is a legitimate runtime condition (the user has not
                yet completed onboarding step 2) and is *not* a
                system fault. Callers should log and continue.
            SIFError subclasses: A tier-level fault (e.g. SIF
                unavailability from Phase 1.2.2) is logged and
                swallowed within the tier; the method falls
                through to the next tier. Only SIFContextMissing
                surfaces out of this method.
        """
        # 1) Fastest: flat-file agent context
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step2_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Flat context lookup failed for user {self.user_id}: {e}")

        # 2) Database fallback
        db = None
        try:
            db = get_session_for_user(self.user_id)
            if db:
                stmt = (
                    select(WebsiteAnalysis)
                    .join(OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == self.user_id)
                    .order_by(desc(WebsiteAnalysis.updated_at))
                )
                row = db.execute(stmt).scalars().first()
                if row:
                    payload = row.to_dict() if hasattr(row, "to_dict") else {}
                    return {
                        "source": "database",
                        "data": payload,
                        "agent_summary": {
                            "quick_facts": {
                                "website_url": payload.get("website_url"),
                                "brand_voice": (payload.get("brand_analysis") or {}).get("brand_voice") if isinstance(payload.get("brand_analysis"), dict) else "",
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"Database fallback failed for user {self.user_id}: {e}")
        finally:
            if db:
                db.close()

        # 3) Semantic fallback. Phase 1.2.2 made intelligence_service.search
        # raise SIFError subclasses on real faults; we catch those
        # here and fall through (the tier failed, but the *user*
        # condition is "no context yet" until proven otherwise).
        try:
            results = await self.intelligence_service.search("website analysis brand voice style", limit=1)
        except SIFError as se:
            logger.warning(
                f"SIF semantic fallback raised {type(se).__name__} for user {self.user_id} "
                f"(continuing to SIFContextMissing): {se}"
            )
            results = None
        except Exception as e:
            logger.warning(f"SIF semantic fallback failed for user {self.user_id}: {e}")
            results = None

        if results:
            top = results[0]
            metadata = top.get("object") if isinstance(top, dict) else None
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}
            if isinstance(metadata, dict):
                report = metadata.get("full_report") if isinstance(metadata.get("full_report"), dict) else metadata
                return {
                    "source": "sif_semantic",
                    "data": report,
                    "agent_summary": {
                        "quick_facts": {
                            "website_url": report.get("website_url") if isinstance(report, dict) else None,
                        }
                    },
                }

        # All three tiers exhausted with no data. Pre-1.2.3 returned
        # ``{"source": "none", "data": {}}``. We now raise
        # SIFContextMissing so callers (and operators) can
        # distinguish "user has no context yet" from "context was
        # found and used".
        raise SIFContextMissing(
            "No step 2 website context available for user (all 3 tiers exhausted)",
            user_id=self.user_id,
            operation="get_step2_website_context",
        )

    async def get_step3_research_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 3 research context with fallback chain:
        flat file -> database -> SIF semantic index.

        Returns:
            A dict with at least ``source`` and ``data`` keys.

        Raises:
            SIFContextMissing: All three tiers returned no data.
        """
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step3_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Step 3 flat context lookup failed for user {self.user_id}: {e}")

        db = None
        try:
            db = get_session_for_user(self.user_id)
            if db:
                stmt = (
                    select(ResearchPreferences)
                    .join(OnboardingSession, ResearchPreferences.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == self.user_id)
                    .order_by(desc(ResearchPreferences.updated_at))
                )
                prefs = db.execute(stmt).scalars().first()
                if prefs:
                    payload = prefs.to_dict() if hasattr(prefs, "to_dict") else {}
                    return {
                        "source": "database",
                        "data": payload,
                        "agent_summary": {
                            "quick_facts": {
                                "research_depth": payload.get("research_depth"),
                                "content_types_count": len(payload.get("content_types") or []),
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"Step 3 database fallback failed for user {self.user_id}: {e}")
        finally:
            if db:
                db.close()

        try:
            results = await self.intelligence_service.search("research preferences competitors onboarding step 3", limit=1)
        except SIFError as se:
            logger.warning(
                f"Step 3 SIF semantic fallback raised {type(se).__name__} for user {self.user_id}: {se}"
            )
            results = None
        except Exception as e:
            logger.warning(f"Step 3 semantic fallback failed for user {self.user_id}: {e}")
            results = None

        if results:
            top = results[0]
            metadata = top.get("object") if isinstance(top, dict) else None
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}
            report = metadata.get("full_report") if isinstance(metadata, dict) and isinstance(metadata.get("full_report"), dict) else (metadata if isinstance(metadata, dict) else {})
            return {
                "source": "sif_semantic",
                "data": report,
                "agent_summary": {
                    "quick_facts": {
                        "research_depth": report.get("research_depth") if isinstance(report, dict) else None,
                    }
                },
            }

        raise SIFContextMissing(
            "No step 3 research context available for user (all 3 tiers exhausted)",
            user_id=self.user_id,
            operation="get_step3_research_context",
        )

    async def get_step4_persona_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 4 persona context with fallback chain:
        flat file -> database -> SIF semantic index.

        Returns:
            A dict with at least ``source`` and ``data`` keys.

        Raises:
            SIFContextMissing: All three tiers returned no data.
        """
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step4_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Step 4 flat context lookup failed for user {self.user_id}: {e}")

        db = None
        try:
            db = get_session_for_user(self.user_id)
            if db:
                stmt = (
                    select(PersonaData)
                    .join(OnboardingSession, PersonaData.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == self.user_id)
                    .order_by(desc(PersonaData.updated_at))
                )
                persona = db.execute(stmt).scalars().first()
                if persona:
                    payload = persona.to_dict() if hasattr(persona, "to_dict") else {}
                    return {
                        "source": "database",
                        "data": payload,
                        "agent_summary": {
                            "quick_facts": {
                                "selected_platforms_count": len(payload.get("selected_platforms") or []),
                                "has_core_persona": bool(payload.get("core_persona")),
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"Step 4 database fallback failed for user {self.user_id}: {e}")
        finally:
            if db:
                db.close()

        # ==========================================================================
        # PHASE D FOLLOW-UP — natural-language semantic query (NOT YET TUNED)
        # This tier is only reached when flat-file and DB both miss. The query
        # below uses onboarding-internal wording ("step 4"); once persona is
        # indexed into SIF (Phase A), retune it to natural domain terms the
        # content-gen agents actually use, e.g.
        #   "brand persona tone voice audience go-to phrases"
        # so semantic retrieval returns the indexed persona docs (type: "persona").
        # ==========================================================================
        try:
            results = await self.intelligence_service.search("persona platform personas onboarding step 4", limit=1)
        except SIFError as se:
            logger.warning(
                f"Step 4 SIF semantic fallback raised {type(se).__name__} for user {self.user_id}: {se}"
            )
            results = None
        except Exception as e:
            logger.warning(f"Step 4 semantic fallback failed for user {self.user_id}: {e}")
            results = None

        if results:
            top = results[0]
            metadata = top.get("object") if isinstance(top, dict) else None
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}
            report = metadata.get("full_report") if isinstance(metadata, dict) and isinstance(metadata.get("full_report"), dict) else (metadata if isinstance(metadata, dict) else {})
            return {
                "source": "sif_semantic",
                "data": report,
                "agent_summary": {
                    "quick_facts": {
                        "has_core_persona": bool(report.get("core_persona")) if isinstance(report, dict) else False,
                    }
                },
            }

        raise SIFContextMissing(
            "No step 4 persona context available for user (all 3 tiers exhausted)",
            user_id=self.user_id,
            operation="get_step4_persona_context",
        )

    async def get_step5_integrations_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 5 integrations context with fallback chain:
        flat file -> SIF semantic index.

        Returns:
            A dict with at least ``source`` and ``data`` keys.

        Raises:
            SIFContextMissing: All tiers returned no data.
        """
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step5_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Step 5 flat context lookup failed for user {self.user_id}: {e}")

        try:
            results = await self.intelligence_service.search("integrations onboarding step 5 connected providers", limit=1)
        except SIFError as se:
            logger.warning(
                f"Step 5 SIF semantic fallback raised {type(se).__name__} for user {self.user_id}: {se}"
            )
            results = None
        except Exception as e:
            logger.warning(f"Step 5 semantic fallback failed for user {self.user_id}: {e}")
            results = None

        if results:
            top = results[0]
            metadata = top.get("object") if isinstance(top, dict) else None
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}
            report = metadata.get("full_report") if isinstance(metadata, dict) and isinstance(metadata.get("full_report"), dict) else (metadata if isinstance(metadata, dict) else {})
            return {
                "source": "sif_semantic",
                "data": report,
                "agent_summary": {
                    "quick_facts": {
                        "connected_integrations_count": len((report.get("integrations") or {})) if isinstance(report, dict) and isinstance(report.get("integrations"), dict) else None,
                    }
                },
            }

        raise SIFContextMissing(
            "No step 5 integrations context available for user (all tiers exhausted)",
            user_id=self.user_id,
            operation="get_step5_integrations_context",
        )

    async def get_flat_context_manifest(self) -> Dict[str, Any]:
        """Return lightweight manifest of available flat context documents for this user."""
        try:
            manifest = AgentFlatContextStore(self.user_id).load_context_manifest()
            if manifest:
                return {"source": "flat_file", "data": manifest}
        except Exception as e:
            logger.warning(f"Failed to load flat context manifest for user {self.user_id}: {e}")
        return {"source": "none", "data": {"documents": []}}

    async def get_merged_flat_context(self) -> Dict[str, Any]:
        """Return merged onboarding context from all available flat context documents.

        This is an aggregation helper; step-specific APIs still return one-by-one files.
        """
        store = AgentFlatContextStore(self.user_id)
        manifest = store.load_context_manifest() or {"documents": []}
        docs = manifest.get("documents") if isinstance(manifest.get("documents"), list) else []

        merged: Dict[str, Any] = {
            "source": "flat_file",
            "user_id": self.user_id,
            "manifest_updated_at": manifest.get("updated_at"),
            "steps": {},
            "agent_summaries": {},
            "documents": [],
        }

        for item in docs:
            if not isinstance(item, dict):
                continue
            path = item.get("path")
            if not path:
                continue
            doc = store.load_context_document(str(path)) or {}
            context_type = str(doc.get("context_type") or item.get("type") or path)
            merged["documents"].append(
                {
                    "path": path,
                    "context_type": context_type,
                    "updated_at": doc.get("updated_at") or item.get("updated_at"),
                    "size_bytes": item.get("size_bytes"),
                }
            )
            merged["steps"][context_type] = doc.get("data") if isinstance(doc.get("data"), dict) else {}
            merged["agent_summaries"][context_type] = doc.get("agent_summary") if isinstance(doc.get("agent_summary"), dict) else {}

        merged["document_count"] = len(merged["documents"])
        return merged
