"""
Step Manager for 12-Step Prompt Chaining

This module manages the lifecycle and dependencies of all steps in the 12-step framework.
"""

import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger

from .steps.base_step import PromptStep, PlaceholderStep


class StepManager:
    """
    Manages the lifecycle and dependencies of all steps in the 12-step framework.
    
    Responsibilities:
    - Step registration and initialization
    - Dependency management
    - Step execution order
    - Step state management
    - Error recovery and retry logic
    """
    
    def __init__(self, default_timeout: int = 120):
        """Initialize the step manager.

        Args:
            default_timeout: Default timeout in seconds for each step execution.
        """
        self.steps: Dict[str, PromptStep] = {}
        self.step_dependencies: Dict[str, List[str]] = {}
        self.execution_order: List[str] = []
        self.step_states: Dict[str, Dict[str, Any]] = {}
        self.step_timeouts: Dict[str, int] = {}
        self.default_timeout = default_timeout
        
        logger.info("🎯 Step Manager initialized")
    
    def register_step(self, step_name: str, step: PromptStep, dependencies: Optional[List[str]] = None, timeout: Optional[int] = None):
        """
        Register a step with the manager.
        
        Args:
            step_name: Unique name for the step
            step: Step instance
            dependencies: List of step names this step depends on
            timeout: Per-step timeout in seconds (overrides default)
        """
        self.steps[step_name] = step
        self.step_dependencies[step_name] = dependencies or []
        self.step_timeouts[step_name] = timeout or self.default_timeout
        self.step_states[step_name] = {
            "status": "registered",
            "registered_at": datetime.now().isoformat(),
            "execution_count": 0,
            "last_execution": None,
            "total_execution_time": 0.0,
            "success_count": 0,
            "error_count": 0
        }
        
        logger.info(f"📝 Registered step: {step_name} (dependencies: {dependencies or []})")
    
    def get_step(self, step_name: str) -> Optional[PromptStep]:
        """
        Get a step by name.
        
        Args:
            step_name: Name of the step
            
        Returns:
            Step instance or None if not found
        """
        return self.steps.get(step_name)
    
    def get_all_steps(self) -> Dict[str, PromptStep]:
        """
        Get all registered steps.
        
        Returns:
            Dict of all registered steps
        """
        return self.steps.copy()
    
    def get_step_state(self, step_name: str) -> Dict[str, Any]:
        """
        Get the current state of a step.
        
        Args:
            step_name: Name of the step
            
        Returns:
            Dict containing step state information
        """
        return self.step_states.get(step_name, {})
    
    def update_step_state(self, step_name: str, updates: Dict[str, Any]):
        """
        Update the state of a step.
        
        Args:
            step_name: Name of the step
            updates: Dict containing state updates
        """
        if step_name in self.step_states:
            self.step_states[step_name].update(updates)
            self.step_states[step_name]["last_updated"] = datetime.now().isoformat()
    
    def get_execution_order(self) -> List[str]:
        """
        Get the execution order of steps based on dependencies.
        
        Returns:
            List of step names in execution order
        """
        if not self.execution_order:
            self.execution_order = self._calculate_execution_order()
        
        return self.execution_order.copy()
    
    def _calculate_execution_order(self) -> List[str]:
        """
        Calculate the execution order based on dependencies.
        
        Returns:
            List of step names in execution order
        """
        # Simple topological sort for dependencies
        visited = set()
        temp_visited = set()
        order = []
        
        def visit(step_name: str):
            if step_name in temp_visited:
                raise ValueError(f"Circular dependency detected: {step_name}")
            
            if step_name in visited:
                return
            
            temp_visited.add(step_name)
            
            # Visit dependencies first
            for dep in self.step_dependencies.get(step_name, []):
                if dep in self.steps:
                    visit(dep)
            
            temp_visited.remove(step_name)
            visited.add(step_name)
            order.append(step_name)
        
        # Visit all steps
        for step_name in self.steps.keys():
            if step_name not in visited:
                visit(step_name)
        
        return order
    
    async def execute_step(self, step_name: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a single step.
        
        Args:
            step_name: Name of the step to execute
            context: Current context
            
        Returns:
            Dict containing step execution result
        """
        if step_name not in self.steps:
            raise ValueError(f"Step not found: {step_name}")
        
        step = self.steps[step_name]
        state = self.step_states[step_name]
        
        try:
            # Update state
            state["status"] = "running"
            state["execution_count"] += 1
            state["last_execution"] = datetime.now().isoformat()
            
            # Execute step with per-step timeout
            timeout = self.step_timeouts.get(step_name, self.default_timeout)
            result = await asyncio.wait_for(step.run(context), timeout=timeout)
            
            # Update state based on result
            if result.get("status") == "completed":
                state["status"] = "completed"
                state["success_count"] += 1
                state["total_execution_time"] += result.get("execution_time", 0.0)
            else:
                state["status"] = "failed"
                state["error_count"] += 1
            
            logger.info(f"✅ Step {step_name} executed successfully")
            return result
            
        except asyncio.TimeoutError:
            state["status"] = "timeout"
            state["error_count"] += 1
            logger.error(f"⏰ Step {step_name} timed out after {self.step_timeouts.get(step_name, self.default_timeout)}s")
            raise TimeoutError(f"Step {step_name} timed out after {self.step_timeouts.get(step_name, self.default_timeout)}s")
        except Exception as e:
            state["status"] = "error"
            state["error_count"] += 1
            logger.error(f"❌ Error executing step {step_name}: {str(e)}")
            raise
    
    async def execute_steps_in_order(self, context: Dict[str, Any], step_names: List[str]) -> Dict[str, Any]:
        """
        Execute multiple steps in order.
        
        Args:
            context: Current context
            step_names: List of step names to execute in order
            
        Returns:
            Dict containing results from all steps
        """
        results = {}
        
        for step_name in step_names:
            if step_name not in self.steps:
                logger.warning(f"⚠️ Step not found: {step_name}, skipping")
                continue
            
            try:
                result = await self.execute_step(step_name, context)
                results[step_name] = result
                
                # Update context with step result
                context["step_results"][step_name] = result
                
            except Exception as e:
                logger.error(f"❌ Failed to execute step {step_name}: {str(e)}")
                results[step_name] = {
                    "status": "error",
                    "error_message": str(e),
                    "step_name": step_name
                }
        
        return results
    
    def get_step_statistics(self) -> Dict[str, Any]:
        """
        Get statistics for all steps.
        
        Returns:
            Dict containing step statistics
        """
        stats = {
            "total_steps": len(self.steps),
            "execution_order": self.get_execution_order(),
            "step_details": {}
        }
        
        for step_name, state in self.step_states.items():
            step = self.steps.get(step_name)
            stats["step_details"][step_name] = {
                "name": step.name if step else "Unknown",
                "step_number": step.step_number if step else 0,
                "status": state["status"],
                "execution_count": state["execution_count"],
                "success_count": state["success_count"],
                "error_count": state["error_count"],
                "total_execution_time": state["total_execution_time"],
                "average_execution_time": (
                    state["total_execution_time"] / state["execution_count"]
                    if state["execution_count"] > 0 else 0.0
                ),
                "success_rate": (
                    state["success_count"] / state["execution_count"]
                    if state["execution_count"] > 0 else 0.0
                ),
                "dependencies": self.step_dependencies.get(step_name, [])
            }
        
        return stats
    
    def reset_all_steps(self):
        """Reset all steps to initial state."""
        for step_name, step in self.steps.items():
            step.reset()
            self.step_states[step_name]["status"] = "initialized"
            self.step_states[step_name]["last_reset"] = datetime.now().isoformat()
        
        logger.info("🔄 All steps reset to initial state")
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get health status of the step manager.
        
        Returns:
            Dict containing health status
        """
        total_steps = len(self.steps)
        completed_steps = sum(1 for state in self.step_states.values() if state["status"] == "completed")
        error_steps = sum(1 for state in self.step_states.values() if state["status"] == "error")
        
        return {
            "service": "step_manager",
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "total_steps": total_steps,
            "completed_steps": completed_steps,
            "error_steps": error_steps,
            "success_rate": completed_steps / total_steps if total_steps > 0 else 0.0,
            "execution_order_ready": len(self.get_execution_order()) == total_steps
        }
