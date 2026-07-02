#!/usr/bin/env python3
"""
One-time diagnostic script to test Hugging Face model availability and log full error payload.
"""
import os
import sys
import json
from pathlib import Path

# Load backend .env explicitly
backend_env = Path(__file__).parent / "backend" / ".env"
if backend_env.exists():
    with open(backend_env) as f:
        for line in f:
            if '=' in line and not line.strip().startswith('#'):
                key, val = line.strip().split('=', 1)
                os.environ[key] = val

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from services.llm_providers.huggingface_provider import huggingface_text_response
from services.onboarding.api_key_manager import APIKeyManager

def test_hf_model(model_name: str):
    """Test a single HF model and print full error payload."""
    print(f"\n=== Testing HF model: {model_name} ===")
    
    # Check API key
    api_key_manager = APIKeyManager()
    hf_token = api_key_manager.get_api_key("hf_token")
    print(f"HF token present: {'Yes' if hf_token else 'No'}")
    if hf_token:
        print(f"HF token length: {len(hf_token)} chars")
    
    try:
        response = huggingface_text_response(
            prompt="Say hello",
            model=model_name,
            temperature=0.7,
            max_tokens=10
        )
        print(f"✅ SUCCESS: {response[:100]}...")
    except Exception as e:
        print(f"❌ FAILURE: {type(e).__name__}: {e}")
        # Try to extract more details if it's an HF API error
        if hasattr(e, 'response') and e.response is not None:
            print(f"HTTP Status: {e.response.status_code}")
            try:
                body = e.response.json()
                print(f"Response Body JSON: {json.dumps(body, indent=2)}")
            except:
                print(f"Response Body (raw): {e.response.text}")
        else:
            print("No HTTP response object attached to exception.")

if __name__ == "__main__":
    # Test the failing model first
    test_hf_model("openai/gpt-oss-120b:groq")
    
    # Test some common fallback models
    common_models = [
        "meta-llama/Llama-3.1-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
        "microsoft/DialoGPT-medium",
        "google/gemma-7b-it"
    ]
    
    for model in common_models:
        test_hf_model(model)
        print("\n" + "="*60 + "\n")
