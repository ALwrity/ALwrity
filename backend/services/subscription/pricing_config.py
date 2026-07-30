"""Pricing Configuration Loader — reads pricing.yaml as SSOT."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from loguru import logger

from models.subscription_models import APIProvider, SubscriptionTier

# ────────────────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "pricing.yaml"

ENV_VAR_PATTERN = re.compile(r"\$\{(\w+):-([^}]*)\}")

# Valid provider strings (must match APIProvider enum .value)
VALID_PROVIDERS = {p.value for p in APIProvider}

# Valid tier strings (must match SubscriptionTier enum .value)
VALID_TIERS = {t.value for t in SubscriptionTier}

# ────────────────────────────────────────────────────────────────────────────
# Data structures
# ────────────────────────────────────────────────────────────────────────────


@dataclass
class ModelPricingEntry:
    provider: APIProvider
    model_name: str
    cost_per_input_token: float = 0.0
    cost_per_output_token: float = 0.0
    cost_per_request: float = 0.0
    cost_per_image: float = 0.0
    cost_per_page: float = 0.0
    cost_per_search: float = 0.0
    description: str = ""


@dataclass
class PlanEntry:
    name: str
    tier: SubscriptionTier
    price_monthly: float = 0.0
    price_yearly: float = 0.0
    monthly_cost_limit: float = 0.0
    limits: Dict[str, Any] = field(default_factory=dict)
    features: List[str] = field(default_factory=list)
    description: str = ""


@dataclass
class PricingConfig:
    model_pricing: List[ModelPricingEntry] = field(default_factory=list)
    plans: List[PlanEntry] = field(default_factory=list)


# ────────────────────────────────────────────────────────────────────────────
# Loader
# ────────────────────────────────────────────────────────────────────────────


class PricingConfigLoader:
    """Reads, validates, and caches pricing.yaml as the SSOT for all pricing."""

    def __init__(self, config_path: Optional[Path] = None) -> None:
        self._config_path = config_path or CONFIG_PATH
        self._config: Optional[PricingConfig] = None

    def load(self) -> PricingConfig:
        """Parse and validate pricing.yaml, return typed config."""
        raw = self._read_yaml()
        config = PricingConfig(
            model_pricing=self._parse_model_pricing(raw.get("model_pricing", [])),
            plans=self._parse_plans(raw.get("plans", [])),
        )
        self._validate(config)
        self._config = config
        logger.info(
            f"[PricingConfig] Loaded {len(config.model_pricing)} model pricing "
            f"entries and {len(config.plans)} plans from {self._config_path}"
        )
        return config

    def get_config(self) -> PricingConfig:
        """Return cached config, loading on first call."""
        if self._config is None:
            return self.load()
        return self._config

    # ── YAML reading ─────────────────────────────────────────────────────

    def _read_yaml(self) -> Dict[str, Any]:
        path = self._config_path
        if not path.exists():
            raise FileNotFoundError(
                f"Pricing config not found at {path}. "
                "Create it from pricing.yaml.example or restore from version control."
            )
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        if not isinstance(raw, dict):
            raise ValueError(f"Expected YAML dict at root, got {type(raw).__name__}")
        return raw

    # ── Env var resolution ───────────────────────────────────────────────

    @staticmethod
    def _resolve_env_var(value: Any) -> Any:
        """Replace ${VAR:-default} placeholders with env var values."""
        if not isinstance(value, str):
            return value

        def _replace(m: re.Match) -> str:
            var_name = m.group(1)
            default = m.group(2)
            return os.environ.get(var_name, default)

        return ENV_VAR_PATTERN.sub(_replace, value)

    # ── Model pricing parsing ────────────────────────────────────────────

    def _parse_model_pricing(self, entries: List[Dict[str, Any]]) -> List[ModelPricingEntry]:
        parsed: List[ModelPricingEntry] = []
        for i, entry in enumerate(entries):
            try:
                provider_str = self._resolve_env_var(entry.get("provider", ""))
                model = self._resolve_env_var(entry.get("model", ""))

                if provider_str not in VALID_PROVIDERS:
                    raise ValueError(f"Unknown provider '{provider_str}' at index {i}")

                provider = APIProvider(provider_str)

                cost_per_input = self._to_float(
                    self._resolve_env_var(entry.get("input_per_1m_tokens", 0)), i
                ) / 1_000_000
                cost_per_output = self._to_float(
                    self._resolve_env_var(entry.get("output_per_1m_tokens", 0)), i
                ) / 1_000_000

                parsed.append(
                    ModelPricingEntry(
                        provider=provider,
                        model_name=model,
                        cost_per_input_token=cost_per_input,
                        cost_per_output_token=cost_per_output,
                        cost_per_request=self._to_float(self._resolve_env_var(entry.get("per_request", 0)), i),
                        cost_per_image=self._to_float(self._resolve_env_var(entry.get("per_image", 0)), i),
                        cost_per_page=self._to_float(self._resolve_env_var(entry.get("per_page", 0)), i),
                        cost_per_search=self._to_float(self._resolve_env_var(entry.get("per_search", 0)), i),
                        description=str(self._resolve_env_var(entry.get("notes", ""))),
                    )
                )
            except Exception as e:
                raise ValueError(f"Error parsing model_pricing entry [{i}]: {e}") from e

        return parsed

    # ── Plan parsing ─────────────────────────────────────────────────────

    def _parse_plans(self, plans: List[Dict[str, Any]]) -> List[PlanEntry]:
        parsed: List[PlanEntry] = []
        for i, plan in enumerate(plans):
            try:
                tier_str = plan.get("tier", "")
                if tier_str not in VALID_TIERS:
                    raise ValueError(f"Unknown tier '{tier_str}' at index {i}")

                limits = {}
                for key, val in (plan.get("limits", {}) or {}).items():
                    limits[key] = int(val) if val is not None else 0

                parsed.append(
                    PlanEntry(
                        name=plan.get("name", f"plan-{i}"),
                        tier=SubscriptionTier(tier_str),
                        price_monthly=float(plan.get("price_monthly", 0)),
                        price_yearly=float(plan.get("price_yearly", 0)),
                        monthly_cost_limit=float(plan.get("monthly_cost_cap", 0)),
                        limits=limits,
                        features=list(plan.get("features", [])),
                        description=str(plan.get("description", "")),
                    )
                )
            except Exception as e:
                raise ValueError(f"Error parsing plans entry [{i}]: {e}") from e

        return parsed

    # ── Validation ───────────────────────────────────────────────────────

    def _validate(self, config: PricingConfig) -> None:
        if not config.plans:
            raise ValueError("Pricing config must define at least one plan")
        if not config.model_pricing:
            raise ValueError("Pricing config must define at least one model pricing entry")

        tiers_seen = set()
        for plan in config.plans:
            if plan.tier in tiers_seen:
                raise ValueError(f"Duplicate plan tier: {plan.tier.value}")
            tiers_seen.add(plan.tier)
            if plan.price_monthly < 0:
                raise ValueError(f"Negative monthly price for {plan.name}")
            if plan.monthly_cost_limit < 0:
                raise ValueError(f"Negative cost cap for {plan.name}")

        seen = set()
        for mp in config.model_pricing:
            key = (mp.provider.value, mp.model_name)
            if key in seen:
                raise ValueError(f"Duplicate model pricing: {mp.provider.value}:{mp.model_name}")
            seen.add(key)

        logger.info(
            f"[PricingConfig] Validation passed: "
            f"{len(config.plans)} plans, {len(config.model_pricing)} model entries"
        )

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _to_float(value: Any, index: int) -> float:
        try:
            return float(value) if value else 0.0
        except (TypeError, ValueError) as e:
            raise ValueError(f"Cannot convert to float at index {index}: {value!r}") from e
