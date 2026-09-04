# Strategy Prefill Integration Guide

This document explains how to integrate the strategy prefill functionality into the Content Strategy component.

## Overview

The prefill utility (`strategyPrefill.ts`) maps onboarding data to strategy fields. It's already tested (11 tests passing) and ready for integration.

## Integration Steps

### Step 1: Detect Onboarding Completion Navigation

In `ContentStrategyTab.tsx`, detect when navigation comes from the Onboarding Completion CTA:

```typescript
import { useLocation } from 'react-router-dom';
import { strategyPrefill, OnboardingData, StrategyPrefillInput } from '../../../utils/strategyPrefill';

const ContentStrategyTab: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    const locationState = location.state as any;
    if (locationState?.fromOnboarding && strategyStatus === 'none') {
      // Prefill strategy from onboarding data
      prefillFromOnboarding();
    }
  }, [location.state, strategyStatus]);
  
  const prefillFromOnboarding = async () => {
    try {
      // Fetch onboarding summary from API
      const response = await fetch('/api/onboarding/summary');
      const onboardingData = await response.json();
      
      const input: StrategyPrefillInput = {
        fromOnboarding: true,
        quickInputs: {
          primary_goal: 'traffic', // or get from location.state
          budget_range: 'medium',
          timeline: '12 months',
        },
      };
      
      const prefilledData = strategyPrefill(onboardingData, input);
      
      // Update form state with prefilled data
      // This depends on how the form state is managed
      // Example: updateFormData(prefilledData);
      
      console.log('Prefilled strategy data:', prefilledData);
    } catch (error) {
      console.error('Failed to prefill strategy:', error);
    }
  };
};
```

### Step 2: Update Form State

The form state management depends on which store is used:

#### Option A: Using contentPlanningStore

```typescript
// Add a prefill action to the store
prefillStrategy: (data: StrategyPrefillOutput) => void;
```

#### Option B: Using local form state

If the Create tab uses local state, pass the prefilled data via navigation state or store it temporarily.

### Step 3: Create API Endpoint (Backend)

Create `/api/onboarding/summary` endpoint that returns:

```json
{
  "persona": {
    "target_audience": "string",
    "writing_style": "string",
    "industry": "string",
    "business_size": "string",
    "goals": ["string"]
  },
  "website_analysis": {
    "brand_analysis": {
      "business_type": "string",
      "industry": "string",
      "company_stage": "string"
    }
  },
  "seo_audit": {
    "keywords": ["string"],
    "traffic_potential": 0,
    "competition_level": "string"
  },
  "competitor_analysis": {
    "competitors": [
      { "name": "string", "strengths": [], "weaknesses": [] }
    ]
  }
}
```

## Test Coverage

- **Unit Tests**: 11 tests for prefill logic (`strategyPrefill.test.ts`)
- **Component Tests**: Placeholder tests created (needs more work due to complex dependencies)

## Next Steps

1. Implement backend `/api/onboarding/summary` endpoint
2. Wire up the prefill in ContentStrategyTab or Create tab
3. Add more comprehensive component tests once dependencies are stable

## Current Status

- Prefill utility: ✅ Complete and tested
- Backend API: ❌ Not implemented
- Component integration: ⚠️ Partially implemented
- Tests: ⚠️ 11 utility tests passing, component tests need work