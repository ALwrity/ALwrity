"""Calendar Structure Quality Gate - Validates calendar structure and duration control."""

import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CalendarStructureGate:
    def __init__(self):
        self.name = "calendar_structure"
        self.description = "Validates calendar structure and duration control"
        self.pass_threshold = 0.8
        self.validation_criteria = ["Structure completeness", "Duration appropriateness"]

    async def validate(self, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        try:
            validation_result = {
                "gate_name": self.name, "passed": False, "score": 0.0,
                "issues": [], "recommendations": [], "timestamp": datetime.utcnow().isoformat()
            }

            total_score = 0.0
            checks = 0

            # 1. Validate daily_schedule exists and has content
            schedule_score, schedule_issues = self._check_schedule(calendar_data)
            total_score += schedule_score
            checks += 1
            validation_result["issues"].extend(schedule_issues)

            # 2. Validate weekly themes
            themes_score, themes_issues = self._check_weekly_themes(calendar_data)
            total_score += themes_score
            checks += 1
            validation_result["issues"].extend(themes_issues)

            # 3. Validate duration/timespan
            duration_score, duration_issues = self._check_duration(calendar_data)
            total_score += duration_score
            checks += 1
            validation_result["issues"].extend(duration_issues)

            # 4. Validate content mix/strategy tables
            mix_score, mix_issues = self._check_content_mix(calendar_data)
            total_score += mix_score
            checks += 1
            validation_result["issues"].extend(mix_issues)

            validation_result["score"] = round(total_score / max(checks, 1), 2)
            validation_result["passed"] = validation_result["score"] >= self.pass_threshold

            if not validation_result["passed"]:
                validation_result["recommendations"].extend([
                    "Ensure daily schedule covers the full calendar period",
                    "Add weekly themes for each week in the schedule",
                    "Verify content_mix specifies platform distribution ratios",
                    "Include platform_strategies for all target platforms"
                ])

            logger.info(f"Calendar structure validation: {'PASSED' if validation_result['passed'] else 'FAILED'} (score: {validation_result['score']:.2f})")
            return validation_result

        except Exception as e:
            logger.error(f"Error in calendar structure validation: {e}")
            return {"gate_name": self.name, "passed": False, "score": 0.0, "error": str(e)}

    def _check_schedule(self, calendar_data: Dict[str, Any]) -> tuple:
        daily_schedule = calendar_data.get("daily_schedule", {})
        if not daily_schedule:
            return 0.0, ["No daily schedule found"]

        if isinstance(daily_schedule, dict):
            entries = list(daily_schedule.values())
        elif isinstance(daily_schedule, list):
            entries = daily_schedule
        else:
            return 0.3, ["Daily schedule has unexpected format"]

        if not entries:
            return 0.0, ["Daily schedule is empty"]

        items_with_content = 0
        total_items = 0
        missing_fields = 0

        for entry in entries:
            if isinstance(entry, dict):
                total_items += 1
                content = entry.get("content") or entry.get("content_items") or []
                if isinstance(content, list) and len(content) > 0:
                    items_with_content += 1
                if not entry.get("date"):
                    missing_fields += 1

        content_coverage = items_with_content / max(total_items, 1)
        field_penalty = (missing_fields / max(total_items, 1)) * 0.3
        score = min(1.0, max(0.0, content_coverage - field_penalty))

        issues = []
        if content_coverage < 0.5:
            issues.append(f"Only {items_with_content}/{total_items} schedule entries have content")
        if missing_fields > 0:
            issues.append(f"{missing_fields} schedule entries missing date field")

        return score, issues

    def _check_weekly_themes(self, calendar_data: Dict[str, Any]) -> tuple:
        weekly_themes = calendar_data.get("weekly_themes", {})
        if not weekly_themes:
            return 0.0, ["No weekly themes defined"]

        if isinstance(weekly_themes, dict):
            week_count = len(weekly_themes)
        elif isinstance(weekly_themes, list):
            week_count = len(weekly_themes)
        else:
            return 0.3, ["Weekly themes has unexpected format"]

        if week_count < 2:
            return 0.3, [f"Only {week_count} week(s) of themes — calendar should span 4+ weeks"]
        if week_count < 4:
            return 0.6, [f"Only {week_count} weeks of themes, consider extending to 4 weeks"]

        return min(1.0, week_count / 8), []

    def _check_duration(self, calendar_data: Dict[str, Any]) -> tuple:
        daily_schedule = calendar_data.get("daily_schedule", {})
        if not daily_schedule:
            return 0.0, ["Cannot check duration: no daily schedule"]

        entries = []
        if isinstance(daily_schedule, dict):
            entries = list(daily_schedule.values())
        elif isinstance(daily_schedule, list):
            entries = daily_schedule

        dates = []
        for entry in entries:
            if isinstance(entry, dict):
                date_val = entry.get("scheduled_date") or entry.get("date")
                if date_val:
                    try:
                        dates.append(datetime.fromisoformat(str(date_val).replace("Z", "+00:00")))
                    except (ValueError, TypeError):
                        pass

        if len(dates) < 2:
            return 0.5, ["Cannot verify calendar duration: fewer than 2 dated entries"]

        span = max(dates) - min(dates)
        if span < timedelta(days=25):
            return 0.5, [f"Calendar spans only {span.days} days — expected 28+ days for monthly"]
        if span > timedelta(days=35):
            return 0.8, [f"Calendar spans {span.days} days — slightly longer than standard month"]

        return 1.0, []

    def _check_content_mix(self, calendar_data: Dict[str, Any]) -> tuple:
        content_mix = calendar_data.get("content_mix")
        platform_strategies = calendar_data.get("platform_strategies")
        content_pillars = calendar_data.get("content_pillars")

        present = 0
        total = 3

        if content_mix and isinstance(content_mix, dict):
            present += 1
        if platform_strategies and isinstance(platform_strategies, dict):
            present += 1
        if content_pillars and isinstance(content_pillars, (dict, list)) and len(content_pillars) > 0:
            present += 1

        score = present / max(total, 1)

        issues = []
        if not content_mix:
            issues.append("Missing content_mix distribution table")
        if not platform_strategies:
            issues.append("Missing platform_strategies configuration")
        if not content_pillars or len(content_pillars) == 0:
            issues.append("Missing or empty content_pillars")

        return score, issues

    def __str__(self) -> str:
        return f"CalendarStructureGate(threshold={self.pass_threshold})"
