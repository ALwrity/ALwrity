"""Feature-mode gates for lean LinkedIn-only backend startup."""

from __future__ import annotations

import os
from typing import Set

LINGUISTIC_REQUIRED_FEATURES: Set[str] = {
    "content_planning",
    "strategy_copilot",
    "facebook",
    "blog_writer",
    "persona",
}


def parse_enabled_features(env_value: str | None = None) -> Set[str]:
    """Parse ALWRITY_ENABLED_FEATURES into a normalized feature set."""
    value = (
        env_value
        if env_value is not None
        else os.getenv("ALWRITY_ENABLED_FEATURES", "all")
    ).strip().lower()

    if not value or value == "all":
        return {"all"}

    return {feature.strip() for feature in value.split(",") if feature.strip()}


def is_full_mode(enabled_features: Set[str] | None = None) -> bool:
    """Return True when all features are enabled."""
    enabled = enabled_features if enabled_features is not None else parse_enabled_features()
    return "all" in enabled


def should_bootstrap_linguistic_models(enabled_features: Set[str] | None = None) -> bool:
    """Return True when spaCy/NLTK bootstrap is needed for enabled features."""
    enabled = enabled_features if enabled_features is not None else parse_enabled_features()

    if "all" in enabled:
        return True

    if enabled == {"podcast"}:
        return False

    return bool(enabled & LINGUISTIC_REQUIRED_FEATURES)


def get_requirements_file_for_features(enabled_features: Set[str] | None = None) -> str:
    """Pick the lean requirements file for feature-limited LinkedIn startup."""
    enabled = enabled_features if enabled_features is not None else parse_enabled_features()

    if "all" in enabled:
        return "requirements.txt"

    if "linkedin" in enabled:
        return "requirements-linkedin.txt"

    return "requirements.txt"


def should_run_sif_schema_ensures(enabled_features: Set[str] | None = None) -> bool:
    """Return True when SIF/semantic schema migrations should run."""
    return is_full_mode(enabled_features)
