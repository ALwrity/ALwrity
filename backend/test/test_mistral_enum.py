#!/usr/bin/env python3
"""
Test script to verify APIProvider enum includes mistral
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from models.subscription_models import APIProvider
    
    print("APIProvider enum values:")
    for provider in APIProvider:
        print(f"  - {provider.name} = '{provider.value}'")
    
    # Check if mistral is included
    mistral_found = any(provider.value == 'mistral' for provider in APIProvider)
    print(f"\nMistral found in enum: {mistral_found}")
    
    if not mistral_found:
        print("ERROR: 'mistral' is not in the APIProvider enum!")
        sys.exit(1)
    else:
        print("SUCCESS: 'mistral' is properly defined in the enum")
        
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
