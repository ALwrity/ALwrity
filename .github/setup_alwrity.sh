#!/bin/bash

# ALwrity Complete Setup Script
# This script sets up both frontend and backend for local development

set -e  # Exit on error

echo "🚀 ALwrity Setup Script"
echo "================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the project root
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: This script must be run from the project root directory${NC}"
    echo "Please navigate to the AI-Writer directory and try again."
    exit 1
fi

echo -e "${YELLOW}📋 Step 1: Setting up Backend${NC}"
echo "--------------------------------"

# Setup Backend
cd backend

echo "Creating Python virtual environment..."
python -m venv .venv || python3 -m venv .venv

echo "Activating virtual environment..."
source .venv/bin/activate || source .venv/Scripts/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp env_template.txt .env
    echo -e "${YELLOW}⚠️  Please update backend/.env with your API keys${NC}"
fi

echo "Creating subscription tables..."
python scripts/create_subscription_tables.py || echo -e "${YELLOW}⚠️  Subscription tables may already exist${NC}"

cd ..

echo -e "${GREEN}✅ Backend setup complete!${NC}"
echo ""

echo -e "${YELLOW}📋 Step 2: Setting up Frontend${NC}"
echo "--------------------------------"

# Setup Frontend
cd frontend

# Clean install
if [ -d "node_modules" ]; then
    echo "Cleaning old node_modules..."
    rm -rf node_modules package-lock.json
fi

echo "Installing Node.js dependencies (this may take a few minutes)..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp env_template.txt .env
    echo -e "${YELLOW}⚠️  Please update frontend/.env with your environment variables${NC}"
fi

echo "Building frontend..."
npm run build

cd ..

echo -e "${GREEN}✅ Frontend setup complete!${NC}"
echo ""

echo "================================"
echo -e "${GREEN}🎉 ALwrity Setup Complete!${NC}"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your API keys (Clerk, Gemini, etc.)"
echo "2. Update frontend/.env with your Clerk publishable key"
echo ""
echo "To start the application:"
echo "  Backend:  cd backend && python app.py"
echo "  Frontend: cd frontend && npm start"
echo ""
echo "Access points:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:8000/api/docs"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"

