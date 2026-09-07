"""
Phase C item 12 (#20 + #5) — create_enhanced_strategy error shape + field validation.

#20: the endpoint's generic ``except`` used to ``return`` the HTTPException
object instead of raising it. FastAPI serialized that object as a 200 response
with a ``{status_code, detail, headers}`` body — a different shape than both
the success envelope (``{success, data, message}``) and the normal FastAPI
error shape (``{detail}`` with the right status). Clients could not
distinguish success from failure.

#5: the create endpoint previously validated only ``name``. The 30 canonical
strategy-builder fields now get type validation (lenient — anything
``parse_strategy_data`` can coerce is accepted; structurally wrong types like
a dict where a number/array is expected are rejected with a 422 listing the
offending fields, and unknown keys produce warnings).
"""
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from api.content_planning.services.enhanced_strategy_service import EnhancedStrategyService
from api.content_planning.api.content_strategy.endpoints.strategy_crud import (
    create_enhanced_strategy,
)


def _mock_service_success(captured: dict | None = None):
    async def _record(self, strategy_data, db):
        if captured is not None:
            captured.update(strategy_data)
        return {"strategy_id": 1, "name": "Test"}

    return patch.object(
        EnhancedStrategyService,
        "create_enhanced_strategy",
        new=_record,
    )


# --------------------------------------------------------------------
# #20 — standardized error response shape
# --------------------------------------------------------------------


class TestCreateEnhancedStrategyErrorShape:
    @pytest.mark.asyncio
    async def test_unexpected_exception_raises_proper_500(self):
        """Regression: generic exceptions MUST raise HTTPException (500 with
        {detail}), not return a serialized HTTPException object with a 200."""
        with patch.object(
            EnhancedStrategyService,
            "create_enhanced_strategy",
            new=AsyncMock(side_effect=Exception("boom")),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await create_enhanced_strategy(
                    strategy_data={"name": "Shape Test"},
                    current_user={"id": "u-shape"},
                    db=MagicMock(),
                )

        assert exc_info.value.status_code == 500
        assert "boom" in str(exc_info.value.detail)


# --------------------------------------------------------------------
# #5 — 30-field type validation
# --------------------------------------------------------------------


class TestCreateEnhancedStrategyFieldValidation:
    @pytest.mark.asyncio
    async def test_rejects_dict_for_array_field(self):
        """preferred_formats is an array field; a dict is structurally wrong."""
        with _mock_service_success():
            with pytest.raises(HTTPException) as exc_info:
                await create_enhanced_strategy(
                    strategy_data={"name": "V", "preferred_formats": {"oops": 1}},
                    current_user={"id": "u1"},
                    db=MagicMock(),
                )

        assert exc_info.value.status_code == 422
        assert "preferred_formats" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_rejects_dict_for_number_field(self):
        with _mock_service_success():
            with pytest.raises(HTTPException) as exc_info:
                await create_enhanced_strategy(
                    strategy_data={"name": "V", "team_size": {"a": 1}},
                    current_user={"id": "u2"},
                    db=MagicMock(),
                )

        assert exc_info.value.status_code == 422
        assert "team_size" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_rejects_number_for_boolean_field(self):
        with _mock_service_success():
            with pytest.raises(HTTPException) as exc_info:
                await create_enhanced_strategy(
                    strategy_data={"name": "V", "ab_testing_capabilities": {"x": 1}},
                    current_user={"id": "u3"},
                    db=MagicMock(),
                )

        assert exc_info.value.status_code == 422
        assert "ab_testing_capabilities" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_accepts_numeric_string_budget(self):
        """Lenient: numeric strings are parseable by parse_float — accepted."""
        with _mock_service_success():
            response = await create_enhanced_strategy(
                strategy_data={"name": "V", "content_budget": "1000"},
                current_user={"id": "u4"},
                db=MagicMock(),
            )

        assert response["status"] == "success"

    @pytest.mark.asyncio
    async def test_accepts_csv_string_for_array_field(self):
        """Lenient: comma-separated strings are parseable by parse_array."""
        with _mock_service_success():
            response = await create_enhanced_strategy(
                strategy_data={"name": "V", "preferred_formats": "Blog Posts, Videos"},
                current_user={"id": "u5"},
                db=MagicMock(),
            )

        assert response["status"] == "success"

    @pytest.mark.asyncio
    async def test_unknown_fields_produce_warnings(self):
        """Unknown top-level keys don't break the create, but must be surfaced."""
        with _mock_service_success():
            response = await create_enhanced_strategy(
                strategy_data={"name": "V", "totally_unknown_key": 1},
                current_user={"id": "u6"},
                db=MagicMock(),
            )

        assert response["status"] == "success"
        assert "totally_unknown_key" in str(response.get("warnings", {}))

    @pytest.mark.asyncio
    async def test_data_source_transparency_is_not_flagged_unknown(self):
        """Phase D #15: the frontend now sends data_source_transparency
        (autofill/personalization metadata); it is a known model column and
        must NOT be reported as an unrecognized field."""
        with _mock_service_success():
            response = await create_enhanced_strategy(
                strategy_data={
                    "name": "V",
                    "data_source_transparency": {"auto_populated_fields": {"a": 1}},
                },
                current_user={"id": "u8"},
                db=MagicMock(),
            )

        assert response["status"] == "success"
        assert "data_source_transparency" not in str(response.get("warnings", {}))

    @pytest.mark.asyncio
    async def test_happy_path_minimal_unchanged(self):
        """Backwards compat: {name} alone still creates successfully."""
        with _mock_service_success():
            response = await create_enhanced_strategy(
                strategy_data={"name": "Minimal"},
                current_user={"id": "u7"},
                db=MagicMock(),
            )

        assert response["status"] == "success"
        assert response["data"]["strategy_id"] == 1


# --------------------------------------------------------------------
# Phase G #31 — field whitelist for POST create (PUT's ALLOWED_UPDATE_FIELDS pattern)
# --------------------------------------------------------------------


class TestCreateEnhancedStrategyWhitelist:
    @pytest.mark.asyncio
    async def test_unknown_fields_are_dropped_from_payload(self):
        """Unknown top-level keys must NOT reach the service/DB row — the
        mass-assignment surface that PUT closed with ALLOWED_UPDATE_FIELDS
        stays closed for POST create too."""
        captured: dict = {}
        with _mock_service_success(captured):
            await create_enhanced_strategy(
                strategy_data={
                    "name": "V",
                    "totally_unknown_key": 1,
                    "is_admin": True,
                },
                current_user={"id": "u-wl"},
                db=MagicMock(),
            )

        assert "totally_unknown_key" not in captured
        assert "is_admin" not in captured

    @pytest.mark.asyncio
    async def test_canonical_and_system_fields_survive(self):
        """The 30 canonical fields + known metadata keys must pass through."""
        captured: dict = {}
        with _mock_service_success(captured):
            await create_enhanced_strategy(
                strategy_data={
                    "name": "V",
                    "industry": "saas",
                    "brand_voice": "Professional",
                    "completion_percentage": 42,
                    "data_source_transparency": {"data_sources": {"a": "b"}},
                    "strategic_scores": {"x": 1},
                    "user_id": "spoofed-id",  # must be overwritten with auth id
                },
                current_user={"id": "u-real"},
                db=MagicMock(),
            )

        assert captured["name"] == "V"
        assert captured["industry"] == "saas"
        assert captured["brand_voice"] == "Professional"
        assert captured["completion_percentage"] == 42
        assert captured["data_source_transparency"] == {"data_sources": {"a": "b"}}
        assert captured["strategic_scores"] == {"x": 1}
        # Backend authoritatively sets user_id from the auth token
        assert captured["user_id"] == "u-real"

    @pytest.mark.asyncio
    async def test_dropped_fields_are_reported_in_warnings(self):
        """Dropping must not be fully silent — the response lists the keys."""
        with _mock_service_success():
            response = await create_enhanced_strategy(
                strategy_data={"name": "V", "ghost_key": "x"},
                current_user={"id": "u-wl2"},
                db=MagicMock(),
            )

        assert response["status"] == "success"
        assert "ghost_key" in str(response.get("warnings", {}))

