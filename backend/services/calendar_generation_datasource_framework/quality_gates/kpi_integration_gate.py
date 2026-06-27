"""KPI Integration Quality Gate - Validates content strategy KPI integration."""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class KPIIntegrationGate:
    def __init__(self):
        self.name = "kpi_integration"
        self.description = "Validates content strategy KPI integration"
        self.pass_threshold = 0.85
        self.validation_criteria = ["KPI alignment", "Measurement framework", "Goal tracking"]

    async def validate(self, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        try:
            validation_result = {
                "gate_name": self.name, "passed": False, "score": 0.0,
                "issues": [], "recommendations": [], "timestamp": datetime.utcnow().isoformat()
            }

            total_score = 0.0
            checks = 0

            # 1. Check performance_predictions exist and are well-structured
            perf_score, perf_issues = self._check_performance_predictions(calendar_data)
            total_score += perf_score
            checks += 1
            validation_result["issues"].extend(perf_issues)

            # 2. Check content items have measurable KPIs (engagement tracking)
            kpi_score, kpi_issues = self._check_content_kpis(self._extract_content_items(calendar_data))
            total_score += kpi_score
            checks += 1
            validation_result["issues"].extend(kpi_issues)

            # 3. Check platform distribution has measurable goals
            platform_score, platform_issues = self._check_platform_distribution(calendar_data)
            total_score += platform_score
            checks += 1
            validation_result["issues"].extend(platform_issues)

            # 4. Check content goals / objectives are present
            goals_score, goals_issues = self._check_content_goals(calendar_data)
            total_score += goals_score
            checks += 1
            validation_result["issues"].extend(goals_issues)

            validation_result["score"] = round(total_score / max(checks, 1), 2)
            validation_result["passed"] = validation_result["score"] >= self.pass_threshold

            if not validation_result["passed"]:
                validation_result["recommendations"].extend([
                    "Include performance_predictions with engagement_rate, reach, and conversion estimates",
                    "Ensure content items specify measurable KPIs (engagement, reach, clicks)",
                    "Define platform-specific goals in platform_strategies",
                    "Add business_goals or content_objectives to the calendar metadata"
                ])

            logger.info(f"KPI integration validation: {'PASSED' if validation_result['passed'] else 'FAILED'} (score: {validation_result['score']:.2f})")
            return validation_result

        except Exception as e:
            logger.error(f"Error in KPI integration validation: {e}")
            return {"gate_name": self.name, "passed": False, "score": 0.0, "error": str(e)}

    def _extract_content_items(self, calendar_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        content_items = []
        daily_schedule = calendar_data.get("daily_schedule", {})
        if isinstance(daily_schedule, dict):
            for day_data in daily_schedule.values():
                if isinstance(day_data, dict):
                    items = day_data.get("content") or day_data.get("content_items") or []
                    if isinstance(items, list):
                        content_items.extend(items)
        elif isinstance(daily_schedule, list):
            for day_data in daily_schedule:
                if isinstance(day_data, dict):
                    items = day_data.get("content") or day_data.get("content_items") or []
                    if isinstance(items, list):
                        content_items.extend(items)
        return content_items

    def _check_performance_predictions(self, calendar_data: Dict[str, Any]) -> tuple:
        predictions = calendar_data.get("performance_predictions")
        if not predictions:
            return 0.0, ["No performance_predictions found in calendar data"]

        if not isinstance(predictions, dict):
            return 0.3, ["performance_predictions has unexpected format (expected dict)"]

        expected_metrics = ["engagement_rate", "reach", "conversions", "roi"]
        present_metrics = [m for m in expected_metrics if predictions.get(m) is not None]
        missing_metrics = [m for m in expected_metrics if m not in present_metrics]

        score = len(present_metrics) / max(len(expected_metrics), 1)
        issues = []
        if missing_metrics:
            issues.append(f"Missing KPI predictions: {', '.join(missing_metrics)}")
        if predictions.get("confidence_score") is None:
            issues.append("No confidence_score on predictions — cannot assess prediction reliability")

        return score, issues

    def _check_content_kpis(self, content_items: List[Dict[str, Any]]) -> tuple:
        if not content_items:
            return 0.0, ["No content items to check for KPI data"]

        items_with_kpis = 0
        total = len(content_items)

        known_kpi_fields = {"engagement", "reach", "clicks", "conversions", "impressions", "ctr", "kpi", "metrics"}

        for item in content_items:
            if isinstance(item, dict):
                has_kpi = any(k.lower() in known_kpi_fields for k in item.keys())
                if not has_kpi:
                    for val in item.values():
                        if isinstance(val, dict):
                            has_kpi = any(k.lower() in known_kpi_fields for k in val.keys())
                            if has_kpi:
                                break
                if has_kpi:
                    items_with_kpis += 1

        kpi_coverage = items_with_kpis / max(total, 1)
        issues = []
        if kpi_coverage < 0.5:
            issues.append(f"Only {items_with_kpis}/{total} content items have KPI/metrics data")

        return kpi_coverage, issues

    def _check_platform_distribution(self, calendar_data: Dict[str, Any]) -> tuple:
        platform_strategies = calendar_data.get("platform_strategies")
        content_mix = calendar_data.get("content_mix")
        optimal_timing = calendar_data.get("optimal_timing")

        score = 0.0
        checks = 0
        issues = []

        if platform_strategies and isinstance(platform_strategies, dict):
            has_kpi_platform = False
            for platform, config in platform_strategies.items():
                if isinstance(config, dict):
                    if any(k.lower() in {"kpi", "goal", "target", "metrics", "objective"} for k in config.keys()):
                        has_kpi_platform = True
                        break
            score += 1.0 if has_kpi_platform else 0.5
            if not has_kpi_platform:
                issues.append("Platform strategies lack measurable KPIs for individual platforms")
        else:
            score += 0.0
            issues.append("Missing platform_strategies for KPI assignment")
        checks += 1

        if content_mix and isinstance(content_mix, dict):
            score += 1.0
        else:
            score += 0.0
            issues.append("Missing content_mix distribution — cannot measure KPI allocation")
        checks += 1

        if optimal_timing and isinstance(optimal_timing, dict):
            score += 1.0
        else:
            score += 0.3
            issues.append("Missing optimal_timing data — KPI timing analysis not possible")
        checks += 1

        return score / max(checks, 1), issues

    def _check_content_goals(self, calendar_data: Dict[str, Any]) -> tuple:
        goals_fields = [
            "content_goals", "business_goals", "content_objectives",
            "strategic_objectives", "goals", "objectives"
        ]

        found_goals = None
        for field in goals_fields:
            val = calendar_data.get(field)
            if val and isinstance(val, (list, dict)) and len(val) > 0:
                found_goals = val
                break

        if not found_goals:
            return 0.0, ["No content goals or objectives defined in calendar data"]

        if isinstance(found_goals, list):
            goal_count = len(found_goals)
        elif isinstance(found_goals, dict):
            goal_count = len(found_goals)
        else:
            goal_count = 1

        goals_score = min(1.0, goal_count / 3)
        return goals_score, []

    def __str__(self) -> str:
        return f"KPIIntegrationGate(threshold={self.pass_threshold})"
