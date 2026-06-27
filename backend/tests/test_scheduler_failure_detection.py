"""Tests for FailureDetectionService settings integration."""

from datetime import datetime, timedelta
from unittest import mock

import pytest

from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.scheduler.core.settings import SchedulerSettings


@pytest.fixture
def settings():
    return SchedulerSettings(
        failure_consecutive_threshold=3,
        failure_recent_threshold=5,
        failure_lookback_days=7,
        failure_cool_off_days=7,
        failure_analysis_max_logs=5,
        failure_pattern_max_logs=5,
        failure_pattern_truncate_length=100,
        failure_pattern_max_count=3,
    )


@pytest.fixture
def mock_db():
    return mock.MagicMock()


@pytest.fixture
def service(settings, mock_db):
    return FailureDetectionService(db=mock_db, settings=settings)


class TestFailureDetectionThresholds:
    """Threshold properties read from SchedulerSettings."""

    def test_consecutive_threshold(self, settings, service):
        assert service.CONSECUTIVE_FAILURE_THRESHOLD == settings.failure_consecutive_threshold

    def test_recent_threshold(self, settings, service):
        assert service.RECENT_FAILURE_THRESHOLD == settings.failure_recent_threshold

    def test_cool_off_period(self, settings, service):
        assert service.COOL_OFF_PERIOD_DAYS == settings.failure_cool_off_days

    def test_lookback_days(self, settings, service):
        assert service._get_lookback_days() == settings.failure_lookback_days


class TestFailureDetectionLogic:
    """analyze_task_failures returns FailurePattern when thresholds exceeded."""

    def _make_log_entry(self, status: str):
        return {"status": status, "error_message": "", "execution_date": datetime.utcnow(), "result_data": None}

    def test_analyze_returns_none_when_no_logs(self, service, mock_db):
        with mock.patch.object(service, "_get_execution_logs", return_value=[]):
            result = service.analyze_task_failures(task_id=1, task_type="test", user_id="u1")
        assert result is None

    def test_analyze_detects_consecutive_failures(self, service, mock_db):
        logs = [self._make_log_entry("failed") for _ in range(3)]
        with mock.patch.object(service, "_get_execution_logs", return_value=logs):
            result = service.analyze_task_failures(task_id=1, task_type="test", user_id="u1")
        assert result is not None
        assert result.consecutive_failures >= 3
        assert result.should_cool_off is True

    def test_analyze_returns_pattern_when_below_threshold(self, service, mock_db):
        logs = [
            self._make_log_entry("success"),
            self._make_log_entry("failed"),
            self._make_log_entry("success"),
        ]
        with mock.patch.object(service, "_get_execution_logs", return_value=logs):
            result = service.analyze_task_failures(task_id=2, task_type="test", user_id="u2")
        assert result is not None
        assert result.should_cool_off is False
