"""
Router Manager Module
Handles FastAPI router inclusion and management.
"""

from importlib import import_module
from typing import Any, Dict, List, Optional

import os

from fastapi import FastAPI
from loguru import logger


CORE_ROUTER_REGISTRY = [
    {"name": "component_logic", "module": "api.component_logic", "attr": "router", "features": {"all", "core"}},
    {"name": "subscription", "module": "api.subscription", "attr": "router", "features": {"all", "core", "podcast", "blog_writer", "youtube"}},
    {"name": "step3_research", "module": "api.onboarding_utils.step3_routes", "attr": "router", "features": {"all", "core"}},
    {"name": "step4_assets", "module": "api.onboarding_utils.step4_asset_routes", "attr": "router", "features": {"all", "core", "podcast"}},
    {"name": "step4_persona", "module": "api.onboarding_utils.step4_persona_routes_optimized", "attr": "router", "features": {"all", "core"}},
    {"name": "gsc_auth", "module": "routers.gsc_auth", "attr": "router", "features": {"all", "core", "seo", "blog_writer"}},
    {"name": "ai_visibility", "module": "routers.ai_visibility", "attr": "router", "features": {"all", "core", "seo", "blog_writer"}},
    {"name": "wordpress", "module": "routers.wordpress", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "wordpress_oauth", "module": "routers.wordpress_oauth", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "bing_oauth", "module": "routers.bing_oauth", "attr": "router", "features": {"all", "core"}},
    {"name": "bing_analytics", "module": "routers.bing_analytics", "attr": "router", "features": {"all", "core"}},
    {"name": "bing_analytics_storage", "module": "routers.bing_analytics_storage", "attr": "router", "features": {"all", "core"}},
    {"name": "seo_tools", "module": "routers.seo_tools", "attr": "router", "features": {"all", "core", "seo"}},
    {"name": "facebook_writer", "module": "api.facebook_writer.routers", "attr": "facebook_router", "features": {"all", "core", "facebook"}},
    {"name": "linkedin", "module": "routers.linkedin", "attr": "router", "features": {"all", "core", "linkedin"}},
    {"name": "linkedin_social", "module": "api.linkedin_social_routes", "attr": "router", "features": {"all", "core", "linkedin"}},
    {"name": "unipile_webhook", "module": "api.unipile_webhook_routes", "attr": "router", "features": {"all", "core", "linkedin"}},
    {"name": "linkedin_image", "module": "api.linkedin_image_generation", "attr": "router", "features": {"all", "core", "linkedin"}},
    {"name": "linkedin_video", "module": "api.linkedin_video_generation", "attr": "router", "features": {"all", "core", "linkedin"}},
    {"name": "linkedin_growth", "module": "api.linkedin_growth_routes", "attr": "router", "features": {"all", "core", "linkedin"}},
    {"name": "brainstorm", "module": "api.brainstorm", "attr": "router", "features": {"all", "core"}},
    {"name": "hallucination_detector", "module": "api.hallucination_detector", "attr": "router", "features": {"all", "core"}},
    {"name": "writing_assistant", "module": "api.writing_assistant", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "content_planning", "module": "api.content_planning.api.router", "attr": "router", "features": {"all", "core", "content_planning"}},
    {"name": "user_data", "module": "api.user_data", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "user_environment", "module": "api.user_environment", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "strategy_copilot", "module": "api.content_planning.strategy_copilot", "attr": "router", "features": {"all", "core", "content_planning"}},
    {"name": "error_logging", "module": "routers.error_logging", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "frontend_env_manager", "module": "routers.frontend_env_manager", "attr": "router", "features": {"all", "core", "blog_writer"}},
    {"name": "platform_analytics", "module": "routers.platform_analytics", "attr": "router", "features": {"all", "core"}},
    {"name": "bing_insights", "module": "routers.bing_insights", "attr": "router", "features": {"all", "core", "seo"}},
    {"name": "background_jobs", "module": "routers.background_jobs", "attr": "router", "features": {"all", "core"}},
]

OPTIONAL_ROUTER_REGISTRY = [
    {"name": "blog_writer", "module": "api.blog_writer.router", "attr": "router", "features": {"all", "blog_writer"}},
    {"name": "story_writer", "module": "api.story_writer.router", "attr": "router", "features": {"all", "story_writer"}},
    {"name": "wix", "module": "api.wix_routes", "attr": "router", "features": {"all", "blog_writer"}},
    {"name": "wix_test", "module": "api.wix_routes", "attr": "qa_router", "features": {"all"}},
    {"name": "blog_seo_analysis", "module": "api.blog_writer.seo_analysis", "attr": "router", "features": {"all", "blog_writer"}},
    {"name": "persona", "module": "api.persona_routes", "attr": "router", "features": {"all", "persona"}},
    {"name": "video_studio", "module": "api.video_studio.router", "attr": "router", "features": {"all", "video_studio"}},
    {"name": "stability", "module": "routers.stability", "attr": "router", "features": {"all", "image_studio"}},
    {"name": "stability_advanced", "module": "routers.stability_advanced", "attr": "router", "features": {"all", "image_studio"}},
    {"name": "stability_admin", "module": "routers.stability_admin", "attr": "router", "features": {"all", "image_studio"}},
    {"name": "images", "module": "api.images", "attr": "router", "features": {"all", "image_studio", "blog_writer"}},
    {"name": "image_studio", "module": "routers.image_studio", "attr": "router", "features": {"all", "image_studio"}},
    {"name": "product_marketing", "module": "routers.product_marketing", "attr": "router", "features": {"all", "product_marketing"}},
    {"name": "campaign_creator", "module": "routers.campaign_creator", "attr": "router", "features": {"all"}},
    {"name": "content_assets", "module": "api.content_assets.router", "attr": "router", "features":  {"all", "linkedin", "podcast", "blog_writer"}},
    {"name": "podcast", "module": "api.podcast.router", "attr": "router", "features": {"all", "podcast"}},
    {"name": "youtube", "module": "api.youtube.router", "attr": "router", "features": {"all", "youtube"}, "include_kwargs": {"prefix": "/api"}},
    {"name": "research_config", "module": "api.research_config", "attr": "router", "features": {"all", "research"}, "include_kwargs": {"prefix": "/api/research", "tags": ["research"]}},
    {"name": "research_engine", "module": "api.research.router", "attr": "router", "features": {"all", "research"}, "include_kwargs": {"tags": ["Research Engine"]}},
    {"name": "scheduler_dashboard", "module": "api.scheduler_dashboard", "attr": "router", "features": {"all", "scheduler"}},
    {"name": "oauth_token_monitoring", "module": "api.oauth_token_monitoring_routes", "attr": "router", "features": {"all", "core"}},
    {"name": "agents", "module": "api.agents_api", "attr": "router", "features": {"all"}},
    {"name": "today_workflow", "module": "api.today_workflow", "attr": "router", "features": {"all"}},
    {"name": "backlink_outreach", "module": "routers.backlink_outreach", "attr": "router", "features": {"all", "backlinking"}},
]

OPTIONAL_MODULE_MATRIX = {
    "all": [entry["name"] for entry in OPTIONAL_ROUTER_REGISTRY],
    "default": [entry["name"] for entry in OPTIONAL_ROUTER_REGISTRY],
}


class RouterManager:
    """Manages FastAPI router inclusion and organization."""
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.included_routers = []
        self.failed_routers = []
        self.skipped_routers = []
    
    @staticmethod
    def get_enabled_features() -> set:
        """Get enabled features from ALWRITY_ENABLED_FEATURES env var.
        
        Values:
        - "all" - enable all features (default)
        - comma-separated: "podcast,blog-writer,youtube"
        - single feature: "podcast"
        """
        env_value = os.getenv("ALWRITY_ENABLED_FEATURES", "all").strip().lower()
        
        if not env_value or env_value == "all":
            return {"all"}
        
        return {f.strip() for f in env_value.split(",") if f.strip()}
    
    def _is_verbose(self) -> bool:
        return os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
    
    def _get_profile(self) -> str:
        """Legacy method - returns primary profile."""
        enabled = self.get_enabled_features()
        if "all" in enabled:
            return "all"
        # Return first feature as profile for backwards compatibility
        return list(enabled)[0] if enabled else "all"
    
    def _should_include_router(self, registry_entry: Dict[str, Any], enabled_features: set) -> bool:
        """Check if router should be included based on enabled features."""
        required_features = registry_entry.get("features", set())
        
        # If "all" is enabled, include everything
        if "all" in enabled_features:
            return True
        
        # If no required features specified, include by default
        if not required_features:
            return True
        
        # Check if any required feature is enabled
        return bool(required_features & enabled_features)
    
    def _load_router_from_registry(self, registry_entry: Dict[str, Any]):
        module = import_module(registry_entry["module"])
        return getattr(module, registry_entry["attr"])
    
    def include_router_safely(self, router, router_name: Optional[str] = None, include_kwargs: Optional[Dict[str, Any]] = None) -> bool:
        """Include a router safely with error handling."""
        verbose = self._is_verbose()
        router_name = router_name or getattr(router, 'prefix', 'unknown')

        try:
            self.app.include_router(router, **(include_kwargs or {}))
            self.included_routers.append(router_name)
            if verbose:
                logger.info(f"✅ Router included successfully: {router_name}")
            return True
        except Exception as e:
            router_name = router_name or 'unknown'
            self.failed_routers.append({"name": router_name, "error": str(e)})
            if verbose:
                logger.warning(f"❌ Router inclusion failed: {router_name} - {e}")
            return False
    
    @staticmethod
    def _demo_release_mode_enabled() -> bool:
        """Return True when demo-release safety mode is enabled."""
        return os.getenv("ALWRITY_DEMO_RELEASE", "false").lower() in {"1", "true", "yes", "on"}
    
    def _include_registry_group(self, registry: List[Dict[str, Any]], group_name: str) -> bool:
        verbose = self._is_verbose()
        enabled_features = self.get_enabled_features()
        
        try:
            if verbose:
                logger.info(f"Including {group_name} routers with features: {enabled_features}...")
            
            for entry in registry:
                if entry["name"] == "wix_test" and not self._should_include_wix_test_router():
                    reason = "wix test routes disabled or running in production environment"
                    self.skipped_routers.append({"name": entry["name"], "reason": reason})
                    if verbose:
                        logger.info(f"⏭️  Skipping {entry['name']}: {reason}")
                    continue
                if not self._should_include_router(entry, enabled_features):
                    reason = f"features {enabled_features} not matching {entry.get('features', set())}"
                    self.skipped_routers.append({"name": entry["name"], "reason": reason})
                    if verbose:
                        logger.info(f"⏭️  Skipping {entry['name']}: {reason}")
                    continue
                
                try:
                    router = self._load_router_from_registry(entry)
                    self.include_router_safely(router, entry["name"], entry.get("include_kwargs"))
                except Exception as e:
                    logger.warning(f"{entry['name']} router not mounted: {e}")
            
            logger.info(f"✅ {group_name.capitalize()} routers processed for features: {enabled_features}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error including {group_name} routers: {e}")
            return False

    @staticmethod
    def _should_include_wix_test_router() -> bool:
        environment = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development").strip().lower()
        is_production = environment in {"prod", "production"}
        wix_test_enabled = os.getenv("WIX_TEST_ROUTES_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
        return wix_test_enabled and not is_production
    
    def include_core_routers(self) -> bool:
        """Include core application routers."""
        return self._include_registry_group(CORE_ROUTER_REGISTRY, "core")
    
    def include_optional_routers(self) -> bool:
        """Include optional routers with error handling."""
        return self._include_registry_group(OPTIONAL_ROUTER_REGISTRY, "optional")
    
    def get_router_status(self) -> Dict[str, Any]:
        """Get the status of router inclusion."""
        return {
            "active_profile": self._get_profile(),
            "included_routers": self.included_routers,
            "failed_routers": self.failed_routers,
            "skipped_routers": self.skipped_routers,
            "total_included": len(self.included_routers),
            "total_failed": len(self.failed_routers),
            "total_skipped": len(self.skipped_routers)
        }
    
    def log_startup_summary(self) -> None:
        """Log startup summary including profile, enabled routers, and skipped items."""
        profile = self._get_profile()
        
        logger.info("=" * 60)
        logger.info("📋 STARTUP SUMMARY")
        logger.info(f"   Active profile: {profile}")
        logger.info(f"   Enabled routers ({len(self.included_routers)}): {', '.join(self.included_routers)}")
        if self.skipped_routers:
            logger.info(f"   Skipped routers ({len(self.skipped_routers)}):")
            for s in self.skipped_routers:
                logger.info(f"      - {s['name']}: {s['reason']}")
        if self.failed_routers:
            logger.warning(f"   Failed routers ({len(self.failed_routers)}):")
            for f in self.failed_routers:
                logger.warning(f"      - {f['name']}: {f['error']}")
        logger.info("=" * 60)
    
    def get_feature_profile_status(self) -> Dict[str, Any]:
        """Get feature profile status and enabled modules."""
        profile = self._get_profile()
        enabled_modules = OPTIONAL_MODULE_MATRIX.get(profile, OPTIONAL_MODULE_MATRIX.get("all", []))
        
        return {
            "active_profile": profile,
            "enabled_modules": enabled_modules,
            "available_profiles": list(OPTIONAL_MODULE_MATRIX.keys())
        }
