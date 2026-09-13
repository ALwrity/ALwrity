"""
Phase 14 (plan Phase D slice 3) — CTA'd SEO AgentAlerts from real evidence.

Turns the persisted SEO signals (seo_evidence) into actionable AgentAlerts.
Each alert carries cta_path='/seo-dashboard' and a STABLE dedupe_key, so
AgentActivityService.create_alert suppresses duplicates while unread — and the
huddle feed plus the next grounding's `recent_agent_alerts` surface them with
no extra plumbing.

Honest: only status == 'ok' evidence produces alerts. no_data/error -> none.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

STALE_AUDIT_DAYS = 30
LOW_HEALTH_SCORE = 60
PAGE_FIX_THRESHOLD = 70
CTA_PATH = "/seo-dashboard"


def _is_stale(last_audit_at: Optional[str]) -> bool:
    if not last_audit_at:
        return False
    try:
        parsed = datetime.fromisoformat(str(last_audit_at).replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.replace(tzinfo=None)
    except Exception:
        return False
    return (datetime.utcnow() - parsed) > timedelta(days=STALE_AUDIT_DAYS)


def produce_seo_alerts(
    db,
    user_id: str,
    evidence: Dict[str, Any],
    activity_service: Any = None,
) -> List[Dict[str, Any]]:
    """Raise CTA'd alerts from SEO evidence. Returns the alerts actually created."""
    if not isinstance(evidence, dict) or evidence.get("status") != "ok":
        return []

    if activity_service is None:
        try:
            from services.agent_activity_service import AgentActivityService

            activity_service = AgentActivityService(db, user_id)
        except Exception as exc:
            logger.warning(f"SEO alert producer unavailable: {exc}")
            return []

    created: List[Dict[str, Any]] = []

    def _raise(alert_type: str, title: str, message: str, severity: str, dedupe_key: str) -> None:
        try:
            alert = activity_service.create_alert(
                alert_type=alert_type,
                title=title,
                message=message,
                severity=severity,
                cta_path=CTA_PATH,
                dedupe_key=dedupe_key,
            )
        except Exception as exc:
            logger.warning(f"Failed to raise SEO alert {alert_type}: {exc}")
            return
        if alert is not None:
            created.append({"alert_type": alert_type, "title": title, "severity": severity})

    pages_needing_fix = int(evidence.get("pages_needing_fix") or 0)
    if pages_needing_fix > 0:
        _raise(
            "seo_page_health",
            f"{pages_needing_fix} page(s) need SEO fixes",
            f"{pages_needing_fix} audited page(s) score below {PAGE_FIX_THRESHOLD}. "
            "Open the SEO dashboard for the prioritized list.",
            "warning",
            "seo:pages_needing_fix",
        )

    striking = evidence.get("striking_distance") or []
    if striking:
        top = striking[0] or {}
        _raise(
            "seo_striking_distance",
            f'Striking distance: "{top.get("keyword")}"',
            f'Ranking at position {top.get("position")} with {top.get("impressions")} impressions — '
            "small pushes can reach page 1.",
            "info",
            "seo:striking_distance",
        )

    low_ctr = evidence.get("low_ctr") or []
    if low_ctr:
        top = low_ctr[0] or {}
        _raise(
            "seo_low_ctr",
            f'Low CTR on "{top.get("keyword")}"',
            f'{top.get("ctr")}% CTR at {top.get("impressions")} impressions — '
            "improve the title/meta to convert existing visibility.",
            "warning",
            "seo:low_ctr",
        )

    health_score = evidence.get("health_score")
    if health_score is not None:
        try:
            if float(health_score) < LOW_HEALTH_SCORE:
                _raise(
                    "seo_health_low",
                    f"SEO health score is {health_score}/100",
                    f"On-page SEO health is below the {LOW_HEALTH_SCORE} threshold.",
                    "warning",
                    "seo:health_low",
                )
        except (TypeError, ValueError):
            pass

    if _is_stale(evidence.get("last_audit_at")):
        _raise(
            "seo_audit_stale",
            "SEO audit is stale",
            f"The last on-page audit was over {STALE_AUDIT_DAYS} days ago. Re-run the audit.",
            "info",
            "seo:audit_stale",
        )

    return created
