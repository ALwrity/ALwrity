#!/usr/bin/env python3
"""Comprehensive functionality test for text generation modules."""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_all_functions():
    """Test all functions to ensure functionality is preserved."""
    
    try:
        # Test main imports
        from backend.services.llm_providers.main_text_generation import (
            llm_text_gen, check_gpt_provider, get_api_key,
            _normalize_provider, _parse_csv_env, _resolve_provider_sequence,
            _map_logical_model_to_provider_model, _resolve_model_sequence
        )
        print("All main imports successful")
        
        # Test utility functions
        print("\nTesting utility functions:")
        
        # Test provider normalization
        normalized = _normalize_provider("gemini")
        print(f"  _normalize_provider('gemini') = {normalized}")
        assert normalized == "google", f"Expected 'google', got {normalized}"
        
        normalized = _normalize_provider("hf")
        print(f"  _normalize_provider('hf') = {normalized}")
        assert normalized == "huggingface", f"Expected 'huggingface', got {normalized}"
        
        # Test CSV parsing
        csv_list = _parse_csv_env("google,huggingface,wavespeed")
        print(f"  _parse_csv_env('google,huggingface,wavespeed') = {csv_list}")
        assert csv_list == ["google", "huggingface", "wavespeed"], f"CSV parsing failed"
        
        # Test provider sequence resolution
        sequence = _resolve_provider_sequence("google", "google,hf", ["google", "huggingface"])
        print(f"  _resolve_provider_sequence = {sequence}")
        assert "google" in sequence, "Provider sequence resolution failed"
        
        # Test model mapping
        mapped = _map_logical_model_to_provider_model("huggingface", "gpt-oss")
        print(f"  _map_logical_model_to_provider_model('huggingface', 'gpt-oss') = {mapped}")
        assert ":" in mapped, "Model mapping failed"
        
        # Test model sequence
        model_seq = _resolve_model_sequence("huggingface", ["gpt-oss"])
        print(f"  _resolve_model_sequence('huggingface', ['gpt-oss']) = {model_seq}")
        assert len(model_seq) > 0, "Model sequence resolution failed"
        
        # Test provider checking
        is_supported = check_gpt_provider("google")
        print(f"  check_gpt_provider('google') = {is_supported}")
        assert is_supported == True, "Provider check failed"
        
        is_supported = check_gpt_provider("invalid")
        print(f"  check_gpt_provider('invalid') = {is_supported}")
        assert is_supported == False, "Invalid provider check failed"
        
        # Test API key resolution (should not fail even if no keys)
        api_key = get_api_key("google")
        print(f"  get_api_key('google') = {'configured' if api_key else 'not configured'}")
        
        # Test constants
        from backend.services.llm_providers.main_text_generation import PREMIUM_HF_MINIMAL_FALLBACK_MODELS
        print(f"  PREMIUM_HF_MINIMAL_FALLBACK_MODELS = {PREMIUM_HF_MINIMAL_FALLBACK_MODELS}")
        assert len(PREMIUM_HF_MINIMAL_FALLBACK_MODELS) > 0, "Constants missing"
        
        print("\nAll utility function tests passed!")
        
        # Test that main function signature is correct
        import inspect
        sig = inspect.signature(llm_text_gen)
        expected_params = ['prompt', 'system_prompt', 'json_struct', 'user_id', 'preferred_hf_models', 'preferred_provider', 'flow_type']
        actual_params = list(sig.parameters.keys())
        
        print(f"\nFunction signature check:")
        print(f"  Expected params: {expected_params}")
        print(f"  Actual params: {actual_params}")
        
        for param in expected_params:
            assert param in actual_params, f"Missing parameter: {param}"
        
        print("Function signature is correct!")
        
        return True
        
    except Exception as e:
        print(f"Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_all_functions()
    if success:
        print("\nSUCCESS: All functionality is preserved!")
        print("The modular implementation maintains complete compatibility.")
    else:
        print("\nFAILURE: Some functionality is missing or broken.")
        sys.exit(1)
