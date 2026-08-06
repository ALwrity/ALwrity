"""
Environment Setup Module
Handles environment configuration and directory setup.
"""

import os
from pathlib import Path
from typing import List, Dict, Any


class EnvironmentSetup:
    """Manages environment setup for ALwrity backend."""
    
    def __init__(self, production_mode: bool = False):
        self.production_mode = production_mode
        if production_mode:
            self.required_directories = []
        else:
            self.required_directories = [
                "lib/workspace/alwrity_content",
                "lib/workspace/alwrity_web_research", 
                "lib/workspace/alwrity_prompts",
                "lib/workspace/alwrity_config"
            ]
    
    def setup_directories(self) -> bool:
        """Create necessary directories for ALwrity."""
        import os
        verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
        
        if verbose:
            print("📁 Setting up directories...")
        
        if not self.required_directories:
            if verbose:
                print("   ⚠️  Skipping directory creation in production mode")
            return True
        
        for directory in self.required_directories:
            try:
                Path(directory).mkdir(parents=True, exist_ok=True)
                if verbose:
                    print(f"   ✅ Created: {directory}")
            except Exception as e:
                if verbose:
                    print(f"   ❌ Failed to create {directory}: {e}")
                return False
        
        if verbose:
            print("✅ All directories created successfully")
        return True
    
    def setup_environment_variables(self) -> bool:
        """Set up environment variables for the application."""
        print("🔧 Setting up environment variables...")
        
        # Production environment variables
        # IMPORTANT: Don't override PORT if already set by Render cloud
        render_port = os.getenv("PORT")
        
        if self.production_mode:
            env_vars = {
                "HOST": "0.0.0.0",
                "RELOAD": "false",
                "LOG_LEVEL": "INFO",
                "DEBUG": "false"
            }
            # Only set PORT if not already provided by cloud (Render sets PORT)
            if not render_port:
                env_vars["PORT"] = "8000"
        else:
            env_vars = {
                "HOST": "0.0.0.0",
                "RELOAD": "true", 
                "LOG_LEVEL": "DEBUG",
                "DEBUG": "true"
            }
            if not render_port:
                env_vars["PORT"] = "8000"
        
        for key, value in env_vars.items():
            os.environ.setdefault(key, value)
            print(f"   ✅ {key}={value}")
        
        print("✅ Environment variables configured")
        return True
    
    def create_env_file(self) -> bool:
        """Create .env file with default configuration (development only)."""
        if self.production_mode:
            print("⚠️  Skipping .env file creation in production mode")
            return True
        
        print("🔧 Creating .env file...")
        
        env_file = Path(".env")
        if env_file.exists():
            print("   ✅ .env file already exists")
            return True
        
        env_content = """# ALwrity Backend Configuration

# API Keys (Configure these in the onboarding process)
# OPENAI_API_KEY=your_openai_api_key_here
# GEMINI_API_KEY=your_gemini_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
# MISTRAL_API_KEY=your_mistral_api_key_here

# Research API Keys (Optional)
# TAVILY_API_KEY=your_tavily_api_key_here
# SERPER_API_KEY=your_serper_api_key_here
# EXA_API_KEY=your_exa_api_key_here

# Authentication
# CLERK_SECRET_KEY=your_clerk_secret_key_here

# OAuth Redirect URIs
# GSC_REDIRECT_URI=https://your-frontend.vercel.app/gsc/callback
# WORDPRESS_REDIRECT_URI=https://your-frontend.vercel.app/wp/callback
# WIX_REDIRECT_URI=https://your-frontend.vercel.app/wix/callback

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true

# Logging
LOG_LEVEL=INFO
# Stripe Subscription Configuration

# Stripe mode selector (test or live).
# STRIPE_MODE=test

# JSON mapping for test mode price IDs.
# Example:
# STRIPE_PLAN_PRICE_MAPPING_TEST={"basic":{"monthly":"price_basic_monthly"},"pro":{"monthly":"price_pro_monthly"}}

# JSON mapping for live mode price IDs.
# Example:
# STRIPE_PLAN_PRICE_MAPPING_LIVE={"basic":{"monthly":"price_live_basic_monthly"},"pro":{"monthly":"price_live_pro_monthly"}}

# Optional fallback JSON mapping used when mode-specific variable is not provided.
# Example:
# STRIPE_PLAN_PRICE_MAPPING={"basic":{"monthly":"price_basic_monthly"},"pro":{"monthly":"price_pro_monthly"}}
"""
        
        try:
            with open(env_file, 'w') as f:
                f.write(env_content)
            print("✅ .env file created successfully")
            return True
        except Exception as e:
            print(f"❌ Error creating .env file: {e}")
            return False
    
    def verify_environment(self) -> bool:
        """Verify that the environment is properly configured."""
        print("🔍 Verifying environment setup...")
        
        # Check required directories
        for directory in self.required_directories:
            if not Path(directory).exists():
                print(f"❌ Directory missing: {directory}")
                return False
        
        # Check environment variables
        required_vars = ["HOST", "PORT", "LOG_LEVEL"]
        for var in required_vars:
            if not os.getenv(var):
                print(f"❌ Environment variable missing: {var}")
                return False
        
        print("✅ Environment verification complete")
        return True
