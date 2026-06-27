import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CalendarEnhancementEngine:
    def __init__(self):
        self.enhancement_config = {
            "min_gap_hours_between_posts": 3,
            "preferred_posting_hours": {"mon-fri": [8, 18], "sat-sun": [10, 16]},
            "max_sequential_same_type": 2,
            "platform_peak_times": {
                "linkedin": (7, 9),
                "twitter": (12, 14),
                "instagram": (11, 13),
                "facebook": (13, 15),
                "blog": (6, 9),
            },
        }
        logger.info("Calendar Enhancement Engine initialized")

    async def enhance_calendar(self, calendar_data: dict) -> dict:
        enhanced = dict(calendar_data)
        content_schedule = enhanced.get("content_schedule", enhanced.get("daily_schedule", []))
        if not content_schedule:
            enhanced["enhancement_notes"] = "No content schedule to enhance"
            return enhanced

        optimizations = []
        scheduling_issues = self._check_scheduling_gaps(content_schedule)
        if scheduling_issues:
            optimizations.extend(scheduling_issues)

        sequencing_fixes = self._optimize_content_sequencing(content_schedule)
        if sequencing_fixes:
            optimizations.extend(sequencing_fixes)

        platform_adjustments = self._apply_platform_adjustments(content_schedule)
        if platform_adjustments:
            optimizations.extend(platform_adjustments)

        performance_indicators = self._integrate_performance_indicators(content_schedule)

        enhanced["optimizations"] = optimizations
        enhanced["performance_indicators"] = performance_indicators
        enhanced["enhancement_timestamp"] = datetime.utcnow().isoformat()
        enhanced["enhancement_summary"] = {
            "total_optimizations": len(optimizations),
            "schedule_coverage": f"{len([d for d in content_schedule if d.get('content_pieces')])}/{len(content_schedule)} days with content",
            "platform_adjustments_applied": len(platform_adjustments),
        }
        return enhanced

    def _check_scheduling_gaps(self, schedule: List[Dict]) -> List[str]:
        fixes = []
        dates_with_content = [
            d for d in schedule if d.get("content_pieces")
        ]
        for i in range(len(dates_with_content) - 1):
            current_date = dates_with_content[i].get("date")
            next_date = dates_with_content[i + 1].get("date")
            if current_date and next_date:
                try:
                    gap = (
                        datetime.strptime(next_date, "%Y-%m-%d")
                        - datetime.strptime(current_date, "%Y-%m-%d")
                    ).days
                    if gap > 3:
                        fixes.append(
                            f"Gap of {gap} days between {current_date} and {next_date} — consider filler content"
                        )
                except (ValueError, TypeError):
                    pass
        return fixes

    def _optimize_content_sequencing(self, schedule: List[Dict]) -> List[str]:
        fixes = []
        for day in schedule:
            pieces = day.get("content_pieces", [])
            if len(pieces) > self.enhancement_config["max_sequential_same_type"]:
                types = [p.get("content_type", "unknown") for p in pieces]
                consecutive = 1
                for i in range(1, len(types)):
                    if types[i] == types[i - 1]:
                        consecutive += 1
                    else:
                        if consecutive > self.enhancement_config["max_sequential_same_type"]:
                            fixes.append(
                                f"{consecutive} consecutive '{types[i-1]}' posts on {day.get('date')} — interleave with other types"
                            )
                        consecutive = 1
        return fixes

    def _apply_platform_adjustments(self, schedule: List[Dict]) -> List[str]:
        adjustments = []
        for day in schedule:
            pieces = day.get("content_pieces", [])
            for piece in pieces:
                platform = piece.get("platform", "").lower()
                peak = self.enhancement_config["platform_peak_times"].get(platform)
                if peak and piece.get("scheduled_time"):
                    try:
                        hour = int(piece["scheduled_time"].split(":")[0])
                        if not (peak[0] <= hour <= peak[1]):
                            adjustments.append(
                                f"Move {platform} post on {day.get('date')} from {piece['scheduled_time']} to peak window {peak[0]}:00-{peak[1]}:00"
                            )
                    except (ValueError, IndexError):
                        pass
        return adjustments

    def _integrate_performance_indicators(self, schedule: List[Dict]) -> Dict[str, Any]:
        total_pieces = sum(len(d.get("content_pieces", [])) for d in schedule)
        platform_distribution: Dict[str, int] = {}
        type_distribution: Dict[str, int] = {}
        for d in schedule:
            for p in d.get("content_pieces", []):
                platform = p.get("platform", "unknown")
                platform_distribution[platform] = platform_distribution.get(platform, 0) + 1
                ctype = p.get("content_type", "unknown")
                type_distribution[ctype] = type_distribution.get(ctype, 0) + 1
        return {
            "total_content_pieces": total_pieces,
            "platform_distribution": platform_distribution,
            "content_type_distribution": type_distribution,
            "avg_pieces_per_day": round(total_pieces / max(len(schedule), 1), 1),
            "platform_diversity": len(platform_distribution),
            "content_type_diversity": len(type_distribution),
        }
