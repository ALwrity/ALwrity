#!/usr/bin/env python3
"""
Smoke test script for podcast-only demo mode.
Tests the subscription funnel, Stripe flow, and podcast runtime paths.
"""

import requests
import json
import sys
from typing import Dict, Any

BASE_URL = "http://localhost:8000"


def test_health() -> bool:
    """Test backend health endpoint."""
    print("\n[TEST] Backend health check...")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        data = resp.json()
        print(f"  Status: {data.get('status')}")
        print(f"  Demo mode: {data.get('podcast_only_demo_mode')}")
        return resp.status_code == 200
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        return False


def test_router_status() -> bool:
    """Test router status endpoint."""
    print("\n[TEST] Router status...")
    try:
        resp = requests.get(f"{BASE_URL}/api/routers/status", timeout=10)
        data = resp.json()
        
        # Check critical routers
        podcast_mounted = data.get("podcast_only_demo_mode", False)
        router_groups = data.get("router_groups", {})
        
        print(f"  Podcast router: {router_groups.get('podcast_maker', {}).get('mounted')}")
        print(f"  Assets serving: {router_groups.get('assets_serving', {}).get('mounted')}")
        
        # Check podcast router is always mounted
        podcast_ok = router_groups.get('podcast_maker', {}).get('mounted') == True
        if not podcast_ok:
            print("  ❌ Podcast router not mounted!")
            return False
        
        return resp.status_code == 200
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        return False


def test_subscription_plans() -> bool:
    """Test subscription plans endpoint."""
    print("\n[TEST] Subscription plans...")
    try:
        resp = requests.get(f"{BASE_URL}/api/subscription/plans", timeout=10)
        data = resp.json()
        
        if resp.status_code == 200:
            plans = data.get("plans", [])
            print(f"  Plans returned: {len(plans)}")
            for plan in plans[:3]:
                print(f"    - {plan.get('name')}: ${plan.get('price', {}).get('monthly', 'N/A')}/mo")
            return True
        else:
            print(f"  ❌ Status {resp.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        return False


def test_podcast_routes() -> bool:
    """Test podcast router is accessible."""
    print("\n[TEST] Podcast router endpoints...")
    try:
        # Test without auth (should return 401, not 404)
        resp = requests.get(f"{BASE_URL}/api/podcast/projects", timeout=10)
        
        if resp.status_code == 401:
            print("  ✅ Podcast router mounted (auth required as expected)")
            return True
        elif resp.status_code == 404:
            print("  ❌ Podcast router NOT mounted (404)")
            return False
        else:
            print(f"  Status: {resp.status_code}")
            return resp.status_code in [200, 401]
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        return False


def test_preflight() -> bool:
    """Test preflight cost estimation endpoint."""
    print("\n[TEST] Preflight cost estimation...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/subscription/preflight-check",
            json={"operation": "podcast_analysis", "tier": "basic"},
            timeout=10
        )
        
        if resp.status_code in [200, 401]:
            print(f"  ✅ Preflight endpoint accessible (status: {resp.status_code})")
            return True
        else:
            print(f"  ❌ Status {resp.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        return False


def test_onboarding_status() -> bool:
    """Test onboarding status endpoint."""
    print("\n[TEST] Onboarding status...")
    try:
        resp = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        data = resp.json()
        
        print(f"  Status: {data.get('status')}")
        print(f"  Enabled: {data.get('enabled')}")
        
        # In demo mode, should be disabled
        if data.get('enabled') == False:
            print("  ✅ Onboarding correctly disabled in demo mode")
            return True
        
        return resp.status_code == 200
    except Exception as e:
        print(f"  ❌ FAILED: {e}")
        return False


def main():
    """Run all smoke tests."""
    print("=" * 60)
    print("PODCAST-ONLY DEMO MODE SMOKE TESTS")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Health", test_health()))
    results.append(("Router Status", test_router_status()))
    results.append(("Subscription Plans", test_subscription_plans()))
    results.append(("Podcast Routes", test_podcast_routes()))
    results.append(("Preflight Check", test_preflight()))
    results.append(("Onboarding Status", test_onboarding_status()))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
