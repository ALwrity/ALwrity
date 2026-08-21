"""
Onboarding Services Package

This package contains all onboarding-related services and utilities.
All onboarding data is stored in the database with proper user isolation.

Services:
- OnboardingDataIntegrationService: Canonical SSOT for onboarding data
- OnboardingProgressService: Progress tracking and step management
- APIKeyManager: API key management


Architecture:
- Database-first: All data stored in PostgreSQL with proper foreign keys
- User isolation: Each user's data is completely separate
- No file storage: Removed all JSON file operations for production scalability
- Local development: API keys still written to .env for convenience
"""

# Import all public classes for easy access
from .progress_service import OnboardingProgressService
from .api_key_manager import APIKeyManager

__all__ = [
    'OnboardingProgressService', 
    'APIKeyManager'
]
