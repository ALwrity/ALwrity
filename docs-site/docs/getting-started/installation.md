# Installation Guide

This comprehensive guide will walk you through installing and setting up ALwrity on your system. Follow these steps to get your AI-powered content creation platform running.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Python**: Version 3.10 or higher, but not 3.14 (Pillow fails to build). Tested on 3.12.
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

# Ubuntu/Debian only, if the next command fails: sudo apt install python3-venv
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

# Required: the backend will not start without this.
# Generate it with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
OAUTH_TOKEN_ENCRYPTION_KEY=paste_generated_key_here

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

# Or run the initialization script
python scripts/init_alpha_subscription_tiers.py
```

#### 2.4 Start Backend Server

```bash
# Start the backend server
python start_alwrity_backend.py

# The server will be available at: http://localhost:8000
# API documentation: http://localhost:8000/docs
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

2. **API Documentation**: Visit `http://localhost:8000/docs`
   - Should display interactive API documentation

3. **Database Check**: Verify database file exists
   ```bash
   ls -la backend/alwrity.db  # Linux/macOS
   dir backend\alwrity.db     # Windows
   ```

### Frontend Verification

1. **Application Load**: Visit `http://localhost:3000`
