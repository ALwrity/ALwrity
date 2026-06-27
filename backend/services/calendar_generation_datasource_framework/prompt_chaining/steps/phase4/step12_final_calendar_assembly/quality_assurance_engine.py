import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class QualityAssuranceEngine:
    def __init__(self):
        self.required_step_keys = [
            "step_01", "step_02", "step_03", "step_04", "step_05",
            "step_06", "step_07", "step_08", "step_09", "step_10", "step_11",
        ]
        logger.info("Quality Assurance Engine initialized")

    async def validate_completeness(self, calendar_data: dict) -> dict:
        issues = []
        present_fields = []
        missing_fields = []

        required = ["content_schedule", "daily_schedule", "content_pieces", "calendar_structure"]
        for field in required:
            if field == "content_pieces":
                schedule = calendar_data.get("content_schedule", calendar_data.get("daily_schedule", []))
                has_content = any(
                    isinstance(d, dict) and d.get("content_pieces")
                    for d in (schedule if isinstance(schedule, list) else [])
                )
                if has_content:
                    present_fields.append(field)
                else:
                    missing_fields.append(field)
                    issues.append("No content_pieces found in any schedule entry")
            elif calendar_data.get(field):
                present_fields.append(field)
            elif field == "daily_schedule" and calendar_data.get("content_schedule"):
                present_fields.append(field)
            else:
                missing_fields.append(field)
                issues.append(f"Missing required field: {field}")

        step_data = calendar_data.get("all_steps_data", {})
        missing_steps = [s for s in self.required_step_keys if s not in step_data]
        if missing_steps:
            issues.append(f"Missing data from steps: {', '.join(missing_steps)}")

        completeness_score = len(present_fields) / max(len(required), 1)
        return {
            "passed": completeness_score >= 0.8,
            "score": round(completeness_score, 2),
            "present_fields": present_fields,
            "missing_fields": missing_fields,
            "missing_steps": missing_steps,
            "issues": issues,
        }

    async def verify_consistency(self, calendar_data: dict) -> dict:
        issues = []
        schedule = calendar_data.get("content_schedule", calendar_data.get("daily_schedule", []))
        if not isinstance(schedule, list):
            return {"passed": False, "score": 0.0, "issues": ["Schedule is not a list"]}

        platform_fields = set()
        type_fields = set()
        date_formats = set()
        for day in schedule:
            if not isinstance(day, dict):
                continue
            pieces = day.get("content_pieces", [])
            for p in pieces if isinstance(pieces, list) else []:
                if p.get("platform"):
                    platform_fields.add(p["platform"])
                if p.get("content_type"):
                    type_fields.add(p["content_type"])
            date_val = day.get("date")
            if date_val:
                if "/" in str(date_val):
                    date_formats.add("slash")
                elif "-" in str(date_val):
                    date_formats.add("dash")

        if len(date_formats) > 1:
            issues.append(f"Inconsistent date format across schedule entries: {date_formats}")

        consistency_score = 1.0 - (len(issues) * 0.2)
        consistency_score = max(0.0, min(1.0, consistency_score))

        return {
            "passed": consistency_score >= 0.7,
            "score": round(consistency_score, 2),
            "platforms_used": sorted(platform_fields),
            "content_types_used": sorted(type_fields),
            "date_format_consistency": date_formats,
            "issues": issues,
        }

    async def validate_performance(self, calendar_data: dict) -> dict:
        issues = []
        predictions = calendar_data.get("performance_predictions", {})
        quality_metrics = calendar_data.get("quality_metrics", calendar_data.get("assembly_metadata", {}))

        qa_report = {"has_predictions": bool(predictions), "has_quality_metrics": bool(quality_metrics)}

        if not predictions:
            issues.append("No performance predictions found")
        else:
            expected_keys = ["engagement_rate", "reach", "conversions", "roi"]
            missing = [k for k in expected_keys if k not in predictions]
            if missing:
                issues.append(f"Predictions missing expected metrics: {', '.join(missing)}")

        if not quality_metrics:
            issues.append("No quality metrics found")
        elif quality_metrics.get("overall_quality_score") is None:
            issues.append("Quality metrics missing overall_quality_score")

        score = 1.0 - (len(issues) * 0.3)
        score = max(0.0, min(1.0, score))

        return {
            "passed": score >= 0.6,
            "score": round(score, 2),
            "qa_report": qa_report,
            "issues": issues,
            "recommendations": [
                "Ensure performance_predictions include engagement_rate, reach, conversions, roi",
                "Include overall_quality_score in quality_metrics",
            ],
        }
