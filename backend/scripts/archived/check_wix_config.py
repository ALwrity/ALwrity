"""
Quick diagnostic script to check Wix configuration.

Run this to verify your WIX_API_KEY is properly loaded.

Usage:
    python backend/scripts/check_wix_config.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def check_wix_config():
    """Check if Wix configuration is properly set up."""
    
    print("\n" + "="*60)
    print("🔍 WIX CONFIGURATION DIAGNOSTIC")
    print("="*60 + "\n")
    
    # 1. Check if .env file exists
    env_locations = [
        Path.cwd() / ".env",
        Path.cwd() / "backend" / ".env",
        Path.cwd() / ".env.local",
    ]
    
    print("📁 Checking for .env files:")
    env_file_found = False
    for env_path in env_locations:
        exists = env_path.exists()
        status = "✅ FOUND" if exists else "❌ NOT FOUND"
        print(f"  {status}: {env_path}")
        if exists:
            env_file_found = True
    
    if not env_file_found:
        print("\n⚠️  WARNING: No .env file found!")
        print("    Create a .env file in your project root.")
    
    print("\n" + "-"*60 + "\n")
    
    # 2. Try loading .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ dotenv loaded successfully")
    except ImportError:
        print("❌ python-dotenv not installed")
        print("   Install: pip install python-dotenv")
    except Exception as e:
        print(f"⚠️  Error loading .env: {e}")
    
    print("\n" + "-"*60 + "\n")
    
    # 3. Check WIX_API_KEY environment variable
    print("🔑 Checking WIX_API_KEY environment variable:")
    api_key = os.getenv('WIX_API_KEY')
    
    if not api_key:
        print("  ❌ NOT FOUND")
        print("\n⚠️  CRITICAL: WIX_API_KEY is not set!")
        print("\nTo fix:")
        print("  1. Add this line to your .env file:")
        print("     WIX_API_KEY=your_api_key_from_wix_dashboard")
        print("  2. Restart your backend server")
        print("  3. Run this script again to verify")
        return False
    
    print("  ✅ FOUND")
    print(f"  Length: {len(api_key)} characters")
    print(f"  Preview: {api_key[:30]}...")
    
    # 4. Validate API key format
    print("\n" + "-"*60 + "\n")
    print("🔍 Validating API key format:")
    
    if api_key.startswith("JWS."):
        print("  ✅ Starts with 'JWS.' (correct format)")
    else:
        print(f"  ⚠️  Doesn't start with 'JWS.' (got: {api_key[:10]}...)")
        print("     This might not be a valid Wix API key")
    
    if len(api_key) > 200:
        print(f"  ✅ Length looks correct ({len(api_key)} chars)")
    else:
        print(f"  ⚠️  API key seems too short ({len(api_key)} chars)")
        print("     Wix API keys are typically 500+ characters")
    
    dot_count = api_key.count('.')
    print(f"  📊 Contains {dot_count} dots (JWT tokens have 2+ dots)")
    
    # 5. Test import of Wix services
    print("\n" + "-"*60 + "\n")
    print("📦 Testing Wix service imports:")
    
    try:
        from services.integrations.wix.auth_utils import get_wix_api_key
        test_key = get_wix_api_key()
        
        if test_key:
            print("  ✅ auth_utils.get_wix_api_key() works")
            print(f"  ✅ Returned key length: {len(test_key)}")
            print(f"  ✅ Keys match: {test_key == api_key}")
        else:
            print("  ❌ auth_utils.get_wix_api_key() returned None")
            print("     Even though os.getenv('WIX_API_KEY') found it!")
            print("     This indicates an environment loading issue.")
    except Exception as e:
        print(f"  ❌ Error importing: {e}")
    
    # 6. Final summary
    print("\n" + "="*60)
    print("📋 SUMMARY")
    print("="*60 + "\n")
    
    if api_key and len(api_key) > 200 and api_key.startswith("JWS."):
        print("✅ Configuration looks GOOD!")
        print("\nNext steps:")
        print("  1. Restart your backend server")
        print("  2. Try publishing a blog post")
        print("  3. Check logs for 'Using API key' messages")
        print("  4. Verify no 403 Forbidden errors")
    else:
        print("❌ Configuration has ISSUES!")
        print("\nPlease review the warnings above and:")
        print("  1. Ensure WIX_API_KEY is set in your .env file")
        print("  2. Verify the API key is correct (from Wix Dashboard)")
        print("  3. Restart your backend server")
        print("  4. Run this script again")
    
    print("\n" + "="*60 + "\n")
    
    return bool(api_key)


if __name__ == "__main__":
    success = check_wix_config()
    sys.exit(0 if success else 1)

