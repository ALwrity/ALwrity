"""
Context Manager for 12-Step Prompt Chaining

This module manages context across all 12 steps of the prompt chaining framework.
"""

import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger


class ContextManager:
    """
    Manages context across all 12 steps of the prompt chaining framework.
    
    Responsibilities:
    - Context initialization and setup
    - Context updates across steps
    - Context validation and integrity
    - Context persistence and recovery
    - Context optimization for AI prompts
    """
    
    def __init__(self):
        """Initialize the context manager."""
        self.context: Dict[str, Any] = {}
        self.context_history: List[Dict[str, Any]] = []
        self.max_history_size = 50
        self.context_schema = self._initialize_context_schema()
        
        logger.info("📋 Context Manager initialized")
    
    def _initialize_context_schema(self) -> Dict[str, Any]:
        """Initialize the context schema for validation."""
        return {
            "required_fields": [
                "user_id",
                "strategy_id",
                "calendar_type",
                "industry",
                "business_size",
                "user_data",
                "step_results",
                "quality_scores",
                "current_step",
                "phase"
            ],
            "optional_fields": [
                "ai_confidence",
                "quality_score",
                "processing_time",
                "generated_at",
                "framework_version",
                "status"
            ],
            "data_types": {
                "user_id": (int, str),
                "strategy_id": (int, type(None)),
                "calendar_type": str,
                "industry": str,
                "business_size": str,
                "user_data": dict,
                "step_results": dict,
                "quality_scores": dict,
                "current_step": int,
                "phase": str
            }
        }
    
    async def initialize(self, initial_context: Dict[str, Any]):
        """
        Initialize the context with initial data.
        
        Args:
            initial_context: Initial context data
        """
        try:
            logger.info("🔍 Initializing context")
            
            # Validate initial context
            self._validate_context(initial_context)
            
            # Set up base context
            self.context = {
                **initial_context,
                "step_results": {},
                "quality_scores": {},
                "current_step": 0,
                "phase": "initialization",
                "context_initialized_at": datetime.now().isoformat(),
                "context_version": "1.0"
            }
            
            # Add to history
            self._add_to_history(self.context.copy())
            
            logger.info("✅ Context initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Error initializing context: {str(e)}")
            raise
    
    def _validate_context(self, context: Dict[str, Any]):
        """
        Validate context against schema.
        
        Args:
            context: Context to validate
        """
        # Check required fields
        for field in self.context_schema["required_fields"]:
            if field not in context:
                raise ValueError(f"Missing required field: {field}")
        
        # Check data types
        for field, expected_type in self.context_schema["data_types"].items():
            if field in context:
                if not isinstance(context[field], expected_type):
                    raise ValueError(f"Invalid type for {field}: expected {expected_type}, got {type(context[field])}")
    
    def _add_to_history(self, context_snapshot: Dict[str, Any]):
        """Add context snapshot to history."""
        self.context_history.append({
            "timestamp": datetime.now().isoformat(),
            "context": context_snapshot.copy()
        })
        
        # Limit history size
        if len(self.context_history) > self.max_history_size:
            self.context_history.pop(0)
    
    async def update_context(self, step_name: str, step_result: Dict[str, Any]):
        """
        Update context with step result.
        
        Args:
            step_name: Name of the step that produced the result
            step_result: Result from the step
        """
        try:
            logger.info(f"🔄 Updating context with {step_name} result")
            
            # Update step results
            self.context["step_results"][step_name] = step_result
            
            # Update current step
            step_number = step_result.get("step_number", 0)
            self.context["current_step"] = step_number
            
            # Update quality scores
            quality_score = step_result.get("quality_score", 0.0)
            self.context["quality_scores"][step_name] = quality_score
            
            # Update phase based on step number
            self.context["phase"] = self._get_phase_for_step(step_number)
            
            # Update overall quality score
            self._update_overall_quality_score()
            
            # Add to history
            self._add_to_history(self.context.copy())
            
            logger.info(f"✅ Context updated with {step_name} result")
            
        except Exception as e:
            logger.error(f"❌ Error updating context: {str(e)}")
            raise
    
    def _get_phase_for_step(self, step_number: int) -> str:
        """
        Get the phase name for a given step number.
        
        Args:
            step_number: Step number (1-12)
            
        Returns:
            Phase name
        """
        if 1 <= step_number <= 3:
            return "phase_1_foundation"
        elif 4 <= step_number <= 6:
            return "phase_2_structure"
        elif 7 <= step_number <= 9:
            return "phase_3_content"
        elif 10 <= step_number <= 12:
            return "phase_4_optimization"
        else:
            return "unknown"
    
    def _update_overall_quality_score(self):
        """Update the overall quality score based on all step results."""
        quality_scores = list(self.context["quality_scores"].values())
        
        if quality_scores:
            # Calculate weighted average (later steps have more weight)
            total_weight = 0
            weighted_sum = 0
            
            for step_name, score in self.context["quality_scores"].items():
                step_number = self.context["step_results"].get(step_name, {}).get("step_number", 1)
                weight = step_number  # Weight by step number
                weighted_sum += score * weight
                total_weight += weight
            
            overall_score = weighted_sum / total_weight if total_weight > 0 else 0.0
            self.context["quality_score"] = min(overall_score, 1.0)
        else:
            self.context["quality_score"] = 0.0
    
    def get_context(self) -> Dict[str, Any]:
        """
        Get the current context.
        
        Returns:
            Current context
        """
        return self.context.copy()
    
    def get_context_for_step(self, step_name: str) -> Dict[str, Any]:
        """
        Get context optimized for a specific step.
        
        Args:
            step_name: Name of the step
            
        Returns:
            Context optimized for the step
        """
        step_context = self.context.copy()
        
        # Add step-specific context
        step_context["current_step_name"] = step_name
        step_context["previous_step_results"] = self._get_previous_step_results(step_name)
        step_context["relevant_user_data"] = self._get_relevant_user_data(step_name)
        
        return step_context
    
    def _get_previous_step_results(self, current_step_name: str) -> Dict[str, Any]:
        """
        Get results from previous steps.
        
        Args:
            current_step_name: Name of the current step
            
        Returns:
            Dict of previous step results
        """
        current_step_number = self._get_step_number(current_step_name)
        previous_results = {}
        
        for step_name, result in self.context["step_results"].items():
            step_number = result.get("step_number", 0)
            if step_number < current_step_number:
                previous_results[step_name] = result
        
        return previous_results
    
    def _get_relevant_user_data(self, step_name: str) -> Dict[str, Any]:
        """
        Get user data relevant to a specific step.
        
        Args:
            step_name: Name of the step
            
        Returns:
            Relevant user data
        """
        step_number = self._get_step_number(step_name)
        user_data = self.context.get("user_data", {})
        
        # Step-specific data filtering
        if step_number <= 3:  # Foundation phase
            return {
                "onboarding_data": user_data.get("onboarding_data", {}),
                "strategy_data": user_data.get("strategy_data", {}),
                "industry": self.context.get("industry"),
                "business_size": self.context.get("business_size")
            }
        elif step_number <= 6:  # Structure phase
            return {
                "strategy_data": user_data.get("strategy_data", {}),
                "gap_analysis": user_data.get("gap_analysis", {}),
                "ai_analysis": user_data.get("ai_analysis", {})
            }
        elif step_number <= 9:  # Content phase
            return {
                "strategy_data": user_data.get("strategy_data", {}),
                "gap_analysis": user_data.get("gap_analysis", {}),
                "ai_analysis": user_data.get("ai_analysis", {})
            }
        else:  # Optimization phase
            return user_data
    
    def _get_step_number(self, step_name: str) -> int:
        """
        Get step number from step name.
        
        Args:
            step_name: Name of the step
            
        Returns:
            Step number
        """
        try:
            return int(step_name.split("_")[-1])
        except (ValueError, IndexError):
            return 0
    
    def get_context_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the current context.
        
        Returns:
            Context summary
        """
        return {
            "user_id": self.context.get("user_id"),
            "strategy_id": self.context.get("strategy_id"),
            "calendar_type": self.context.get("calendar_type"),
            "industry": self.context.get("industry"),
            "business_size": self.context.get("business_size"),
            "current_step": self.context.get("current_step"),
            "phase": self.context.get("phase"),
            "quality_score": self.context.get("quality_score"),
            "completed_steps": len(self.context.get("step_results", {})),
            "total_steps": 12,
            "context_initialized_at": self.context.get("context_initialized_at"),
            "context_version": self.context.get("context_version")
        }
    
    def get_context_history(self) -> List[Dict[str, Any]]:
        """
        Get the context history.
        
        Returns:
            List of context snapshots
        """
        return self.context_history.copy()
    
    def rollback_context(self, steps_back: int = 1):
        """
        Rollback context to a previous state.
        
        Args:
            steps_back: Number of steps to rollback
        """
        if len(self.context_history) <= steps_back:
            logger.warning("⚠️ Not enough history to rollback")
            return
        
        # Remove recent history entries
        for _ in range(steps_back):
            self.context_history.pop()
        
        # Restore context from history
        if self.context_history:
            self.context = self.context_history[-1]["context"].copy()
            logger.info(f"🔄 Context rolled back {steps_back} steps")
        else:
            logger.warning("⚠️ No context history available for rollback")
    
    def export_context(self) -> str:
        """
        Export context to JSON string.
        
        Returns:
            JSON string representation of context
        """
        try:
            return json.dumps(self.context, indent=2, default=str)
        except Exception as e:
            logger.error(f"❌ Error exporting context: {str(e)}")
            return "{}"
    
    def import_context(self, context_json: str):
        """
        Import context from JSON string.
        
        Args:
            context_json: JSON string representation of context
        """
        try:
            imported_context = json.loads(context_json)
            self._validate_context(imported_context)
            self.context = imported_context
            self._add_to_history(self.context.copy())
            logger.info("✅ Context imported successfully")
        except Exception as e:
            logger.error(f"❌ Error importing context: {str(e)}")
            raise
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get health status of the context manager.
        
        Returns:
            Dict containing health status
        """
        return {
            "service": "context_manager",
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "context_initialized": bool(self.context),
            "context_size": len(str(self.context)),
            "history_size": len(self.context_history),
            "max_history_size": self.max_history_size,
            "current_step": self.context.get("current_step", 0),
            "phase": self.context.get("phase", "unknown"),
            "quality_score": self.context.get("quality_score", 0.0)
        }
