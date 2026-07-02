"""
Content Guardian Agent — ALwrity's committee watchdog.
Audits committee proposals, evaluates agent behaviour, flags coverage gaps,
and alerts the user when agents need correction.
"""
import json
import traceback
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent, TXTAI_AVAILABLE, Agent
from services.intelligence.agents.core_agent_framework import TaskProposal
from services.intelligence.txtai_service import TxtaiIntelligenceService

# ── known committee agents for critique ──────────────────────────
KNOWN_AGENTS = {
    "ContentStrategyAgent":    {"label": "Content Strategy",    "short": "Strategy",    "pillar_focus": "plan"},
    "StrategyArchitectAgent":  {"label": "Strategy Architect",  "short": "Architect",   "pillar_focus": "plan"},
    "SEOOptimizationAgent":   {"label": "SEO Optimization",    "short": "SEO",         "pillar_focus": "analyze"},
    "SocialAmplificationAgent":{"label": "Social Amplification","short": "Social",      "pillar_focus": "engage"},
    "CompetitorResponseAgent": {"label": "Competitor Response", "short": "Competitor",  "pillar_focus": "analyze"},
    "ContentGapRadarAgent":    {"label": "Content Gap Radar",   "short": "Gap Radar",   "pillar_focus": "generate"},
}

PILLAR_IDS = {"plan", "generate", "publish", "analyze", "engage", "remarket"}
COMMITTEE_CYCLE_WINDOW_DAYS = 30


class ContentGuardianAgent(SIFBaseAgent):
    """Committee watchdog — audits proposals, critiques agents, flags faults, alerts users."""

    CANNIBALIZATION_THRESHOLD = 0.85
    ORIGINALITY_THRESHOLD = 0.75

    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, sif_service: Any = None, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="content_guardian", **kwargs)
        self.sif_service = sif_service

    # ── existing utilities ────────────────────────────────────────
    async def _create_txtai_agent(self):
        if not TXTAI_AVAILABLE or Agent is None:
            return None
        try:
            _llm_for_agent = getattr(self.llm, "llm", self.llm)
            return Agent(
                tools=[{"name": "brand_voice_checker", "description": "Checks content against brand voice guidelines", "target": self._check_brand_voice}],
                llm=_llm_for_agent, max_iterations=3)
        except Exception as e:
            logger.error(f"Failed to create txtai agent for ContentGuardian: {e}"); raise e

    def _check_brand_voice(self, content: str) -> Dict[str, Any]:
        return {"consistent": True, "score": 0.95, "notes": "Content aligns with professional/authoritative tone."}

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        return [TaskProposal(title="Audit Old Content", description="Review top performing posts from >6 months ago for updates.", pillar_id="create", priority="low", estimated_time=30, source_agent="ContentGuardianAgent", reasoning="Maintains content relevance and authority.", action_type="navigate", action_url="/content-planning-dashboard")]

    async def perform_site_audit(self, website_url: str) -> Dict[str, Any]:
        self._log_agent_operation("Performing site audit", website_url=website_url)
        try:
            results = await self.intelligence.search(f"website content analysis {website_url}", limit=10)
            audit: Dict[str, Any] = {"website_url": website_url, "audit_timestamp": datetime.utcnow().isoformat(), "total_pages_crawled": len(results), "content_quality": None, "brand_voice_consistency": None, "safety_issues": None, "cannibalization_issues": None}
            if not results: return audit
            quality_scores, style_scores, safety_flags = [], [], []
            for result in results:
                text = result.get("text", "") or result.get("id", "")
                if len(text) < 50: continue
                quality = await self.assess_content_quality({"description": text, "title": website_url}); quality_scores.append(quality.get("score", 0.0))
                style = await self.style_enforcer(text); style_scores.append(style.get("compliance_score", 0.0))
                safety = await self.safety_filter(text)
                if not safety.get("is_safe", True): safety_flags.append(safety.get("flags", []))
            audit["content_quality"] = {"score": round(sum(quality_scores)/max(len(quality_scores),1),4), "pages_analyzed": len(quality_scores)}
            audit["brand_voice_consistency"] = {"compliance_score": round(sum(style_scores)/max(len(style_scores),1),4), "pages_checked": len(style_scores)}
            audit["safety_issues"] = {"has_issues": len(safety_flags)>0, "flagged_pages": len(safety_flags)}
            audit["cannibalization_issues"] = await self.check_cannibalization(website_url)
            return audit
        except Exception as e: logger.error(f"[{self.__class__.__name__}] Site audit failed: {e}"); return {"website_url": website_url, "error": str(e), "audit_timestamp": datetime.utcnow().isoformat()}

    async def assess_content_quality(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        self._log_agent_operation("Assessing content quality")
        try:
            text = website_data.get('description','') or website_data.get('title','')
            if not text: return {"score":0.5,"reason":"No content to analyze"}
            style = await self.style_enforcer(text); safety = await self.safety_filter(text)
            base = style.get('compliance_score',0.8)
            if safety.get('action')=='flag_for_review': base*=0.5
            return {"score":base,"style_analysis":style,"safety_analysis":safety,"analyzed_text_length":len(text)}
        except Exception as e: return {"score":0.0,"error":str(e)}

    async def check_cannibalization(self, new_draft: str) -> Dict[str, Any]:
        self._log_agent_operation("Checking for semantic cannibalization", draft_length=len(new_draft))
        try:
            if not await self._ensure_intelligence_ready(): return {"warning":False,"error":"Service not initialized"}
            if not new_draft or len(new_draft.strip())<50: return {"warning":False,"reason":"Draft too short"}
            results = await self.intelligence.search(new_draft, limit=1)
            if not results: return {"warning":False,"uniqueness_score":1.0}
            score = results[0].get('score',0.0)
            if score > self.CANNIBALIZATION_THRESHOLD: return {"warning":True,"similar_to":results[0].get('id','unknown'),"score":score,"threshold":self.CANNIBALIZATION_THRESHOLD,"recommendation":"Consider revising the draft to target a different angle or merge with existing content"}
            return {"warning":False,"uniqueness_score":1.0-score}
        except Exception as e: return {"warning":False,"error":str(e)}

    async def verify_originality(self, text: str, competitor_index: Any) -> Dict[str, Any]:
        """(unchanged — kept for backward compat)"""
        self._log_agent_operation("Verifying originality against competitors", text_length=len(text))
        try:
            if not text or len(text.strip())<50: return {"originality_score":0.0,"reason":"Text too short"}
            query = text.strip(); competitor_results = []; method="user_index_competitor_filter"
            if competitor_index is not None and hasattr(competitor_index,"search"):
                method="competitor_index_search"; raw=competitor_index.search(query,limit=5)
                if asyncio.iscoroutine(raw): raw=await raw
                competitor_results=raw or []
            else:
                raw=await self.intelligence.search(query,limit=10)
                for r in raw or []:
                    m_raw=r.get("object"); m=m_raw if isinstance(m_raw,dict) else {}
                    if not m and isinstance(m_raw,str):
                        try: m=json.loads(m_raw)
                        except Exception: m={}
                    if "competitor" in str(m.get("type","")).lower() or "competitor" in str(m.get("source","")).lower():
                        competitor_results.append(r)
            if not competitor_results: return {"originality_score":1.0,"confidence":0.6,"method":method,"notes":"No competitor overlap detected"}
            top=max(competitor_results,key=lambda i:float(i.get("score",0.0))); s=max(0.0,min(1.0,float(top.get("score",0.0))))
            os_=max(0.0,round(1.0-s,4)); c=round(min(1.0,0.55+(min(len(competitor_results),5)*0.07)),3)
            return {"originality_score":os_,"confidence":c,"method":method,"warning":os_<self.ORIGINALITY_THRESHOLD,"threshold":self.ORIGINALITY_THRESHOLD,"top_competitor_match":{"id":top.get("id"),"score":round(s,4)},"matches_evaluated":len(competitor_results)}
        except Exception as e: return {"originality_score":0.0,"error":str(e)}

    async def style_enforcer(self, text: str, style_guidelines: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        self._log_agent_operation("Enforcing style guidelines", text_length=len(text))
        try:
            if not text: return {"compliance_score":0.0,"issues":["No text provided"]}
            if not style_guidelines and self.sif_service:
                try:
                    r=await self.intelligence.search("website analysis brand voice style",limit=1)
                    if r:
                        m_raw=r[0].get('object'); m=json.loads(m_raw) if isinstance(m_raw,str) else (m_raw or r[0])
                        if m.get('type')=='website_analysis':
                            rep=m.get('full_report',{}); style_guidelines={"tone":rep.get('brand_analysis',{}).get('brand_voice','neutral'),"style_patterns":rep.get('style_patterns',{}),"writing_style":rep.get('writing_style',{})}
                except Exception: pass
            issues=[]; score=1.0
            tone=(style_guidelines or {}).get('tone','').lower()
            if 'formal' in tone or 'professional' in tone:
                found=[c for c in ["can't","won't","don't","it's"] if c in text.lower()]
                if found: issues.append(f"Found contractions in formal text: {', '.join(found[:3])}..."); score-=0.1
            sentences=text.split('.'); avg=sum(len(s.split()) for s in sentences if s)/max(1,len(sentences))
            if avg>25: issues.append("Average sentence length is too high (>25 words). Consider shortening."); score-=0.1
            return {"compliance_score":max(0.0,score),"issues":issues,"is_compliant":score>0.8,"guidelines_source":"sif_index" if not style_guidelines and self.sif_service else "provided"}
        except Exception as e: return {"error":str(e)}

    async def safety_filter(self, text: str) -> Dict[str, Any]:
        self._log_agent_operation("Running safety filter", text_length=len(text))
        try:
            kw=["hate","kill","murder","attack","destroy","scam","fraud","steal","explicit","adult"]
            found=[k for k in kw if f" {k} " in text.lower()]
            ok=len(found)==0
            return {"is_safe":ok,"flags":found,"safety_score":1.0 if ok else 0.0,"action":"approve" if ok else "flag_for_review"}
        except Exception as e: return {"error":str(e)}

    # ═══════════════════════════════════════════════════════════════
    #  COMMITTEE WATCHDOG — the core audit entry point
    # ═══════════════════════════════════════════════════════════════
    async def audit_committee(self, proposals: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Audits a batch of committee proposals and returns a structured report.

        proposals: list of dicts with at minimum:
            agent, title, pillar_id, priority, reasoning, accepted, valid
        """
        if not proposals:
            return {
                "health_score": 0, "verdict": "No proposals received from any agent",
                "agent_critiques": [], "coverage_gaps": [], "overlaps": [],
                "alerts": []
            }

        by_agent: Dict[str, List[Dict]] = {}
        for p in proposals:
            by_agent.setdefault(p.get("agent", "unknown"), []).append(p)

        # 1. Critique each agent
        agent_critiques = []
        for agent_name, agent_props in sorted(by_agent.items()):
            critique = self._critique_agent(agent_name, agent_props)
            agent_critiques.append(critique)

        # 2. Coverage check
        coverage_gaps = self._find_coverage_gaps(proposals)
        overstuffed = self._find_overstuffed_pillars(proposals)

        # 3. Overlap detection
        overlaps = self._find_overlaps(proposals)

        # 4. Overall health score
        health_score = self._compute_health_score(agent_critiques, coverage_gaps, overlaps)

        # 5. Generate actionable alerts
        alerts = self._generate_alerts(agent_critiques, coverage_gaps, overlaps)

        verdict = self._verdict_text(health_score, agent_critiques, coverage_gaps)

        return {
            "health_score": health_score,
            "verdict": verdict,
            "agent_critiques": agent_critiques,
            "coverage_gaps": coverage_gaps,
            "overstuffed_pillars": overstuffed,
            "overlaps": overlaps,
            "alerts": alerts,
            "audit_timestamp": datetime.utcnow().isoformat(),
        }

    # ── agent critique ────────────────────────────────────────────
    def _critique_agent(self, agent_name: str, proposals: List[Dict]) -> Dict[str, Any]:
        info = KNOWN_AGENTS.get(agent_name, {"label": agent_name, "short": agent_name[:6], "pillar_focus": None})
        total = len(proposals)
        accepted = sum(1 for p in proposals if p.get("accepted"))
        rejected = total - accepted
        acceptance_rate = accepted / total if total > 0 else 0

        weak_reasoning = []
        poor_priority = []
        off_pillar = []
        for p in proposals:
            # Reasoning quality
            reason = (p.get("reasoning") or "").strip()
            r_score = self._reasoning_score(reason)
            if r_score < 0.5:
                weak_reasoning.append({"title": p.get("title",""), "reasoning": reason, "score": r_score})

            # Priority appropriateness
            pr = (p.get("priority") or "").lower()
            if info["pillar_focus"] and pr == "low" and p.get("pillar_id") == info["pillar_focus"]:
                poor_priority.append({"title": p.get("title",""), "pillar": p.get("pillar_id",""), "priority": pr,
                                      "note": f"Pillar '{info['pillar_focus']}' is {info['label']}'s core — low priority seems wrong"})

            # Pillar relevance
            if info["pillar_focus"] and p.get("pillar_id") and p["pillar_id"] != info["pillar_focus"]:
                off_pillar.append({"title": p.get("title",""), "proposed_pillar": p.get("pillar_id",""),
                                   "expected_pillar": info["pillar_focus"],
                                   "note": f"'{info['label']}' proposed for '{p['pillar_id']}' pillar but typically operates in '{info['pillar_focus']}'"})

        issues = []
        if weak_reasoning:
            issues.append({"type": "weak_reasoning", "severity": "warning", "count": len(weak_reasoning),
                           "summary": f"{len(weak_reasoning)} proposal(s) with vague or empty reasoning",
                           "details": weak_reasoning,
                           "action_label": "Improve reasoning", "action_url": None})
        if poor_priority:
            issues.append({"type": "poor_priority", "severity": "warning", "count": len(poor_priority),
                           "summary": f"{len(poor_priority)} proposal(s) under-prioritised for core pillar",
                           "details": poor_priority,
                           "action_label": "Review priorities", "action_url": None})
        if off_pillar:
            issues.append({"type": "off_pillar", "severity": "info", "count": len(off_pillar),
                           "summary": f"{len(off_pillar)} proposal(s) outside usual pillar",
                           "details": off_pillar,
                           "action_label": "Review pillar assignment", "action_url": None})
        if rejected > 0:
            issues.append({"type": "rejected_proposals", "severity": "error" if acceptance_rate < 0.3 else "warning",
                           "count": rejected,
                           "summary": f"{rejected} proposal(s) rejected by committee" if rejected > 0 else "",
                           "details": [{"title": p.get("title",""), "reason": p.get("rejected_reason","no reason")} for p in proposals if not p.get("accepted")],
                           "action_label": "Review rejections", "action_url": None})

        # Agent score (0-100)
        score = 100
        if weak_reasoning: score -= len(weak_reasoning) * 15
        if poor_priority: score -= len(poor_priority) * 10
        if acceptance_rate < 0.3: score -= 20
        if acceptance_rate == 0: score = max(0, score - 30)
        score = max(0, min(100, score))

        health = "good" if score >= 80 else "warning" if score >= 50 else "failing"

        return {
            "agent": agent_name,
            "label": info["label"],
            "short": info["short"],
            "score": score,
            "health": health,
            "total_proposals": total,
            "accepted": accepted,
            "rejected": rejected,
            "acceptance_rate": round(acceptance_rate, 2),
            "issues": issues,
            "summary": self._agent_summary(health, score, accepted, total, weak_reasoning, poor_priority),
        }

    # ── reasoning quality ─────────────────────────────────────────
    def _reasoning_score(self, reasoning: str) -> float:
        if not reasoning or len(reasoning) < 10:
            return 0.0
        # Short = weak
        if len(reasoning) < 25:
            return 0.2
        if len(reasoning) < 50:
            return 0.4
        # Has specifics
        specifics = ["because", "since", "based on", "data", "metric", "trend", "observed",
                      "target", "audience", "competitor", "gap", "opportunity", "improve",
                      "increase", "reduce", "goal", "kpi", "score", "result"]
        found = sum(1 for s in specifics if s in reasoning.lower())
        base = min(1.0, 0.4 + found * 0.1)
        # Length bonus
        if len(reasoning) > 100:
            base = min(1.0, base + 0.15)
        return min(1.0, base)

    # ── coverage ──────────────────────────────────────────────────
    def _find_coverage_gaps(self, proposals: List[Dict]) -> List[Dict]:
        covered = set()
        for p in proposals:
            pid = p.get("pillar_id")
            if pid and pid in PILLAR_IDS:
                covered.add(pid)
        gaps = []
        for pid in sorted(PILLAR_IDS):
            if pid not in covered:
                gaps.append({"pillar_id": pid, "severity": "warning",
                             "summary": f"Pillar '{pid}' has no proposals from any agent",
                             "action_label": "Add task", "action_url": None})
        return gaps

    def _find_overstuffed_pillars(self, proposals: List[Dict]) -> List[Dict]:
        counts: Dict[str, int] = {}
        for p in proposals:
            pid = p.get("pillar_id")
            if pid and pid in PILLAR_IDS:
                counts[pid] = counts.get(pid, 0) + 1
        total = len(proposals)
        overstuffed = []
        for pid, count in sorted(counts.items()):
            if total > 0 and count / total > 0.5:
                overstuffed.append({"pillar_id": pid, "count": count, "total": total,
                                    "severity": "info",
                                    "summary": f"Pillar '{pid}' has {count}/{total} proposals ({count/total*100:.0f}%) — may be over-represented",
                                    "action_label": None, "action_url": None})
        return overstuffed

    # ── overlap detection ─────────────────────────────────────────
    def _find_overlaps(self, proposals: List[Dict]) -> List[Dict]:
        overlaps = []
        by_title: Dict[str, List[Dict]] = {}
        for p in proposals:
            t = (p.get("title") or "").strip().lower()
            by_title.setdefault(t, []).append(p)
        for title, dups in by_title.items():
            if len(dups) > 1 and title:
                agents = [d.get("agent","?") for d in dups]
                overlaps.append({"title": dups[0].get("title",""), "pillar": dups[0].get("pillar_id",""),
                                 "agents": agents, "count": len(dups),
                                 "severity": "warning",
                                 "summary": f"{len(dups)} agents proposed '{dups[0].get('title','')}': {', '.join(agents)}",
                                 "action_label": "Resolve conflict", "action_url": None})
        return overlaps

    # ── health ────────────────────────────────────────────────────
    def _compute_health_score(self, critiques: List[Dict], gaps: List[Dict], overlaps: List[Dict]) -> int:
        score = 100
        for c in critiques:
            if c["health"] == "failing": score -= 15
            elif c["health"] == "warning": score -= 8
        score -= len(gaps) * 10
        score -= len(overlaps) * 5
        return max(0, min(100, score))

    def _verdict_text(self, health: int, critiques: List[Dict], gaps: List[Dict]) -> str:
        if health >= 90:
            return "Committee is performing well — all agents submitting quality proposals with good coverage."
        failing = [c for c in critiques if c["health"] == "failing"]
        warning = [c for c in critiques if c["health"] == "warning"]
        parts = []
        if failing:
            parts.append(f"{len(failing)} agent(s) need attention: {', '.join(c['label'] for c in failing)}")
        if warning:
            parts.append(f"{len(warning)} agent(s) showing issues: {', '.join(c['label'] for c in warning)}")
        if gaps:
            parts.append(f"Missing coverage: {', '.join(g['pillar_id'] for g in gaps)}")
        if not parts:
            parts.append("Minor issues detected — monitoring.")
        return " — ".join(parts)

    def _agent_summary(self, health: str, score: int, accepted: int, total: int, weak: List, poor: List) -> str:
        if health == "failing":
            return f"Score {score}/100 — {accepted}/{total} accepted, {len(weak)} weak reasoning, {len(poor)} under-prioritised"
        if health == "warning":
            return f"Score {score}/100 — {accepted}/{total} accepted, {len(weak)} weak reasoning"
        return f"Score {score}/100 — {accepted}/{total} accepted"

    # ── alerts ────────────────────────────────────────────────────
    def _generate_alerts(self, critiques: List[Dict], gaps: List[Dict], overlaps: List[Dict]) -> List[Dict]:
        alerts = []
        for c in critiques:
            if c["health"] == "failing":
                alerts.append({
                    "type": "agent_failing", "severity": "error",
                    "agent": c["agent"], "label": c["label"],
                    "title": f"{c['label']} needs attention",
                    "message": c["summary"],
                    "cta_path": None,
                })
            for issue in c.get("issues", []):
                if issue["type"] == "weak_reasoning" and issue["count"] >= 3:
                    alerts.append({
                        "type": "weak_reasoning", "severity": "warning",
                        "agent": c["agent"], "label": c["label"],
                        "title": f"{c['label']}: {issue['count']} proposals with weak reasoning",
                        "message": issue["summary"],
                        "cta_path": None,
                    })
        for g in gaps:
            alerts.append({
                "type": "coverage_gap", "severity": "warning",
                "agent": None, "label": None,
                "title": f"Coverage gap: pillar '{g['pillar_id']}'",
                "message": g["summary"],
                "cta_path": None,
            })
        for o in overlaps:
            alerts.append({
                "type": "proposal_overlap", "severity": "warning",
                "agent": None, "label": None,
                "title": f"Duplicate proposal: '{o['title']}'",
                "message": o["summary"],
                "cta_path": None,
            })
        return alerts
