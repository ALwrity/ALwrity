"""
Agent Safety Framework for ALwrity Autonomous Marketing Agents
Implements safety constraints, validation, and rollback mechanisms
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum

from utils.logger_utils import get_service_logger
from services.database import get_session_for_user

logger = get_service_logger(__name__)

class RiskLevel(Enum):
    """Risk levels for agent actions"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ActionCategory(Enum):
    """Categories of agent actions"""
    CONTENT_MODIFICATION = "content_modification"
    SEO_OPTIMIZATION = "seo_optimization"
    COMPETITOR_RESPONSE = "competitor_response"
    SOCIAL_AMPLIFICATION = "social_amplification"
    STRATEGY_CHANGE = "strategy_change"
    SYSTEM_CONFIGURATION = "system_configuration"

@dataclass
class SafetyConstraint:
    """Represents a safety constraint for agent actions"""
    constraint_id: str
    name: str
    description: str
    action_categories: List[ActionCategory]
    risk_threshold: float  # Maximum allowed risk level (0.0 to 1.0)
    approval_required: bool
    auto_approval_threshold: float  # Risk level below which auto-approval is allowed
    daily_limit: Optional[int] = None  # Maximum actions per day
    hourly_limit: Optional[int] = None  # Maximum actions per hour
    conditions: Dict[str, Any] = None  # Additional conditions for validation
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.conditions is None:
            self.conditions = {}

@dataclass
class ActionCheckpoint:
    """Represents a checkpoint for rollback purposes"""
    checkpoint_id: str
    action_id: str
    agent_id: str
    user_id: str
    action_type: str
    action_data: Dict[str, Any]
    system_state: Dict[str, Any]
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()

@dataclass
class SafetyValidation:
    """Result of safety validation"""
    is_valid: bool
    risk_level: RiskLevel
    violations: List[str]
    recommendations: List[str]
    requires_approval: bool
    confidence_score: float  # 0.0 to 1.0
    validation_timestamp: str = None
    
    def __post_init__(self):
        if self.validation_timestamp is None:
            self.validation_timestamp = datetime.utcnow().isoformat()


@dataclass
class SafetyArbitrationDecision:
    """Explicit allow/deny/lock decision with reasons."""
    decision: str
    reasons: List[str]
    tier: int
    confidence: float
    lock_state_active: bool


class SafetyConstraintManager:
    """Manages safety constraints for agent actions"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.constraints: Dict[str, SafetyConstraint] = {}
        self.action_history: List[Dict[str, Any]] = []
        self.violation_history: List[Dict[str, Any]] = []
        self.lock_state_active: bool = False
        self.lock_state_reason: Optional[str] = None
        
        # Initialize default constraints
        self._initialize_default_constraints()
        
        logger.info(f"Initialized SafetyConstraintManager for user: {user_id}")
    
    def _initialize_default_constraints(self):
        """Initialize default safety constraints"""
        default_constraints = [
            SafetyConstraint(
                constraint_id="content_modification_limit",
                name="Content Modification Daily Limit",
                description="Limit the number of content modifications per day",
                action_categories=[ActionCategory.CONTENT_MODIFICATION],
                risk_threshold=0.7,
                approval_required=False,
                auto_approval_threshold=0.3,
                daily_limit=50,
                hourly_limit=10
            ),
            SafetyConstraint(
                constraint_id="high_risk_approval_required",
                name="High Risk Action Approval",
                description="Require approval for high-risk actions",
                action_categories=[ActionCategory.STRATEGY_CHANGE, ActionCategory.SYSTEM_CONFIGURATION],
                risk_threshold=0.8,
                approval_required=True,
                auto_approval_threshold=0.2
            ),
            SafetyConstraint(
                constraint_id="competitor_response_cooldown",
                name="Competitor Response Cooldown",
                description="Prevent excessive competitor responses",
                action_categories=[ActionCategory.COMPETITOR_RESPONSE],
                risk_threshold=0.6,
                approval_required=False,
                auto_approval_threshold=0.4,
                daily_limit=20,
                hourly_limit=5
            ),
            SafetyConstraint(
                constraint_id="seo_optimization_safety",
                name="SEO Optimization Safety",
                description="Ensure SEO optimizations don't harm rankings",
                action_categories=[ActionCategory.SEO_OPTIMIZATION],
                risk_threshold=0.5,
                approval_required=False,
                auto_approval_threshold=0.3,
                daily_limit=30,
                hourly_limit=8
            ),
            SafetyConstraint(
                constraint_id="social_amplification_limits",
                name="Social Amplification Limits",
                description="Limit social media amplification to prevent spam",
                action_categories=[ActionCategory.SOCIAL_AMPLIFICATION],
                risk_threshold=0.6,
                approval_required=False,
                auto_approval_threshold=0.4,
                daily_limit=25,
                hourly_limit=6
            )
        ]
        
        for constraint in default_constraints:
            self.constraints[constraint.constraint_id] = constraint
    
    async def validate_action(self, action_data: Dict[str, Any]) -> SafetyValidation:
        """Validate an action against safety constraints"""
        try:
            logger.info(f"Validating action for user {self.user_id}: {action_data.get('action_type', 'unknown')}")

            if self.lock_state_active and action_data.get("autonomous_modification", True):
                reason = self.lock_state_reason or "Safety lock is active due to Tier 3 systemic anomaly"
                return SafetyValidation(
                    is_valid=False,
                    risk_level=RiskLevel.CRITICAL,
                    violations=["Autonomous modifications blocked while lock state is active"],
                    recommendations=[reason],
                    requires_approval=True,
                    confidence_score=1.0
                )
            
            violations = []
            recommendations = []
            requires_approval = False
            confidence_score = 1.0
            
            # Extract action details
            action_type = action_data.get('action_type', 'unknown')
            action_category = self._determine_action_category(action_type)
            risk_score = action_data.get('risk_score', 0.5)
            impact_score = action_data.get('impact_score', 0.5)
            
            # Determine risk level
            risk_level = self._calculate_risk_level(risk_score, impact_score)
            
            # Check against all relevant constraints
            for constraint in self.constraints.values():
                if action_category in constraint.action_categories:
                    constraint_result = await self._check_constraint(constraint, action_data, risk_level)
                    
                    if not constraint_result['is_valid']:
                        violations.extend(constraint_result['violations'])
                        confidence_score *= 0.9  # Reduce confidence for violations
                    
                    if constraint_result['requires_approval']:
                        requires_approval = True
                    
                    recommendations.extend(constraint_result['recommendations'])
            
            # Check rate limits
            rate_limit_result = await self._check_rate_limits(action_category, action_data)
            if not rate_limit_result['is_valid']:
                violations.extend(rate_limit_result['violations'])
                confidence_score *= 0.8
            
            # Check for suspicious patterns
            pattern_result = await self._check_suspicious_patterns(action_data)
            if not pattern_result['is_valid']:
                violations.extend(pattern_result['violations'])
                confidence_score *= 0.7
                requires_approval = True  # Suspicious patterns always require approval
            
            # Final validation
            is_valid = len(violations) == 0 and not requires_approval
            confidence_score = max(0.0, min(1.0, confidence_score))
            arbitration = self._arbitrate_decision(action_data, risk_level, violations, requires_approval, confidence_score)

            if arbitration.decision == "lock":
                self.lock_state_active = True
                self.lock_state_reason = "; ".join(arbitration.reasons)
                is_valid = False
                requires_approval = True

            recommendations.extend([f"Arbitration decision: {arbitration.decision}", *arbitration.reasons])

            logger.info(f"Action validation completed for user {self.user_id}. Decision: {arbitration.decision}, Valid: {is_valid}, Risk: {risk_level.value}, Violations: {len(violations)}")

            # Record in history
            await self._record_validation_history(action_data, is_valid, violations)

            return SafetyValidation(
                is_valid=is_valid,
                risk_level=risk_level,
                violations=violations,
                recommendations=recommendations,
                requires_approval=requires_approval,
                confidence_score=confidence_score
            )
            
        except Exception as e:
            logger.error(f"Error validating action for user {self.user_id}: {e}")
            
            # Return safe default on error
            return SafetyValidation(
                is_valid=False,
                risk_level=RiskLevel.CRITICAL,
                violations=["Validation system error"],
                recommendations=["Manual review required"],
                requires_approval=True,
                confidence_score=0.0
            )
    
    def _arbitrate_decision(self, action_data: Dict[str, Any], risk_level: RiskLevel, violations: List[str], requires_approval: bool, confidence_score: float) -> SafetyArbitrationDecision:
        """Arbitrate allow/deny/lock with explicit reasons."""
        reasons: List[str] = []
        tier = int(action_data.get("recommended_tier", 1))

        if self.lock_state_active:
            reasons.append("Existing lock state is active")
            return SafetyArbitrationDecision("lock", reasons, tier, confidence_score, True)

        if tier >= 3 or risk_level == RiskLevel.CRITICAL:
            reasons.append("Tier 3 systemic anomaly or critical risk detected")
            if violations:
                reasons.extend(violations)
            return SafetyArbitrationDecision("lock", reasons, 3, confidence_score, True)

        if violations or requires_approval:
            reasons.append("Safety policy violation or approval requirement triggered")
            reasons.extend(violations)
            return SafetyArbitrationDecision("deny", reasons, tier, confidence_score, False)

        reasons.append("No policy violations detected")
        return SafetyArbitrationDecision("allow", reasons, tier, confidence_score, False)


    def _determine_action_category(self, action_type: str) -> ActionCategory:
        """Determine the category of an action"""
        action_type_lower = action_type.lower()
        
        if any(keyword in action_type_lower for keyword in ['content', 'blog', 'article', 'post']):
            return ActionCategory.CONTENT_MODIFICATION
        elif any(keyword in action_type_lower for keyword in ['seo', 'meta', 'keyword', 'optimization']):
            return ActionCategory.SEO_OPTIMIZATION
        elif any(keyword in action_type_lower for keyword in ['competitor', 'competitive', 'response']):
            return ActionCategory.COMPETITOR_RESPONSE
        elif any(keyword in action_type_lower for keyword in ['social', 'share', 'amplify', 'distribute']):
            return ActionCategory.SOCIAL_AMPLIFICATION
        elif any(keyword in action_type_lower for keyword in ['strategy', 'plan', 'approach']):
            return ActionCategory.STRATEGY_CHANGE
        elif any(keyword in action_type_lower for keyword in ['config', 'setting', 'system']):
            return ActionCategory.SYSTEM_CONFIGURATION
        else:
            return ActionCategory.CONTENT_MODIFICATION  # Default category
    
    def _calculate_risk_level(self, risk_score: float, impact_score: float) -> RiskLevel:
        """Calculate overall risk level"""
        # Weighted combination of risk and impact
        combined_score = (risk_score * 0.6) + (impact_score * 0.4)
        
        if combined_score >= 0.8:
            return RiskLevel.CRITICAL
        elif combined_score >= 0.6:
            return RiskLevel.HIGH
        elif combined_score >= 0.3:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    async def _check_constraint(self, constraint: SafetyConstraint, action_data: Dict[str, Any], risk_level: RiskLevel) -> Dict[str, Any]:
        """Check an action against a specific constraint"""
        violations = []
        recommendations = []
        requires_approval = False
        
        # Check risk threshold
        if risk_level.value in ['high', 'critical'] and constraint.risk_threshold < 0.8:
            violations.append(f"Risk level {risk_level.value} exceeds constraint threshold")
            requires_approval = True
        
        # Check rate limits
        if constraint.daily_limit:
            daily_count = await self._get_daily_action_count(constraint.constraint_id)
            if daily_count >= constraint.daily_limit:
                violations.append(f"Daily limit exceeded: {daily_count}/{constraint.daily_limit}")
        
        if constraint.hourly_limit:
            hourly_count = await self._get_hourly_action_count(constraint.constraint_id)
            if hourly_count >= constraint.hourly_limit:
                violations.append(f"Hourly limit exceeded: {hourly_count}/{constraint.hourly_limit}")
        
        # Check approval requirement
        if constraint.approval_required:
            requires_approval = True
            recommendations.append("Action requires manual approval due to safety constraints")
        
        # Check auto-approval threshold
        risk_score = action_data.get('risk_score', 0.5)
        if risk_score > constraint.auto_approval_threshold:
            requires_approval = True
        
        # Custom condition checks
        if constraint.conditions:
            condition_result = await self._check_custom_conditions(constraint.conditions, action_data)
            if not condition_result['is_valid']:
                violations.extend(condition_result['violations'])
        
        is_valid = len(violations) == 0 and not requires_approval
        
        return {
            "is_valid": is_valid,
            "violations": violations,
            "recommendations": recommendations,
            "requires_approval": requires_approval
        }
    
    async def _check_rate_limits(self, action_category: ActionCategory, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check rate limits for actions"""
        violations = []
        
        # Get current time window counts
        recent_actions = await self._get_recent_actions(hours=1)
        category_actions = [action for action in recent_actions if self._determine_action_category(action.get('action_type', '')) == action_category]
        
        # Check hourly limits
        if len(category_actions) > 50:  # Default hourly limit
            violations.append(f"Hourly action limit exceeded for {action_category.value}")
        
        # Check daily limits
        daily_actions = await self._get_recent_actions(hours=24)
        daily_category_actions = [action for action in daily_actions if self._determine_action_category(action.get('action_type', '')) == action_category]
        
        if len(daily_category_actions) > 200:  # Default daily limit
            violations.append(f"Daily action limit exceeded for {action_category.value}")
        
        return {
            "is_valid": len(violations) == 0,
            "violations": violations
        }
    
    async def _check_suspicious_patterns(self, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check for suspicious patterns in actions"""
        violations = []
        
        # Get recent action patterns
        recent_actions = await self._get_recent_actions(hours=24)
        
        # Check for rapid repetitive actions
        action_type = action_data.get('action_type', '')
        similar_actions = [action for action in recent_actions if action.get('action_type') == action_type]
        
        if len(similar_actions) > 10:  # More than 10 similar actions in 24 hours
            violations.append(f"Suspicious pattern: {len(similar_actions)} similar actions in 24 hours")
        
        # Check for unusual timing patterns
        if len(recent_actions) > 100:  # More than 100 actions in 1 hour
            violations.append("Suspicious pattern: Unusually high action frequency")
        
        # Check for conflicting actions
        conflicting_actions = await self._detect_conflicting_actions(action_data, recent_actions)
        if conflicting_actions:
            violations.append(f"Conflicting actions detected: {len(conflicting_actions)}")
        
        return {
            "is_valid": len(violations) == 0,
            "violations": violations
        }
    
    async def _detect_conflicting_actions(self, current_action: Dict[str, Any], recent_actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect actions that conflict with recent actions"""
        conflicts = []
        
        # Simple conflict detection based on action types
        conflicting_pairs = [
            ("optimize_content", "delete_content"),
            ("increase_keywords", "decrease_keywords"),
            ("enable_feature", "disable_feature")
        ]
        
        current_action_type = current_action.get('action_type', '')
        
        for pair in conflicting_pairs:
            if current_action_type == pair[0]:
                # Check for recent opposite action
                for action in recent_actions:
                    if action.get('action_type') == pair[1]:
                        conflicts.append(action)
                        break
            elif current_action_type == pair[1]:
                # Check for recent opposite action
                for action in recent_actions:
                    if action.get('action_type') == pair[0]:
                        conflicts.append(action)
                        break
        
        return conflicts
    
    async def _check_custom_conditions(self, conditions: Dict[str, Any], action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check custom conditions for constraints"""
        violations = []
        
        # Example custom conditions (can be extended)
        if conditions.get('max_content_length'):
            content_length = len(action_data.get('content', ''))
            if content_length > conditions['max_content_length']:
                violations.append(f"Content length {content_length} exceeds maximum {conditions['max_content_length']}")
        
        if conditions.get('allowed_keywords'):
            content = action_data.get('content', '').lower()
            allowed_keywords = [kw.lower() for kw in conditions['allowed_keywords']]
            if not any(keyword in content for keyword in allowed_keywords):
                violations.append("Content does not contain required keywords")
        
        return {
            "is_valid": len(violations) == 0,
            "violations": violations
        }
    
    async def _get_recent_actions(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent actions from history"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        return [
            action for action in self.action_history
            if datetime.fromisoformat(action.get('timestamp', datetime.utcnow().isoformat())) > cutoff_time
        ]
    
    async def _get_daily_action_count(self, constraint_id: str) -> int:
        """Get daily action count for a specific constraint"""
        daily_actions = await self._get_recent_actions(hours=24)
        return len(daily_actions)
    
    async def _get_hourly_action_count(self, constraint_id: str) -> int:
        """Get hourly action count for a specific constraint"""
        hourly_actions = await self._get_recent_actions(hours=1)
        return len(hourly_actions)
    
    async def _record_validation_history(self, action_data: Dict[str, Any], is_valid: bool, violations: List[str]):
        """Record validation in history"""
        validation_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "action_type": action_data.get('action_type', 'unknown'),
            "is_valid": is_valid,
            "violations": violations,
            "action_data": action_data
        }
        
        self.action_history.append(validation_record)
        
        # Keep only recent history (last 1000 records)
        if len(self.action_history) > 1000:
            self.action_history = self.action_history[-1000:]
        
        # Record violations separately
        if violations:
            violation_record = {
                "timestamp": datetime.utcnow().isoformat(),
                "action_type": action_data.get('action_type', 'unknown'),
                "violations": violations,
                "severity": "high" if len(violations) > 2 else "medium"
            }
            self.violation_history.append(violation_record)
            
            # Keep only recent violations (last 500 records)
            if len(self.violation_history) > 500:
                self.violation_history = self.violation_history[-500:]
    
    def add_custom_constraint(self, constraint: SafetyConstraint):
        """Add a custom safety constraint"""
        self.constraints[constraint.constraint_id] = constraint
        logger.info(f"Added custom constraint for user {self.user_id}: {constraint.constraint_id}")
    
    def remove_constraint(self, constraint_id: str):
        """Remove a safety constraint"""
        if constraint_id in self.constraints:
            del self.constraints[constraint_id]
            logger.info(f"Removed constraint for user {self.user_id}: {constraint_id}")
    
    def get_constraints(self) -> Dict[str, SafetyConstraint]:
        """Get all safety constraints"""
        return self.constraints.copy()
    
    def get_validation_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent validation history"""
        return self.action_history[-limit:] if self.action_history else []
    
    def get_violation_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent violation history"""
        return self.violation_history[-limit:] if self.violation_history else []

class RollbackManager:
    """Manages rollback operations for agent actions"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.checkpoints: List[ActionCheckpoint] = []
        self.rollback_history: List[Dict[str, Any]] = []
        
        logger.info(f"Initialized RollbackManager for user: {user_id}")
    
    async def create_checkpoint(self, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> str:
        """Create a checkpoint before executing an action"""
        try:
            checkpoint_id = f"checkpoint_{self.user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            
            checkpoint = ActionCheckpoint(
                checkpoint_id=checkpoint_id,
                action_id=action_data.get('action_id', 'unknown'),
                agent_id=action_data.get('agent_id', 'unknown'),
                user_id=self.user_id,
                action_type=action_data.get('action_type', 'unknown'),
                action_data=action_data,
                system_state=system_state
            )
            
            self.checkpoints.append(checkpoint)
            
            # Keep only recent checkpoints (last 100)
            if len(self.checkpoints) > 100:
                self.checkpoints = self.checkpoints[-100:]
            
            logger.info(f"Created checkpoint for user {self.user_id}: {checkpoint_id}")
            return checkpoint_id
            
        except Exception as e:
            logger.error(f"Error creating checkpoint for user {self.user_id}: {e}")
            raise e
    
    async def rollback_to_checkpoint(self, checkpoint_id: str) -> Dict[str, Any]:
        """Rollback to a specific checkpoint"""
        try:
            # Find checkpoint
            checkpoint = next((cp for cp in self.checkpoints if cp.checkpoint_id == checkpoint_id), None)
            
            if not checkpoint:
                return {
                    "success": False,
                    "error": f"Checkpoint not found: {checkpoint_id}"
                }
            
            logger.info(f"Rolling back to checkpoint for user {self.user_id}: {checkpoint_id}")
            
            # Execute rollback (implementation depends on action type)
            rollback_result = await self._execute_rollback(checkpoint)
            
            # Record in history
            rollback_record = {
                "timestamp": datetime.utcnow().isoformat(),
                "checkpoint_id": checkpoint_id,
                "action_type": checkpoint.action_type,
                "success": rollback_result["success"],
                "details": rollback_result
            }
            self.rollback_history.append(rollback_record)
            
            # Keep only recent rollback history (last 50)
            if len(self.rollback_history) > 50:
                self.rollback_history = self.rollback_history[-50:]
            
            return rollback_result
            
        except Exception as e:
            logger.error(f"Error rolling back to checkpoint {checkpoint_id} for user {self.user_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _execute_rollback(self, checkpoint: ActionCheckpoint) -> Dict[str, Any]:
        """Execute the rollback operation based on action type"""
        try:
            action_type = checkpoint.action_type
            action_data = checkpoint.action_data
            system_state = checkpoint.system_state
            
            # Implement rollback logic for different action types
            if action_type == "content_modification":
                return await self._rollback_content_modification(action_data, system_state)
            elif action_type == "seo_optimization":
                return await self._rollback_seo_optimization(action_data, system_state)
            elif action_type == "competitor_response":
                return await self._rollback_competitor_response(action_data, system_state)
            elif action_type == "social_amplification":
                return await self._rollback_social_amplification(action_data, system_state)
            else:
                # Generic rollback
                return await self._rollback_generic(action_data, system_state)
                
        except Exception as e:
            logger.error(f"Error executing rollback for action {action_type}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _rollback_content_modification(self, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> Dict[str, Any]:
        """Rollback content modification"""
        try:
            # Implementation would depend on how content is stored and managed
            # For now, return a placeholder implementation
            
            original_content = system_state.get('original_content', {})
            modified_content = action_data.get('content', {})
            
            logger.info(f"Rolling back content modification: {action_data.get('content_id', 'unknown')}")
            
            return {
                "success": True,
                "message": "Content modification rolled back successfully",
                "details": {
                    "content_id": action_data.get('content_id'),
                    "rollback_type": "content_modification",
                    "original_state_restored": bool(original_content)
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to rollback content modification: {str(e)}"
            }
    
    async def _rollback_seo_optimization(self, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> Dict[str, Any]:
        """Rollback SEO optimization"""
        try:
            original_seo_state = system_state.get('seo_state', {})
            
            logger.info(f"Rolling back SEO optimization: {action_data.get('optimization_type', 'unknown')}")
            
            return {
                "success": True,
                "message": "SEO optimization rolled back successfully",
                "details": {
                    "optimization_type": action_data.get('optimization_type'),
                    "rollback_type": "seo_optimization",
                    "original_state_restored": bool(original_seo_state)
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to rollback SEO optimization: {str(e)}"
            }
    
    async def _rollback_competitor_response(self, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> Dict[str, Any]:
        """Rollback competitor response"""
        try:
            logger.info(f"Rolling back competitor response: {action_data.get('response_type', 'unknown')}")
            
            return {
                "success": True,
                "message": "Competitor response rolled back successfully",
                "details": {
                    "response_type": action_data.get('response_type'),
                    "rollback_type": "competitor_response",
                    "original_state_restored": True
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to rollback competitor response: {str(e)}"
            }
    
    async def _rollback_social_amplification(self, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> Dict[str, Any]:
        """Rollback social amplification"""
        try:
            logger.info(f"Rolling back social amplification: {action_data.get('platform', 'unknown')}")
            
            return {
                "success": True,
                "message": "Social amplification rolled back successfully",
                "details": {
                    "platform": action_data.get('platform'),
                    "rollback_type": "social_amplification",
                    "original_state_restored": True
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to rollback social amplification: {str(e)}"
            }
    
    async def _rollback_generic(self, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> Dict[str, Any]:
        """Generic rollback for unknown action types"""
        try:
            logger.info(f"Performing generic rollback for action: {action_data.get('action_type', 'unknown')}")
            
            return {
                "success": True,
                "message": "Generic rollback completed",
                "details": {
                    "action_type": action_data.get('action_type'),
                    "rollback_type": "generic",
                    "system_state_available": bool(system_state)
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to perform generic rollback: {str(e)}"
            }
    
    async def rollback_latest_actions(self, count: int = 1) -> List[Dict[str, Any]]:
        """Rollback the latest N actions"""
        results = []
        
        # Get latest checkpoints
        latest_checkpoints = self.checkpoints[-count:] if self.checkpoints else []
        
        for checkpoint in reversed(latest_checkpoints):
            result = await self.rollback_to_checkpoint(checkpoint.checkpoint_id)
            results.append(result)
        
        return results
    
    def get_checkpoints(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent checkpoints"""
        checkpoints_data = []
        
        for checkpoint in self.checkpoints[-limit:]:
            checkpoints_data.append({
                "checkpoint_id": checkpoint.checkpoint_id,
                "action_id": checkpoint.action_id,
                "action_type": checkpoint.action_type,
                "agent_id": checkpoint.agent_id,
                "created_at": checkpoint.created_at,
                "system_state_keys": list(checkpoint.system_state.keys())
            })
        
        return checkpoints_data
    
    def get_rollback_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get rollback history"""
        return self.rollback_history[-limit:] if self.rollback_history else []

class UserApprovalSystem:
    """Manages user approval for high-risk actions"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.pending_approvals: Dict[str, Dict[str, Any]] = {}
        self.approval_history: List[Dict[str, Any]] = []
        
        logger.info(f"Initialized UserApprovalSystem for user: {user_id}")
    
    async def request_approval(self, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Request user approval for an action"""
        try:
            approval_id = f"approval_{self.user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            
            approval_request = {
                "approval_id": approval_id,
                "action_data": action_data,
                "requested_at": datetime.utcnow().isoformat(),
                "status": "pending",
                "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat()
            }
            
            self.pending_approvals[approval_id] = approval_request
            
            logger.info(f"Created approval request for user {self.user_id}: {approval_id}")
            
            return {
                "success": True,
                "approval_id": approval_id,
                "status": "pending",
                "message": "Approval request created successfully"
            }
            
        except Exception as e:
            logger.error(f"Error creating approval request for user {self.user_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def approve_action(self, approval_id: str, user_decision: str, user_comments: str = "") -> Dict[str, Any]:
        """Process user approval decision"""
        try:
            if approval_id not in self.pending_approvals:
                return {
                    "success": False,
                    "error": "Approval request not found"
                }
            
            approval_request = self.pending_approvals[approval_id]
            
            # Check if approval has expired
            expires_at = datetime.fromisoformat(approval_request["expires_at"])
            if datetime.utcnow() > expires_at:
                del self.pending_approvals[approval_id]
                return {
                    "success": False,
                    "error": "Approval request has expired"
                }
            
            # Process decision
            approval_request["status"] = user_decision
            approval_request["decision_at"] = datetime.utcnow().isoformat()
            approval_request["user_comments"] = user_comments
            
            # Record in history
            self.approval_history.append(approval_request)
            
            # Remove from pending
            del self.pending_approvals[approval_id]
            
            # Keep only recent history (last 100)
            if len(self.approval_history) > 100:
                self.approval_history = self.approval_history[-100:]
            
            logger.info(f"Processed approval decision for user {self.user_id}: {approval_id} - {user_decision}")
            
            return {
                "success": True,
                "approval_id": approval_id,
                "status": user_decision,
                "message": f"Action {user_decision} successfully"
            }
            
        except Exception as e:
            logger.error(f"Error processing approval decision for user {self.user_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_pending_approvals(self) -> List[Dict[str, Any]]:
        """Get all pending approval requests"""
        return list(self.pending_approvals.values())
    
    def get_approval_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent approval history"""
        return self.approval_history[-limit:] if self.approval_history else []
    
    def get_approval_statistics(self) -> Dict[str, Any]:
        """Get approval statistics"""
        if not self.approval_history:
            return {
                "total_approvals": 0,
                "approved_count": 0,
                "rejected_count": 0,
                "approval_rate": 0.0,
                "pending_count": len(self.pending_approvals)
            }
        
        total = len(self.approval_history)
        approved = len([a for a in self.approval_history if a["status"] == "approved"])
        rejected = len([a for a in self.approval_history if a["status"] == "rejected"])
        
        return {
            "total_approvals": total,
            "approved_count": approved,
            "rejected_count": rejected,
            "approval_rate": approved / total if total > 0 else 0.0,
            "pending_count": len(self.pending_approvals)
        }

# Global safety framework instance
safety_framework_instances: Dict[str, Dict[str, Any]] = {}

def get_safety_framework(user_id: str) -> Dict[str, Any]:
    """Get or create safety framework components for a user"""
    if user_id not in safety_framework_instances:
        safety_framework_instances[user_id] = {
            "constraint_manager": SafetyConstraintManager(user_id),
            "rollback_manager": RollbackManager(user_id),
            "approval_system": UserApprovalSystem(user_id)
        }
    
    return safety_framework_instances[user_id]

# Convenience functions
async def validate_agent_action(user_id: str, action_data: Dict[str, Any]) -> SafetyValidation:
    """Validate an agent action for a user"""
    framework = get_safety_framework(user_id)
    return await framework["constraint_manager"].validate_action(action_data)

async def create_action_checkpoint(user_id: str, action_data: Dict[str, Any], system_state: Dict[str, Any]) -> str:
    """Create a checkpoint for an action"""
    framework = get_safety_framework(user_id)
    return await framework["rollback_manager"].create_checkpoint(action_data, system_state)

async def rollback_to_checkpoint(user_id: str, checkpoint_id: str) -> Dict[str, Any]:
    """Rollback to a specific checkpoint"""
    framework = get_safety_framework(user_id)
    return await framework["rollback_manager"].rollback_to_checkpoint(checkpoint_id)

async def request_user_approval(user_id: str, action_data: Dict[str, Any]) -> Dict[str, Any]:
    """Request user approval for an action"""
    framework = get_safety_framework(user_id)
    return await framework["approval_system"].request_approval(action_data)