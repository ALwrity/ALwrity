"""
LinkedIn Onboarding Strategy
=============================

Implements the LinkedIn-specific path through onboarding, reusing existing
LinkedIn Studio services:

    - Step 1: Connect LinkedIn (OAuth) + Profile pipeline (Phases 1-5)
              + post sync + writing style analysis
    - Step 2: Research via consolidated growth engine + competitor/creator discovery
    - Step 3: Persona generation (core + LinkedIn platform persona) — Phase 3
    - Step 4: Integrations / content preferences — Phase 4
    - Step 5: Finish / completion — Phase 4

This strategy does NOT write any new endpoints or services.  It
orchestrates the existing service calls inside the step dispatch.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from .base import LINKEDIN_TYPE


class LinkedInOnboardingStrategy:
    """Strategy for the ``linkedin`` onboarding type."""

    @property
    def onboarding_type(self) -> str:
        return LINKEDIN_TYPE

    @property
    def context_file_prefix(self) -> str:
        return "linkedin"

    async def complete_step(
        self,
        svc,
        step_number: int,
        user_id: str,
        request_data: Dict[str, Any],
        db: Session,
    ) -> Dict[str, Any]:
        """Execute LinkedIn-specific step logic.

        Returns ``{"warnings": [...]}`` if any non-blocking warnings
        occurred.  Raises ``HTTPException`` for blocking errors.
        """
        warnings: List[str] = []

        if step_number == 1:
            await self._complete_linkedin_step1(svc, user_id, request_data, db)
        elif step_number == 2:
            await self._complete_linkedin_step2(svc, user_id, request_data, db)
        elif step_number == 3:
            await self._complete_linkedin_step3(svc, user_id, request_data, db)
        elif step_number == 4:
            await self._complete_linkedin_step4(svc, user_id, request_data, db)
        elif step_number == 5:
            await self._complete_linkedin_step5(svc, user_id, request_data, db)

        return {"warnings": warnings if warnings else None}

    # ------------------------------------------------------------------
    # Step 1 -- Connect + Profile pipeline + Post sync + Writing style
    # (Merged: verifies OAuth connection, runs Phases 1-5, syncs posts,
    #  analyzes writing style, persists combined snapshot to flat-file)
    # ------------------------------------------------------------------

    async def _complete_linkedin_step1(self, svc, user_id, request_data, db):
        """Single user-facing step: Connect + Profile + Posts + Writing Style.

        The frontend ``LinkedInConnectStep`` handles the OAuth popup and
        shows progress indicators.  When the user clicks "Continue",
        this method verifies the connection, then runs the full profile
        pipeline (Phases 1-5), syncs the last 50 posts, and analyzes
        writing style from those posts.  All results are persisted to
        the ``linkedin_analysis_context`` SQLite table (via
        ``ProfileRepository``) and to the ``AgentFlatContextStore``
        flat-file for downstream persona generation.
        """
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.linkedin.types import LinkedInNotConnectedError

        oauth = LinkedInOAuthService()

        # ----------------------------------------------------------
        # Guard: if not connected, return auth URL for the frontend
        # ----------------------------------------------------------
        try:
            oauth.resolve_credentials(user_id)
        except LinkedInNotConnectedError:
            try:
                url_result = await oauth.generate_authorization_url(user_id=user_id)
                auth_url = url_result.get("url") or url_result.get("auth_url") if isinstance(url_result, dict) else str(url_result)
            except Exception as url_err:
                logger.warning(f"[linkedin_step1] Failed to generate auth URL: {url_err}")
                auth_url = None
            return {
                "connected": False,
                "auth_url": auth_url,
                "message": "LinkedIn connection not established. Use the auth_url to connect.",
            }

        logger.info(f"[linkedin_step1] User {user_id} verified LinkedIn connection")

        # ----------------------------------------------------------
        # Save LinkedIn as a platform integration entry
        # ----------------------------------------------------------
        try:
            from models.onboarding import PlatformIntegration
            from datetime import datetime
            session = svc._get_or_create_session(user_id, db)
            if session.platform_integrations:
                pi = session.platform_integrations
            else:
                pi = PlatformIntegration(session_id=session.id)
                db.add(pi)
            social_platforms = pi.social_platforms or {}
            social_platforms.setdefault("linkedin", True)
            pi.social_platforms = social_platforms
            connected = pi.connected_platforms or []
            if "linkedin" not in connected:
                connected.append("linkedin")
            pi.connected_platforms = connected
            pi.updated_at = datetime.utcnow()
            db.commit()
        except Exception as e:
            logger.warning(f"[linkedin_step1] Failed to save platform integration: {e}")
            db.rollback()

        # ----------------------------------------------------------
        # Sub-step 1: Profile pipeline (Phases 1-5)
        # ----------------------------------------------------------
        profile_summary = await self._run_profile_pipeline(user_id, oauth, request_data)

        # ----------------------------------------------------------
        # Sub-step 2: Post analytics sync
        # ----------------------------------------------------------
        post_summary = await self._sync_posts(user_id, oauth, db)

        # ----------------------------------------------------------
        # Sub-step 3: Writing style analysis from past posts
        # ----------------------------------------------------------
        writing_style = self._analyze_writing_style(user_id, db)

        # ----------------------------------------------------------
        # Persist combined snapshot to flat-file context
        # ----------------------------------------------------------
        self._persist_profile_context(user_id, profile_summary, post_summary, writing_style)

        logger.info(
            f"[linkedin_step1] Complete for {user_id}: "
            f"profile={profile_summary.get('name', 'Unknown')}, "
            f"posts={post_summary.get('count', 0)}, "
            f"writing_style={'yes' if writing_style else 'failed'}"
        )

        return {
            "connected": True,
            "profile": {
                "name": profile_summary.get("name"),
                "headline": profile_summary.get("headline"),
                "industry": profile_summary.get("industry"),
                "completeness_score": profile_summary.get("completeness_score"),
                "post_count": post_summary.get("count", 0),
                "writing_style_available": bool(writing_style),
            },
        }

    async def _run_profile_pipeline(self, user_id, oauth, request_data) -> Dict[str, Any]:
        """Run Phases 1-5 of the profile pipeline.

        Orchestrates the same service calls as ``GET /api/linkedin-social/profile``
        but without the FastAPI request context.  Persists to per-user
        SQLite via ProfileRepository.
        """
        from services.integrations.linkedin.profile_repository import ProfileRepository
        from services.integrations.linkedin.profile_service import get_or_fetch_profile
        from services.integrations.linkedin.profile_context_service import (
            get_or_build_profile_context,
        )
        from services.integrations.linkedin.profile_validation_service import (
            get_or_validate_profile_context,
        )
        from services.integrations.linkedin.profile_intelligence_service import (
            get_or_generate_profile_intelligence,
        )

        repository = ProfileRepository(oauth=oauth)
        refresh = bool(request_data.get("refresh", False) if request_data else False)

        # Phase 1: Acquire profile (async)
        profile, meta = await get_or_fetch_profile(
            user_id, refresh=refresh, oauth=oauth
        )

        # Phase 2: Build context (sync)
        profile_context, ctx_meta = get_or_build_profile_context(
            user_id,
            profile,
            profile_content_hash=meta.get("profile_content_hash"),
            repository=repository,
        )

        # Phase 3: Validate (sync)
        profile_validation, _ = get_or_validate_profile_context(
            user_id, profile_context, repository=repository
        )

        # Phase 5: AI intelligence (sync, gated on complete profile)
        ai_intelligence = None
        if profile_validation and profile_validation.get("is_profile_complete"):
            try:
                ai_intelligence, _ = get_or_generate_profile_intelligence(
                    user_id,
                    profile_context,
                    profile_validation=profile_validation,
                    repository=repository,
                )
            except Exception as e:
                logger.warning(f"[linkedin_step1] AI intelligence generation failed: {e}")

        # Build summary for flat-file context
        return {
            "name": profile.get("name", ""),
            "headline": profile.get("headline", ""),
            "industry": profile_context.get("industry", ""),
            "location": profile.get("location", ""),
            "profile_content_hash": meta.get("profile_content_hash"),
            "completeness_score": float(profile_validation.get("completeness_score", 0)) if profile_validation else 0.0,
            "is_profile_complete": bool(profile_validation.get("is_profile_complete", False)) if profile_validation else False,
            "optimization_score": float(profile_validation.get("optimization_score", 0)) if profile_validation else 0.0,
            "missing_fields": list(profile_validation.get("missing_fields", [])) if profile_validation else [],
            "section_scores": dict(profile_validation.get("section_scores", {})) if profile_validation else {},
            "ai_intelligence": ai_intelligence,
            "profile_context": profile_context,
        }

    async def _sync_posts(self, user_id, oauth, db) -> Dict[str, Any]:
        """Fetch posts from Unipile and persist to DB.

        Replicates the logic in ``GET /api/linkedin/post-analytics?refresh=true``
        but without FastAPI context.  Returns a summary.
        """
        from services.integrations.linkedin.types import LinkedInNotConnectedError
        from services.integrations.linkedin.unipile_client import (
            UnipileClient,
            personal_profile_provider_id_from_owner,
        )
        from services.integrations.linkedin.posts_service import get_posts_service
        from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService

        try:
            creds = oauth.resolve_credentials(user_id)
        except LinkedInNotConnectedError:
            return {"count": 0, "error": "not_connected"}

        account_id = creds.unipile_account_id
        client = UnipileClient()

        try:
            profile = await client.get_own_profile(account_id)
            identifier = personal_profile_provider_id_from_owner(profile)
            if not identifier:
                return {"count": 0, "error": "no_identifier"}
        except Exception as e:
            logger.warning(f"[linkedin_step1] Failed to resolve identifier: {e}")
            return {"count": 0, "error": str(e)}

        try:
            posts_service = get_posts_service()
            result = await posts_service.fetch_user_posts(
                account_id=account_id,
                identifier=identifier,
                limit=50,
            )
            analytics_service = LinkedInPostAnalyticsService(db)
            count = analytics_service.store_posts(user_id, result.posts)
            return {"count": count}
        except Exception as e:
            logger.warning(f"[linkedin_step1] Post sync failed: {e}")
            return {"count": 0, "error": str(e)}

    def _analyze_writing_style(self, user_id, db) -> Optional[Dict[str, Any]]:
        """Analyze writing style of past LinkedIn posts.

        Pulls all post texts from the DB, concatenates them, and feeds
        them to the EnhancedLinguisticAnalyzer (same analyzer used for
        website crawl text).  Returns None on failure.
        """
        from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService

        try:
            analytics_service = LinkedInPostAnalyticsService(db)
            stored = analytics_service.get_stored_analytics(user_id)
            post_texts = [
                post.text for post in stored.posts
                if post.text and len(post.text.strip()) > 10
            ]
            if not post_texts:
                logger.info(f"[linkedin_step1] No post texts available for writing style analysis")
                return None

            from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer

            analyzer = get_linguistic_analyzer()
            result = analyzer.analyze_writing_style(post_texts)
            if "error" in result:
                logger.warning(f"[linkedin_step1] Writing style analysis error: {result['error']}")
                return None
            return result
        except Exception as e:
            logger.warning(f"[linkedin_step1] Writing style analysis failed: {e}")
            return None

    def _persist_profile_context(
        self,
        user_id,
        profile_summary: Dict[str, Any],
        post_summary: Dict[str, Any],
        writing_style: Optional[Dict[str, Any]],
    ) -> None:
        """Persist the combined LinkedIn profile snapshot to flat-file context.

        Stored as ``linkedin_step2_profile.json`` in the AgentFlatContextStore,
        parallel to ``step2_website_analysis.json`` for website sessions.
        """
        try:
            from datetime import datetime
            from services.intelligence.agent_flat_context import AgentFlatContextStore

            flat_store = AgentFlatContextStore(user_id)
            canonical_payload = {
                "onboarding_type": "linkedin",
                "analysis_date": datetime.utcnow().isoformat(),
                "profile_snapshot": {
                    "name": profile_summary.get("name"),
                    "headline": profile_summary.get("headline"),
                    "industry": profile_summary.get("industry"),
                    "location": profile_summary.get("location"),
                    "completeness_score": profile_summary.get("completeness_score"),
                    "is_profile_complete": profile_summary.get("is_profile_complete"),
                    "optimization_score": profile_summary.get("optimization_score"),
                    "missing_fields": profile_summary.get("missing_fields"),
                    "section_scores": profile_summary.get("section_scores"),
                },
                "profile_context": profile_summary.get("profile_context"),
                "ai_intelligence": profile_summary.get("ai_intelligence"),
                "writing_style_analysis": writing_style,
                "post_summary": {
                    "count": post_summary.get("count", 0),
                    "error": post_summary.get("error"),
                },
                "saved_at": datetime.utcnow().isoformat(),
            }
            flat_store.save_step2_website_analysis(
                canonical_payload, source="onboarding_linkedin_step1"
            )
            logger.info(f"[linkedin_step1] Persisted profile context to flat store for {user_id}")
        except Exception as e:
            logger.warning(f"[linkedin_step1] Failed to persist flat context: {e}")

    # ------------------------------------------------------------------
    # Step 2 -- Research via growth engine + competitor/creator discovery
    # ------------------------------------------------------------------

    async def _complete_linkedin_step2(self, svc, user_id, request_data, db):
        """Step 2: LinkedIn research via consolidated growth engine.

        Calls ``ConsolidatedGrowthService.analyze_all(user_id)`` (single LLM
        call, 1h cache) to produce all 7 growth sections: trending topics,
        content gaps, viral patterns, network suggestions, engagement
        opportunities, weekly strategy, and brand scorecard.

        Optionally enriches with explicit competitor/creator discovery via
        Unipile search (``people`` / ``companies`` by industry) when an
        ``industry`` is resolved from the profile context.

        Persists the combined result to flat-file context
        (``step3_research_preferences.json``) for the persona step to
        consume.  Also saves minimal research preferences (research_depth,
        content_types) to the ``ResearchPreferences`` model so the
        existing persona pipeline finds expected data.
        """
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.linkedin.types import LinkedInNotConnectedError

        oauth = LinkedInOAuthService()

        # Guard: must be connected (profile pipeline must have run in step 2)
        try:
            oauth.resolve_credentials(user_id)
        except LinkedInNotConnectedError:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="LinkedIn connection required. Please complete step 1 first.",
            )

        # ----------------------------------------------------------
        # Sub-step 1: Consolidated growth analysis (single LLM call)
        # ----------------------------------------------------------
        growth_data = await self._run_growth_analysis(user_id)

        # ----------------------------------------------------------
        # Sub-step 2: Optional competitor/creator discovery
        # ----------------------------------------------------------
        search_results = await self._discover_competitors_and_creators(user_id, oauth)

        # ----------------------------------------------------------
        # Sub-step 3: Persist research preferences to DB
        # (so existing persona pipeline finds required fields)
        # ----------------------------------------------------------
        try:
            svc._save_research_preferences(
                user_id,
                {
                    "research_depth": "Comprehensive",
                    "content_types": ["LinkedIn Posts", "Articles", "Carousels"],
                    "auto_research": True,
                    "factual_content": True,
                    # Inject LinkedIn-specific context for persona
                    "industry_context": (
                        growth_data.get("trending", {}).get("trending_industry")
                        if growth_data.get("trending")
                        else None
                    ),
                    "competitors": (
                        search_results.get("competitors", []) if search_results else []
                    ),
                },
                db,
            )
        except Exception as e:
            logger.warning(f"[linkedin_step2] Failed to save research preferences: {e}")

        # ----------------------------------------------------------
        # Sub-step 4: Persist combined snapshot to flat-file context
        # ----------------------------------------------------------
        self._persist_research_context(user_id, growth_data, search_results)

        logger.info(f"[linkedin_step2] Complete for {user_id}")

    async def _run_growth_analysis(self, user_id) -> Dict[str, Any]:
        """Run consolidated 7-in-1 growth analysis.

        Returns a dict suitable for flat-file serialization.  All errors
        are non-blocking (logged + safe defaults).
        """
        try:
            from services.linkedin.growth.consolidated_growth_service import (
                ConsolidatedGrowthService,
            )

            service = ConsolidatedGrowthService()
            response = await service.analyze_all(user_id)

            # Serialize Pydantic model to dict (use model_dump for v2)
            try:
                return response.model_dump(mode="json")
            except AttributeError:
                # Pydantic v1 fallback
                return response.dict()
        except Exception as e:
            logger.warning(f"[linkedin_step2] Growth analysis failed: {e}")
            return {"error": str(e)}

    async def _discover_competitors_and_creators(self, user_id, oauth) -> Dict[str, Any]:
        """Discover LinkedIn companies and people in the user's industry.

        Uses the async Unipile search API.  Non-blocking -- returns
        empty lists on failure.  Requires the profile context (with
        ``industry``) to have been populated by step 2.
        """
        try:
            from services.integrations.linkedin.profile_repository import ProfileRepository

            repo = ProfileRepository(oauth=oauth)
            profile_context = repo.get_profile_context(user_id)
            if not profile_context:
                return {"competitors": [], "creators": [], "error": "no_profile_context"}

            industry = profile_context.get("industry")
            if not industry:
                return {"competitors": [], "creators": [], "error": "no_industry"}

            from services.integrations.linkedin.linkedin_search_service import (
                perform_search,
            )
            from models.linkedin_search_models import LinkedInSearchRequest

            competitors: List[Dict[str, Any]] = []
            creators: List[Dict[str, Any]] = []

            # Search for companies in the industry
            try:
                company_req = LinkedInSearchRequest(
                    api="classic",
                    category="companies",
                    keywords=industry,
                    limit=5,
                )
                company_res = await perform_search(user_id, company_req, oauth=oauth)
                competitors = [
                    {"name": item.get("name", ""), "url": item.get("url", ""), "headline": item.get("headline", "")}
                    for item in (company_res.items or [])[:5]
                ]
            except Exception as e:
                logger.warning(f"[linkedin_step2] Company search failed: {e}")

            # Search for people/creators in the industry
            try:
                people_req = LinkedInSearchRequest(
                    api="classic",
                    category="people",
                    keywords=industry,
                    limit=5,
                )
                people_res = await perform_search(user_id, people_req, oauth=oauth)
                creators = [
                    {"name": item.get("name", ""), "url": item.get("url", ""), "headline": item.get("headline", "")}
                    for item in (people_res.items or [])[:5]
                ]
            except Exception as e:
                logger.warning(f"[linkedin_step2] People search failed: {e}")

            return {"competitors": competitors, "creators": creators}
        except Exception as e:
            logger.warning(f"[linkedin_step2] Discovery failed: {e}")
            return {"competitors": [], "creators": [], "error": str(e)}

    def _persist_research_context(
        self,
        user_id,
        growth_data: Dict[str, Any],
        search_results: Dict[str, Any],
    ) -> None:
        """Persist the combined LinkedIn research snapshot to flat-file context.

        Stored via ``save_step3_research_preferences`` (same file the
        website path uses) with ``onboarding_type: "linkedin"``
        disambiguation.  The persona step will read this back.
        """
        try:
            from datetime import datetime
            from services.intelligence.agent_flat_context import AgentFlatContextStore

            flat_store = AgentFlatContextStore(user_id)
            canonical_payload = {
                "onboarding_type": "linkedin",
                "research_date": datetime.utcnow().isoformat(),
                "growth_analysis": growth_data,
                "competitor_discovery": search_results.get("competitors", []),
                "creator_discovery": search_results.get("creators", []),
                "research_depth": "Comprehensive",
                "content_types": ["LinkedIn Posts", "Articles", "Carousels"],
                "saved_at": datetime.utcnow().isoformat(),
            }
            flat_store.save_step3_research_preferences(
                canonical_payload, source="onboarding_linkedin_step2"
            )
            logger.info(f"[linkedin_step2] Persisted research context to flat store for {user_id}")
        except Exception as e:
            logger.warning(f"[linkedin_step2] Failed to persist flat context: {e}")

    async def _complete_linkedin_step3(self, svc, user_id, request_data, db):
        """Step 3: Generate core persona + LinkedIn platform persona.

        Loads the profile snapshot (step 1) and research data (step 2) from
        flat-file context, builds an ``onboarding_data`` adapter that maps
        LinkedIn profile/growth outputs into the shape the existing
        ``CorePersonaService`` and ``LinkedInPersonaService`` expect, then
        runs the persona chain:

            CorePersonaService.generate_core_persona()
            → LinkedInPersonaService.generate_linkedin_persona()
            → optional quality-improvement loop

        Persists results to ``PersonaData`` (``platform_personas["linkedin"]``)
        and to flat-file context for downstream consumption.
        """
        from services.intelligence.agent_flat_context import AgentFlatContextStore

        flat_store = AgentFlatContextStore(user_id)

        # ----------------------------------------------------------
        # 1. Load previous steps' flat-file snapshots
        # ----------------------------------------------------------
        step1_doc = flat_store.load_step2_context_document() or {}
        step1_data = (
            step1_doc.get("data")
            if isinstance(step1_doc, dict) and isinstance(step1_doc.get("data"), dict)
            else {}
        )
        step2_doc = flat_store.load_step3_context_document() or {}
        step2_data = (
            step2_doc.get("data")
            if isinstance(step2_doc, dict) and isinstance(step2_doc.get("data"), dict)
            else {}
        )

        profile_snapshot = step1_data.get("profile_snapshot", {})
        profile_context = step1_data.get("profile_context", {})
        ai_intelligence = step1_data.get("ai_intelligence")
        writing_style = step1_data.get("writing_style_analysis")
        growth_data = step2_data.get("growth_analysis", {})

        logger.info(
            f"[linkedin_step3] Building persona for {user_id}: "
            f"industry={profile_snapshot.get('industry')}, "
            f"growth={'yes' if growth_data else 'no'}, "
            f"style={'yes' if writing_style else 'no'}"
        )

        # ----------------------------------------------------------
        # 2. Build onboarding_data adapter
        # ----------------------------------------------------------
        onboarding_data = self._build_linkedin_onboarding_data(
            user_id=user_id,
            profile_snapshot=profile_snapshot,
            profile_context=profile_context,
            ai_intelligence=ai_intelligence,
            growth_data=growth_data,
            writing_style=writing_style,
        )

        # ----------------------------------------------------------
        # 3. Generate core persona (reuse existing service)
        # ----------------------------------------------------------
        from services.persona.core_persona.core_persona_service import CorePersonaService

        core_service = CorePersonaService()
        core_persona = core_service.generate_core_persona(onboarding_data)

        if "error" in core_persona:
            logger.error(f"[linkedin_step3] Core persona generation failed: {core_persona['error']}")
            raise Exception(f"Core persona generation failed: {core_persona['error']}")

        logger.info(f"[linkedin_step3] Core persona generated for {user_id}")

        # ----------------------------------------------------------
        # 4. Generate LinkedIn platform persona (reuse existing service)
        # ----------------------------------------------------------
        from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService

        linkedin_service = LinkedInPersonaService()
        linkedin_persona = linkedin_service.generate_linkedin_persona(
            core_persona, onboarding_data
        )

        if "error" in linkedin_persona:
            logger.error(f"[linkedin_step3] LinkedIn persona generation failed: {linkedin_persona['error']}")
            raise Exception(f"LinkedIn persona generation failed: {linkedin_persona['error']}")

        validation = linkedin_persona.get("validation_results", {})
        quality_score = float(validation.get("quality_score", 0))
        logger.info(
            f"[linkedin_step3] LinkedIn persona for {user_id}: "
            f"quality={quality_score:.1f}%, valid={validation.get('is_valid')}"
        )

        # ----------------------------------------------------------
        # 5. Optional: quality-improvement loop (non-blocking)
        # ----------------------------------------------------------
        if quality_score < 70.0:
            try:
                from services.persona.persona_quality_improver import PersonaQualityImprover

                improver = PersonaQualityImprover()
                quality_result = improver.assess_persona_quality_comprehensive(
                    core_persona=core_persona,
                    platform_personas={"linkedin": linkedin_persona},
                    linguistic_analysis=writing_style or {},
                )
                improved = improver.improve_persona_quality(
                    core_persona=core_persona,
                    platform_personas={"linkedin": linkedin_persona},
                    quality_metrics=quality_result,
                )
                if "error" not in improved:
                    core_persona = improved.get("core_persona", core_persona)
                    linkedin_persona = improved.get("platform_personas", {}).get(
                        "linkedin", linkedin_persona
                    )
                    logger.info(f"[linkedin_step3] Quality improvements applied for {user_id}")
            except Exception as e:
                logger.warning(f"[linkedin_step3] Quality improvement loop failed: {e}")

        # ----------------------------------------------------------
        # 6. Persist to PersonaData model (reuse _save_persona_data)
        # ----------------------------------------------------------
        persona_payload = {
            "corePersona": core_persona,
            "platformPersonas": {"linkedin": linkedin_persona},
            "qualityMetrics": {
                "linkedin_quality_score": quality_score,
                "linkedin_valid": validation.get("is_valid", False),
                "linkedin_completeness_score": validation.get("completeness_score", 0),
                "linkedin_optimization_score": validation.get("linkedin_optimization_score", 0),
            },
            "selectedPlatforms": ["linkedin"],
        }
        try:
            svc._save_persona_data(user_id, persona_payload, db)
            logger.info(f"[linkedin_step3] Persona data persisted to DB for {user_id}")
        except Exception as e:
            logger.error(f"[linkedin_step3] Failed to persist persona data: {e}")
            raise

        # ----------------------------------------------------------
        # 7. Persist to flat-file context
        # ----------------------------------------------------------
        try:
            from datetime import datetime

            flat_payload = {
                "onboarding_type": "linkedin",
                "generation_date": datetime.utcnow().isoformat(),
                "core_persona": core_persona,
                "platform_personas": {"linkedin": linkedin_persona},
                "quality_metrics": persona_payload["qualityMetrics"],
                "selected_platforms": ["linkedin"],
                "saved_at": datetime.utcnow().isoformat(),
            }
            flat_store.save_step4_persona_data(flat_payload, source="onboarding_linkedin_step3")
            logger.info(f"[linkedin_step3] Persona context saved to flat store for {user_id}")
        except Exception as e:
            logger.warning(f"[linkedin_step3] Failed to save persona flat context: {e}")

        logger.info(f"[linkedin_step3] Complete for {user_id}")

    def _build_linkedin_onboarding_data(
        self,
        user_id: str,
        profile_snapshot: Dict[str, Any],
        profile_context: Dict[str, Any],
        ai_intelligence: Optional[Dict[str, Any]],
        growth_data: Dict[str, Any],
        writing_style: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Map LinkedIn Studio outputs → the onboarding_data shape persona services expect.

        Reuses the exact same ``CorePersonaService`` and
        ``LinkedInPersonaService`` by feeding them a synthetic
        ``onboarding_data`` dict that mirrors the website path's structure.
        """
        industry = profile_snapshot.get("industry") or profile_context.get("industry", "general")
        headline = profile_snapshot.get("headline") or profile_context.get("headline", "")
        location = profile_snapshot.get("location") or profile_context.get("location", "")
        name = profile_snapshot.get("name", "")

        # Derive professional context from AI intelligence
        expertise_level = self._derive_expertise_level(ai_intelligence)
        demographics = self._derive_demographics(ai_intelligence, profile_context)
        psychographic = self._derive_psychographics(ai_intelligence)
        pain_points = self._derive_pain_points(ai_intelligence)
        motivations = self._derive_motivations(ai_intelligence)
        brand_voice = self._derive_brand_voice(ai_intelligence, profile_context)
        brand_values = self._derive_brand_values(ai_intelligence)
        positioning = self._derive_positioning(ai_intelligence, profile_context)
        company_size = self._derive_company_size(ai_intelligence)

        # Build enhanced_analysis from writing style + growth data
        comprehensive_style = self._build_comprehensive_style_analysis(writing_style)
        audience_intelligence = {
            "industry_focus": industry,
            "expertise_level": expertise_level,
            "geographic_focus": location,
            "demographics": demographics,
            "psychographic_profile": psychographic,
            "pain_points": pain_points,
            "motivations": motivations,
        }
        brand_voice_analysis = {
            "primary_content_type": "thought_leadership",
            "conversion_focus": "engagement",
            "educational_value": "high",
            "brand_voice": brand_voice,
            "brand_values": brand_values,
        }

        # Extract competitor/creator data from growth research
        competitor_discovery = []
        if isinstance(growth_data, dict):
            competitor_discovery = growth_data.get("competitor_discovery", [])
            if not competitor_discovery:
                # Fallback: try top-level growth fields
                competitor_discovery = growth_data.get("competitors", [])

        return {
            "session_info": {"user_id": user_id},
            # website_analysis key kept for prompt contract compatibility
            "website_analysis": {
                "website_url": f"linkedin.com/in/{name}" if name else "linkedin.com",
                "target_audience": {
                    "industry_focus": industry,
                    "expertise_level": expertise_level,
                    "geographic_focus": location,
                    "demographics": demographics,
                    "psychographic_profile": psychographic,
                    "pain_points": pain_points,
                    "motivations": motivations,
                },
                "content_type": {
                    "purpose": "thought_leadership",
                    "conversion_focus": "engagement",
                    "educational_value": "high",
                },
                "crawl_result": {
                    "domain_info": {
                        "company_size": company_size,
                        "business_model": "personal_brand",
                    },
                    "brand_info": {
                        "professional_role": headline or "Professional",
                        "brand_name": name,
                    },
                },
                "writing_style": writing_style or {},
                "content_characteristics": writing_style or {},
                "brand_analysis": {
                    "brand_voice": brand_voice,
                    "brand_values": brand_values,
                    "positioning_statement": positioning,
                },
            },
            "research_preferences": {
                "research_depth": "Comprehensive",
                "content_types": ["LinkedIn Posts", "Articles", "Carousels"],
                "auto_research": True,
                "factual_content": True,
            },
            "enhanced_analysis": {
                "comprehensive_style_analysis": comprehensive_style,
                "audience_intelligence": audience_intelligence,
                "brand_voice_analysis": brand_voice_analysis,
                "competitive_analysis": {
                    "competitors": competitor_discovery,
                },
                "technical_writing_metrics": {
                    "sentence_length_preference": writing_style.get("basic_metrics", {}).get("average_sentence_length", "")
                    if isinstance(writing_style, dict)
                    else "",
                    "vocabulary_patterns": writing_style.get("vocabulary_analysis", {}).get("vocabulary_sophistication", {})
                    if isinstance(writing_style, dict)
                    else {},
                    "style_consistency": writing_style.get("consistency_analysis", {}).get("consistency_score", "")
                    if isinstance(writing_style, dict)
                    else "",
                },
            },
        }

    # ------------------------------------------------------------------
    # Derivation helpers — extract human-readable signals from AI
    # intelligence so the persona prompts have concrete data to ground on.
    # ------------------------------------------------------------------

    @staticmethod
    def _derive_expertise_level(ai_intelligence: Optional[Dict[str, Any]]) -> str:
        if not ai_intelligence:
            return "intermediate"
        positioning = ai_intelligence.get("positioning", {})
        seniority = positioning.get("seniority", "")
        if seniority:
            return seniority
        # Infer from experience length or title keywords
        exp_years = ai_intelligence.get("experience_years", 0)
        if isinstance(exp_years, (int, float)) and exp_years >= 10:
            return "senior"
        if isinstance(exp_years, (int, float)) and exp_years >= 5:
            return "mid-level"
        return "intermediate"

    @staticmethod
    def _derive_demographics(
        ai_intelligence: Optional[Dict[str, Any]], profile_context: Dict[str, Any]
    ) -> List[str]:
        out: List[str] = []
        industry = profile_context.get("industry", "")
        if industry:
            out.append(f"{industry} professionals")
        if ai_intelligence:
            target = ai_intelligence.get("target_audience", {})
            if isinstance(target, dict):
                for k in ("job_titles", "roles", "seniority_levels"):
                    vals = target.get(k, [])
                    if isinstance(vals, list):
                        out.extend(vals)
        return out if out else ["B2B professionals"]

    @staticmethod
    def _derive_psychographics(ai_intelligence: Optional[Dict[str, Any]]) -> str:
        if not ai_intelligence:
            return "Career-focused professionals seeking industry insights and networking opportunities"
        psych = ai_intelligence.get("psychographic_profile", "")
        if isinstance(psych, str) and psych:
            return psych
        values = ai_intelligence.get("values", [])
        if isinstance(values, list) and values:
            return f"Values: {', '.join(str(v) for v in values[:5])}"
        return "Professionals focused on career growth, industry knowledge, and meaningful business relationships"

    @staticmethod
    def _derive_pain_points(ai_intelligence: Optional[Dict[str, Any]]) -> List[str]:
        if not ai_intelligence:
            return ["Staying current with industry trends", "Building professional credibility"]
        pains = ai_intelligence.get("pain_points", [])
        if isinstance(pains, list) and pains:
            return [str(p) for p in pains[:6]]
        challenges = ai_intelligence.get("challenges", [])
        if isinstance(challenges, list) and challenges:
            return [str(c) for c in challenges[:6]]
        return ["Staying current with industry trends", "Building professional credibility"]

    @staticmethod
    def _derive_motivations(ai_intelligence: Optional[Dict[str, Any]]) -> List[str]:
        if not ai_intelligence:
            return ["Thought leadership", "Professional networking", "Career advancement"]
        mots = ai_intelligence.get("motivations", [])
        if isinstance(mots, list) and mots:
            return [str(m) for m in mots[:6]]
        goals = ai_intelligence.get("career_goals", [])
        if isinstance(goals, list) and goals:
            return [str(g) for g in goals[:6]]
        return ["Thought leadership", "Professional networking", "Career advancement"]

    @staticmethod
    def _derive_brand_voice(
        ai_intelligence: Optional[Dict[str, Any]], profile_context: Dict[str, Any]
    ) -> str:
        if not ai_intelligence:
            return "Professional, authoritative, and approachable"
        voice = ai_intelligence.get("brand_voice", "")
        if isinstance(voice, str) and voice:
            return voice
        tone = ai_intelligence.get("tone", "")
        style = ai_intelligence.get("writing_style", "")
        if tone and style:
            return f"{tone}, {style}"
        headline = profile_context.get("headline", "")
        if headline:
            return f"Reflects the professional identity of: {headline}"
        return "Professional, authoritative, and approachable"

    @staticmethod
    def _derive_brand_values(ai_intelligence: Optional[Dict[str, Any]]) -> List[str]:
        if not ai_intelligence:
            return ["Professional excellence", "Knowledge sharing", "Authenticity"]
        vals = ai_intelligence.get("values", [])
        if isinstance(vals, list) and vals:
            return [str(v) for v in vals[:6]]
        principles = ai_intelligence.get("principles", [])
        if isinstance(principles, list) and principles:
            return [str(p) for p in principles[:6]]
        return ["Professional excellence", "Knowledge sharing", "Authenticity"]

    @staticmethod
    def _derive_positioning(
        ai_intelligence: Optional[Dict[str, Any]], profile_context: Dict[str, Any]
    ) -> str:
        industry = profile_context.get("industry", "")
        headline = profile_context.get("headline", "")
        if ai_intelligence:
            pos = ai_intelligence.get("positioning", {})
            if isinstance(pos, dict):
                statement = pos.get("statement", "")
                if statement:
                    return statement
        if industry and headline:
            return f"{headline} in the {industry} space"
        return "Thought leader and industry professional"

    @staticmethod
    def _derive_company_size(ai_intelligence: Optional[Dict[str, Any]]) -> str:
        if not ai_intelligence:
            return "Not specified"
        org = ai_intelligence.get("organization", {})
        if isinstance(org, dict):
            size = org.get("size", "")
            if size:
                return size
        return "Not specified"

    @staticmethod
    def _build_comprehensive_style_analysis(
        writing_style: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not writing_style or not isinstance(writing_style, dict):
            return {
                "tone_analysis": "Professional and authoritative",
                "voice_characteristics": "Clear, direct communication",
                "complexity_assessment": "Moderate complexity suitable for B2B audience",
                "brand_personality": "Professional thought leader",
                "formality_level": "Semi-formal",
                "emotional_appeal": "Measured and credible",
            }
        bm = writing_style.get("basic_metrics", {}) or {}
        sa = writing_style.get("sentence_analysis", {}) or {}
        va = writing_style.get("vocabulary_analysis", {}) or {}
        ra = writing_style.get("readability_analysis", {}) or {}
        ea = writing_style.get("emotional_analysis", {}) or {}
        ca = writing_style.get("consistency_analysis", {}) or {}

        return {
            "tone_analysis": ea.get("sentiment_bias", "Professional"),
            "voice_characteristics": f"Sentence length avg {bm.get('average_sentence_length', '?')} words, "
            f"vocab diversity {va.get('lexical_diversity', '?')}",
            "complexity_assessment": f"Flesch grade {ra.get('flesch_kincaid_grade', '?')}, "
            f"complexity score {ra.get('complexity_score', '?')}",
            "brand_personality": f"Consistency {ca.get('consistency_score', '?')}%",
            "formality_level": "Semi-formal" if (bm.get("average_word_length", 0) or 0) > 5 else "Conversational",
            "emotional_appeal": f"Intensity {ea.get('emotional_intensity', '?')}%",
        }

    async def _complete_linkedin_step4(self, svc, user_id, request_data, db):
        """Step 4: Content preferences + optional integrations metadata.

        LinkedIn is already connected from step 1.  This step records any
        user-provided content preferences (posting cadence, preferred formats)
        into the session payload and ensures the integration entry is complete.
        """
        from datetime import datetime
        from models.onboarding import PlatformIntegration

        # ----------------------------------------------------------
        # 1. Ensure LinkedIn integration is recorded
        # ----------------------------------------------------------
        try:
            session = svc._get_or_create_session(user_id, db)
            if session.platform_integrations:
                pi = session.platform_integrations
            else:
                pi = PlatformIntegration(session_id=session.id)
                db.add(pi)
            social_platforms = pi.social_platforms or {}
            social_platforms.setdefault("linkedin", True)
            pi.social_platforms = social_platforms
            connected = pi.connected_platforms or []
            if "linkedin" not in connected:
                connected.append("linkedin")
            pi.connected_platforms = connected
            pi.updated_at = datetime.utcnow()
            db.commit()
            logger.info(f"[linkedin_step4] LinkedIn integration confirmed for {user_id}")
        except Exception as e:
            logger.warning(f"[linkedin_step4] Failed to confirm integration: {e}")
            db.rollback()

        # ----------------------------------------------------------
        # 2. Save content preferences from request_data if provided
        # ----------------------------------------------------------
        preferences = request_data.get("data") or request_data or {}
        if preferences and isinstance(preferences, dict):
            try:
                session = svc._get_or_create_session(user_id, db)
                payload = dict(session.payload) if session.payload else {}
                payload["linkedin_content_preferences"] = {
                    "posting_cadence": preferences.get("postingCadence", preferences.get("posting_cadence")),
                    "preferred_formats": preferences.get("preferredFormats", preferences.get("preferred_formats", ["posts", "articles", "carousels"])),
                    "content_topics": preferences.get("contentTopics", preferences.get("content_topics", [])),
                    "engagement_goals": preferences.get("engagementGoals", preferences.get("engagement_goals")),
                    "saved_at": datetime.utcnow().isoformat(),
                }
                session.payload = payload
                db.add(session)
                db.commit()
                logger.info(f"[linkedin_step4] Content preferences saved for {user_id}")
            except Exception as e:
                logger.warning(f"[linkedin_step4] Failed to save preferences: {e}")
                db.rollback()

    async def _complete_linkedin_step5(self, svc, user_id, request_data, db):
        """Step 5: Finish — validate, progressive setup, summary, mark complete.

        Validates that all prerequisites (connection, profile, persona) are
        in place, initializes the user environment via
        ``ProgressiveSetupService``, records completion metadata, and
        schedules LinkedIn-specific background tasks.
        """
        from datetime import datetime
        from services.intelligence.agent_flat_context import AgentFlatContextStore

        # ----------------------------------------------------------
        # 1. Validate prerequisites
        # ----------------------------------------------------------
        validation_errors = []

        # Check connection
        try:
            from services.integrations.linkedin_oauth import LinkedInOAuthService
            from services.integrations.linkedin.types import LinkedInNotConnectedError

            oauth = LinkedInOAuthService()
            oauth.resolve_credentials(user_id)
        except LinkedInNotConnectedError:
            validation_errors.append("LinkedIn account not connected")

        # Check profile context exists (from flat file or DB)
        try:
            from services.integrations.linkedin.profile_repository import ProfileRepository

            repo = ProfileRepository(oauth=oauth)
            profile_context = repo.get_profile_context(user_id)
            if not profile_context:
                validation_errors.append("LinkedIn profile context not found")
        except Exception as e:
            logger.warning(f"[linkedin_step5] Could not validate profile context: {e}")

        # Check persona exists
        try:
            flat_store = AgentFlatContextStore(user_id)
            persona_doc = flat_store.load_step4_context_document()
            if not persona_doc:
                # Fallback: check DB
                from models.onboarding import PersonaData
                session = svc._get_or_create_session(user_id, db)
                existing_persona = db.query(PersonaData).filter(
                    PersonaData.session_id == session.id
                ).first()
                if not existing_persona or not existing_persona.platform_personas:
                    validation_errors.append("LinkedIn persona not generated")
        except Exception as e:
            logger.warning(f"[linkedin_step5] Could not validate persona: {e}")

        if validation_errors:
            logger.error(f"[linkedin_step5] Validation failed for {user_id}: {validation_errors}")
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Cannot complete onboarding: {'; '.join(validation_errors)}",
            )

        logger.info(f"[linkedin_step5] All prerequisites validated for {user_id}")

        # ----------------------------------------------------------
        # 2. Progressive setup — initialize user environment
        # ----------------------------------------------------------
        try:
            from services.progressive_setup_service import ProgressiveSetupService

            setup_service = ProgressiveSetupService(db)
            setup_result = setup_service.initialize_user_environment(user_id)
            logger.info(
                f"[linkedin_step5] Progressive setup complete for {user_id}: "
                f"workspace={setup_result.get('workspace', {}).get('workspace_path', 'n/a')}"
            )
        except Exception as e:
            logger.error(f"[linkedin_step5] Progressive setup failed: {e}")
            # Non-blocking: don't fail completion if setup errors

        # ----------------------------------------------------------
        # 3. Build and persist completion summary
        # ----------------------------------------------------------
        try:
            flat_store = AgentFlatContextStore(user_id)
            step1_doc = flat_store.load_step2_context_document() or {}
            step1_data = step1_doc.get("data", {}) if isinstance(step1_doc, dict) else {}
            step2_doc = flat_store.load_step3_context_document() or {}
            step2_data = step2_doc.get("data", {}) if isinstance(step2_doc, dict) else {}
            step3_doc = flat_store.load_step4_context_document() or {}
            step3_data = step3_doc.get("data", {}) if isinstance(step3_doc, dict) else {}

            profile_snapshot = step1_data.get("profile_snapshot", {})
            growth_data = step2_data.get("growth_analysis", {})
            linkedin_persona = (
                step3_data.get("platform_personas", {}).get("linkedin", {})
                if isinstance(step3_data, dict)
                else {}
            )
            quality_metrics = step3_data.get("quality_metrics", {}) if isinstance(step3_data, dict) else {}

            summary = {
                "onboarding_type": "linkedin",
                "completed_at": datetime.utcnow().isoformat(),
                "profile": {
                    "name": profile_snapshot.get("name"),
                    "headline": profile_snapshot.get("headline"),
                    "industry": profile_snapshot.get("industry"),
                    "completeness_score": profile_snapshot.get("completeness_score"),
                },
                "research": {
                    "trending_industry": (
                        growth_data.get("trending", {}).get("trending_industry")
                        if isinstance(growth_data, dict)
                        else None
                    ),
                    "brand_scorecard": (
                        growth_data.get("brand_scorecard")
                        if isinstance(growth_data, dict)
                        else None
                    ),
                },
                "persona": {
                    "quality_score": quality_metrics.get("linkedin_quality_score"),
                    "valid": quality_metrics.get("linkedin_valid"),
                },
                "connected_platforms": ["linkedin"],
            }

            # Save to flat file
            flat_payload = {
                "onboarding_type": "linkedin",
                "completion_date": datetime.utcnow().isoformat(),
                "summary": summary,
                "saved_at": datetime.utcnow().isoformat(),
            }
            flat_store.save_step5_integrations(flat_payload, source="onboarding_linkedin_finish")

            # Save to session payload
            session = svc._get_or_create_session(user_id, db)
            payload = dict(session.payload) if session.payload else {}
            payload["linkedin_onboarding_summary"] = summary
            session.payload = payload
            db.add(session)
            db.commit()

            logger.info(f"[linkedin_step5] Completion summary saved for {user_id}")
        except Exception as e:
            logger.warning(f"[linkedin_step5] Failed to save completion summary: {e}")

        # ----------------------------------------------------------
        # 4. Mark onboarding as complete (current_step=6, progress=100%)
        # ----------------------------------------------------------
        try:
            session = svc._get_or_create_session(user_id, db)
            session.current_step = 6
            session.progress = 100.0
            session.updated_at = datetime.utcnow()
            db.add(session)
            db.commit()
            logger.info(f"[linkedin_step5] Marked onboarding complete for {user_id} (step=6, progress=100%)")
        except Exception as e:
            db.rollback()
            logger.warning(f"[linkedin_step5] Failed to mark onboarding complete in session: {e}")

        # ----------------------------------------------------------
        # 5. Optionally call the existing completion service
        # ----------------------------------------------------------
        try:
            from services.onboarding.progress_service import OnboardingProgressService
            completion_result = OnboardingProgressService().complete_onboarding(user_id)
            if completion_result:
                logger.info(f"[linkedin_step5] Completion service confirmed onboarding complete for {user_id}")
            else:
                logger.warning(f"[linkedin_step5] Completion service returned False for {user_id}")
        except Exception as e:
            logger.warning(f"[linkedin_step5] Non-blocking: completion service call failed: {e}")

        # ----------------------------------------------------------
        # 6. Schedule LinkedIn background tasks (non-blocking)
        # ----------------------------------------------------------
        await self._schedule_linkedin_tasks(user_id, db)

        logger.info(f"[linkedin_step5] Onboarding complete for {user_id}")

    async def _schedule_linkedin_tasks(self, user_id: str, db) -> None:
        """Schedule recurring LinkedIn background tasks.

        Creates persistent DB-backed scheduler tasks via ``_upsert_task`` and
        records them in the session payload manifest.  All errors are
        non-blocking.
        """
        from datetime import datetime, timezone, timedelta
        from api.onboarding_utils.onboarding_task_scheduler import (
            _record_task_in_session,
            _upsert_task,
        )
        from models.linkedin_monitoring_models import (
            LinkedInProfileSyncTask,
            LinkedInPostAnalyticsSyncTask,
            LinkedInGrowthReanalysisTask,
        )

        now = datetime.now(timezone.utc)

        # 1. LinkedIn profile sync (every 7 days)
        try:
            _upsert_task(
                db, LinkedInProfileSyncTask,
                user_id=user_id,
                filters={"user_id": user_id},
                defaults={
                    "status": "active",
                    "next_execution": now + timedelta(days=7),
                    "frequency_days": 7,
                    "payload": {
                        "created_from": "onboarding_linkedin_step5",
                        "description": "Re-run LinkedIn profile pipeline (Phases 1-5) to catch external profile changes",
                    },
                },
            )
            db.commit()
            logger.info(f"[linkedin_step5] Scheduled linkedin_profile_sync for {user_id}")
            _record_task_in_session(
                db, user_id, "linkedin_profile_sync", step=5,
                details={
                    "frequency": 7,
                    "frequency_unit": "days",
                    "description": "Re-run LinkedIn profile pipeline (Phases 1-5) to catch external profile changes",
                }
            )
        except Exception as e:
            db.rollback()
            logger.warning(f"[linkedin_step5] Non-blocking: failed to schedule linkedin_profile_sync: {e}")

        # 2. LinkedIn post analytics sync (every 24 hours)
        try:
            _upsert_task(
                db, LinkedInPostAnalyticsSyncTask,
                user_id=user_id,
                filters={"user_id": user_id},
                defaults={
                    "status": "active",
                    "next_execution": now + timedelta(hours=24),
                    "frequency_hours": 24,
                    "payload": {
                        "created_from": "onboarding_linkedin_step5",
                        "post_limit": 50,
                        "description": "Sync last 50 posts + engagement metrics from Unipile",
                    },
                },
            )
            db.commit()
            logger.info(f"[linkedin_step5] Scheduled linkedin_post_analytics_sync for {user_id}")
            _record_task_in_session(
                db, user_id, "linkedin_post_analytics_sync", step=5,
                details={
                    "frequency": 24,
                    "frequency_unit": "hours",
                    "description": "Sync last 50 posts + engagement metrics from Unipile",
                }
            )
        except Exception as e:
            db.rollback()
            logger.warning(f"[linkedin_step5] Non-blocking: failed to schedule linkedin_post_analytics_sync: {e}")

        # 3. LinkedIn growth reanalysis (every 72 hours)
        try:
            _upsert_task(
                db, LinkedInGrowthReanalysisTask,
                user_id=user_id,
                filters={"user_id": user_id},
                defaults={
                    "status": "active",
                    "next_execution": now + timedelta(hours=72),
                    "frequency_hours": 72,
                    "payload": {
                        "created_from": "onboarding_linkedin_step5",
                        "description": "Re-run ConsolidatedGrowthService.analyze_all() to capture trending topic drift",
                    },
                },
            )
            db.commit()
            logger.info(f"[linkedin_step5] Scheduled linkedin_growth_reanalysis for {user_id}")
            _record_task_in_session(
                db, user_id, "linkedin_growth_reanalysis", step=5,
                details={
                    "frequency": 72,
                    "frequency_unit": "hours",
                    "description": "Re-run ConsolidatedGrowthService.analyze_all() to capture trending topic drift",
                }
            )
        except Exception as e:
            db.rollback()
            logger.warning(f"[linkedin_step5] Non-blocking: failed to schedule linkedin_growth_reanalysis: {e}")

        # 4. Create OAuth token monitoring task for LinkedIn
        try:
            from services.oauth_token_monitoring_service import create_oauth_monitoring_tasks
            create_oauth_monitoring_tasks(user_id, db, ['linkedin'])
            db.commit()
            logger.info(f"[linkedin_step5] Created OAuth monitoring task for {user_id}")
        except Exception as e:
            db.rollback()
            logger.warning(f"[linkedin_step5] Non-blocking: failed to create OAuth monitoring task: {e}")

    # ------------------------------------------------------------------
    # SIF Sync -- LinkedIn uses structured tables, not vector index
    # ------------------------------------------------------------------

    async def sif_sync(self, user_id: str, sif_service) -> None:
        """LinkedIn data lives in structured SQLite tables, not the SIF index.

        This is a no-op for LinkedIn onboarding.  The profile pipeline's
        data is accessible via ProfileRepository, and post analytics via
        LinkedInPostAnalyticsService -- both are structured stores.
        """
        logger.debug(f"[linkedin_sif_sync] No-op for user {user_id}")
        pass