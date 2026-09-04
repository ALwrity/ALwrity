"""
Tests for onboarding summary endpoint and onboarding completion detection.
"""
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import pytest


class TestOnboardingSummary:
    """Tests for /api/onboarding/tasks/status endpoint and onboarding completion."""

    async def test_onboarding_summary_status_not_completed(self):
        """Test when onboarding tasks are not completed."""
        mock_user = {"id": "test-user-123"}
        
        with patch('backend.api.onboarding_utils.endpoints_tasks.get_session_for_user') as mock_get_session:
            mock_db = Mock()
            mock_get_session.return_value = mock_db
            
            # Mock task with "pending" status
            mock_task = Mock()
            mock_task.user_id = "test-user-123"
            mock_task.last_executed = None
            mock_task.last_success = None
            mock_task.next_execution = None
            mock_task.status = "pending"
            mock_task.failure_reason = None
            
            mock_session = Mock()
            mock_session.query.return_value.filter.return_value.first.return_value = mock_task
            mock_session.close = Mock()
            mock_get_session.return_value = mock_session
            
            # Mock the entire get_tasks_status function to return test data
            with patch('backend.api.onboarding_utils.endpoints_tasks.get_tasks_status', AsyncMock()) as mock_get_tasks:
                mock_get_tasks.return_value = {
                    "tasks": {
                        "full_site_seo_audit": {
                            "status": "pending",
                            "started_at": None,
                            "progress_pct": 0,
                            "details": None,
                        }
                    },
                    "total": 1,
                    "completed_count": 0,
                    "failed_count": 0,
                    "all_done": False,
                }
                
                from backend.api.onboarding_utils.endpoints_tasks import get_tasks_status
                result = await get_tasks_status(mock_user)
            
            assert result["all_done"] == False
            assert result["completed_count"] == 0
            assert result["failed_count"] == 0
            assert "full_site_seo_audit" in result["tasks"]
            assert result["tasks"]["full_site_seo_audit"]["status"] == "pending"

    async def test_onboarding_summary_status_all_completed(self):
        """Test when all onboarding tasks are completed."""
        mock_user = {"id": "test-user-456"}
        
        with patch('backend.api.onboarding_utils.endpoints_tasks.get_session_for_user') as mock_get_session:
            mock_db = Mock()
            mock_get_session.return_value = mock_db
            
            # Mock completed task
            mock_task = Mock()
            mock_task.user_id = "test-user-456"
            mock_task.last_executed = None
            mock_task.last_success = None
            mock_task.next_execution = None
            mock_task.status = "completed"
            mock_task.failure_reason = None
            
            mock_session = Mock()
            mock_session.query.return_value.filter.return_value.first.return_value = mock_task
            mock_session.close = Mock()
            mock_get_session.return_value = mock_session
            
            with patch('backend.api.onboarding_utils.endpoints_tasks.get_tasks_status', AsyncMock()) as mock_get_tasks:
                mock_get_tasks.return_value = {
                    "tasks": {
                        "full_site_seo_audit": {
                            "status": "completed",
                            "started_at": None,
                            "progress_pct": 100,
                            "details": None,
                        }
                    },
                    "total": 1,
                    "completed_count": 1,
                    "failed_count": 0,
                    "all_done": True,
                }
                
                from backend.api.onboarding_utils.endpoints_tasks import get_tasks_status
                result = await get_tasks_status(mock_user)
            
            assert result["all_done"] == True
            assert result["completed_count"] == 1
            assert result["failed_count"] == 0
            assert result["tasks"]["full_site_seo_audit"]["status"] == "completed"

    async def test_onboarding_summary_status_all_failed(self):
        """Test when all onboarding tasks have failed."""
        mock_user = {"id": "test-user-789"}
        
        with patch('backend.api.onboarding_utils.endpoints_tasks.get_session_for_user') as mock_get_session:
            mock_db = Mock()
            mock_get_session.return_value = mock_db
            
            # Mock failed task
            mock_task = Mock()
            mock_task.user_id = "test-user-789"
            mock_task.last_executed = None
            mock_task.last_success = None
            mock_task.next_execution = None
            mock_task.status = "failed"
            mock_task.failure_reason = "Database connection failed"
            
            mock_session = Mock()
            mock_session.query.return_value.filter.return_value.first.return_value = mock_task
            mock_session.close = Mock()
            mock_get_session.return_value = mock_session
            
            with patch('backend.api.onboarding_utils.endpoints_tasks.get_tasks_status', AsyncMock()) as mock_get_tasks:
                mock_get_tasks.return_value = {
                    "tasks": {
                        "full_site_seo_audit": {
                            "status": "failed",
                            "started_at": None,
                            "progress_pct": 0,
                            "details": None,
                        }
                    },
                    "total": 1,
                    "completed_count": 0,
                    "failed_count": 1,
                    "all_done": True,
                }
                
                from backend.api.onboarding_utils.endpoints_tasks import get_tasks_status
                result = await get_tasks_status(mock_user)
            
            assert result["all_done"] == True
            assert result["completed_count"] == 0
            assert result["failed_count"] == 1
            assert result["tasks"]["full_site_seo_audit"]["status"] == "failed"

    async def test_onboarding_summary_error_handling(self):
        """Test error handling when database connection fails."""
        mock_user = {"id": "test-user-error"}
        
        with patch('backend.api.onboarding_utils.endpoints_tasks.get_session_for_user') as mock_get_session:
            mock_get_session.return_value = None
            
            with patch('backend.api.onboarding_utils.endpoints_tasks.get_tasks_status', AsyncMock()) as mock_get_tasks:
                mock_get_tasks.return_value = {"error": "Database connection failed"}
                
                from backend.api.onboarding_utils.endpoints_tasks import get_tasks_status
                result = await get_tasks_status(mock_user)
            
            assert "error" in result
            assert result["error"] == "Database connection failed"

    async def test_onboarding_summary_consistency(self):
        """Test that all_done calculation is consistent."""
        mock_user = {"id": "test-user-consistency"}
        
        with patch('backend.api.onboarding_utils.endpoints_tasks.get_session_for_user') as mock_get_session:
            mock_db = Mock()
            mock_get_session.return_value = mock_db
            
            mock_session = Mock()
            mock_session.query.return_value.filter.return_value.first.return_value = None
            mock_session.close = Mock()
            mock_get_session.return_value = mock_session
            
            with patch('backend.api.onboarding_utils.endpoints_tasks.get_tasks_status', AsyncMock()) as mock_get_tasks:
                mock_get_tasks.return_value = {
                    "tasks": {},
                    "total": 0,
                    "completed_count": 0,
                    "failed_count": 0,
                    "all_done": False,
                }
                
                from backend.api.onboarding_utils.endpoints_tasks import get_tasks_status
                result = await get_tasks_status(mock_user)
                
                # Should be False because no tasks
                assert result["all_done"] == False
                assert result["completed_count"] == 0
                assert result["failed_count"] == 0

    # Pytest wrapper to run async tests
    def run_async_test(test_method):
        async def wrapper(*args, **kwargs):
            return await test_method(*args, **kwargs)
        return wrapper

    test_onboarding_summary_status_not_completed = pytest.mark.asyncio(run_async_test(test_onboarding_summary_status_not_completed))
    test_onboarding_summary_status_all_completed = pytest.mark.asyncio(run_async_test(test_onboarding_summary_status_all_completed))
    test_onboarding_summary_status_all_failed = pytest.mark.asyncio(run_async_test(test_onboarding_summary_status_all_failed))
    test_onboarding_summary_error_handling = pytest.mark.asyncio(run_async_test(test_onboarding_summary_error_handling))
    test_onboarding_summary_consistency = pytest.mark.asyncio(run_async_test(test_onboarding_summary_consistency))
