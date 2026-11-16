# Content Planning API - Modular Architecture

## Overview

The Content Planning API has been refactored from a monolithic structure into a modular, maintainable architecture. This document provides comprehensive documentation for the new modular structure.

## Architecture

```
backend/api/content_planning/
├── __init__.py
├── api/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── strategies.py          # Strategy management endpoints
│   │   ├── calendar_events.py     # Calendar event endpoints
│   │   ├── gap_analysis.py        # Content gap analysis endpoints
│   │   ├── ai_analytics.py        # AI analytics endpoints
│   │   ├── calendar_generation.py # Calendar generation endpoints
│   │   └── health_monitoring.py   # Health monitoring endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── requests.py            # Request models
│   │   └── responses.py           # Response models
│   └── router.py                  # Main router
├── services/
│   ├── __init__.py
│   ├── strategy_service.py        # Strategy business logic
│   ├── calendar_service.py        # Calendar business logic
│   ├── gap_analysis_service.py    # Gap analysis business logic
│   ├── ai_analytics_service.py    # AI analytics business logic
│   └── calendar_generation_service.py # Calendar generation business logic
├── utils/
│   ├── __init__.py
│   ├── error_handlers.py          # Centralized error handling
│   ├── response_builders.py       # Response formatting
│   └── constants.py               # API constants
└── tests/
    ├── __init__.py
    ├── functionality_test.py      # Functionality tests
    ├── before_after_test.py      # Before/after comparison tests
    └── test_data.py              # Test data fixtures
```

## API Endpoints

### Base URL
```
/api/content-planning
```

### Health Check
```
GET /health
```
Returns the operational status of all content planning modules.

### Strategy Management

#### Create Strategy
```
POST /strategies/
```
Creates a new content strategy.

**Request Body:**
```json
{
  "user_id": 1,
  "name": "Digital Marketing Strategy",
  "industry": "technology",
  "target_audience": {
    "demographics": ["professionals", "business_owners"],
    "interests": ["digital_marketing", "content_creation"]
  },
  "content_pillars": [
    {
      "name": "Educational Content",
      "description": "How-to guides and tutorials"
    }
  ]
}
```

#### Get Strategies
```
GET /strategies/?user_id=1
```
Retrieves content strategies for a user.

#### Get Strategy by ID
```
GET /strategies/{strategy_id}
```
Retrieves a specific strategy by ID.

#### Update Strategy
```
PUT /strategies/{strategy_id}
```
Updates an existing strategy.

#### Delete Strategy
```
DELETE /strategies/{strategy_id}
```
Deletes a strategy.

### Calendar Events

#### Create Calendar Event
```
POST /calendar-events/
```
Creates a new calendar event.

**Request Body:**
```json
{
  "strategy_id": 1,
  "title": "Blog Post: AI in Marketing",
  "description": "Comprehensive guide on AI applications in marketing",
  "content_type": "blog",
  "platform": "website",
  "scheduled_date": "2024-08-15T10:00:00Z"
}
```

#### Get Calendar Events
```
GET /calendar-events/?strategy_id=1
```
Retrieves calendar events, optionally filtered by strategy.

#### Get Calendar Event by ID
```
GET /calendar-events/{event_id}
```
Retrieves a specific calendar event.

#### Update Calendar Event
```
PUT /calendar-events/{event_id}
```
Updates an existing calendar event.

#### Delete Calendar Event
```
DELETE /calendar-events/{event_id}
```
Deletes a calendar event.

### Content Gap Analysis

#### Get Gap Analysis
```
GET /gap-analysis/?user_id=1&force_refresh=false
```
Retrieves content gap analysis with AI insights.

**Query Parameters:**
- `user_id`: User ID (optional, defaults to 1)
- `strategy_id`: Strategy ID (optional)
- `force_refresh`: Force refresh analysis (default: false)

#### Create Gap Analysis
```
POST /gap-analysis/
```
Creates a new content gap analysis.

**Request Body:**
```json
{
  "user_id": 1,
  "website_url": "https://example.com",
  "competitor_urls": ["https://competitor1.com", "https://competitor2.com"],
  "target_keywords": ["digital marketing", "content creation"],
  "industry": "technology"
}
```

#### Analyze Content Gaps
```
POST /gap-analysis/analyze
```
Performs comprehensive content gap analysis.

**Request Body:**
```json
{
  "website_url": "https://example.com",
  "competitor_urls": ["https://competitor1.com"],
  "target_keywords": ["digital marketing"],
  "industry": "technology"
}
```

### AI Analytics

#### Get AI Analytics
```
GET /ai-analytics/?user_id=1&force_refresh=false
```
Retrieves AI-powered analytics and insights.

**Query Parameters:**
- `user_id`: User ID (optional, defaults to 1)
- `strategy_id`: Strategy ID (optional)
- `force_refresh`: Force refresh analysis (default: false)

#### Content Evolution Analysis
```
POST /ai-analytics/content-evolution
```
Analyzes content evolution over time.

**Request Body:**
```json
{
  "strategy_id": 1,
  "time_period": "30d"
}
```

#### Performance Trends Analysis
```
POST /ai-analytics/performance-trends
```
Analyzes performance trends.

**Request Body:**
```json
{
  "strategy_id": 1,
  "metrics": ["engagement_rate", "reach", "conversion_rate"]
}
```

#### Strategic Intelligence
```
POST /ai-analytics/strategic-intelligence
```
Generates strategic intelligence insights.

**Request Body:**
```json
{
  "strategy_id": 1,
  "market_data": {
    "industry_trends": ["AI adoption", "Digital transformation"],
    "competitor_analysis": ["competitor1.com", "competitor2.com"]
  }
}
```

### Calendar Generation

#### Generate Comprehensive Calendar
```
POST /calendar-generation/generate-calendar
```
Generates a comprehensive AI-powered content calendar.

**Request Body:**
```json
{
  "user_id": 1,
  "strategy_id": 1,
  "calendar_type": "monthly",
  "industry": "technology",
  "business_size": "sme",
  "force_refresh": false
}
```

#### Optimize Content for Platform
```
POST /calendar-generation/optimize-content
```
Optimizes content for specific platforms.

**Request Body:**
```json
{
  "user_id": 1,
  "title": "AI Marketing Guide",
  "description": "Comprehensive guide on AI in marketing",
  "content_type": "blog",
  "target_platform": "linkedin"
}
```

#### Predict Content Performance
```
POST /calendar-generation/performance-predictions
```
Predicts content performance using AI.

**Request Body:**
```json
{
  "user_id": 1,
  "strategy_id": 1,
  "content_type": "blog",
  "platform": "linkedin",
  "content_data": {
    "title": "AI Marketing Guide",
    "description": "Comprehensive guide on AI in marketing"
  }
}
```

#### Get Trending Topics
```
GET /calendar-generation/trending-topics?user_id=1&industry=technology&limit=10
```
Retrieves trending topics relevant to the user's industry.

**Query Parameters:**
- `user_id`: User ID (required)
- `industry`: Industry (required)
- `limit`: Number of topics to return (default: 10)

#### Get Comprehensive User Data
```
GET /calendar-generation/comprehensive-user-data?user_id=1
```
Retrieves comprehensive user data for calendar generation.

**Query Parameters:**
- `user_id`: User ID (required)

### Health Monitoring

#### Backend Health Check
```
GET /health/backend
```
Checks core backend health (independent of AI services).

#### AI Services Health Check
```
GET /health/ai
```
Checks AI services health separately.

#### Public Database Status
```
GET /health/database
```
Returns HTTP 503 with `status: "not_verified"`. This public endpoint does not inspect a tenant database or verify live database connectivity. Use the authenticated tenant-scoped check below for that.

#### Authenticated Tenant Database Health Check
```
GET /api/content-planning/health/database
```
Checks connectivity and operations for the authenticated tenant's database. The basic public `GET /health` endpoint reports process liveness only; it does not check workspace storage or tenant database health. Startup workspace checks are separate snapshots and do not verify live tenant database connectivity.

#### Calendar Generation Health Check
```
GET /calendar-generation/health
```
Checks calendar generation services health.

## Response Formats

### Success Response
```json
{
  "status": "success",
  "data": {...},
  "message": "Operation completed successfully",
  "timestamp": "2024-08-01T10:00:00Z"
}
```

### Error Response
```json
{
  "status": "error",
  "error": "Error description",
  "message": "Detailed error message",
  "timestamp": "2024-08-01T10:00:00Z"
}
```

### Health Check Response
```json
{
  "service": "content_planning",
  "status": "healthy",
  "timestamp": "2024-08-01T10:00:00Z",
  "modules": {
    "strategies": "operational",
    "calendar_events": "operational",
    "gap_analysis": "operational",
    "ai_analytics": "operational",
    "calendar_generation": "operational",
    "health_monitoring": "operational"
  },
  "version": "2.0.0",
  "architecture": "modular"
}
```

## Error Codes

- `200`: Success
- `400`: Bad Request - Invalid input data
- `404`: Not Found - Resource not found
- `422`: Validation Error - Request validation failed
- `500`: Internal Server Error - Server-side error
- `503`: Service Unavailable - AI services unavailable

## Authentication

All endpoints require proper authentication. Include authentication headers as required by your application.

## Rate Limiting

API requests are subject to rate limiting to ensure fair usage and system stability.

## Caching

The API implements intelligent caching for:
- AI analysis results (24-hour cache)
- User data and preferences
- Strategy and calendar data

## Versioning

Current API version: `2.0.0`

The API follows semantic versioning. Breaking changes will be communicated in advance.

## Migration from Monolithic Structure

The API has been migrated from a monolithic structure to a modular architecture. Key improvements:

1. **Separation of Concerns**: Business logic separated from API routes
2. **Service Layer**: Dedicated services for each domain
3. **Error Handling**: Centralized and standardized error handling
4. **Performance**: Optimized imports and dependencies
5. **Maintainability**: Smaller, focused modules
6. **Testability**: Isolated components for better testing

## Support

For API support and questions, please refer to the project documentation or contact the development team. 