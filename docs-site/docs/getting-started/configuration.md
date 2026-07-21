# Configuration Guide

This guide will help you configure ALwrity with your API keys, settings, and preferences to get the most out of your AI-powered content creation platform.

## Overview

ALwrity requires configuration of several components to function optimally:

- **AI Service API Keys**: Core AI capabilities
- **Research & SEO Services**: Enhanced content research
- **Authentication**: User management and security
- **Database**: Data storage and management
- **Frontend Settings**: User interface configuration

## Backend Configuration

### Environment Variables

The backend configuration is managed through environment variables in the `.env` file located in the `backend/` directory.

#### Core AI Services (Required)

```env
# Google Gemini API - Primary AI service
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI API - Alternative AI service
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic API - Claude AI service
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

#### Database Configuration

```env
# Database URL - SQLite for development, PostgreSQL for production
DATABASE_URL=sqlite:///./alwrity.db

# For PostgreSQL production setup:
# DATABASE_URL=postgresql://username:password@localhost:5432/alwrity
```

#### Security Settings

```env
# Secret key for JWT tokens and encryption
SECRET_KEY=your_very_secure_secret_key_here

# Generate a secure key:
# python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Research & SEO Services (Optional but Recommended)

#### Web Search & Research

```env
# Tavily API - Advanced web search and research
TAVILY_API_KEY=your_tavily_api_key_here

# Serper API - Google search results
SERPER_API_KEY=your_serper_api_key_here

# Metaphor API - Content discovery
METAPHOR_API_KEY=your_metaphor_api_key_here

# Firecrawl API - Web scraping and content extraction
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

#### SEO & Analytics

```env
# Google Search Console integration
GSC_CLIENT_ID=your_gsc_client_id_here
GSC_CLIENT_SECRET=your_gsc_client_secret_here

# Google Analytics (if needed)
GA_TRACKING_ID=your_ga_tracking_id_here
```

#### Content Generation

```env
# Stability AI - Image generation
STABILITY_API_KEY=your_stability_api_key_here

# Additional AI services
MISTRAL_API_KEY=your_mistral_api_key_here
```

### Authentication & Integration

```env
# Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key_here

# CopilotKit Integration
COPILOT_API_KEY=your_copilot_api_key_here

# Webhook URLs (for production)
WEBHOOK_URL=your_webhook_url_here
```

## Frontend Configuration

### Environment Variables

The frontend configuration is managed through environment variables in the `.env` file located in the `frontend/` directory.

#### Core Settings

```env
# Backend API URL
REACT_APP_API_URL=http://localhost:8000

# For production:
# REACT_APP_API_URL=https://your-domain.com

# Environment
NODE_ENV=development
```

#### Authentication

```env
# Clerk Authentication
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here

# Google OAuth (if using)
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here
```

#### AI Integration

```env
# CopilotKit
REACT_APP_COPILOT_API_KEY=your_copilot_api_key_here

# Additional AI services
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

#### SEO & Analytics

```env
# Google Search Console
REACT_APP_GSC_CLIENT_ID=your_gsc_client_id_here

# Google Analytics
REACT_APP_GA_TRACKING_ID=your_ga_tracking_id_here
```

## API Keys Setup

### 1. Google Gemini API

**Purpose**: Primary AI service for content generation and analysis

**Setup Steps**:
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key
5. Add to `GEMINI_API_KEY` in backend `.env`

**Usage Limits**:
- Free tier: 15 requests per minute
- Paid tier: Higher limits available

### 2. OpenAI API

**Purpose**: Alternative AI service for content generation

**Setup Steps**:
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in to your account
3. Click "Create new secret key"
4. Copy the generated key
5. Add to `OPENAI_API_KEY` in backend `.env`

**Usage Limits**:
- Pay-per-use model
- Rate limits based on your plan

### 3. Anthropic API

**Purpose**: Claude AI for advanced reasoning and analysis

**Setup Steps**:
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign in to your account
3. Navigate to API Keys
4. Create a new API key
5. Add to `ANTHROPIC_API_KEY` in backend `.env`

### 4. Tavily API

**Purpose**: Advanced web search and research capabilities

**Setup Steps**:
1. Visit [Tavily](https://tavily.com/)
2. Sign up for an account
3. Navigate to API section
4. Generate API key
5. Add to `TAVILY_API_KEY` in backend `.env`

**Benefits**:
- Real-time web search
- Content summarization
- Source verification

### 5. Serper API

**Purpose**: Google search results and SEO data

**Setup Steps**:
1. Visit [Serper](https://serper.dev/)
2. Sign up for an account
3. Get your API key
4. Add to `SERPER_API_KEY` in backend `.env`

**Benefits**:
- Google search results
- SEO data and insights
- Keyword research

### 6. Google Search Console

**Purpose**: SEO analysis and performance tracking

**Setup Steps**:
1. Visit [Google Search Console](https://search.google.com/search-console/)
2. Add your website property
3. Go to Settings → Users and permissions
4. Create OAuth credentials
5. Add client ID and secret to `.env`

**Benefits**:
- Real search performance data
- Keyword insights
- Technical SEO analysis

### 7. Clerk Authentication

**Purpose**: User authentication and management

**Setup Steps**:
1. Visit [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application
3. Get your publishable and secret keys
4. Add to frontend and backend `.env` files

**Benefits**:
- Secure user authentication
- Social login options
- User management

### 8. CopilotKit

**Purpose**: AI chat interface and interactions

**Setup Steps**:
1. Visit [CopilotKit](https://copilotkit.ai/)
2. Sign up for an account
3. Get your API key
4. Add to `COPILOT_API_KEY` in both `.env` files

**Benefits**:
- Interactive AI chat
- Context-aware responses
- Seamless user experience

## Database Configuration

### SQLite (Development)

**Default Configuration**:
```env
DATABASE_URL=sqlite:///./alwrity.db
```

**Benefits**:
- No additional setup required
- Perfect for development
- File-based storage

### PostgreSQL (Production)

**Setup Steps**:
1. Install PostgreSQL
2. Create database and user
3. Update environment variable:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/alwrity
```

**Benefits**:
- Better performance
- Concurrent access
- Advanced features

### Database Initialization

```bash
# Initialize database with default data
python -c "from services.database import initialize_database; initialize_database()"
```

## Security Configuration

### Secret Key Generation

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Environment Security

**Best Practices**:
- Never commit `.env` files to version control
- Use different keys for development and production
- Rotate API keys regularly
- Monitor API usage and costs

### CORS Configuration

The backend automatically configures CORS for development. For production, update the CORS settings in `backend/app.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],  # Production domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Performance Configuration

### Backend Optimization

```env
# Worker processes (for production)
WORKERS=4

# Request timeout
REQUEST_TIMEOUT=30

# Database connection pool
DB_POOL_SIZE=10
```

### Frontend Optimization

```env
# Enable production optimizations
NODE_ENV=production

# Bundle analyzer
ANALYZE_BUNDLE=true

# Source maps (disable for production)
GENERATE_SOURCEMAP=false
```

## Monitoring & Logging

### Logging Configuration

```env
# Log level
LOG_LEVEL=INFO

# Log file
LOG_FILE=logs/alwrity.log

# Enable request logging
ENABLE_REQUEST_LOGGING=true
```

### Health Checks

```bash
# Backend health check
curl http://localhost:8000/health

# Database health check
curl http://localhost:8000/health/db

# API health check
curl http://localhost:8000/health/api
```

## Configuration Validation

### Test Configuration

```bash
# Test backend configuration
python -c "from services.api_key_manager import validate_api_keys; validate_api_keys()"

# Test database connection
python -c "from services.database import test_connection; test_connection()"

# Test API endpoints
curl http://localhost:8000/api/health
```

### Configuration Checklist

- [ ] All required API keys are set
- [ ] Database is initialized
- [ ] Backend server starts without errors
- [ ] Frontend connects to backend
- [ ] Authentication is working (if configured)
- [ ] API endpoints are accessible
- [ ] Health checks pass

## Troubleshooting Configuration

### Common Issues

**API Key Errors**:
- Verify keys are correctly copied
- Check for extra spaces or characters
- Ensure keys have proper permissions

**Database Connection Issues**:
- Verify database URL format
- Check database server is running
- Ensure proper permissions

**CORS Errors**:
- Check frontend URL in CORS settings
- Verify backend is running on correct port
- Check for HTTPS/HTTP mismatch

**Authentication Issues**:
- Verify Clerk keys are correct
- Check domain configuration in Clerk
- Ensure proper redirect URLs

### Getting Help

If you encounter configuration issues:

1. **Check Logs**: Review console output for error messages
2. **Validate Keys**: Test API keys individually
3. **Verify URLs**: Ensure all URLs are correct
4. **Check Permissions**: Verify API key permissions
5. **Review Documentation**: Check service-specific documentation

## Next Steps

After successful configuration:

1. **[First Steps](first-steps.md)** - Create your first content strategy
2. **[Quick Start](quick-start.md)** - Get up and running quickly
3. **[Troubleshooting Guide](../guides/troubleshooting.md)** - Common issues and solutions
4. **[API Reference](../api/overview.md)** - Complete API documentation

---

*Configuration complete? [Start creating content](first-steps.md) with your newly configured ALwrity platform!*
