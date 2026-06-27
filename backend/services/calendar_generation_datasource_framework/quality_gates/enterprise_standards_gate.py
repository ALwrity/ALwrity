"""Enterprise Standards Quality Gate - Validates enterprise-level content standards."""

import logging
import re
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class EnterpriseStandardsGate:
    def __init__(self):
        self.name = "enterprise_standards"
        self.description = "Validates enterprise-level content standards"
        self.pass_threshold = 0.9
        self.validation_criteria = ["Professional quality", "Brand compliance", "Industry standards"]

    async def validate(self, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        try:
            validation_result = {
                "gate_name": self.name, "passed": False, "score": 0.0,
                "issues": [], "recommendations": [], "timestamp": datetime.utcnow().isoformat()
            }

            content_items = self._extract_content_items(calendar_data)

            if not content_items:
                validation_result["issues"].append("No content items to validate against enterprise standards")
                validation_result["score"] = 0.0
                return validation_result

            total_score = 0.0
            checks = 0

            # 1. Check content item completeness (all required fields present)
            completeness_score, completeness_issues = self._check_completeness(content_items)
            total_score += completeness_score
            checks += 1
            validation_result["issues"].extend(completeness_issues)

            # 2. Check for placeholder / low-quality content
            quality_score, quality_issues = self._check_placeholder_content(content_items)
            total_score += quality_score
            checks += 1
            validation_result["issues"].extend(quality_issues)

            # 3. Check platform coverage (major platforms present)
            platform_score, platform_issues = self._check_platform_coverage(content_items)
            total_score += platform_score
            checks += 1
            validation_result["issues"].extend(platform_issues)

            # 4. Check industry alignment (industry mentioned if expected)
            industry_score, industry_issues = self._check_industry_alignment(calendar_data, content_items)
            total_score += industry_score
            checks += 1
            validation_result["issues"].extend(industry_issues)

            validation_result["score"] = round(total_score / max(checks, 1), 2)
            validation_result["passed"] = validation_result["score"] >= self.pass_threshold

            if not validation_result["passed"]:
                validation_result["recommendations"].extend([
                    "Ensure all content items have title, description, type, and platform",
                    "Remove placeholder text and lorem ipsum from generated content",
                    "Cover all major platforms in content distribution",
                    "Tailor content to specified industry vertical"
                ])

            logger.info(f"Enterprise standards validation: {'PASSED' if validation_result['passed'] else 'FAILED'} (score: {validation_result['score']:.2f})")
            return validation_result

        except Exception as e:
            logger.error(f"Error in enterprise standards validation: {e}")
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

    def _check_completeness(self, content_items: List[Dict[str, Any]]) -> tuple:
        required_fields = ["title", "type", "platform"]
        incomplete_count = 0
        total = len(content_items)
        issues = []

        for item in content_items:
            if isinstance(item, dict):
                missing = [f for f in required_fields if not item.get(f)]
                if missing:
                    incomplete_count += 1

        completeness_ratio = 1.0 - (incomplete_count / max(total, 1))
        if incomplete_count > 0:
            issues.append(f"{incomplete_count}/{total} content items missing required fields (title, type, platform)")

        return completeness_ratio, issues

    def _check_placeholder_content(self, content_items: List[Dict[str, Any]]) -> tuple:
        placeholder_patterns = [
            r"lorem ipsum", r"placeholder", r"tbd", r"to be determined",
            r"sample content", r"example text", r"\[.*?\]",
        ]
        compiled = [re.compile(p, re.IGNORECASE) for p in placeholder_patterns]

        placeholder_count = 0
        total = len(content_items)
        issues = []

        for item in content_items:
            if isinstance(item, dict):
                text_fields = [
                    str(item.get("title", "")),
                    str(item.get("description", "")),
                    str(item.get("topic", "")),
                ]
                for text in text_fields:
                    for pattern in compiled:
                        if pattern.search(text):
                            placeholder_count += 1
                            break
                    else:
                        continue
                    break

        quality_ratio = 1.0 - (placeholder_count / max(total, 1))
        if placeholder_count > 0:
            issues.append(f"{placeholder_count}/{total} items contain placeholder/low-quality text")

        return quality_ratio, issues

    def _check_platform_coverage(self, content_items: List[Dict[str, Any]]) -> tuple:
        major_platforms = {"linkedin", "instagram", "twitter", "facebook", "website", "blog", "youtube"}
        covered = set()

        for item in content_items:
            if isinstance(item, dict):
                platform = str(item.get("platform", "")).lower().strip()
                if platform:
                    covered.add(platform)

        missing = major_platforms - covered
        coverage_ratio = len(covered) / max(len(major_platforms), 1)

        issues = []
        if missing:
            issues.append(f"Content does not cover platforms: {', '.join(sorted(missing)[:3])}")

        return min(1.0, coverage_ratio + 0.3), issues

    def _check_industry_alignment(self, calendar_data: Dict[str, Any], content_items: List[Dict[str, Any]]) -> tuple:
        industry = (calendar_data.get("industry") or "").lower().strip()
        if not industry:
            return 0.5, ["No industry specified — cannot verify alignment"]

        industry_words = set(industry.lower().split())
        aligned_count = 0
        total = len(content_items)

        for item in content_items:
            if isinstance(item, dict):
                text = f"{item.get('title', '')} {item.get('description', '')} {item.get('topic', '')}".lower()
                if any(word in text for word in industry_words):
                    aligned_count += 1

        alignment_ratio = aligned_count / max(total, 1)
        if alignment_ratio < 0.3:
            return alignment_ratio, [f"Only {aligned_count}/{total} items reference the specified industry '{industry}'"]

        return min(1.0, alignment_ratio + 0.2), []

    def __str__(self) -> str:
        return f"EnterpriseStandardsGate(threshold={self.pass_threshold})"
