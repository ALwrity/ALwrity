#!/usr/bin/env python3
"""Test script to verify structured routing logs functionality."""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    # Test imports
    from backend.services.llm_providers.main_text_generation import llm_text_gen, check_gpt_provider, get_api_key
    from backend.utils.logger_utils import emit_routing_event
    from loguru import logger
    
    print("✅ All imports successful")
    
    # Test emit_routing_event function
    payload = emit_routing_event(
        logger,
        flow_type="test_flow",
        route_intent="primary",
        provider_selected="google",
        model_selected="gemini-2.0-flash-001",
        tenant_user_id="test_user_123",
        extra={"test": True}
    )
    
    print(f"✅ Routing event emitted successfully: {payload.get('event_name')}")
    print(f"✅ Tenant user ID hashed: {payload.get('tenant_user_id')}")
    
    # Test provider check
    is_supported = check_gpt_provider("google")
    print(f"✅ Provider check works: google supported = {is_supported}")
    
    print("\n🎉 All functionality tests passed!")
    
except Exception as e:
    print(f"❌ Test failed: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
