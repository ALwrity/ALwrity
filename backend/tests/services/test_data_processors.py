"""
Tests for Content Strategy Data Processors - Critical Bug Fix Validation

Tests verify that get_onboarding_data uses the correct AutoFillService method.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))


class TestDataProcessorService:
    """Test DataProcessorService onboarding data retrieval."""
    
    @pytest.mark.asyncio
    async def test_get_onboarding_data_uses_generate_method(self):
        """
        CRITICAL TEST: Verify get_onboarding_data calls service.generate()
        not the non-existent service.get_autofill()
        
        This test validates the fix for the bug where:
        - service.get_autofill(user_id) was called (method doesn't exist)
        - Should be: service.generate(user_id)
        """
        from api.content_planning.services.content_strategy.utils.data_processors import DataProcessorService
        
        with patch('services.database.get_db_session') as mock_db:
            mock_db.return_value = MagicMock()
            
            with patch('api.content_planning.services.content_strategy.autofill.AutoFillService') as MockAutoFill:
                mock_service = MagicMock()
                mock_service.generate = AsyncMock(return_value={"fields": {"test": "value"}})
                MockAutoFill.return_value = mock_service
                
                processor = DataProcessorService()
                result = await processor.get_onboarding_data("user_test_123")
                
                # Critical assertion: generate() should be called, NOT get_autofill()
                mock_service.generate.assert_called_once_with("user_test_123")
                
                # Verify result is returned
                assert result is not None
                assert "fields" in result

    @pytest.mark.asyncio
    async def test_get_onboarding_data_returns_fields(self):
        """
        Verify get_onboarding_data returns valid payload structure.
        
        Expected structure:
        {
            "fields": {...},
            "sources": {...},
            "quality_scores": {...},
            "confidence_levels": {...},
            "data_freshness": {...}
        }
        """
        from api.content_planning.services.content_strategy.utils.data_processors import DataProcessorService
        
        expected_fields = {
            "fields": {"business_objectives": {"value": "Test"}},
            "sources": {"business_objectives": "website_analysis"},
            "quality_scores": {"overall": 0.8},
            "confidence_levels": {"business_objectives": "high"},
            "data_freshness": {"fresh": True}
        }
        
        with patch('services.database.get_db_session') as mock_db:
            mock_db.return_value = MagicMock()
            
            with patch('api.content_planning.services.content_strategy.autofill.AutoFillService') as MockAutoFill:
                mock_service = MagicMock()
                mock_service.generate = AsyncMock(return_value=expected_fields)
                MockAutoFill.return_value = mock_service
                
                processor = DataProcessorService()
                result = await processor.get_onboarding_data("user_test_123")
                
                # Verify all expected keys are present
                assert "fields" in result
                assert "sources" in result
                assert "quality_scores" in result
                assert "confidence_levels" in result
                assert "data_freshness" in result

    @pytest.mark.asyncio
    async def test_get_onboarding_data_error_handling(self):
        """
        Verify proper error handling when AutoFillService.generate() fails.
        """
        from api.content_planning.services.content_strategy.utils.data_processors import DataProcessorService
        
        with patch('services.database.get_db_session') as mock_db:
            mock_db.return_value = MagicMock()
            
            with patch('api.content_planning.services.content_strategy.autofill.AutoFillService') as MockAutoFill:
                mock_service = MagicMock()
                # Simulate generate() raising an exception
                mock_service.generate = AsyncMock(side_effect=RuntimeError("Database connection failed"))
                MockAutoFill.return_value = mock_service
                
                processor = DataProcessorService()
                
                # Should propagate the error
                with pytest.raises(RuntimeError, match="Database connection failed"):
                    await processor.get_onboarding_data("user_test_123")


class TestDataProcessorServiceBackwardCompatibility:
    """Test backward compatible standalone functions."""
    
    @pytest.mark.asyncio
    async def test_standalone_get_onboarding_data_function(self):
        """
        Test the standalone get_onboarding_data function works correctly.
        This function is used by other parts of the system.
        """
        from api.content_planning.services.content_strategy.utils.data_processors import get_onboarding_data
        
        mock_payload = {
            "fields": {"test_field": {"value": "test_value"}},
            "sources": {},
            "quality_scores": {},
            "confidence_levels": {},
            "data_freshness": {}
        }
        
        with patch('api.content_planning.services.content_strategy.utils.data_processors.DataProcessorService') as MockProcessor:
            mock_instance = AsyncMock()
            mock_instance.get_onboarding_data = AsyncMock(return_value=mock_payload)
            MockProcessor.return_value = mock_instance
            
            result = await get_onboarding_data("user_test_456")
            
            # Verify the processor was called with correct user_id
            mock_instance.get_onboarding_data.assert_called_once_with("user_test_456")
            
            # Verify result
            assert result == mock_payload


# Run tests with: pytest tests/services/test_data_processors.py -v
