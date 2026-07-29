# Installation Guide

This comprehensive guide will walk you through installing and setting up ALwrity on your system. Follow these steps to get your AI-powered content creation platform running.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Python**: Version 3.10 or higher
- **Node.js**: Version 18 or higher
- **Git**: Latest version for version control
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: At least 2GB free disk space

### Required Software

#### 1. Python 3.10+
```bash
# Check if Python is installed
python --version

# If not installed, download from: https://www.python.org/downloads/
# Or use package manager:
# Windows: choco install python
# macOS: brew install python
# Ubuntu: sudo apt install python3.10
```

#### 2. Node.js 18+
```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed, download from: https://nodejs.org/
# Or use package manager:
# Windows: choco install nodejs
# macOS: brew install node
# Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
```

#### 3. Git
```bash
# Check if Git is installed
git --version

# If not installed, download from: https://git-scm.com/
# Or use package manager:
# Windows: choco install git
# macOS: brew install git
# Ubuntu: sudo apt install git
```

## Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the ALwrity repository
git clone https://github.com/AJaySi/ALwrity.git

# Navigate to the project directory
cd ALwrity
```

### Step 2: Backend Setup

#### 2.1 Install Python Dependencies

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 2.2 Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Create environment file
touch .env  # Linux/macOS
# or
type nul > .env  # Windows
```

Add the following configuration to your `.env` file:

```env
# AI Service API Keys (Required)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Database Configuration
DATABASE_URL=sqlite:///./alwrity.db

# Security
SECRET_KEY=your_secret_key_here

# Optional: Additional AI Services
TAVILY_API_KEY=your_tavily_api_key_here
SERPER_API_KEY=your_serper_api_key_here
METAPHOR_API_KEY=your_metaphor_api_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
STABILITY_API_KEY=your_stability_api_key_here

# Optional: Google Search Console
GSC_CLIENT_ID=your_gsc_client_id_here
GSC_CLIENT_SECRET=your_gsc_client_secret_here

# Optional: Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key_here

# Optional: CopilotKit
COPILOT_API_KEY=your_copilot_api_key_here
```

#### 2.3 Initialize Database

```bash
# Initialize the database
python -c "from services.database import initialize_database; initialize_database()"

# (Plan limits and model pricing are seeded automatically via PricingService)
```

#### 2.4 Start Backend Server

```bash
# Start the backend server
python start_alwrity_backend.py

# The server will be available at: http://localhost:8000
# API documentation: http://localhost:8000/api/docs
# Health check: http://localhost:8000/health
```

### Step 3: Frontend Setup

#### 3.1 Install Node.js Dependencies

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install
```

#### 3.2 Frontend Environment Configuration

Create a `.env` file in the frontend directory:

```bash
# Create environment file
touch .env  # Linux/macOS
# or
type nul > .env  # Windows
```

Add the following configuration:

```env
# Backend API URL
REACT_APP_API_URL=http://localhost:8000

# Clerk Authentication (Optional)
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here

# CopilotKit (Optional)
REACT_APP_COPILOT_API_KEY=your_copilot_api_key_here

# Google Search Console (Optional)
REACT_APP_GSC_CLIENT_ID=your_gsc_client_id_here

# Environment
NODE_ENV=development
```

#### 3.3 Start Frontend Development Server

```bash
# Start the frontend development server
npm start

# The application will be available at: http://localhost:3000
```

## Verification

### Backend Verification

1. **Health Check**: Visit `http://localhost:8000/health`
   - Should return: `{"status": "healthy"}`

2. **API Documentation**: Visit `http://localhost:8000/api/docs`
   - Should display interactive API documentation

3. **Database Check**: Verify database file exists
   ```bash
   ls -la backend/alwrity.db  # Linux/macOS
   dir backend\alwrity.db     # Windows
   ```

### Frontend Verification

1. **Application Load**: Visit `http://localhost:3000`
   - Should display the ALwrity dashboard

2. **API Connection**: Check browser console for connection errors
   - Should show successful API connections

3. **Authentication**: Test login functionality (if configured)

## API Keys Setup

### Required API Keys

#### 1. Google Gemini API
- Visit: [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create a new API key
- Add to `GEMINI_API_KEY` in backend `.env`

#### 2. OpenAI API (Optional)
- Visit: [OpenAI Platform](https://platform.openai.com/api-keys)
- Create a new API key
- Add to `OPENAI_API_KEY` in backend `.env`

#### 3. Anthropic API (Optional)
- Visit: [Anthropic Console](https://console.anthropic.com/)
- Create a new API key
- Add to `ANTHROPIC_API_KEY` in backend `.env`

### Optional API Keys

#### Research & SEO Services
- **Tavily**: [Tavily API](https://tavily.com/) - Web search and research
- **Serper**: [Serper API](https://serper.dev/) - Google search results
- **Metaphor**: [Metaphor API](https://metaphor.systems/) - Content discovery
- **Firecrawl**: [Firecrawl API](https://firecrawl.dev/) - Web scraping

#### Content Generation
- **Stability AI**: [Stability Platform](https://platform.stability.ai/) - Image generation

#### Authentication & Integration
- **Clerk**: [Clerk Dashboard](https://dashboard.clerk.com/) - User authentication
- **CopilotKit**: [CopilotKit](https://copilotkit.ai/) - AI chat interface

## Troubleshooting

### Common Issues

#### Backend Issues

**Port Already in Use**
```bash
# Find process using port 8000
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # macOS/Linux

# Kill the process or use different port
python start_alwrity_backend.py --port 8001
```

**Database Connection Error**
```bash
# Reset database
rm backend/alwrity.db  # Linux/macOS
del backend\alwrity.db  # Windows

# Reinitialize
python -c "from services.database import initialize_database; initialize_database()"
```

**Missing Dependencies**
```bash
# Reinstall requirements
pip install -r requirements.txt --force-reinstall
```

#### Frontend Issues

**Port Already in Use**
```bash
# Use different port
npm start -- --port 3001
```

**Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**API Connection Issues**
- Verify backend is running on `http://localhost:8000`
- Check `REACT_APP_API_URL` in frontend `.env`
- Ensure CORS is properly configured

### Getting Help

If you encounter issues:

1. **Check Logs**: Review console output for error messages
2. **Verify Configuration**: Ensure all environment variables are set
3. **Test API Keys**: Verify API keys are valid and have sufficient credits
4. **Check Dependencies**: Ensure all required software is installed
5. **Review Documentation**: Check our [troubleshooting guide](../guides/troubleshooting.md)

## Next Steps

After successful installation:

1. **[Configuration Guide](configuration.md)** - Configure your API keys and settings
2. **[First Steps](first-steps.md)** - Create your first content strategy
3. **[Quick Start](quick-start.md)** - Get up and running quickly
4. **[Troubleshooting Guide](../guides/troubleshooting.md)** - Common issues and solutions

## Production Deployment

For production deployment, consider:

- **Environment Variables**: Use secure environment variable management
- **Database**: Consider PostgreSQL or MySQL for production
- **SSL/TLS**: Enable HTTPS for secure connections
- **Monitoring**: Set up logging and monitoring
- **Backup**: Implement regular database backups

---

*Installation complete? [Configure your settings](configuration.md) to start creating amazing content with ALwrity!*
