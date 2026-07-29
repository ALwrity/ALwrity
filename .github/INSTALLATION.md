# ALwrity Quick Start Guide

Complete setup guide for running ALwrity locally after cloning from GitHub.

## 🎯 **Prerequisites**

Before you begin, ensure you have:

- **Node.js** 16+ and npm installed ([Download](https://nodejs.org/))
- **Python** 3.8+ installed ([Download](https://www.python.org/downloads/))
- **Git** installed ([Download](https://git-scm.com/downloads))
- **Clerk Account** ([Sign up](https://clerk.com/))
- **API Keys** (Gemini, CopilotKit, etc.)

## 🚀 **Quick Setup (Automated)**

### **Option A: Windows**

```powershell
# 1. Clone the repository
git clone https://github.com/AJaySi/ALwrity.git
cd ALwrity

# 2. Run automated setup
.\setup_alwrity.bat
```

### **Option B: macOS/Linux**

```bash
# 1. Clone the repository
git clone https://github.com/AJaySi/ALwrity.git
cd ALwrity

# 2. Make script executable and run
chmod +x setup_alwrity.sh
./setup_alwrity.sh
```

## 📝 **Manual Setup (Step-by-Step)**

### **Step 1: Clone Repository**

```bash
git clone https://github.com/AJaySi/ALwrity.git
cd ALwrity
```

### **Step 2: Backend Setup**

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp env_template.txt .env

# Edit .env and add your API keys:
# - CLERK_SECRET_KEY
# - CLERK_PUBLISHABLE_KEY
# - GEMINI_API_KEY (optional, can be provided in UI)

# Initialize database
python scripts/create_subscription_tables.py

# Return to root
cd ..
```

### **Step 3: Frontend Setup**

```bash
# Navigate to frontend
cd frontend

# Clean install (important!)
rm -rf node_modules package-lock.json  # macOS/Linux
# OR for Windows PowerShell:
# Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue

# Install dependencies (THIS IS CRITICAL - DO NOT SKIP!)
npm install

# Create .env file
cp env_template.txt .env

# Edit .env and add:
# REACT_APP_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
# REACT_APP_API_BASE_URL=http://localhost:8000

# Build the project (validates everything compiles)
npm run build

# Return to root
cd ..
```

### **Step 4: Start the Application**

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### **Step 5: Access the Application**

- **Frontend UI**: http://localhost:3000
- **Backend API Docs**: http://localhost:8000/api/docs
- **Health Check**: http://localhost:8000/health

## 🐛 **Troubleshooting Common Issues**

### **Issue 1: "CopilotSidebar is not exported" Error**

**Cause**: Did not run `npm install` in frontend directory

**Fix:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
npm start
```

### **Issue 2: "Module not found" (Python)**

**Cause**: Did not install Python dependencies or activate virtual environment

**Fix:**
```bash
cd backend
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### **Issue 3: "CORS Error" in Browser**

**Cause**: Backend not running or frontend connecting to wrong URL

**Fix:**
1. Ensure backend is running on `http://localhost:8000`
2. Check `frontend/.env` has `REACT_APP_API_BASE_URL=http://localhost:8000`
3. Restart both frontend and backend

### **Issue 4: "Clerk Publishable Key Missing"**

**Cause**: Frontend `.env` file not configured

**Fix:**
```bash
cd frontend
# Edit .env file and add:
# REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_xxx...
```

### **Issue 5: "Database Error" or "Subscription Plans Not Found"**

**Cause**: Database tables not created

**Fix:**
```bash
cd backend
python scripts/create_subscription_tables.py
```

### **Issue 6: "Port Already in Use"**

**Backend (8000):**
```bash
# Find and kill process using port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <process_id> /F

# macOS/Linux:
lsof -ti:8000 | xargs kill -9
```

**Frontend (3000):**
```bash
# Find and kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
```

## ✅ **Verification Checklist**

After setup, verify:

- [ ] Backend health check returns 200 OK: `curl http://localhost:8000/health`
- [ ] Frontend loads without errors
- [ ] Can sign in with Clerk authentication
- [ ] Pricing page loads with 4 subscription tiers (Free, Basic, Pro, Enterprise)
- [ ] Can navigate to onboarding after selecting a plan

## 📚 **Environment Variables Required**

### **Backend (.env)**
```bash
# Required for authentication
CLERK_SECRET_KEY=sk_test_xxx...
CLERK_PUBLISHABLE_KEY=pk_test_xxx...

# Optional (can be provided via UI in Step 1 of onboarding)
GEMINI_API_KEY=AIzaSy...
EXA_API_KEY=xxx...
COPILOTKIT_API_KEY=xxx...

# Development settings
DISABLE_AUTH=false
DEPLOY_ENV=local
```

### **Frontend (.env)**
```bash
# Required
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_xxx...

# Optional
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_COPILOTKIT_API_KEY=xxx...
```

## 🎯 **First-Time User Flow**

After setup:

1. **Start both servers** (backend + frontend)
2. **Navigate to** http://localhost:3000
3. **Sign in** with Clerk
4. **Select subscription plan** (Free or Basic for alpha testing)
5. **Complete onboarding** (6 steps):
   - Step 1: API Keys
   - Step 2: Website Analysis
   - Step 3: Competitor Research
   - Step 4: Persona Generation
   - Step 5: Research Preferences
   - Step 6: Final Review
6. **Access dashboard** with all features unlocked

## 🆘 **Getting Help**

If you encounter issues:

1. **Check logs**: Both terminal windows show detailed error messages
2. **GitHub Issues**: https://github.com/AJaySi/ALwrity/issues
3. **Documentation**: See `docs/` directory for detailed guides
4. **Common Issues**: See `docs/GITHUB_ISSUE_291_FIX.md` for CopilotSidebar error

## 📖 **Additional Documentation**

- **Onboarding System**: `docs/API_KEY_MANAGEMENT_ARCHITECTURE.md`
- **Subscription System**: `docs/Billing_Subscription/SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md`
- **Deployment Guide**: `DEPLOY_ENV_REFERENCE.md`
- **API Key Management**: `docs/API_KEY_INJECTION_EXPLAINED.md`

---

**Need help? Open an issue on GitHub: https://github.com/AJaySi/ALwrity/issues**

