#!/usr/bin/env python3
"""Initialization script for Stability AI service."""

import os
import sys
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.stability_service import StabilityAIService
from config.stability_config import get_stability_config
from loguru import logger


async def test_stability_connection():
    """Test connection to Stability AI API."""
    try:
        print("🔧 Initializing Stability AI service...")
        
        # Get configuration
        config = get_stability_config()
        print(f"✅ Configuration loaded")
        print(f"   - API Key: {config.api_key[:8]}..." if config.api_key else "   - API Key: Not set")
        print(f"   - Base URL: {config.base_url}")
        print(f"   - Timeout: {config.timeout}s")
        
        # Initialize service
        service = StabilityAIService(api_key=config.api_key)
        print("✅ Service initialized")
        
        # Test API connection
        print("\n🌐 Testing API connection...")
        
        async with service:
            # Test account endpoint
            try:
                account_info = await service.get_account_details()
                print("✅ Account API test successful")
                print(f"   - Account ID: {account_info.get('id', 'Unknown')}")
                print(f"   - Email: {account_info.get('email', 'Unknown')}")
                
                # Get balance
                balance_info = await service.get_account_balance()
                credits = balance_info.get('credits', 0)
                print(f"   - Credits: {credits}")
                
                if credits < 10:
                    print("⚠️  Warning: Low credit balance")
                
            except Exception as e:
                print(f"❌ Account API test failed: {str(e)}")
                return False
            
            # Test engines endpoint
            try:
                engines = await service.list_engines()
                print("✅ Engines API test successful")
                print(f"   - Available engines: {len(engines)}")
                
                # List some engines
                for engine in engines[:3]:
                    print(f"   - {engine.get('name', 'Unknown')}: {engine.get('id', 'Unknown')}")
                
            except Exception as e:
                print(f"❌ Engines API test failed: {str(e)}")
                return False
        
        print("\n🎉 Stability AI service initialization completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Initialization failed: {str(e)}")
        return False


async def validate_service_setup():
    """Validate complete service setup."""
    print("\n🔍 Validating service setup...")
    
    validation_results = {
        "api_key": False,
        "dependencies": False,
        "file_permissions": False,
        "network_access": False
    }
    
    # Check API key
    api_key = os.getenv("STABILITY_API_KEY")
    if api_key and api_key.startswith("sk-"):
        validation_results["api_key"] = True
        print("✅ API key format valid")
    else:
        print("❌ Invalid or missing API key")
    
    # Check dependencies
    try:
        import aiohttp
        import PIL
        from pydantic import BaseModel
        validation_results["dependencies"] = True
        print("✅ Required dependencies available")
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
    
    # Check file permissions
    try:
        test_dir = backend_dir / "temp_test"
        test_dir.mkdir(exist_ok=True)
        test_file = test_dir / "test.txt"
        test_file.write_text("test")
        test_file.unlink()
        test_dir.rmdir()
        validation_results["file_permissions"] = True
        print("✅ File system permissions OK")
    except Exception as e:
        print(f"❌ File permission error: {e}")
    
    # Check network access
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get("https://api.stability.ai", timeout=aiohttp.ClientTimeout(total=10)) as response:
                validation_results["network_access"] = True
                print("✅ Network access to Stability AI API OK")
    except Exception as e:
        print(f"❌ Network access error: {e}")
    
    # Summary
    passed = sum(validation_results.values())
    total = len(validation_results)
    
    print(f"\n📊 Validation Summary: {passed}/{total} checks passed")
    
    if passed == total:
        print("🎉 All validations passed! Service is ready to use.")
    else:
        print("⚠️  Some validations failed. Please address the issues above.")
    
    return passed == total


def setup_environment():
    """Set up environment for Stability AI service."""
    print("🔧 Setting up environment...")
    
    # Create necessary directories
    directories = [
        backend_dir / "generated_content",
        backend_dir / "generated_content" / "images",
        backend_dir / "generated_content" / "audio",
        backend_dir / "generated_content" / "3d_models",
        backend_dir / "logs",
        backend_dir / "cache"
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created directory: {directory}")
    
    # Copy example environment file if .env doesn't exist
    env_file = backend_dir / ".env"
    example_env = backend_dir / ".env.stability.example"
    
    if not env_file.exists() and example_env.exists():
        import shutil
        shutil.copy(example_env, env_file)
        print("✅ Created .env file from example")
        print("⚠️  Please edit .env file and add your Stability AI API key")
    
    print("✅ Environment setup completed")


def print_usage_examples():
    """Print usage examples."""
    print("\n📚 Usage Examples:")
    print("\n1. Generate an image:")
    print("""
curl -X POST "http://localhost:8000/api/stability/generate/ultra" \\
     -F "prompt=A majestic mountain landscape at sunset" \\
     -F "aspect_ratio=16:9" \\
     -F "style_preset=photographic" \\
     -o generated_image.png
""")
    
    print("2. Upscale an image:")
    print("""
curl -X POST "http://localhost:8000/api/stability/upscale/fast" \\
     -F "image=@input_image.png" \\
     -o upscaled_image.png
""")
    
    print("3. Edit an image with inpainting:")
    print("""
curl -X POST "http://localhost:8000/api/stability/edit/inpaint" \\
     -F "image=@input_image.png" \\
     -F "mask=@mask_image.png" \\
     -F "prompt=a beautiful garden" \\
     -o edited_image.png
""")
    
    print("4. Generate 3D model:")
    print("""
curl -X POST "http://localhost:8000/api/stability/3d/stable-fast-3d" \\
     -F "image=@object_image.png" \\
     -o model.glb
""")
    
    print("5. Generate audio:")
    print("""
curl -X POST "http://localhost:8000/api/stability/audio/text-to-audio" \\
     -F "prompt=Peaceful piano music with nature sounds" \\
     -F "duration=60" \\
     -o generated_audio.mp3
""")


def main():
    """Main initialization function."""
    print("🚀 Stability AI Service Initialization")
    print("=" * 50)
    
    # Setup environment
    setup_environment()
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Run async validation
    async def run_validation():
        # Test connection
        connection_ok = await test_stability_connection()
        
        # Validate setup
        setup_ok = await validate_service_setup()
        
        return connection_ok and setup_ok
    
    # Run validation
    success = asyncio.run(run_validation())
    
    if success:
        print("\n🎉 Initialization completed successfully!")
        print("\n📋 Next steps:")
        print("1. Start the FastAPI server: python app.py")
        print("2. Visit http://localhost:8000/docs for API documentation")
        print("3. Test the endpoints using the examples below")
        
        print_usage_examples()
    else:
        print("\n❌ Initialization failed!")
        print("\n🔧 Troubleshooting steps:")
        print("1. Check your STABILITY_API_KEY in .env file")
        print("2. Verify network connectivity to api.stability.ai")
        print("3. Ensure all dependencies are installed: pip install -r requirements.txt")
        print("4. Check account balance at https://platform.stability.ai/account")
        
        sys.exit(1)


if __name__ == "__main__":
    main()