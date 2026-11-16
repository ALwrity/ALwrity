# CopilotKit API Key Setup Guide
## How to Get and Configure Your CopilotKit API Key

---

## 🔑 **Step 1: Get Your CopilotKit API Key**

### **1.1 Sign Up for CopilotKit**
1. Visit [copilotkit.ai](https://copilotkit.ai)
2. Click "Sign Up" or "Get Started"
3. Create your account using email or GitHub
4. Verify your email address

### **1.2 Access Your Dashboard**
1. Log in to your CopilotKit dashboard
2. Navigate to the "API Keys" section
3. Click "Generate New API Key"
4. Copy the generated public API key

### **1.3 API Key Format**
Your API key will look something like this:
```
ck_public_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📁 **Step 2: Configure the API Key**

### **2.1 Frontend Environment File**

Create a `.env` file in your `frontend` directory:

**File Location:** `frontend/.env`

```bash
# CopilotKit Configuration
# Get your API key from: https://copilotkit.ai
REACT_APP_COPILOTKIT_API_KEY=ck_public_your_actual_api_key_here

# Backend API Configuration
REACT_APP_API_URL=http://localhost:8000

# Other Frontend Environment Variables
REACT_APP_ENVIRONMENT=development
REACT_APP_VERSION=1.0.0
```

### **2.2 Backend Environment File**

Update your backend `.env` file:

**File Location:** `backend/.env`

```bash
# Google GenAI Configuration (for Gemini)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key_here

# Database Configuration
DATABASE_URL=your_database_url_here

# Other Backend Environment Variables
ENVIRONMENT=development
DEBUG=True
```

---

## 🔧 **Step 3: Verify Configuration**

### **3.1 Check Frontend Configuration**

The API key is used in `frontend/src/App.tsx`:

```typescript
<CopilotKit 
  publicApiKey={process.env.REACT_APP_COPILOTKIT_API_KEY || "demo"}
>
```

### **3.2 Test the Configuration**

1. **Start the Frontend:**
   ```bash
   cd frontend
   npm start
   ```

2. **Check Browser Console:**
   - Open browser developer tools
   - Look for any CopilotKit-related errors
   - Verify the API key is being loaded

3. **Test CopilotKit Sidebar:**
   - Navigate to the Content Planning Dashboard
   - Press `/` or click the CopilotKit sidebar
   - Verify the assistant loads without errors

---

## 🚨 **Important Notes**

### **Security Considerations**
- ✅ **Public API Key**: The CopilotKit API key is designed to be public
- ✅ **Frontend Only**: Only used in the frontend, not in backend code
- ✅ **Rate Limited**: CopilotKit handles rate limiting on their end
- ✅ **No Sensitive Data**: The key doesn't expose sensitive information

### **Environment Variables**
- **Development**: Use `.env` file in frontend directory
- **Production**: Set environment variables in your hosting platform
- **Git**: Add `.env` to `.gitignore` to keep it out of version control

### **Fallback Configuration**
If no API key is provided, CopilotKit will use a demo mode:
```typescript
publicApiKey={process.env.REACT_APP_COPILOTKIT_API_KEY || "demo"}
```

---

## 🔍 **Troubleshooting**

### **Common Issues**

#### **1. API Key Not Loading**
```bash
# Check if the environment variable is set
echo $REACT_APP_COPILOTKIT_API_KEY

# Restart the development server
npm start
```

#### **2. CopilotKit Not Working**
- Check browser console for errors
- Verify the API key format is correct
- Ensure the key starts with `ck_public_`

#### **3. Environment Variable Not Recognized**
- Make sure the `.env` file is in the correct location
- Restart the development server after adding the file
- Check that the variable name is exactly `REACT_APP_COPILOTKIT_API_KEY`

### **Debug Steps**
1. **Check Environment Variable:**
   ```bash
   cd frontend
   echo $REACT_APP_COPILOTKIT_API_KEY
   ```

2. **Check .env File:**
   ```bash
   cat .env
   ```

3. **Check Browser Console:**
   - Open developer tools
   - Look for CopilotKit initialization messages
   - Check for any error messages

---

## 📊 **Production Deployment**

### **Vercel Deployment**
1. Go to your Vercel project settings
2. Add environment variable:
   - **Name:** `REACT_APP_COPILOTKIT_API_KEY`
   - **Value:** Your CopilotKit API key
3. Redeploy your application

### **Netlify Deployment**
1. Go to your Netlify site settings
2. Navigate to "Environment variables"
3. Add the variable:
   - **Key:** `REACT_APP_COPILOTKIT_API_KEY`
   - **Value:** Your CopilotKit API key
4. Trigger a new deployment

### **Other Platforms**
- **Heroku:** Use `heroku config:set`
- **AWS:** Use AWS Systems Manager Parameter Store
- **Docker:** Pass as environment variable in docker-compose

---

## 🎯 **Next Steps**

### **After Setting Up API Key**
1. **Test the Integration:**
   - Start both frontend and backend
   - Navigate to Strategy Builder
   - Test CopilotKit sidebar

2. **Verify Features:**
   - Test field population
   - Test validation
   - Test strategy review

3. **Monitor Usage:**
   - Check CopilotKit dashboard for usage stats
   - Monitor API response times
   - Track user interactions

---

## 📞 **Support**

### **CopilotKit Support**
- **Documentation:** [docs.copilotkit.ai](https://docs.copilotkit.ai)
- **Discord:** [discord.gg/copilotkit](https://discord.gg/copilotkit)
- **GitHub:** [github.com/copilotkit/copilotkit](https://github.com/copilotkit/copilotkit)

### **ALwrity Support**
- Check the troubleshooting section above
- Review the setup guide
- Test with the demo key first

---

## ✅ **Summary**

1. **Get API Key:** Sign up at copilotkit.ai and generate a public API key
2. **Add to Frontend:** Create `frontend/.env` with `REACT_APP_COPILOTKIT_API_KEY`
3. **Test Configuration:** Start the app and verify CopilotKit loads
4. **Deploy:** Add the environment variable to your production platform

That's it! Your CopilotKit integration should now be fully functional. 🚀
