"""
Strategy Data Processor

Extracted from calendar_generator_service.py to improve maintainability
and align with 12-step implementation plan.

NO MOCK DATA - Only real data sources allowed.

Strategy resolution (multi-tenant, DB-first, cost-effective):
- Reads from the user's per-user workspace SQLite database via the injected
  ``ContentPlanningDBService`` (which wraps the per-user session), never from
  the main ``backend/alwrity.db``.
- Uses the modern ``EnhancedContentStrategy`` row (``enhanced_content_strategies``,
  string Clerk user id). The AI-generated strategy JSON (``ai_recommendations`` /
  ``comprehensive_ai_analysis``) is the source of truth because the structured
  builder columns are frequently NULL for AI-generated strategies.
- Merges onboarding ``website_analyses`` (rich ``target_audience``, writing style,
  content type + strategy insights) for the audience/brand fields the strategy
  JSON does not carry.
"""

import json
import re
from typing import Dict, Any, List, Optional
from loguru import logger

import sys
import os

# Add the services directory to the path for proper imports
services_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

# Import real services - NO FALLBACKS
from services.content_planning_db import ContentPlanningDBService

logger.trace("✅ Successfully imported real data processing services (strategy data)")

# The 30 canonical strategic input fields (kept in sync with
# api/content_planning/utils/data_parsers.STRATEGY_FIELD_TYPES).
ENHANCED_STRATEGY_FIELDS: List[str] = [
    'business_objectives', 'target_metrics', 'content_budget', 'team_size',
    'implementation_timeline', 'market_share', 'competitive_position', 'performance_metrics',
    'content_preferences', 'consumption_patterns', 'audience_pain_points', 'buying_journey',
    'seasonal_trends', 'engagement_metrics', 'top_competitors', 'competitor_content_strategies',
    'market_gaps', 'industry_trends', 'emerging_trends', 'preferred_formats', 'content_mix',
    'content_frequency', 'optimal_timing', 'quality_metrics', 'editorial_guidelines', 'brand_voice',
    'traffic_sources', 'conversion_rates', 'content_roi_targets', 'ab_testing_capabilities',
]


class StrategyDataProcessor:
    """Process comprehensive content strategy data for 12-step prompt chaining."""
    
    def __init__(self):
        self.content_planning_db_service = None  # Will be injected

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    # VFS fallback budget: one small file read, only when DB is missing/thin.
    _VFS_MAX_BYTES = 256 * 1024

    async def get_strategy_data(self, strategy_id: Optional[int] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive content strategy data from the user's per-user database.

        Resolution order (all against the per-user workspace session):
          1. ``strategy_id`` -> ``EnhancedContentStrategy`` row
          2. ``user_id``     -> active strategy (``strategy_activation_status``)
          3. ``strategy_id`` -> legacy ``ContentStrategy`` row (fallback)

        Args:
            strategy_id: Enhanced content strategy ID (from the wizard context).
            user_id: Clerk user ID (string) used for ownership scoping and the
                active-strategy fallback.

        Returns:
            Merged comprehensive strategy dict with basic + enhanced fields,
            onboarding-merged audience, and quality-gate / prompt-chain data.
        """
        try:
            logger.info(f"🔍 Retrieving comprehensive strategy data for strategy {strategy_id} (user {user_id})")
            
            # Check if database service is available
            if self.content_planning_db_service is None:
                raise ValueError("ContentPlanningDBService not available - cannot retrieve strategy data")

            db = getattr(self.content_planning_db_service, 'db', None)
            if db is None:
                raise ValueError("ContentPlanningDBService has no active database session")

            source = await self._resolve_strategy_source(db, strategy_id, user_id)
            if not source:
                if strategy_id:
                    raise ValueError(f"No strategy found for ID {strategy_id}")
                raise ValueError(f"No strategy data found for user_id: {user_id}")

            # Provenance marker (set by _resolve_strategy_source); DB wins,
            # VFS only ever fills gaps. Never persisted back to the DB.
            source_kind = str(source.pop("_source_kind", "db:unknown"))

            # Phase C: thin DB rows (no AI blob, empty key fields) are enriched
            # from the VFS mirror. Guarded: VFS failures never break DB reads.
            if user_id and self._is_thin_source(source):
                try:
                    vfs_source = self._load_vfs_source(str(user_id))
                    if vfs_source and self._apply_vfs_enrichment(source, vfs_source):
                        source_kind += "+vfs_enriched"
                        logger.info("📄 Enriched thin DB strategy from VFS mirror")
                except Exception as enrich_error:
                    logger.warning(f"⚠️ VFS enrichment skipped: {str(enrich_error)}")

            website_analysis = self._load_website_analysis(db, user_id)
            strategy_dict, enhanced_data = self._flatten_strategy(source, website_analysis)

            comprehensive_strategy_data = await self._assemble_comprehensive(
                strategy_dict, enhanced_data, strategy_id
            )
            comprehensive_strategy_data["strategy_source"] = source_kind

            logger.info(f"✅ Successfully retrieved comprehensive strategy data for strategy {strategy_id}")
            return comprehensive_strategy_data
            
        except Exception as e:
            logger.error(f"❌ Error getting comprehensive strategy data: {str(e)}")
            raise Exception(f"Failed to get strategy data: {str(e)}")
    
    async def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate strategy data quality."""
        try:
            if not data:
                raise ValueError("Strategy data is empty")
            
            # Basic validation
            required_fields = ["strategy_id", "strategy_name", "industry", "target_audience", "content_pillars"]
            
            missing_fields = []
            for field in required_fields:
                if not data.get(field):
                    missing_fields.append(field)
            
            if missing_fields:
                raise ValueError(f"Missing required fields: {missing_fields}")
            
            # Quality assessment
            quality_score = 0.8  # Base score for valid data
            
            # Add quality indicators
            validation_result = {
                "quality_score": quality_score,
                "missing_fields": missing_fields,
                "recommendations": []
            }
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating strategy data: {str(e)}")
            raise Exception(f"Strategy data validation failed: {str(e)}")

    # ------------------------------------------------------------------ #
    # Source resolution
    # ------------------------------------------------------------------ #
    async def _resolve_strategy_source(self, db, strategy_id: Optional[int], user_id: Optional[str]) -> Dict[str, Any]:
        """Resolve the strategy source row/dict against the per-user session.

        Preference order (DB-first, cheapest first — no SIF/embeddings):
        1) explicit enhanced strategy ID, 2) activated strategy,
        3) legacy table, 4) VFS ``strategy/active.md`` mirror.
        """
        # 1) Explicit enhanced strategy ID (wizard confirmed strategy)
        if strategy_id:
            try:
                from api.content_planning.services.enhanced_strategy_db_service import EnhancedStrategyDBService
                enhanced = await EnhancedStrategyDBService(db).get_enhanced_strategy(strategy_id, str(user_id) if user_id else None)
                if enhanced is not None:
                    source = self._to_plain_dict(enhanced)
                    source["_source_kind"] = "db:enhanced"
                    return source
                logger.warning(f"⚠️ Enhanced strategy {strategy_id} not found for user {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ Enhanced strategy lookup failed: {str(e)}")

        # 2) Active strategy (matches steps 3+ via ActiveStrategyService)
        if user_id:
            try:
                from services.active_strategy_service import ActiveStrategyService
                active = await ActiveStrategyService(db).get_active_strategy(str(user_id), force_refresh=True)
                if active:
                    if strategy_id and active.get("id") != strategy_id:
                        logger.info(
                            f"📊 Active strategy {active.get('id')} differs from requested {strategy_id}; using active strategy"
                        )
                    source = self._to_plain_dict(active)
                    source["_source_kind"] = "db:active"
                    return source
            except Exception as e:
                logger.warning(f"⚠️ Active strategy lookup failed: {str(e)}")

        # 3) Legacy table fallback (users onboarded before enhanced strategies)
        if strategy_id:
            try:
                legacy = await self.content_planning_db_service.get_content_strategy(strategy_id)
                if legacy is not None:
                    source = self._to_plain_dict(legacy)
                    source["_source_kind"] = "db:legacy"
                    return source
            except Exception as e:
                logger.warning(f"⚠️ Legacy strategy lookup failed: {str(e)}")

        # 4) VFS mirror fallback (activation snapshot; file read only, no SIF).
        # Guarded: any failure is swallowed and the caller raises the standard
        # "no strategy" error. Provenance is marked vfs_fallback so callers
        # can tell a mirror snapshot from live DB data.
        if user_id:
            try:
                vfs_source = self._load_vfs_source(str(user_id))
                if vfs_source:
                    logger.info("📄 Resolved strategy from VFS mirror fallback")
                    return vfs_source
            except Exception as e:
                logger.warning(f"⚠️ VFS strategy fallback skipped: {str(e)}")

        return {}

    # ------------------------------------------------------------------ #
    # Flattening
    # ------------------------------------------------------------------ #
    def _flatten_strategy(self, source: Dict[str, Any], website_analysis: Dict[str, Any]):
        """Flatten a strategy source (ORM/JSON) into basic + enhanced field dicts.

        The structured builder columns are frequently NULL for AI-generated
        strategies; the ``ai_recommendations`` JSON (``base_strategy`` +
        ``strategic_insights``) is the source of truth, enriched with the
        onboarding website analysis for audience and brand fields.
        """
        ai = self._parse_strategy_json(source.get("ai_recommendations") or source.get("comprehensive_ai_analysis"))
        base = ai.get("base_strategy") or {}
        insights = ai.get("strategic_insights") or {}
        risk = ai.get("risk_assessment") or {}
        summary = ai.get("summary") or {}

        preferred_formats = self._normalize_list(
            base.get("preferred_formats")
            or (base.get("content_preferences") or {}).get("preferred_formats")
        )

        content_pillars = self._derive_content_pillars(base, insights, website_analysis)

        strategy_dict: Dict[str, Any] = {
            "id": source.get("id"),
            "user_id": source.get("user_id"),
            "name": source.get("name") or base.get("name") or "Content Strategy",
            "industry": source.get("industry") or base.get("industry") or "",
            "target_audience": self._build_target_audience(base, website_analysis),
            "content_pillars": content_pillars,
            "business_objectives": self._normalize_list(
                base.get("business_objectives")
                or source.get("business_objectives")
            ),
            "brand_voice": base.get("brand_voice")
                or (website_analysis.get("writing_style") or {}).get("tone")
                or "",
            "editorial_guidelines": base.get("editorial_guidelines") or {},
            "content_frequency": base.get("content_frequency") or "",
            "preferred_formats": preferred_formats,
            "content_mix": base.get("content_mix") or "",
            "ai_recommendations": ai,
            "comprehensive_ai_analysis": ai,
            "created_at": source.get("created_at"),
            "updated_at": source.get("updated_at"),
            "completion_percentage": source.get("completion_percentage") or base.get("completion_percentage") or 0.0,
        }

        # 30 canonical enhanced fields (only concrete values carried over).
        enhanced_data: Dict[str, Any] = {}
        for field in ENHANCED_STRATEGY_FIELDS:
            value = base.get(field) or source.get(field)
            if field == "ab_testing_capabilities" and isinstance(value, str):
                value = value.strip().lower() in ("true", "yes", "1")
            if value is not None:
                enhanced_data[field] = value

        # Ensure pointers to nested strategy sections survive for downstream steps.
        enhanced_data.setdefault("preferred_formats", preferred_formats)
        enhanced_data.setdefault("brand_voice", strategy_dict["brand_voice"])
        enhanced_data.setdefault("audience_pain_points",
                                 self._normalize_list(base.get("audience_pain_points")))
        enhanced_data.setdefault("business_objectives", strategy_dict["business_objectives"])
        enhanced_data.setdefault("content_pillars", content_pillars)

        # Strategic/analysis enrichment surfaces from the AI JSON.
        enhanced_data["market_positioning"] = (
            insights.get("market_positioning")
            or {"current_position": (base.get("competitive_position") or ""),
                "positioning_strength": (insights.get("swot_summary") or {}).get("overall_score")}
        )
        enhanced_data["strategic_scores"] = insights.get("swot_summary") or insights.get("growth_potential") or {}
        enhanced_data["opportunity_analysis"] = insights.get("content_opportunities") or []
        enhanced_data["competitive_advantages"] = (
            (insights.get("swot_summary") or {}).get("primary_strengths")
            or (insights.get("growth_potential") or {}).get("competitive_advantages")
            or []
        )
        enhanced_data["strategic_risks"] = self._extract_risks(risk)
        enhanced_data["implementation_timeline"] = (
            base.get("implementation_timeline")
            or summary.get("implementation_timeline")
            or (ai.get("implementation_roadmap") or {}).get("timeline")
            or ""
        )
        enhanced_data["onboarding_data_used"] = base.get("data_source_transparency") or {}
        enhanced_data["data_source_transparency"] = base.get("data_source_transparency") or {}
        enhanced_data["completion_percentage"] = strategy_dict["completion_percentage"]

        return strategy_dict, enhanced_data

    def _parse_strategy_json(self, blob: Any) -> Dict[str, Any]:
        """Parse the AI strategy JSON blob (string or already-parsed dict)."""
        if isinstance(blob, dict):
            return blob
        if isinstance(blob, str) and blob.strip():
            try:
                parsed = json.loads(blob)
                if isinstance(parsed, dict):
                    return parsed
            except Exception as e:
                logger.warning(f"⚠️ Could not parse strategy JSON blob: {str(e)}")
        return {}

    def _derive_content_pillars(self, base: Dict[str, Any], insights: Dict[str, Any],
                                website_analysis: Dict[str, Any]) -> List[str]:
        """Derive content pillars from the AI strategy + onboarding analysis.

        AI-generated strategies enumerate their pillars inside the pillar-blog
        recommendation (e.g. "(a) X, (b) Y, (c) Z"); that is parsed first,
        falling back to onboarding website content themes.
        """
        pillars: List[str] = []

        # 1) Enumerated items from pillar recommendations/opportunities.
        #    Strip trailing sentence bleed ("(e) ROI Case Studies. Each post
        #    should..." -> "ROI Case Studies").
        enumerated = ("content_opportunities", "recommendations", "content_pillars")
        for key in enumerated:
            for item in (insights.get(key, []) or []):
                if isinstance(item, str):
                    for m in re.finditer(r"\(\s*[a-zA-Z]\s*\)\s*([^,(;]+)", item):
                        title = self._clean_pillar_title(m.group(1))
                        if title and all(t.lower() != title.lower() for t in pillars):
                            pillars.append(title)
                elif isinstance(item, dict):
                    title = item.get("title") or item.get("pillar") or item.get("name")
                    if title and all(t.lower() != str(title).lower() for t in pillars):
                        pillars.append(self._clean_pillar_title(str(title)))

        # 2) Explicit columns / base keys.
        for key in ("content_pillars", "content_themes"):
            value = base.get(key)
            if value:
                for item in self._normalize_list(value):
                    if isinstance(item, dict):
                        item = item.get("pillar") or item.get("title") or item.get("name") or item.get("label")
                    if item and all(t.lower() != str(item).lower() for t in pillars):
                        pillars.append(str(item).strip().strip('.,'))

        # 3) Onboarding website analysis themes (actual themes, not
        #    improvement recommendations like "streamline copy").
        insights_blob = website_analysis.get("content_strategy_insights") or {}
        for item in self._normalize_list(insights_blob.get("content_themes")):
            if item and all(t.lower() != str(item).lower() for t in pillars):
                pillars.append(str(item).strip().strip('.,'))

        # 4) Purpose/topics string split fallback (semicolon / bullet separated).
        if len(pillars) < 3:
            topics = (base.get("content_preferences") or {}).get("content_topics")
            if isinstance(topics, str):
                for part in re.split(r"[;|•]\s*", topics):
                    part = part.strip().strip('.,')
                    if len(part) >= 4 and all(t.lower() != part.lower() for t in pillars):
                        pillars.append(part)

        return pillars[:6]

    def _build_target_audience(self, base: Dict[str, Any], website_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Build a target-audience dict from the onboarding website analysis,
        enriched with the strategy's audience pain points."""
        ta = website_analysis.get("target_audience") or {}
        if isinstance(ta, str):
            try:
                ta = json.loads(ta)
            except Exception:
                ta = {}
        if not isinstance(ta, dict):
            ta = {}

        audience = dict(ta or {})

        pain_points = self._normalize_list(base.get("audience_pain_points"))
        if pain_points and not audience.get("pain_points"):
            audience["pain_points"] = pain_points

        interests = self._normalize_list(
            (base.get("content_preferences") or {}).get("content_topics")
        )
        if interests and not audience.get("interests"):
            audience["interests"] = interests

        # Never emit an empty audience: pain points alone are a valid signal.
        if not audience:
            audience = {"pain_points": pain_points, "segment": "target audience"}
        return audience or {"segment": "target audience"}

    @staticmethod
    def _extract_risks(risk_assessment: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract a list of risk entries from the risk assessment section."""
        risks = []
        if isinstance(risk_assessment, dict):
            for key in ("risks", "top_risks", "risk_register"):
                value = risk_assessment.get(key)
                if isinstance(value, list):
                    risks = value
                    break
                if isinstance(value, dict):
                    risks = list(value.values())
                    break
            if not risks and isinstance(risk_assessment.get("risk_assessment"), list):
                risks = risk_assessment["risk_assessment"]
        return risks

    @staticmethod
    def _clean_pillar_title(title: str) -> str:
        """Trim a pillar title, dropping trailing sentence continuation.

        Enumerated pillars sometimes bleed into their description, e.g.
        "(a) ROI Case Studies. Each post should include at least one
        infographic" -> "ROI Case Studies". Only strip at a sentence-starter
        word so abbreviations like "vs. Proprietary" survive.
        """
        title = str(title or "").strip().strip('.,')
        match = re.search(r"\.\s+(?:Each|Every|This|These|That|Posts|Post|The|It|They|Include|Ensure|Adding|Look|Let)\s+", title)
        if match:
            title = title[: match.start()].strip().strip('.,')
        return title

    @staticmethod
    def _normalize_list(value: Any) -> List[Any]:
        """Normalize a field value into a list."""
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, tuple):
            return list(value)
        if isinstance(value, dict):
            return list(value.values())
        if isinstance(value, str):
            parts = [p.strip() for p in re.split(r"[,;•|\n]+", value) if p.strip()]
            return parts
        return [value]

    @staticmethod
    def _to_plain_dict(obj: Any) -> Dict[str, Any]:
        """Convert an ORM row or strategy dict into a plain JSON-safe dict."""
        if obj is None:
            return {}
        if isinstance(obj, dict):
            return dict(obj)
        if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
            try:
                return obj.to_dict()
            except Exception:
                pass
        keys = (
            "id", "user_id", "name", "industry", "target_audience", "content_pillars",
            "business_objectives", "brand_voice", "editorial_guidelines",
            "content_frequency", "preferred_formats", "content_mix",
            "ai_recommendations", "comprehensive_ai_analysis",
            "created_at", "updated_at", "completion_percentage",
        )
        out = {}
        for k in keys:
            if hasattr(obj, k):
                v = getattr(obj, k)
                if k in ("created_at", "updated_at") and hasattr(v, "isoformat"):
                    v = v.isoformat()
                if isinstance(v, (dict, list)):
                    v = json.dumps(v)
                out[k] = v
        return out

    def _load_website_analysis(self, db, user_id: Optional[str]) -> Dict[str, Any]:
        """Load the latest onboarding website analysis for the user (per-user DB)."""
        if not user_id:
            return {}
        try:
            from models.onboarding import OnboardingSession, WebsiteAnalysis
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == str(user_id)
            ).order_by(OnboardingSession.updated_at.desc()).first()
            if not session:
                return {}
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).order_by(WebsiteAnalysis.created_at.desc()).first()
            if not analysis:
                return {}
            data = analysis.to_dict() if hasattr(analysis, "to_dict") and callable(analysis.to_dict) else {}
            # JSON columns come back as dicts already; be defensive for strings.
            for key in ("target_audience", "writing_style", "content_type",
                        "content_strategy_insights", "brand_analysis"):
                value = data.get(key)
                if isinstance(value, str):
                    try:
                        data[key] = json.loads(value)
                    except Exception:
                        pass
            return data
        except Exception as e:
            logger.warning(f"⚠️ Could not load website analysis for user {user_id}: {str(e)}")
            return {}

    # ------------------------------------------------------------------ #
    # VFS mirror fallback (Phase C: DB-first, file-read only, no SIF)
    # ------------------------------------------------------------------ #
    def _read_vfs_active_markdown(self, user_id: str) -> Optional[str]:
        """Read the activation mirror. Returns None on any failure (never raises)."""
        try:
            from services.workspace_paths import get_user_workspace_dir

            path = get_user_workspace_dir(str(user_id)) / "strategy" / "active.md"
            if not path.is_file():
                return None
            if path.stat().st_size > self._VFS_MAX_BYTES:
                logger.warning(f"⚠️ VFS mirror oversized for user {user_id}; skipping")
                return None
            text = path.read_text(encoding="utf-8")
            return text if text.strip() else None
        except Exception as e:
            logger.warning(f"⚠️ VFS mirror read failed for user {user_id}: {str(e)}")
            return None

    @staticmethod
    def _parse_vfs_value(raw: str) -> Any:
        """Best-effort scalar/JSON parse of a rendered bullet value. Never raises."""
        text = (raw or "").strip()
        if not text or text.lower() in ("none", "null", "n/a", "-"):
            return ""
        if text[0] in "[{\"" or text.lower() in ("true", "false"):
            try:
                return json.loads(text)
            except Exception:
                return text
        number = re.fullmatch(r"-?\d+(\.\d+)?", text)
        if number:
            try:
                return float(text) if "." in text else int(text)
            except ValueError:
                return text
        return text

    def _parse_vfs_markdown(self, text: str) -> Dict[str, Any]:
        """Parse the activation mirror into header/form/components. Never raises."""
        parsed: Dict[str, Any] = {"header": {}, "form": {}, "components": {}}
        try:
            section = "header"
            for line in (text or "").splitlines():
                stripped = line.strip()
                if stripped.startswith("## "):
                    section = stripped[3:].strip().lower().replace(" ", "_")
                    continue
                if not stripped.startswith("- ") or ":" not in stripped:
                    continue
                key, _, value = stripped[2:].partition(":")
                key = key.strip()
                if not key:
                    continue
                if section == "form_inputs":
                    parsed["form"][key] = self._parse_vfs_value(value)
                elif section == "header":
                    parsed["header"][key] = self._parse_vfs_value(value)
                else:
                    parsed["components"].setdefault(section, {})[key] = self._parse_vfs_value(value)
        except Exception as e:
            logger.warning(f"⚠️ VFS mirror parse failed: {str(e)}")
            return {"header": {}, "form": {}, "components": {}}
        return parsed

    def _vfs_to_source(self, parsed: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Map parsed mirror data onto the source-dict shape _flatten_strategy expects."""
        header = parsed.get("header", {}) or {}
        form = parsed.get("form", {}) or {}
        components = parsed.get("components", {}) or {}
        base = dict(form)
        base_component = components.get("base_strategy")
        if isinstance(base_component, dict):
            base.update(base_component)
        insights = components.get("strategic_insights")
        if not isinstance(insights, dict):
            insights = {}
        # Seed pillar derivation from opportunity titles (mirrors AI enumeration).
        if not base.get("content_pillars"):
            titles = [
                str(item if isinstance(item, str) else item.get("title", item))
                for item in self._normalize_list(insights.get("content_opportunities"))
            ]
            titles = [t for t in titles if t]
            if titles:
                base["content_pillars"] = titles
        ai_blob = {
            "base_strategy": base,
            "strategic_insights": insights,
            "competitive_analysis": components.get("competitive_analysis", {}),
            "performance_predictions": components.get("performance_predictions", {}),
            "implementation_roadmap": components.get("implementation_roadmap", {}),
            "risk_assessment": components.get("risk_assessment", {}),
            "summary": {
                "implementation_timeline": base.get("implementation_timeline", ""),
                "estimated_roi": (components.get("performance_predictions") or {}).get("estimated_roi")
                if isinstance(components.get("performance_predictions"), dict) else None,
            },
        }
        try:
            strategy_id = int(str(header.get("strategy_id", "") or "").strip())
        except (TypeError, ValueError):
            strategy_id = None
        return {
            "id": strategy_id,
            "user_id": user_id,
            "name": form.get("name") or "Content Strategy",
            "industry": form.get("industry") or "",
            **form,
            "ai_recommendations": ai_blob,
            "comprehensive_ai_analysis": ai_blob,
            "completion_percentage": 0.0,
            "_source_kind": "vfs_fallback",
        }

    def _load_vfs_source(self, user_id: str) -> Dict[str, Any]:
        """Full guarded VFS resolution. Returns {} when unusable (never raises)."""
        try:
            text = self._read_vfs_active_markdown(user_id)
            if not text:
                return {}
            parsed = self._parse_vfs_markdown(text)
            if not parsed.get("form") and not parsed.get("components"):
                return {}
            return self._vfs_to_source(parsed, user_id)
        except Exception as e:
            logger.warning(f"⚠️ VFS source load failed for user {user_id}: {str(e)}")
            return {}

    @staticmethod
    def _is_empty_value(value: Any) -> bool:
        return value is None or value == "" or value == [] or value == {}

    def _is_thin_source(self, source: Dict[str, Any]) -> bool:
        """A DB source is thin when it carries no AI blob and no key fields."""
        ai = source.get("ai_recommendations") or source.get("comprehensive_ai_analysis")
        has_ai = bool(
            isinstance(ai, dict) and (ai.get("base_strategy") or ai.get("strategic_insights"))
        )
        if has_ai:
            return False
        watched = (
            "business_objectives",
            "preferred_formats",
            "content_pillars",
            "market_gaps",
            "brand_voice",
        )
        return all(self._is_empty_value(source.get(field)) for field in watched)

    def _apply_vfs_enrichment(self, source: Dict[str, Any], vfs_source: Dict[str, Any]) -> bool:
        """Fill only missing source fields from the VFS snapshot. DB always wins."""
        try:
            from services.intelligence.sif_strategy_source_ids import STRATEGY_FORM_FIELDS
        except Exception:
            STRATEGY_FORM_FIELDS = ()
        changed = False
        for field in ("name", "industry", *STRATEGY_FORM_FIELDS):
            if self._is_empty_value(source.get(field)) and not self._is_empty_value(
                vfs_source.get(field)
            ):
                source[field] = vfs_source[field]
                changed = True
        if (
            not source.get("ai_recommendations")
            and not source.get("comprehensive_ai_analysis")
            and vfs_source.get("ai_recommendations")
        ):
            source["ai_recommendations"] = vfs_source["ai_recommendations"]
            source["comprehensive_ai_analysis"] = vfs_source.get(
                "comprehensive_ai_analysis", vfs_source["ai_recommendations"]
            )
            changed = True
        return changed

    async def _assemble_comprehensive(self, strategy_dict: Dict[str, Any],
                                      enhanced_data: Dict[str, Any],
                                      strategy_id: Optional[int]) -> Dict[str, Any]:
        """Merge flattened strategy data + run quality assessment + prompt-chain prep.

        Keeps the exact merged shape downstream steps expect.
        """
        from ..quality_assessment.strategy_quality import StrategyQualityAssessor
        quality_assessor = StrategyQualityAssessor()

        comprehensive_strategy_data = {
            "strategy_id": strategy_id or strategy_dict.get("id"),
            "strategy_name": strategy_dict.get("name"),
            "industry": strategy_dict.get("industry") or "technology",
            "target_audience": strategy_dict.get("target_audience", {}),
            "content_pillars": strategy_dict.get("content_pillars", []),
            "ai_recommendations": strategy_dict.get("ai_recommendations", {}),
            "created_at": strategy_dict.get("created_at"),
            "updated_at": strategy_dict.get("updated_at"),

            **enhanced_data,

            "comprehensive_ai_analysis": strategy_dict.get("comprehensive_ai_analysis"),

            "strategy_analysis": await quality_assessor.analyze_strategy_completeness(strategy_dict, enhanced_data),
            "quality_indicators": await quality_assessor.calculate_strategy_quality_indicators(strategy_dict, enhanced_data),
            "data_completeness": await quality_assessor.calculate_data_completeness(strategy_dict, enhanced_data),
            "strategic_alignment": await quality_assessor.assess_strategic_alignment(strategy_dict, enhanced_data),

            "quality_gate_data": await quality_assessor.prepare_quality_gate_data(strategy_dict, enhanced_data),
            "prompt_chain_data": await quality_assessor.prepare_prompt_chain_data(strategy_dict, enhanced_data),
        }
        return comprehensive_strategy_data