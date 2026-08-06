"""
Social Amplification Agent implementation.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent, TXTAI_AVAILABLE, Agent
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent, TaskProposal
from services.database import has_onboarding_session

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
            # Removed unsupported 'system' argument
            # Instruction will be provided via orchestrator context or initial prompt
            # Instruction should be provided during invocation or via orchestrator context
        )

    def get_social_integration_capabilities(self) -> Dict[str, Dict[str, bool]]:
        """Expose platform capability flags used by social integration managers."""
        return self._get_social_capability_matrix()
    
    # Tool Implementations
    
    def _social_monitor_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Social monitoring tool using SIF.
        
        Args:
            context: Dictionary containing monitoring criteria like 'topics' or 'platforms'.
        """
        # Stub implementation
        return {
            "trends": ["AI in marketing", "Content automation"],
            "source": "stub",
            "timestamp": datetime.utcnow().isoformat()
        }

    def _content_adapter_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adapts content for specific platforms.
        
        Args:
            context: Dictionary containing 'content' and 'platform' (e.g., 'linkedin', 'twitter').
        """
        # Stub implementation
        return {"adapted_content": "Social post"}

    def _engagement_optimizer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimizes content for engagement (hashtags, timing, hook).
        
        Args:
            context: Dictionary containing 'content' to optimize.
        """
        # Stub implementation
        return {
            "optimization_suggestions": ["Use questions"],
            "estimated_engagement_score": 8.5,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _distribution_manager_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Manages distribution (scheduling/posting).
        
        Args:
            context: Dictionary containing 'post_content' and 'schedule_time'.
        """
        # Stub implementation
        return {
            "distribution_plan": [],
            "status": "scheduled",
            "timestamp": datetime.utcnow().isoformat()
        }

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose social media tasks based on user's onboarding context.
        Derives platforms and content types from user data.
        """
        proposals = []

        onboarding = context.get("onboarding_data", {})
        if not isinstance(onboarding, dict):
            return proposals

        # Extract selected platforms from onboarding step 5
        selected_platforms = []
        try:
            step5 = onboarding.get("step5_summary") or onboarding.get("distribution_channels") or {}
            if isinstance(step5, dict):
                sp = step5.get("selected_platforms") or step5.get("platforms") or []
                selected_platforms = [p for p in sp if isinstance(p, str)]
            if not selected_platforms:
                # Fallback: check top-level keys
                for key in ("selected_platforms", "platforms", "social_platforms"):
                    val = onboarding.get(key)
                    if isinstance(val, list):
                        selected_platforms = [p for p in val if isinstance(p, str)]
                        break
        except Exception:
            pass

        platform_urls = {
            "linkedin": "/linkedin-writer",
            "facebook": "/facebook-writer",
            "twitter": "/linkedin-writer",  # no dedicated twitter writer, use linkedin as fallback
            "instagram": "/linkedin-writer",
            "tiktok": "/linkedin-writer",
            "youtube": "/linkedin-writer",
        }

        target_platforms = [p for p in selected_platforms if p.lower() in platform_urls]
        if not target_platforms:
            # No known platforms configured — generic engage task
            proposals.append(TaskProposal(
                title="Share content on social media",
                description="Promote your latest published piece across your social channels.",
                pillar_id="engage",
                priority="medium",
                estimated_time=20,
                source_agent="SocialAmplificationAgent",
                reasoning="Social distribution drives referral traffic and builds audience engagement.",
                action_type="navigate",
                action_url="/linkedin-writer",
            ))
            return proposals

        platform = target_platforms[0]
        platform_label = platform.capitalize()
        proposals.append(TaskProposal(
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
            proposals.append(TaskProposal(
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

        return proposals
