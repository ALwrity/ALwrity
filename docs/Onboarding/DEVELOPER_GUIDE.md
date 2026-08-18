# ALwrity Onboarding System - Developer Guide

## Architecture Overview

The ALwrity Onboarding System is built with a modular, service-based architecture that separates concerns and promotes maintainability. The system is designed to handle user isolation, progressive setup, and comprehensive onboarding workflows.

## 🏗️ System Architecture

### Core Components

```
backend/api/onboarding_utils/
├── __init__.py                           # Package initialization
├── onboarding_completion_service.py      # Final onboarding completion logic
├── onboarding_summary_service.py        # Comprehensive summary generation
├── onboarding_config_service.py         # Configuration and provider management
├── business_info_service.py             # Business information CRUD operations
├── api_key_management_service.py       # API key operations and validation
├── step_management_service.py          # Step progression and validation
├── onboarding_control_service.py        # Onboarding session management
├── persona_management_service.py        # Persona generation and management
├── README.md                            # End-user documentation
└── DEVELOPER_GUIDE.md                   # This file
```

### Service Responsibilities

#### 1. OnboardingCompletionService
**Purpose**: Handles the complex logic for completing the onboarding process
**Key Methods**:
- `complete_onboarding()` - Main completion logic with validation
- `_validate_required_steps()` - Ensures all required steps are completed
- `_validate_api_keys()` - Validates API key configuration
- `_generate_persona_from_onboarding()` - Generates writing persona

#### 2. OnboardingSummaryService
**Purpose**: Generates comprehensive onboarding summaries for the final step
**Key Methods**:
- `get_onboarding_summary()` - Main summary generation
- `_get_api_keys()` - Retrieves configured API keys
- `_get_website_analysis()` - Gets website analysis data
- `_get_research_preferences()` - Retrieves research preferences
- `_check_persona_readiness()` - Validates persona generation readiness

#### 3. OnboardingConfigService
**Purpose**: Manages onboarding configuration and provider setup information
**Key Methods**:
- `get_onboarding_config()` - Returns complete onboarding configuration
- `get_provider_setup_info()` - Provider-specific setup information
- `get_all_providers_info()` - All available providers
- `validate_provider_key()` - API key validation
- `get_enhanced_validation_status()` - Comprehensive validation status

#### 4. BusinessInfoService
**Purpose**: Handles business information management for users without websites
**Key Methods**:
- `save_business_info()` - Create new business information
- `get_business_info()` - Retrieve by ID
- `get_business_info_by_user()` - Retrieve by user ID
- `update_business_info()` - Update existing information

#### 5. APIKeyManagementService
**Purpose**: Manages API key operations with caching and security
**Key Methods**:
- `get_api_keys()` - Retrieves masked API keys with caching
- `save_api_key()` - Saves new API keys securely
- `validate_api_keys()` - Validates all configured keys

#### 6. StepManagementService
**Purpose**: Controls step progression and validation
**Key Methods**:
- `get_onboarding_status()` - Current onboarding status
- `get_onboarding_progress_full()` - Complete progress data
- `get_step_data()` - Specific step information
- `complete_step()` - Mark step as completed with environment setup
- `skip_step()` - Skip optional steps
- `validate_step_access()` - Validate step accessibility

#### 7. OnboardingControlService
**Purpose**: Manages onboarding session control
**Key Methods**:
- `start_onboarding()` - Initialize new onboarding session
- `reset_onboarding()` - Reset onboarding progress
- `get_resume_info()` - Resume information for incomplete sessions

#### 8. PersonaManagementService (removed)
> Deprecated and removed during the Brand Brain E.4 migration. Persona generation
> now flows through `api/onboarding_utils/step4_persona_routes.py`
> (`generate_writing_personas` / `generate_writing_personas_async`) and reads/writes
> `PersonaData` via `services/persona_data_service.py`. The legacy
> `check_persona_generation_readiness`, `generate_persona_preview`,
> `generate_writing_persona`, and `get_user_writing_personas` endpoints no longer exist.

## 🔧 Integration Points

### Progressive Setup Integration

The onboarding system integrates with the progressive setup service:

```python
# In step_management_service.py
from services.progressive_setup_service import ProgressiveSetupService

# Initialize/upgrade user environment based on new step
if step_number == 1:
    setup_service.initialize_user_environment(user_id)
else:
    setup_service.upgrade_user_environment(user_id, step_number)
```

### User Isolation

Each user gets their own:
- **Workspace**: `lib/workspace/users/user_<id>/`
- **Database Tables**: `user_<id>_*` tables
- **Configuration**: User-specific settings
- **Progress**: Individual onboarding progress

### Authentication Integration

All services require authentication:

```python
from middleware.auth_middleware import get_current_user

async def endpoint_function(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = str(current_user.get('id'))
    # Service logic here
```

## 📊 Data Flow

### 1. Onboarding Initialization
```
User Login → Authentication → Check Onboarding Status → Redirect to Appropriate Step
```

### 2. Step Completion
```
User Completes Step → Validate Step → Save Progress → Setup User Environment → Return Success
```

### 3. Environment Setup
```
Step Completed → Progressive Setup Service → User Workspace Creation → Feature Activation
```

### 4. Final Completion
```
All Steps Complete → Validation → Persona Generation → Environment Finalization → Onboarding Complete
```

## 🛠️ Development Guidelines

### Adding New Services

1. **Create Service Class**:
```python
class NewService:
    def __init__(self):
        # Initialize dependencies
    
    async def main_method(self, params):
        # Main functionality
        pass
```

2. **Update __init__.py**:
```python
from .new_service import NewService

__all__ = [
    # ... existing services
    'NewService'
]
```

3. **Update Main Onboarding File**:
```python
async def new_endpoint():
    try:
        from onboarding_utils.new_service import NewService
        
        service = NewService()
        return await service.main_method()
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### Error Handling Pattern

All services follow a consistent error handling pattern:

```python
try:
    # Service logic
    return result
except HTTPException:
    raise  # Re-raise HTTP exceptions
except Exception as e:
    logger.error(f"Error in service: {str(e)}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

### Logging Guidelines

Use structured logging with context:

```python
logger.info(f"[service_name] Action for user {user_id}")
logger.success(f"✅ Operation completed for user {user_id}")
logger.warning(f"⚠️ Non-critical issue: {issue}")
logger.error(f"❌ Error in operation: {str(e)}")
```

## 🧪 Testing

### Unit Testing

Each service should have comprehensive unit tests:

```python
import pytest
from onboarding_utils.step_management_service import StepManagementService

class TestStepManagementService:
    def setup_method(self):
        self.service = StepManagementService()
    
    async def test_get_onboarding_status(self):
        # Test implementation
        pass
```

### Integration Testing

Test service interactions:

```python
async def test_complete_onboarding_flow():
    # Test complete onboarding workflow
    pass
```

## 🔒 Security Considerations

### API Key Security
- Keys are masked in responses
- Encryption before storage
- Secure transmission only

### User Data Isolation
- User-specific workspaces
- Isolated database tables
- No cross-user data access

### Input Validation
- Validate all user inputs
- Sanitize data before processing
- Use Pydantic models for validation

## 📈 Performance Optimization

### Caching Strategy
- API key responses cached for 30 seconds
- User progress cached in memory
- Database queries optimized

### Database Optimization
- User-specific table indexing
- Efficient query patterns
- Connection pooling

### Resource Management
- Proper database session handling
- Memory-efficient data processing
- Background task optimization

## 🚀 Deployment Considerations

### Environment Variables
```bash
# Required for onboarding
CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
GEMINI_API_KEY=your_gemini_key
EXA_API_KEY=your_exa_key
COPILOTKIT_API_KEY=your_copilotkit_key
```

### Database Setup
- User-specific tables created on demand
- Progressive table creation based on onboarding progress
- Automatic cleanup on user deletion

### Monitoring
- Track onboarding completion rates
- Monitor step abandonment points
- Performance metrics for each service

## 🔄 Maintenance

### Regular Tasks
- Review and update API key validation
- Monitor service performance
- Update documentation
- Clean up abandoned onboarding sessions

### Version Updates
- Maintain backward compatibility
- Gradual feature rollouts
- User migration strategies

## 📚 Additional Resources

### Related Documentation
- [User Environment Setup](../services/user_workspace_manager.py)
- [Progressive Setup Service](../services/progressive_setup_service.py)
- [Authentication Middleware](../middleware/auth_middleware.py)

### External Dependencies
- FastAPI for API framework
- SQLAlchemy for database operations
- Pydantic for data validation
- Loguru for logging

---

*This developer guide provides comprehensive information for maintaining and extending the ALwrity Onboarding System. For questions or contributions, please refer to the main project documentation.*
