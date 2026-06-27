"""Chain Context Quality Gate - Validates chain step context understanding."""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class ChainContextGate:
    def __init__(self):
        self.name = "chain_context"
        self.description = "Validates chain step context understanding"
        self.pass_threshold = 0.85
        self.validation_criteria = ["Step context preservation", "Data flow continuity"]

    async def validate(self, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        try:
            validation_result = {
                "gate_name": self.name, "passed": False, "score": 0.0,
                "issues": [], "recommendations": [], "timestamp": datetime.utcnow().isoformat()
            }

            # 1. Validate step context is provided
            if not step_name:
                validation_result["issues"].append("No step context provided")
                validation_result["recommendations"].append("Pass step_name to validate() for context-aware checking")
            else:
                validation_result["step_context"] = step_name

            # 2. Check data flow continuity - data should flow from earlier steps
            step_artifacts = self._get_expected_artifacts(step_name)
            missing_artifacts = []

            for field in step_artifacts:
                if field not in calendar_data or calendar_data.get(field) is None:
                    missing_artifacts.append(field)
                elif isinstance(calendar_data.get(field), dict) and not calendar_data[field]:
                    missing_artifacts.append(f"{field} (empty)")
                elif isinstance(calendar_data.get(field), list) and not calendar_data[field]:
                    missing_artifacts.append(f"{field} (empty)")

            if missing_artifacts:
                validation_result["issues"].extend([
                    f"Missing or empty data from previous steps: {', '.join(missing_artifacts)}"
                ])

            # 3. Check data flow continuity - extract content items
            content_items = self._extract_content_items(calendar_data)

            if not content_items:
                validation_result["issues"].append("No content items in calendar data - data flow interrupted")
                validation_result["recommendations"].append("Ensure content generation steps produce output before validation")
            else:
                # Verify items have required fields indicating proper data flow
                missing_fields_count = 0
                for item in content_items:
                    if isinstance(item, dict):
                        for req_field in ["title", "type", "platform"]:
                            if not item.get(req_field):
                                missing_fields_count += 1

                if missing_fields_count > len(content_items):
                    validation_result["issues"].append(
                        f"Content items missing required fields ({missing_fields_count} total gaps)"
                    )

            # 4. Check calendar_type or session_type continuity
            calendar_type = calendar_data.get("calendar_type") or calendar_data.get("session_type")
            if not calendar_type:
                validation_result["issues"].append("Calendar type context not preserved in data")
                validation_result["recommendations"].append("Ensure calendar_type persists through the generation chain")

            # Calculate score
            base_score = 1.0
            penalty_per_issue = 0.15
            score = max(0.0, base_score - len(validation_result["issues"]) * penalty_per_issue)

            # Bonus for having step context and all required artifacts
            if step_name and not missing_artifacts:
                score = min(1.0, score + 0.1)

            validation_result["score"] = round(score, 2)
            validation_result["passed"] = score >= self.pass_threshold

            if not validation_result["passed"]:
                validation_result["recommendations"].extend([
                    "Verify all pipeline steps executed in correct order",
                    "Check for skipped or failed steps in generation chain",
                    "Ensure data passes correctly between consecutive steps"
                ])

            logger.info(f"Chain context validation: {'PASSED' if validation_result['passed'] else 'FAILED'} (score: {score:.2f})")
            return validation_result

        except Exception as e:
            logger.error(f"Error in chain context validation: {e}")
            return {"gate_name": self.name, "passed": False, "score": 0.0, "error": str(e)}

    def _get_expected_artifacts(self, step_name: str = None) -> List[str]:
        artifacts = ["content_pillars", "daily_schedule"]
        if step_name:
            step_num = None
            if step_name.startswith("step_"):
                try:
                    step_num = int(step_name.split("_")[1])
                except (IndexError, ValueError):
                    pass
            if step_num is not None and step_num >= 5:
                artifacts.extend(["weekly_themes", "content_recommendations"])
            if step_num is not None and step_num >= 8:
                artifacts.extend(["optimal_timing", "platform_strategies"])
            if step_num is not None and step_num >= 10:
                artifacts.extend(["performance_predictions", "repurposing_opportunities"])
        return artifacts

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
        recommendations = calendar_data.get("content_recommendations", [])
        if isinstance(recommendations, list):
            content_items.extend(recommendations)
        return content_items

    def __str__(self) -> str:
        return f"ChainContextGate(threshold={self.pass_threshold})"
