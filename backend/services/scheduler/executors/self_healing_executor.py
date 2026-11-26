"""Self-healing executor for social post engagement recovery.

Implements:
- Per-post evaluation windows and cooldown timers
- Stagnation trigger evaluation with tiered action selection
- Action idempotency keys for edit/comment/thread operations
- Duplicate and over-frequency suppression within cooldown boundaries
- Outcome persistence and safe retry policy for transient failures
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class ActionType(str, Enum):
    EDIT = "edit"
    COMMENT = "comment"
    THREAD = "thread"


class ActionTier(str, Enum):
    TIER_1 = "tier_1"  # low-intensity nudge (comment)
    TIER_2 = "tier_2"  # medium-intensity enhancement (edit)
    TIER_3 = "tier_3"  # high-intensity amplification (thread)


SAFE_TRANSIENT_ERROR_CODES = {
    "timeout",
    "rate_limit",
    "service_unavailable",
    "network_error",
}


@dataclass
class EvaluationConfig:
    per_post_window_minutes: int = 90
    min_samples_required: int = 3
    cooldown_by_action_seconds: Dict[ActionType, int] = field(
        default_factory=lambda: {
            ActionType.COMMENT: 30 * 60,
            ActionType.EDIT: 2 * 60 * 60,
            ActionType.THREAD: 3 * 60 * 60,
        }
    )
    max_actions_per_window: int = 2


@dataclass
class PostMetricsPoint:
    timestamp: datetime
    impressions: int
    engagements: int


@dataclass
class ActionRecord:
    idempotency_key: str
    post_id: str
    action_type: ActionType
    tier: ActionTier
    initiated_at: datetime
    status: str
    attempts: int = 1
    outcome: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None

    def to_json(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["action_type"] = self.action_type.value
        payload["tier"] = self.tier.value
        payload["initiated_at"] = self.initiated_at.isoformat()
        return payload

    @classmethod
    def from_json(cls, payload: Dict[str, Any]) -> "ActionRecord":
        return cls(
            idempotency_key=payload["idempotency_key"],
            post_id=payload["post_id"],
            action_type=ActionType(payload["action_type"]),
            tier=ActionTier(payload["tier"]),
            initiated_at=datetime.fromisoformat(payload["initiated_at"]),
            status=payload["status"],
            attempts=payload.get("attempts", 1),
            outcome=payload.get("outcome"),
            error_code=payload.get("error_code"),
        )


class SelfHealingExecutor:
    """Decision and guardrail engine for corrective engagement actions."""

    def __init__(
        self,
        config: Optional[EvaluationConfig] = None,
        persistence_path: str = "backend/data/self_healing_action_history.json",
    ) -> None:
        self.config = config or EvaluationConfig()
        self.persistence_path = Path(persistence_path)
        self._history: List[ActionRecord] = self._load_history()

    def evaluate_and_plan(
        self,
        post_id: str,
        metrics: List[PostMetricsPoint],
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Evaluate stagnation for a post and plan a single best next action."""
        now = now or datetime.now(timezone.utc)
        window_metrics = self._filter_window(metrics, now)

        if len(window_metrics) < self.config.min_samples_required:
            return {
                "post_id": post_id,
                "eligible": False,
                "reason": "insufficient_samples",
                "sample_count": len(window_metrics),
            }

        stagnation_score, tier = self._evaluate_stagnation(window_metrics)
        action_type = self._choose_action_type(tier)
        idempotency_key = self.generate_idempotency_key(post_id, action_type, tier)

        if self._is_duplicate(idempotency_key):
            return {
                "post_id": post_id,
                "eligible": False,
                "reason": "duplicate_action",
                "idempotency_key": idempotency_key,
            }

        cooldown_ok, cooldown_reason = self._can_execute_with_cooldown(post_id, action_type, now)
        if not cooldown_ok:
            return {
                "post_id": post_id,
                "eligible": False,
                "reason": cooldown_reason,
                "idempotency_key": idempotency_key,
            }

        return {
            "post_id": post_id,
            "eligible": True,
            "stagnation_score": stagnation_score,
            "tier": tier.value,
            "action_type": action_type.value,
            "idempotency_key": idempotency_key,
        }

    def generate_idempotency_key(self, post_id: str, action_type: ActionType, tier: ActionTier) -> str:
        fingerprint = f"{post_id}:{action_type.value}:{tier.value}".encode("utf-8")
        digest = hashlib.sha256(fingerprint).hexdigest()[:32]
        return f"sheal_{digest}"

    def persist_outcome(
        self,
        post_id: str,
        action_type: ActionType,
        tier: ActionTier,
        idempotency_key: str,
        status: str,
        outcome: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> ActionRecord:
        now = now or datetime.now(timezone.utc)

        existing = next((h for h in self._history if h.idempotency_key == idempotency_key), None)
        if existing:
            existing.status = status
            existing.outcome = outcome
            existing.error_code = error_code
            existing.attempts += 1
            existing.initiated_at = now
            record = existing
        else:
            record = ActionRecord(
                idempotency_key=idempotency_key,
                post_id=post_id,
                action_type=action_type,
                tier=tier,
                initiated_at=now,
                status=status,
                outcome=outcome,
                error_code=error_code,
            )
            self._history.append(record)

        self._save_history()
        return record

    def should_retry(self, idempotency_key: str) -> bool:
        """Retry only if the last failure is transient and safe to replay."""
        rec = next((h for h in self._history if h.idempotency_key == idempotency_key), None)
        if not rec or rec.status != "failed":
            return False

        if rec.error_code not in SAFE_TRANSIENT_ERROR_CODES:
            return False

        return rec.action_type in {ActionType.COMMENT, ActionType.EDIT, ActionType.THREAD}

    def _filter_window(self, metrics: List[PostMetricsPoint], now: datetime) -> List[PostMetricsPoint]:
        cutoff = now - timedelta(minutes=self.config.per_post_window_minutes)
        return [m for m in metrics if m.timestamp >= cutoff]

    def _evaluate_stagnation(self, metrics: List[PostMetricsPoint]) -> Tuple[float, ActionTier]:
        ordered = sorted(metrics, key=lambda m: m.timestamp)
        first, last = ordered[0], ordered[-1]

        imp_delta = max(0, last.impressions - first.impressions)
        eng_delta = max(0, last.engagements - first.engagements)
        eng_rate = eng_delta / imp_delta if imp_delta > 0 else 0.0

        stagnation_score = 1.0 - min(1.0, eng_rate * 20)
        if stagnation_score >= 0.8:
            return stagnation_score, ActionTier.TIER_3
        if stagnation_score >= 0.55:
            return stagnation_score, ActionTier.TIER_2
        return stagnation_score, ActionTier.TIER_1

    def _choose_action_type(self, tier: ActionTier) -> ActionType:
        if tier == ActionTier.TIER_1:
            return ActionType.COMMENT
        if tier == ActionTier.TIER_2:
            return ActionType.EDIT
        return ActionType.THREAD

    def _is_duplicate(self, idempotency_key: str) -> bool:
        return any(h.idempotency_key == idempotency_key and h.status in {"success", "running"} for h in self._history)

    def _can_execute_with_cooldown(self, post_id: str, action_type: ActionType, now: datetime) -> Tuple[bool, Optional[str]]:
        action_cooldown = self.config.cooldown_by_action_seconds[action_type]

        same_post = [h for h in self._history if h.post_id == post_id]
        recent_in_window = [
            h for h in same_post
            if h.initiated_at >= now - timedelta(minutes=self.config.per_post_window_minutes)
        ]
        if len(recent_in_window) >= self.config.max_actions_per_window:
            return False, "window_frequency_exceeded"

        for record in reversed(same_post):
            if record.action_type != action_type:
                continue
            if (now - record.initiated_at).total_seconds() < action_cooldown:
                return False, "action_cooldown_active"
            break

        return True, None

    def _load_history(self) -> List[ActionRecord]:
        if not self.persistence_path.exists():
            return []
        try:
            payload = json.loads(self.persistence_path.read_text(encoding="utf-8"))
            return [ActionRecord.from_json(item) for item in payload]
        except (json.JSONDecodeError, OSError, ValueError):
            return []

    def _save_history(self) -> None:
        self.persistence_path.parent.mkdir(parents=True, exist_ok=True)
        payload = [item.to_json() for item in self._history]
        self.persistence_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
