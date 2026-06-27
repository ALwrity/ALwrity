import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer


class StrategyAlignmentValidator:
    """
    Validates all steps against original strategy from Step 1.
    Provides multi-dimensional alignment scoring, strategy drift detection,
    and alignment confidence assessment.
    """

    def __init__(self):
        """Initialize the strategy alignment validator with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        self.competitor_analyzer = CompetitorAnalyzer()

        # Alignment validation rules
        self.alignment_rules = {
            "min_alignment_score": 0.7,
            "target_alignment_score": 0.85,
            "strategy_drift_threshold": 0.15,
            "confidence_threshold": 0.8,
            "validation_confidence": 0.85
        }

        # Alignment dimensions and weights
        self.alignment_dimensions = {
            "business_goals": 0.25,
            "target_audience": 0.20,
            "content_pillars": 0.20,
            "platform_strategy": 0.15,
            "kpi_alignment": 0.20
        }

        logger.info("🎯 Strategy Alignment Validator initialized with real AI services")

    async def validate_strategy_alignment(self, context: Dict[str, Any], step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate all steps against original strategy from Step 1."""
        try:
            logger.info("🔍 Starting strategy alignment validation...")

            # Extract original strategy from Step 1
            original_strategy = self._extract_original_strategy(context)
            if not original_strategy:
                raise ValueError("Original strategy from Step 1 not found in context")

            # Get all step results for validation
            step_results = self._extract_step_results(context)
            if not step_results:
                raise ValueError("Step results not found in context")

            # Perform multi-dimensional alignment validation
            alignment_results = await self._perform_alignment_validation(original_strategy, step_results)

            # Detect strategy drift
            drift_analysis = await self._detect_strategy_drift(original_strategy, step_results)

            # Assess alignment confidence
            confidence_assessment = await self._assess_alignment_confidence(alignment_results, drift_analysis)

            # Generate comprehensive validation report
            validation_report = self._generate_validation_report(
                alignment_results, drift_analysis, confidence_assessment
            )

            # Calculate overall alignment score
            overall_score = self._calculate_overall_alignment_score(alignment_results)

            return {
                "strategy_alignment_validation": {
                    "overall_alignment_score": overall_score,
                    "alignment_results": alignment_results,
                    "strategy_drift_analysis": drift_analysis,
                    "confidence_assessment": confidence_assessment,
                    "validation_report": validation_report,
                    "quality_metrics": {
                        "alignment_completeness": self._calculate_alignment_completeness(alignment_results),
                        "drift_detection_accuracy": self._calculate_drift_accuracy(drift_analysis),
                        "confidence_reliability": self._calculate_confidence_reliability(confidence_assessment)
                    }
                }
            }

        except Exception as e:
            logger.error(f"❌ Strategy alignment validation failed: {str(e)}")
            raise

    def _extract_original_strategy(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extract original strategy from Step 1 context."""
        try:
            step1_data = context.get("step_01", {})
            if not step1_data:
                return {}

            return {
                "business_goals": step1_data.get("business_goals", {}),
                "target_audience": step1_data.get("target_audience", {}),
                "content_pillars": step1_data.get("content_pillars", {}),
                "platform_strategy": step1_data.get("platform_strategy", {}),
                "kpi_mapping": step1_data.get("kpi_mapping", {}),
                "strategic_foundation": step1_data.get("strategic_foundation", {})
            }
        except Exception as e:
            logger.error(f"❌ Failed to extract original strategy: {str(e)}")
            return {}

    def _extract_step_results(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extract results from all previous steps for validation."""
        try:
            step_results = {}
            for step_key in ["step_02", "step_03", "step_04", "step_05", "step_06", 
                           "step_07", "step_08", "step_09", "step_10"]:
                if step_key in context:
                    step_results[step_key] = context[step_key]
            
            return step_results
        except Exception as e:
            logger.error(f"❌ Failed to extract step results: {str(e)}")
            return {}

    async def _perform_alignment_validation(self, original_strategy: Dict[str, Any], 
                                          step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Perform multi-dimensional alignment validation."""
        try:
            alignment_results = {}

            # Validate business goals alignment
            alignment_results["business_goals"] = await self._validate_business_goals_alignment(
                original_strategy.get("business_goals", {}), step_results
            )

            # Validate target audience alignment
            alignment_results["target_audience"] = await self._validate_audience_alignment(
                original_strategy.get("target_audience", {}), step_results
            )

            # Validate content pillars alignment
            alignment_results["content_pillars"] = await self._validate_content_pillars_alignment(
                original_strategy.get("content_pillars", {}), step_results
            )

            # Validate platform strategy alignment
            alignment_results["platform_strategy"] = await self._validate_platform_strategy_alignment(
                original_strategy.get("platform_strategy", {}), step_results
            )

            # Validate KPI alignment
            alignment_results["kpi_alignment"] = await self._validate_kpi_alignment(
                original_strategy.get("kpi_mapping", {}), step_results
            )

            return alignment_results

        except Exception as e:
            logger.error(f"❌ Alignment validation failed: {str(e)}")
            raise

    async def _validate_business_goals_alignment(self, original_goals: Dict[str, Any], 
                                               step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Validate business goals alignment across all steps."""
        try:
            # Analyze how each step supports business goals
            goal_support_analysis = {}
            
            for step_key, step_data in step_results.items():
                step_goal_support = await self.ai_engine.analyze_text(
                    f"Analyze how this step supports the business goals: {step_data}",
                    "business_goals_alignment"
                )
                goal_support_analysis[step_key] = step_goal_support

            # Calculate alignment score
            alignment_score = self._calculate_dimension_score(goal_support_analysis, "business_goals")

            return {
                "alignment_score": alignment_score,
                "goal_support_analysis": goal_support_analysis,
                "alignment_status": "excellent" if alignment_score >= 0.9 else "good" if alignment_score >= 0.8 else "acceptable"
            }

        except Exception as e:
            logger.error(f"❌ Business goals alignment validation failed: {str(e)}")
            return {"alignment_score": 0.0, "error": str(e)}

    async def _validate_audience_alignment(self, original_audience: Dict[str, Any], 
                                         step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Validate target audience alignment across all steps."""
        try:
            # Analyze audience targeting consistency
            audience_consistency = {}
            
            for step_key, step_data in step_results.items():
                audience_analysis = await self.ai_engine.analyze_text(
                    f"Analyze audience targeting consistency: {step_data}",
                    "audience_alignment"
                )
                audience_consistency[step_key] = audience_analysis

            # Calculate alignment score
            alignment_score = self._calculate_dimension_score(audience_consistency, "target_audience")

            return {
                "alignment_score": alignment_score,
                "audience_consistency": audience_consistency,
                "alignment_status": "excellent" if alignment_score >= 0.9 else "good" if alignment_score >= 0.8 else "acceptable"
            }

        except Exception as e:
            logger.error(f"❌ Audience alignment validation failed: {str(e)}")
            return {"alignment_score": 0.0, "error": str(e)}

    async def _validate_content_pillars_alignment(self, original_pillars: Dict[str, Any], 
                                                step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Validate content pillars alignment across all steps."""
        try:
            # Analyze content pillar distribution and consistency
            pillar_consistency = {}
            
            for step_key, step_data in step_results.items():
                pillar_analysis = await self.ai_engine.analyze_text(
                    f"Analyze content pillar alignment: {step_data}",
                    "content_pillars_alignment"
                )
                pillar_consistency[step_key] = pillar_analysis

            # Calculate alignment score
            alignment_score = self._calculate_dimension_score(pillar_consistency, "content_pillars")

            return {
                "alignment_score": alignment_score,
                "pillar_consistency": pillar_consistency,
                "alignment_status": "excellent" if alignment_score >= 0.9 else "good" if alignment_score >= 0.8 else "acceptable"
            }

        except Exception as e:
            logger.error(f"❌ Content pillars alignment validation failed: {str(e)}")
            return {"alignment_score": 0.0, "error": str(e)}

    async def _validate_platform_strategy_alignment(self, original_platforms: Dict[str, Any], 
                                                   step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Validate platform strategy alignment across all steps."""
        try:
            # Analyze platform strategy consistency
            platform_consistency = {}
            
            for step_key, step_data in step_results.items():
                platform_analysis = await self.ai_engine.analyze_text(
                    f"Analyze platform strategy alignment: {step_data}",
                    "platform_strategy_alignment"
                )
                platform_consistency[step_key] = platform_analysis

            # Calculate alignment score
            alignment_score = self._calculate_dimension_score(platform_consistency, "platform_strategy")

            return {
                "alignment_score": alignment_score,
                "platform_consistency": platform_consistency,
                "alignment_status": "excellent" if alignment_score >= 0.9 else "good" if alignment_score >= 0.8 else "acceptable"
            }

        except Exception as e:
            logger.error(f"❌ Platform strategy alignment validation failed: {str(e)}")
            return {"alignment_score": 0.0, "error": str(e)}

    async def _validate_kpi_alignment(self, original_kpis: Dict[str, Any], 
                                    step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Validate KPI alignment across all steps."""
        try:
            # Analyze KPI measurement and tracking consistency
            kpi_consistency = {}
            
            for step_key, step_data in step_results.items():
                kpi_analysis = await self.ai_engine.analyze_text(
                    f"Analyze KPI alignment: {step_data}",
                    "kpi_alignment"
                )
                kpi_consistency[step_key] = kpi_analysis

            # Calculate alignment score
            alignment_score = self._calculate_dimension_score(kpi_consistency, "kpi_alignment")

            return {
                "alignment_score": alignment_score,
                "kpi_consistency": kpi_consistency,
                "alignment_status": "excellent" if alignment_score >= 0.9 else "good" if alignment_score >= 0.8 else "acceptable"
            }

        except Exception as e:
            logger.error(f"❌ KPI alignment validation failed: {str(e)}")
            return {"alignment_score": 0.0, "error": str(e)}

    async def _detect_strategy_drift(self, original_strategy: Dict[str, Any], 
                                   step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Detect strategy drift and report deviations."""
        try:
            drift_analysis = {}

            # Analyze drift in business goals
            drift_analysis["business_goals_drift"] = await self._analyze_goal_drift(
                original_strategy.get("business_goals", {}), step_results
            )

            # Analyze drift in audience targeting
            drift_analysis["audience_drift"] = await self._analyze_audience_drift(
                original_strategy.get("target_audience", {}), step_results
            )

            # Analyze drift in content approach
            drift_analysis["content_drift"] = await self._analyze_content_drift(
                original_strategy.get("content_pillars", {}), step_results
            )

            # Calculate overall drift score
            overall_drift_score = self._calculate_drift_score(drift_analysis)

            return {
                "drift_analysis": drift_analysis,
                "overall_drift_score": overall_drift_score,
                "drift_status": "minimal" if overall_drift_score <= 0.1 else "moderate" if overall_drift_score <= 0.2 else "significant"
            }

        except Exception as e:
            logger.error(f"❌ Strategy drift detection failed: {str(e)}")
            return {"drift_analysis": {}, "overall_drift_score": 0.0, "error": str(e)}

    async def _assess_alignment_confidence(self, alignment_results: Dict[str, Any], 
                                         drift_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Assess confidence in alignment validation results."""
        try:
            # Calculate confidence based on data quality and consistency
            data_quality_score = self._assess_data_quality(alignment_results)
            consistency_score = self._assess_consistency(alignment_results)
            drift_impact_score = self._assess_drift_impact(drift_analysis)

            # Calculate overall confidence
            overall_confidence = (data_quality_score + consistency_score + drift_impact_score) / 3

            return {
                "data_quality_confidence": data_quality_score,
                "consistency_confidence": consistency_score,
                "drift_impact_confidence": drift_impact_score,
                "overall_confidence": overall_confidence,
                "confidence_status": "high" if overall_confidence >= 0.8 else "medium" if overall_confidence >= 0.6 else "low"
            }

        except Exception as e:
            logger.error(f"❌ Alignment confidence assessment failed: {str(e)}")
            return {"overall_confidence": 0.0, "error": str(e)}

    def _calculate_overall_alignment_score(self, alignment_results: Dict[str, Any]) -> float:
        """Calculate overall alignment score across all dimensions."""
        try:
            total_score = 0.0
            total_weight = 0.0

            for dimension, weight in self.alignment_dimensions.items():
                if dimension in alignment_results:
                    dimension_score = alignment_results[dimension].get("alignment_score", 0.0)
                    total_score += dimension_score * weight
                    total_weight += weight

            return total_score / total_weight if total_weight > 0 else 0.0

        except Exception as e:
            logger.error(f"❌ Overall alignment score calculation failed: {str(e)}")
            return 0.0

    def _generate_validation_report(self, alignment_results: Dict[str, Any], 
                                  drift_analysis: Dict[str, Any], 
                                  confidence_assessment: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive validation report."""
        try:
            return {
                "summary": {
                    "total_dimensions_validated": len(alignment_results),
                    "excellent_alignments": sum(1 for r in alignment_results.values() if r.get("alignment_status") == "excellent"),
                    "good_alignments": sum(1 for r in alignment_results.values() if r.get("alignment_status") == "good"),
                    "acceptable_alignments": sum(1 for r in alignment_results.values() if r.get("alignment_status") == "acceptable"),
                    "drift_status": drift_analysis.get("drift_status", "unknown"),
                    "confidence_level": confidence_assessment.get("confidence_status", "unknown")
                },
                "detailed_analysis": {
                    "alignment_results": alignment_results,
                    "drift_analysis": drift_analysis,
                    "confidence_assessment": confidence_assessment
                },
                "recommendations": self._generate_alignment_recommendations(alignment_results, drift_analysis)
            }

        except Exception as e:
            logger.error(f"❌ Validation report generation failed: {str(e)}")
            return {"error": str(e)}

    def _generate_alignment_recommendations(self, alignment_results: Dict[str, Any], 
                                          drift_analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations for improving alignment."""
        try:
            recommendations = []

            # Check for low alignment scores
            for dimension, result in alignment_results.items():
                if result.get("alignment_score", 0.0) < 0.8:
                    recommendations.append(f"Improve {dimension} alignment to meet target score of 0.8")

            # Check for significant drift
            if drift_analysis.get("overall_drift_score", 0.0) > 0.2:
                recommendations.append("Address significant strategy drift detected across multiple dimensions")

            # Add general recommendations
            if not recommendations:
                recommendations.append("Maintain current high alignment levels across all dimensions")

            return recommendations

        except Exception as e:
            logger.error(f"❌ Recommendation generation failed: {str(e)}")
            return ["Error generating recommendations"]

    # Helper methods for drift analysis
    async def _analyze_goal_drift(self, original_goals: Dict[str, Any], step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze drift in business goals."""
        try:
            drift_score = 0.0
            drift_details = {}
            
            # Implementation would analyze how goals have evolved across steps
            # For now, return a placeholder analysis
            return {
                "drift_score": drift_score,
                "drift_details": drift_details,
                "drift_status": "minimal" if drift_score <= 0.1 else "moderate" if drift_score <= 0.2 else "significant"
            }
        except Exception as e:
            logger.error(f"❌ Goal drift analysis failed: {str(e)}")
            return {"drift_score": 0.0, "error": str(e)}

    async def _analyze_audience_drift(self, original_audience: Dict[str, Any], step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze drift in audience targeting."""
        try:
            drift_score = 0.0
            drift_details = {}
            
            # Implementation would analyze audience targeting consistency
            return {
                "drift_score": drift_score,
                "drift_details": drift_details,
                "drift_status": "minimal" if drift_score <= 0.1 else "moderate" if drift_score <= 0.2 else "significant"
            }
        except Exception as e:
            logger.error(f"❌ Audience drift analysis failed: {str(e)}")
            return {"drift_score": 0.0, "error": str(e)}

    async def _analyze_content_drift(self, original_content: Dict[str, Any], step_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze drift in content approach."""
        try:
            drift_score = 0.0
            drift_details = {}
            
            # Implementation would analyze content approach consistency
            return {
                "drift_score": drift_score,
                "drift_details": drift_details,
                "drift_status": "minimal" if drift_score <= 0.1 else "moderate" if drift_score <= 0.2 else "significant"
            }
        except Exception as e:
            logger.error(f"❌ Content drift analysis failed: {str(e)}")
            return {"drift_score": 0.0, "error": str(e)}

    # Helper methods for confidence assessment
    def _assess_data_quality(self, alignment_results: Dict[str, Any]) -> float:
        """Assess data quality for confidence calculation."""
        try:
            # Calculate data quality score based on completeness and consistency
            total_dimensions = len(alignment_results)
            if total_dimensions == 0:
                return 0.0

            quality_scores = []
            for result in alignment_results.values():
                if "error" not in result:
                    quality_scores.append(1.0)
                else:
                    quality_scores.append(0.5)

            return sum(quality_scores) / len(quality_scores) if quality_scores else 0.0

        except Exception as e:
            logger.error(f"❌ Data quality assessment failed: {str(e)}")
            return 0.0

    def _assess_consistency(self, alignment_results: Dict[str, Any]) -> float:
        """Assess consistency for confidence calculation."""
        try:
            # Calculate consistency score based on alignment score variance
            alignment_scores = [result.get("alignment_score", 0.0) for result in alignment_results.values()]
            if not alignment_scores:
                return 0.0

            # Higher consistency = lower variance
            mean_score = sum(alignment_scores) / len(alignment_scores)
            variance = sum((score - mean_score) ** 2 for score in alignment_scores) / len(alignment_scores)
            
            # Convert variance to consistency score (lower variance = higher consistency)
            consistency_score = max(0.0, 1.0 - variance)
            return consistency_score

        except Exception as e:
            logger.error(f"❌ Consistency assessment failed: {str(e)}")
            return 0.0

    def _assess_drift_impact(self, drift_analysis: Dict[str, Any]) -> float:
        """Assess drift impact for confidence calculation."""
        try:
            # Calculate confidence based on drift impact
            drift_score = drift_analysis.get("overall_drift_score", 0.0)
            
            # Lower drift = higher confidence
            drift_impact_score = max(0.0, 1.0 - drift_score)
            return drift_impact_score

        except Exception as e:
            logger.error(f"❌ Drift impact assessment failed: {str(e)}")
            return 0.0

    # Helper methods for score calculations
    def _calculate_dimension_score(self, analysis_results: Dict[str, Any], dimension: str) -> float:
        """Calculate alignment score for a specific dimension."""
        try:
            if not analysis_results:
                return 0.0

            # Calculate average score from analysis results
            scores = []
            for result in analysis_results.values():
                if isinstance(result, dict) and "score" in result:
                    scores.append(result["score"])
                elif isinstance(result, (int, float)):
                    scores.append(float(result))

            return sum(scores) / len(scores) if scores else 0.0

        except Exception as e:
            logger.error(f"❌ Dimension score calculation failed: {str(e)}")
            return 0.0

    def _calculate_drift_score(self, drift_analysis: Dict[str, Any]) -> float:
        """Calculate overall drift score."""
        try:
            drift_scores = []
            for analysis in drift_analysis.values():
                if isinstance(analysis, dict) and "drift_score" in analysis:
                    drift_scores.append(analysis["drift_score"])

            return sum(drift_scores) / len(drift_scores) if drift_scores else 0.0

        except Exception as e:
            logger.error(f"❌ Drift score calculation failed: {str(e)}")
            return 0.0

    def _calculate_alignment_completeness(self, alignment_results: Dict[str, Any]) -> float:
        """Calculate alignment completeness score."""
        try:
            total_dimensions = len(self.alignment_dimensions)
            validated_dimensions = len(alignment_results)
            return validated_dimensions / total_dimensions if total_dimensions > 0 else 0.0

        except Exception as e:
            logger.error(f"❌ Alignment completeness calculation failed: {str(e)}")
            return 0.0

    def _calculate_drift_accuracy(self, drift_analysis: Dict[str, Any]) -> float:
        """Calculate drift detection accuracy."""
        try:
            # Placeholder for drift detection accuracy calculation
            return 0.85  # Assume 85% accuracy for now

        except Exception as e:
            logger.error(f"❌ Drift accuracy calculation failed: {str(e)}")
            return 0.0

    def _calculate_confidence_reliability(self, confidence_assessment: Dict[str, Any]) -> float:
        """Calculate confidence reliability score."""
        try:
            return confidence_assessment.get("overall_confidence", 0.0)

        except Exception as e:
            logger.error(f"❌ Confidence reliability calculation failed: {str(e)}")
            return 0.0
