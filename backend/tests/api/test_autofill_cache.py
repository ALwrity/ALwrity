"""
Autofill must be generated ONCE and persisted — on every refresh the Create
Strategy page re-issued the expensive POST /autofill/generate (a full LLM call
per refresh), because nothing cached the result.

Fix shape:
- autofill_cache service: persist the full autofill payload inside the
  StrategyWizardState row (step_data['autofill']), keyed by clerk user id.
- GET /autofill/latest returns the persisted snapshot (the frontend hydrates
  from it instead of re-running the LLM on every mount).
- POST /autofill/generate and /autofill/regenerate-ai persist the fresh
  payload under the same snapshot key (manual regenerate overwrites).
- Select-typed fields are normalized to the FRONTEND's option values at the
  boundary ("Leader" -> "Market Leader"; anything unmapped -> None so the UI
  never receives an out-of-range value).
"""
from unittest.mock import patch, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.content_strategy_state_models import StrategyWizardState


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)
    session = session_local()
    try:
        yield session
    finally:
        session.close()


def _fixture_payload():
    return {
        "fields": {
            "competitive_position": {"value": "Leader", "source": "ai"},
            "business_objectives": {"value": "scale", "source": "ai"},
        },
        "meta": {"ai_used": True, "total_fields": 2},
    }


def _mock_generate(return_value):
    """Fake AutoFillService whose generate() AND regenerate_ai_fields() both
    return `return_value` (either or both endpoints may be exercised)."""
    async def generate(user_id):
        return return_value

    mock = MagicMock()
    mock.generate = generate
    mock.regenerate_ai_fields = generate
    return mock


class TestAutofillSnapshotCache:
    def test_save_and_roundtrip(self, db_session):
        from api.content_planning.services.content_strategy.autofill.autofill_cache import (
            save_autofill_snapshot,
            get_autofill_snapshot,
        )

        save_autofill_snapshot(db_session, "user-cache-1", _fixture_payload())
        snapshot = get_autofill_snapshot(db_session, "user-cache-1")

        assert snapshot is not None
        assert snapshot["payload"]["fields"]["business_objectives"]["value"] == "scale"
        assert snapshot["payload"]["meta"]["total_fields"] == 2
        assert snapshot["generated_at"]

    def test_overwrite_updates_snapshot(self, db_session):
        from api.content_planning.services.content_strategy.autofill.autofill_cache import (
            save_autofill_snapshot,
            get_autofill_snapshot,
        )

        save_autofill_snapshot(db_session, "user-ow", {"fields": {"a": 1}, "meta": {}})
        save_autofill_snapshot(db_session, "user-ow", {"fields": {"b": 2}, "meta": {"r": True}})

        snapshot = get_autofill_snapshot(db_session, "user-ow")
        assert snapshot["payload"]["fields"] == {"b": 2}

        # Only ONE wizard-state row per user even after overwrite.
        assert (
            db_session.query(StrategyWizardState)
            .filter(StrategyWizardState.user_id == "user-ow")
            .count()
            == 1
        )

    def test_get_snapshot_empty_returns_none(self, db_session):
        from api.content_planning.services.content_strategy.autofill.autofill_cache import (
            get_autofill_snapshot,
        )

        assert get_autofill_snapshot(db_session, "user-missing") is None


class TestAutofillEndpointsPersistence:
    @pytest.mark.asyncio
    async def test_generate_persists_snapshot_and_latest_returns_it(self, db_session):
        from api.content_planning.api.content_strategy.endpoints.autofill_endpoints import (
            generate_autofill,
            get_latest_autofill,
        )

        with patch(
            "api.content_planning.api.content_strategy.endpoints.autofill_endpoints.AutoFillService"
        ) as mock_service_cls:
            mock_service_cls.return_value = _mock_generate(_fixture_payload())

            response = await generate_autofill(current_user={"id": "u-endpoint"}, db=db_session)

        assert response["status"] == "success"

        latest = await get_latest_autofill(current_user={"id": "u-endpoint"}, db=db_session)
        data = latest["data"]
        assert data is not None
        assert data["payload"]["fields"]["business_objectives"]["value"] == "scale"
        assert data["generated_at"]

    @pytest.mark.asyncio
    async def test_latest_when_nothing_persisted_returns_none(self, db_session):
        from api.content_planning.api.content_strategy.endpoints.autofill_endpoints import (
            get_latest_autofill,
        )

        latest = await get_latest_autofill(current_user={"id": "u-empty"}, db=db_session)

        assert latest["status"] == "success"
        assert latest["data"] is None

    @pytest.mark.asyncio
    async def test_regenerate_also_persists(self, db_session):
        from api.content_planning.api.content_strategy.endpoints.autofill_endpoints import (
            regenerate_ai,
            get_latest_autofill,
        )

        with patch(
            "api.content_planning.api.content_strategy.endpoints.autofill_endpoints.AutoFillService"
        ) as mock_service_cls:
            mock_service_cls.return_value = _mock_generate(_fixture_payload())

            await regenerate_ai(current_user={"id": "u-regen"}, db=db_session)

        latest = await get_latest_autofill(current_user={"id": "u-regen"}, db=db_session)
        assert latest["data"] is not None


class TestSelectFieldNormalization:
    def test_maps_drifted_values_to_frontend_options(self):
        from api.content_planning.services.content_strategy.autofill.option_values import (
            normalize_option_field_value,
        )

        assert normalize_option_field_value("competitive_position", "Leader") == "Market Leader"
        assert normalize_option_field_value("competitive_position", "Niche") == "Niche Player"
        assert normalize_option_field_value("competitive_position", "Emerging") == "Niche Player"
        assert normalize_option_field_value("competitive_position", "Challenger") == "Challenger"

    def test_matches_frontends_canonical_option_sets(self):
        """The backend's option vocabulary must literally match the frontend
        STRATEGIC_INPUT_FIELDS options — the source of the 'Leader'/'Niche'
        skips the QA logs."""
        from api.content_planning.services.content_strategy.autofill import option_values as ov

        assert ov.COMPETITIVE_POSITION_OPTIONS == ["Market Leader", "Challenger", "Follower", "Niche Player"]
        assert "2-3 times per week" in ov.CONTENT_FREQUENCY_OPTIONS
        assert "Humorous" in ov.BRAND_VOICE_OPTIONS
        assert "Ongoing" in ov.IMPLEMENTATION_TIMELINE_OPTIONS

    def test_case_insensitive_and_cleanup(self):
        from api.content_planning.services.content_strategy.autofill.option_values import (
            normalize_option_field_value,
        )

        assert normalize_option_field_value("competitive_position", "market leader") == "Market Leader"
        assert normalize_option_field_value("brand_voice", "PROFESSIONAL") == "Professional"
        assert normalize_option_field_value("content_frequency", "2-3 per week") == "2-3 times per week"

    def test_unknown_values_become_none_never_invalid(self):
        from api.content_planning.services.content_strategy.autofill.option_values import (
            normalize_option_field_value,
        )

        assert normalize_option_field_value("competitive_position", "Fit Bahamas") is None
        assert normalize_option_field_value("brand_voice", {"richly": "object"}) is None
        # Non-select fields pass through untouched
        assert normalize_option_field_value("business_objectives", "anything") == "anything"
