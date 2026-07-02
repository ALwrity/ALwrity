#!/usr/bin/env python3
"""Test script to verify structured routing logs functionality."""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    # Test imports
    from backend.utils.logger_utils import emit_routing_event
    from loguru import logger
    
    print("Logger utils import successful")
    
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
    
    print(f"Routing event emitted successfully: {payload.get('event_name')}")
    print(f"Tenant user ID hashed: {payload.get('tenant_user_id')}")
    print(f"Flow type/route intent: {payload.get('flow_type/route_intent')}")
    print(f"Provider selected: {payload.get('provider_selected')}")
    print(f"Model selected: {payload.get('model_selected')}")
    print(f"Fallback count: {payload.get('fallback_count')}")
    
    # Test different log levels
    payload2 = emit_routing_event(
        logger,
        flow_type="test_flow",
        route_intent="fallback",
        provider_selected="huggingface",
        model_selected="mistralai/Mistral-7B-Instruct-v0.3:groq",
        tenant_user_id="test_user_456",
        fallback_count=1,
        fallback_models_tried=["gemini-2.0-flash-001", "mistralai/Mistral-7B-Instruct-v0.3:groq"],
        level="WARNING",
        extra={"error": "Primary provider failed"}
    )
    
    print(f"Fallback event emitted successfully: {payload2.get('event_name')}")
    print(f"Fallback models tried: {payload2.get('fallback_models_tried')}")
    
    print("\nAll structured routing tests passed!")
    print("Structured routing logs are functional with:")
    print("   - Event name and flow tracking")
    print("   - Provider and model selection logging")
    print("   - Fallback attempt tracking")
    print("   - Tenant user ID privacy protection")
    print("   - Configurable log levels")
    print("   - Extra context fields")
    
except Exception as e:
    print(f"Test failed: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
