"""
Social Amplification Agent implementation.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent, TXTAI_AVAILABLE, Agent
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent, TaskProposal
from services.database import has_onboarding_session
from services.intelligence.agents.tool_contracts import unavailable_tool

try:
    from services.intelligence.sif_integration import SIFIntegrationService
    SIF_AVAILABLE = True
except ImportError:
    SIF_AVAILABLE = False

class SocialAmplificationAgent(BaseALwrityAgent):
    """
    Agent responsible for social media monitoring, content adaptation, and distribution.
    """
    
    def __init__(self, user_id: str, shared_llm_name: str, llm: Any = None, **kwargs):
        super().__init__(user_id, "social_media_manager", shared_llm_name, llm, **kwargs)
        
        self.sif_service = None
        if SIF_AVAILABLE and has_onboarding_session(user_id):
            try:
                self.sif_service = SIFIntegrationService(user_id)
            except Exception as e:
                logger.warning(f"Failed to initialize SIF service for SocialAmplificationAgent: {e}")
        elif SIF_AVAILABLE:
            logger.debug(
                "Skipping SIF service initialization for SocialAmplificationAgent user {}: no onboarding session",
                user_id,
            )

    def _create_txtai_agent(self):
        """Create a specialized txtai Agent for social media."""
        if not TXTAI_AVAILABLE or Agent is None:
            return None
            
        _llm_for_agent = getattr(self.llm, "llm", self.llm)
        return Agent(
            tools=[
                {
                    "name": "social_monitor",
                    "description": "Monitors social trends and conversations",
                    "target": self._social_monitor_tool
                },
                {
                    "name": "content_adapter",
                    "description": "Adapts long-form content for social platforms",
                    "target": self._content_adapter_tool
                },
                {
                    "name": "engagement_optimizer",
                    "description": "Optimizes posts for engagement (hashtags, timing)",
                    "target": self._engagement_optimizer_tool
                },
                {
                    "name": "distribution_manager",
                    "description": "Manages posting schedule",
                    "target": self._distribution_manager_tool
                }
            ],
            llm=_llm_for_agent,
            max_iterations=10,

        )
    
    # Tool Implementations
    
    def _social_monitor_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Social monitoring tool using SIF.
        
        Args:
            context: Dictionary containing monitoring criteria like 'topics' or 'platforms'.
        """
        return unavailable_tool("social", "Social monitoring provider is not connected")

    def _content_adapter_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adapts content for specific platforms.
        
        Args:
            context: Dictionary containing 'content' and 'platform' (e.g., 'linkedin', 'twitter').
        """
        return unavailable_tool("social", "Platform-specific content adaptation provider is unavailable")

    def _engagement_optimizer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimizes content for engagement (hashtags, timing, hook).
        
        Args:
            context: Dictionary containing 'content' to optimize.
        """
        return unavailable_tool("social", "Engagement optimization requires platform analytics")

    def _distribution_manager_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Manages distribution (scheduling/posting).
        
        Args:
            context: Dictionary containing 'post_content' and 'schedule_time'.
        """
        return unavailable_tool("social", "Distribution manager is not connected to a publishing provider")

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose social media tasks based on user's onboarding context.
        Derives platforms and content types from user data.
        """
        self._remember_grounding(context)
        default_proposals = []

        onboarding = context.get("onboarding_data", {})
        if not isinstance(onboarding, dict):
            return default_proposals

        # Extract selected platforms from onboarding data
        selected_platforms = []
        try:
            # P4.1: Read from integrated data keys (platform_integrations, persona_data)
            # Primary: platform_integrations.connected_platforms
            platform_integrations = onboarding.get("platform_integrations") or {}
            if isinstance(platform_integrations, dict):
                sp = platform_integrations.get("connected_platforms") or platform_integrations.get("social_platforms") or []
                selected_platforms = [p for p in sp if isinstance(p, str)]

            # Fallback: persona platform_personas keys
            if not selected_platforms:
                persona = onboarding.get("persona_data") or onboarding.get("persona") or {}
                platform_personas = persona.get("platform_personas") or persona.get("platformPersonas") or {}
                if isinstance(platform_personas, dict):
                    selected_platforms = list(platform_personas.keys())

            # Legacy fallback: check top-level keys
            if not selected_platforms:
                for key in ("selected_platforms", "platforms", "social_platforms", "connected_platforms"):
                    val = onboarding.get(key)
                    if isinstance(val, list):
                        selected_platforms = [p for p in val if isinstance(p, str)]
                        break
        except Exception:
            pass

        platform_urls = {
            "linkedin": "/linkedin-studio",
            "facebook": "/facebook-writer",
            "twitter": "/linkedin-studio",  # no dedicated twitter writer, use linkedin as fallback
            "instagram": "/linkedin-studio",
            "tiktok": "/linkedin-studio",
            "youtube": "/linkedin-studio",
        }

        target_platforms = [p for p in selected_platforms if p.lower() in platform_urls]
        if not target_platforms:
            # No known platforms configured — generic engage task
            default_proposals.append(TaskProposal(
                title="Share content on social media",
                description="Promote your latest published piece across your social channels.",
                pillar_id="engage",
                priority="medium",
                estimated_time=20,
                source_agent="SocialAmplificationAgent",
                reasoning="Social distribution drives referral traffic and builds audience engagement.",
                action_type="navigate",
                action_url="/linkedin-studio",
            ))
            return default_proposals

        platform = target_platforms[0]
        platform_label = platform.capitalize()
        default_proposals.append(TaskProposal(
            title=f"Share content on {platform_label}",
            description=f"Adapt and publish your latest content as a {platform_label} post to drive engagement.",
            pillar_id="engage",
            priority="medium",
            estimated_time=20,
            source_agent="SocialAmplificationAgent",
            reasoning=f"Consistent {platform_label} posting maintains audience engagement and extends content reach.",
            action_type="navigate",
            action_url=platform_urls[platform.lower()],
            context_data={"platform": platform.lower()},
        ))

        if len(target_platforms) > 1:
            platform2 = target_platforms[1]
            default_proposals.append(TaskProposal(
                title=f"Cross-post to {platform2.capitalize()}",
                description=f"Repurpose your latest content for your {platform2.capitalize()} audience.",
                pillar_id="engage",
                priority="low",
                estimated_time=15,
                source_agent="SocialAmplificationAgent",
                reasoning=f"Cross-posting to {platform2.capitalize()} increases reach without additional content creation cost.",
                action_type="navigate",
                action_url=platform_urls[platform2.lower()],
                context_data={"platform": platform2.lower()},
            ))

        return await self._synthesize_task_proposals(
            context,
            default_proposals,
            instructions=(
                "Propose the next social-distribution actions for this brand based on its connected "
                "platforms, content types, posting cadence, brand voice, and target audience. Each task "
                "must have a pillar_id from [plan, generate, publish, analyze, engage, remarket] and an "
                "action_url pointing to a relevant studio (e.g. /linkedin-studio, /facebook-writer)."
            ),
        )
