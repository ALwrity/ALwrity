import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger

from ...base_step import PromptStep
from .strategy_alignment_validator import StrategyAlignmentValidator
from .consistency_checker import ConsistencyChecker


class StrategyAlignmentValidationStep(PromptStep):
    """
    Step 11: Strategy Alignment Validation - Main Implementation

    This step performs comprehensive strategy alignment validation and consistency checking.
    It ensures all previous steps are aligned with the original strategy from Step 1 and
    maintains consistency across the entire 12-step process.

    Features:
    - Strategy alignment validation against original strategy
    - Multi-dimensional alignment scoring
    - Strategy drift detection and reporting
    - Cross-step consistency validation
    - Data flow verification between steps
    - Context preservation validation
    - Logical coherence assessment
    - Real AI service integration without fallbacks
    """

    def __init__(self):
        """Initialize Step 11 with all modular components."""
        super().__init__("Strategy Alignment Validation", 11)

        # Initialize all modular components
        self.strategy_alignment_validator = StrategyAlignmentValidator()
        self.consistency_checker = ConsistencyChecker()

        logger.info("🎯 Step 11: Strategy Alignment Validation initialized with modular architecture")

    async def execute(self, context: Dict[str, Any], step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Step 11: Strategy Alignment Validation."""
        try:
            logger.info("🚀 Starting Step 11: Strategy Alignment Validation...")

            # Validate that we have the required context from previous steps
            self._validate_required_context(context)

            # Perform strategy alignment validation
            strategy_alignment_results = await self.strategy_alignment_validator.validate_strategy_alignment(
                context, step_data
            )

            # Perform consistency checking
            consistency_results = await self.consistency_checker.check_consistency(
                context, step_data
            )

            # Combine results and calculate overall quality score
            combined_results = self._combine_validation_results(
                strategy_alignment_results, consistency_results
            )

            # Generate comprehensive validation report
            validation_report = self._generate_comprehensive_validation_report(
                strategy_alignment_results, consistency_results, combined_results
            )

            # Calculate overall quality score for Step 11
            overall_quality_score = self._calculate_step_quality_score(combined_results)

            # Prepare final step results
            step_results = {
                "step_11": {
                    "step_name": "Strategy Alignment Validation",
                    "step_number": 11,
                    "overall_quality_score": overall_quality_score,
                    "strategy_alignment_validation": strategy_alignment_results.get("strategy_alignment_validation", {}),
                    "consistency_validation": consistency_results.get("consistency_validation", {}),
                    "combined_validation_results": combined_results,
                    "comprehensive_validation_report": validation_report,
                    "quality_metrics": {
                        "alignment_quality": strategy_alignment_results.get("strategy_alignment_validation", {}).get("overall_alignment_score", 0.0),
                        "consistency_quality": consistency_results.get("consistency_validation", {}).get("overall_consistency_score", 0.0),
                        "validation_completeness": self._calculate_validation_completeness(
                            strategy_alignment_results, consistency_results
                        ),
                        "validation_confidence": self._calculate_validation_confidence(
                            strategy_alignment_results, consistency_results
                        )
                    },
                    "status": "completed",
                    "timestamp": asyncio.get_event_loop().time()
                }
            }

            logger.info(f"✅ Step 11: Strategy Alignment Validation completed successfully with quality score: {overall_quality_score:.3f}")

            return step_results

        except Exception as e:
            logger.error(f"❌ Step 11: Strategy Alignment Validation failed: {str(e)}")
            raise

    def _validate_required_context(self, context: Dict[str, Any]) -> None:
        """Validate that required context from previous steps is available."""
        try:
            required_steps = ["step_01", "step_02", "step_03", "step_04", "step_05", "step_06", 
                            "step_07", "step_08", "step_09", "step_10"]
            
            missing_steps = []
            for step in required_steps:
                if step not in context:
                    missing_steps.append(step)

            if missing_steps:
                raise ValueError(f"Missing required context from steps: {missing_steps}")

            logger.info("✅ Required context validation passed - all previous steps available")

        except Exception as e:
            logger.error(f"❌ Required context validation failed: {str(e)}")
            raise

    def _combine_validation_results(self, strategy_alignment_results: Dict[str, Any], 
                                  consistency_results: Dict[str, Any]) -> Dict[str, Any]:
        """Combine strategy alignment and consistency validation results."""
        try:
            # Extract key scores
            alignment_score = strategy_alignment_results.get("strategy_alignment_validation", {}).get("overall_alignment_score", 0.0)
            consistency_score = consistency_results.get("consistency_validation", {}).get("overall_consistency_score", 0.0)

            # Calculate combined score (equal weight for now)
            combined_score = (alignment_score + consistency_score) / 2

            # Determine overall validation status
            if combined_score >= 0.9:
                validation_status = "excellent"
            elif combined_score >= 0.8:
                validation_status = "good"
            elif combined_score >= 0.7:
                validation_status = "acceptable"
            else:
                validation_status = "needs_improvement"

            return {
                "combined_validation_score": combined_score,
                "validation_status": validation_status,
                "alignment_contribution": alignment_score,
                "consistency_contribution": consistency_score,
                "validation_summary": {
                    "total_validation_dimensions": 2,
                    "excellent_validations": sum(1 for score in [alignment_score, consistency_score] if score >= 0.9),
                    "good_validations": sum(1 for score in [alignment_score, consistency_score] if 0.8 <= score < 0.9),
                    "acceptable_validations": sum(1 for score in [alignment_score, consistency_score] if 0.7 <= score < 0.8),
                    "needs_improvement_validations": sum(1 for score in [alignment_score, consistency_score] if score < 0.7)
                }
            }

        except Exception as e:
            logger.error(f"❌ Results combination failed: {str(e)}")
            return {
                "combined_validation_score": 0.0,
                "validation_status": "error",
                "error": str(e)
            }

    def _generate_comprehensive_validation_report(self, strategy_alignment_results: Dict[str, Any], 
                                                consistency_results: Dict[str, Any], 
                                                combined_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive validation report combining all results."""
        try:
            return {
                "executive_summary": {
                    "overall_validation_score": combined_results.get("combined_validation_score", 0.0),
                    "validation_status": combined_results.get("validation_status", "unknown"),
                    "key_findings": self._extract_key_findings(strategy_alignment_results, consistency_results),
                    "critical_issues": self._identify_critical_issues(strategy_alignment_results, consistency_results),
                    "recommendations": self._generate_comprehensive_recommendations(
                        strategy_alignment_results, consistency_results
                    )
                },
                "detailed_analysis": {
                    "strategy_alignment_analysis": strategy_alignment_results.get("strategy_alignment_validation", {}),
                    "consistency_analysis": consistency_results.get("consistency_validation", {}),
                    "combined_analysis": combined_results
                },
                "quality_assessment": {
                    "alignment_quality": strategy_alignment_results.get("strategy_alignment_validation", {}).get("overall_alignment_score", 0.0),
                    "consistency_quality": consistency_results.get("consistency_validation", {}).get("overall_consistency_score", 0.0),
                    "overall_quality": combined_results.get("combined_validation_score", 0.0),
                    "quality_thresholds": {
                        "excellent": 0.9,
                        "good": 0.8,
                        "acceptable": 0.7,
                        "needs_improvement": 0.6
                    }
                },
                "next_steps": self._generate_next_steps_recommendations(combined_results)
            }

        except Exception as e:
            logger.error(f"❌ Comprehensive validation report generation failed: {str(e)}")
            return {"error": str(e)}

    def _extract_key_findings(self, strategy_alignment_results: Dict[str, Any], 
                            consistency_results: Dict[str, Any]) -> List[str]:
        """Extract key findings from validation results."""
        try:
            findings = []

            # Strategy alignment findings
            alignment_data = strategy_alignment_results.get("strategy_alignment_validation", {})
            alignment_score = alignment_data.get("overall_alignment_score", 0.0)
            
            if alignment_score >= 0.9:
                findings.append("Excellent strategy alignment maintained across all steps")
            elif alignment_score >= 0.8:
                findings.append("Good strategy alignment with minor areas for improvement")
            else:
                findings.append("Strategy alignment needs attention to meet quality standards")

            # Consistency findings
            consistency_data = consistency_results.get("consistency_validation", {})
            consistency_score = consistency_data.get("overall_consistency_score", 0.0)
            
            if consistency_score >= 0.9:
                findings.append("Excellent consistency maintained across all steps")
            elif consistency_score >= 0.8:
                findings.append("Good consistency with minor inconsistencies detected")
            else:
                findings.append("Consistency issues detected that need resolution")

            return findings

        except Exception as e:
            logger.error(f"❌ Key findings extraction failed: {str(e)}")
            return ["Error extracting key findings"]

    def _identify_critical_issues(self, strategy_alignment_results: Dict[str, Any], 
                                consistency_results: Dict[str, Any]) -> List[str]:
        """Identify critical issues from validation results."""
        try:
            critical_issues = []

            # Check for critical alignment issues
            alignment_data = strategy_alignment_results.get("strategy_alignment_validation", {})
            alignment_score = alignment_data.get("overall_alignment_score", 0.0)
            
            if alignment_score < 0.7:
                critical_issues.append("Critical strategy alignment issues detected - significant drift from original strategy")

            # Check for critical consistency issues
            consistency_data = consistency_results.get("consistency_validation", {})
            consistency_score = consistency_data.get("overall_consistency_score", 0.0)
            
            if consistency_score < 0.7:
                critical_issues.append("Critical consistency issues detected - significant inconsistencies across steps")

            # Check for drift issues
            drift_analysis = alignment_data.get("strategy_drift_analysis", {})
            drift_score = drift_analysis.get("overall_drift_score", 0.0)
            
            if drift_score > 0.2:
                critical_issues.append("Significant strategy drift detected - strategy has evolved beyond acceptable thresholds")

            return critical_issues

        except Exception as e:
            logger.error(f"❌ Critical issues identification failed: {str(e)}")
            return ["Error identifying critical issues"]

    def _generate_comprehensive_recommendations(self, strategy_alignment_results: Dict[str, Any], 
                                              consistency_results: Dict[str, Any]) -> List[str]:
        """Generate comprehensive recommendations based on validation results."""
        try:
            recommendations = []

            # Strategy alignment recommendations
            alignment_data = strategy_alignment_results.get("strategy_alignment_validation", {})
            alignment_report = alignment_data.get("validation_report", {})
            alignment_recommendations = alignment_report.get("recommendations", [])
            recommendations.extend(alignment_recommendations)

            # Consistency recommendations
            consistency_data = consistency_results.get("consistency_validation", {})
            consistency_report = consistency_data.get("consistency_report", {})
            consistency_recommendations = consistency_report.get("recommendations", [])
            recommendations.extend(consistency_recommendations)

            # Add general recommendations if none specific
            if not recommendations:
                recommendations.append("Maintain current high validation standards across all dimensions")

            return recommendations

        except Exception as e:
            logger.error(f"❌ Comprehensive recommendations generation failed: {str(e)}")
            return ["Error generating comprehensive recommendations"]

    def _generate_next_steps_recommendations(self, combined_results: Dict[str, Any]) -> List[str]:
        """Generate recommendations for next steps based on validation results."""
        try:
            next_steps = []
            validation_status = combined_results.get("validation_status", "unknown")

            if validation_status == "excellent":
                next_steps.append("Proceed to Step 12: Final Calendar Assembly with confidence")
                next_steps.append("Consider documenting best practices for maintaining high alignment")
            elif validation_status == "good":
                next_steps.append("Proceed to Step 12: Final Calendar Assembly")
                next_steps.append("Address minor alignment and consistency issues in future iterations")
            elif validation_status == "acceptable":
                next_steps.append("Proceed to Step 12: Final Calendar Assembly with caution")
                next_steps.append("Plan for alignment and consistency improvements in next calendar generation")
            else:
                next_steps.append("Consider revisiting previous steps to address validation issues")
                next_steps.append("Implement alignment and consistency improvements before proceeding")

            return next_steps

        except Exception as e:
            logger.error(f"❌ Next steps recommendations generation failed: {str(e)}")
            return ["Error generating next steps recommendations"]

    def _calculate_step_quality_score(self, combined_results: Dict[str, Any]) -> float:
        """Calculate overall quality score for Step 11."""
        try:
            # Use the combined validation score as the step quality score
            return combined_results.get("combined_validation_score", 0.0)

        except Exception as e:
            logger.error(f"❌ Step quality score calculation failed: {str(e)}")
            return 0.0

    def _calculate_validation_completeness(self, strategy_alignment_results: Dict[str, Any], 
                                         consistency_results: Dict[str, Any]) -> float:
        """Calculate validation completeness score."""
        try:
            total_validations = 2
            completed_validations = 0

            # Check strategy alignment validation
            if "error" not in strategy_alignment_results.get("strategy_alignment_validation", {}):
                completed_validations += 1

            # Check consistency validation
            if "error" not in consistency_results.get("consistency_validation", {}):
                completed_validations += 1

            return completed_validations / total_validations if total_validations > 0 else 0.0

        except Exception as e:
            logger.error(f"❌ Validation completeness calculation failed: {str(e)}")
            return 0.0

    def _calculate_validation_confidence(self, strategy_alignment_results: Dict[str, Any], 
                                       consistency_results: Dict[str, Any]) -> float:
        """Calculate validation confidence score."""
        try:
            # Extract confidence scores from both validations
            alignment_confidence = strategy_alignment_results.get("strategy_alignment_validation", {}).get("confidence_assessment", {}).get("overall_confidence", 0.0)
            
            # For consistency, use the overall consistency score as confidence proxy
            consistency_confidence = consistency_results.get("consistency_validation", {}).get("overall_consistency_score", 0.0)

            # Calculate average confidence
            return (alignment_confidence + consistency_confidence) / 2

        except Exception as e:
            logger.error(f"❌ Validation confidence calculation failed: {str(e)}")
            return 0.0
    
    def get_prompt_template(self) -> str:
        """
        Get the AI prompt template for Step 11: Strategy Alignment Validation.
        
        Returns:
            String containing the prompt template for strategy alignment validation
        """
        return """
        You are an expert strategy alignment specialist tasked with validating calendar alignment.
        
        Based on the original strategy from Step 1 and all subsequent step results,
        perform comprehensive strategy alignment validation that:
        
        1. Validates all steps against the original strategy objectives
        2. Assesses multi-dimensional alignment across all strategic elements
        3. Detects strategy drift and provides correction recommendations
        4. Evaluates cross-step consistency and data flow integrity
        5. Validates context preservation throughout the process
        6. Assesses logical coherence and strategic soundness
        7. Provides alignment confidence scores and improvement suggestions
        
        For each validation area, provide:
        - Alignment assessment and scoring
        - Drift detection and analysis
        - Consistency validation results
        - Context preservation verification
        - Logical coherence evaluation
        - Improvement recommendations and corrective actions
        
        Ensure all validations are thorough, objective, and actionable for strategic improvement.
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """
        Validate the Step 11 result.
        
        Args:
            result: Step result to validate
            
        Returns:
            True if validation passes, False otherwise
        """
        try:
            # Check if result contains required fields
            required_fields = [
                "strategy_alignment_validation",
                "consistency_checker_results",
                "alignment_scores",
                "drift_detection",
                "validation_summary"
            ]
            
            for field in required_fields:
                if field not in result:
                    logger.error(f"❌ Missing required field: {field}")
                    return False
            
            # Validate alignment scores
            alignment_scores = result.get("alignment_scores", {})
            if not alignment_scores:
                logger.error("❌ No alignment scores generated")
                return False
            
            # Validate overall alignment score
            overall_alignment = alignment_scores.get("overall_alignment_score", 0.0)
            if overall_alignment < 0.0 or overall_alignment > 1.0:
                logger.error(f"❌ Invalid overall alignment score: {overall_alignment}")
                return False
            
            # Validate drift detection
            drift_detection = result.get("drift_detection", {})
            if not drift_detection:
                logger.error("❌ No drift detection results generated")
                return False
            
            logger.info("✅ Step 11 result validation passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Step 11 result validation failed: {str(e)}")
            return False
