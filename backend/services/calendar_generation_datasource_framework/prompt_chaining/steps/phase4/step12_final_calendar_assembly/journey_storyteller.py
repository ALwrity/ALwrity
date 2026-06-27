import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class JourneyStoryteller:
    def __init__(self):
        self.step_names = {
            "step_01": "Content Strategy Analysis",
            "step_02": "Gap Analysis & Opportunities",
            "step_03": "Audience & Platform Strategy",
            "step_04": "Calendar Framework & Timeline",
            "step_05": "Content Pillar Distribution",
            "step_06": "Platform-Specific Strategy",
            "step_07": "Weekly Theme Development",
            "step_08": "Daily Content Planning",
            "step_09": "Content Recommendations",
            "step_10": "Performance Optimization",
            "step_11": "Strategy Alignment Validation",
        }
        logger.info("Journey Storyteller initialized")

    async def create_journey_narrative(self, all_steps_data: dict) -> dict:
        step_summaries = self._build_step_summaries(all_steps_data)
        decision_log = self._build_decision_rationale(all_steps_data)
        quality_overview = self._summarize_quality_metrics(all_steps_data)
        strategic_insights = self._extract_strategic_insights(all_steps_data)

        narrative = {
            "journey_title": "12-Step Calendar Generation Journey",
            "generated_at": datetime.utcnow().isoformat(),
            "total_steps_completed": len(step_summaries),
            "steps": step_summaries,
            "decision_rationale": decision_log,
            "quality_overview": quality_overview,
            "strategic_insights": strategic_insights,
            "narrative_summary": self._compose_summary(
                step_summaries, quality_overview, strategic_insights
            ),
        }
        return narrative

    def _build_step_summaries(self, all_steps_data: Dict) -> List[Dict]:
        summaries = []
        for step_key, display_name in self.step_names.items():
            data = all_steps_data.get(step_key, {})
            summary = {
                "step": step_key,
                "name": display_name,
                "status": "completed" if data.get("completed") else "unknown",
                "key_findings": data.get("output", {}).get("insights", []),
                "recommendations": data.get("output", {}).get("recommendations", []),
                "quality_score": data.get("output", {}).get("quality_metrics", {}).get("overall_quality_score"),
            }
            if not summary["key_findings"]:
                summary["key_findings"] = [f"No explicit insights recorded for {display_name}"]
            summaries.append(summary)
        return summaries

    def _build_decision_rationale(self, all_steps_data: Dict) -> List[Dict]:
        decisions = []
        for step_key, display_name in self.step_names.items():
            data = all_steps_data.get(step_key, {})
            output = data.get("output", {})
            if output.get("decision_rationale"):
                decisions.append({
                    "step": step_key,
                    "name": display_name,
                    "rationale": output["decision_rationale"],
                })
        return decisions

    def _summarize_quality_metrics(self, all_steps_data: Dict) -> Dict[str, Any]:
        scores = []
        for step_key in self.step_names:
            output = all_steps_data.get(step_key, {}).get("output", {})
            qm = output.get("quality_metrics", {})
            score = qm.get("overall_quality_score")
            if score is not None:
                scores.append(score)
        if not scores:
            return {"average_quality_score": 0.0, "steps_evaluated": 0}
        return {
            "average_quality_score": round(sum(scores) / len(scores), 2),
            "min_score": round(min(scores), 2),
            "max_score": round(max(scores), 2),
            "steps_evaluated": len(scores),
        }

    def _extract_strategic_insights(self, all_steps_data: Dict) -> List[str]:
        insights = set()
        for step_key in self.step_names:
            output = all_steps_data.get(step_key, {}).get("output", {})
            for insight in output.get("insights", []):
                if isinstance(insight, str) and len(insight) > 20:
                    insights.add(insight)
        return sorted(insights)[:10]

    def _compose_summary(
        self, step_summaries: List[Dict], quality: Dict, insights: List[str]
    ) -> str:
        completed = sum(1 for s in step_summaries if s["status"] == "completed")
        avg_score = quality.get("average_quality_score", 0)
        return (
            f"Generated {completed}/{len(step_summaries)} steps with "
            f"average quality score {avg_score:.2f}. "
            f"Key insights identified: {min(len(insights), 10)}. "
            f"Ready for execution."
        )
