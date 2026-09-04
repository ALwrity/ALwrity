# E2E Test Scenarios for Onboarding Completion CTA

This document outlines the end-to-end test scenarios for the Onboarding Completion CTA feature. These tests should be implemented when an E2E testing framework (Cypress, Playwright, etc.) is set up.

## Test Scenarios

### Scenario 1: CTA appears after onboarding completes
```gherkin
GIVEN a user has completed onboarding (all critical tasks are done)
AND the user does not have an active content strategy
WHEN the user navigates to the main dashboard
THEN the "Your Marketing OS is ready!" CTA banner should be visible
AND the "Create Content Strategy" button should be present
```

**Implementation Steps:**
1. Mock/seed database with completed onboarding tasks
2. Ensure no active strategy exists for the user
3. Navigate to `/dashboard`
4. Verify CTA banner is displayed
5. Verify button is clickable

### Scenario 2: CTA auto-dismisses when strategy is created
```gherkin
GIVEN the CTA banner is visible on the dashboard
WHEN the user clicks "Create Content Strategy"
AND completes the strategy creation flow
AND returns to the dashboard
THEN the CTA banner should no longer be visible
```

**Implementation Steps:**
1. Verify CTA is visible
2. Click "Create Content Strategy"
3. Complete strategy creation (may need to mock API calls)
4. Navigate back to dashboard
5. Verify CTA is hidden

### Scenario 3: CTA dismisses for session when "Maybe later" is clicked
```gherkin
GIVEN the CTA banner is visible on the dashboard
WHEN the user clicks "Maybe later"
THEN the CTA banner should disappear
AND it should remain hidden during the current session
```

**Implementation Steps:**
1. Verify CTA is visible
2. Click "Maybe later"
3. Verify CTA disappears
4. Navigate away and back to dashboard
5. Verify CTA is still hidden

### Scenario 4: CTA does not appear when strategy exists
```gherkin
GIVEN a user has an active content strategy
WHEN the user navigates to the main dashboard
THEN the CTA banner should NOT be displayed
```

**Implementation Steps:**
1. Seed database with an active strategy
2. Navigate to dashboard
3. Verify CTA is not present

### Scenario 5: Navigation to content planning
```gherkin
GIVEN the CTA banner is visible
WHEN the user clicks "Create Content Strategy"
THEN the app should navigate to `/content-planning`
AND the Strategy tab should be active (tab index 4)
```

**Implementation Steps:**
1. Verify CTA is visible
2. Click "Create Content Strategy"
3. Verify URL is `/content-planning`
4. Verify Strategy tab is selected

## Test Data Requirements

- User account with completed onboarding
- User account with incomplete onboarding
- User account with active strategy
- Mock/seed onboarding task completion status

## API Mocking Requirements

- `GET /api/onboarding/tasks/status` - should return appropriate status based on test scenario
- Strategy-related API calls for creation flow

## Future Implementation

When E2E framework is added:
1. Set up test fixtures for different user states
2. Create page objects for Dashboard and Content Planning pages
3. Implement scenarios above using Cypress/Playwright
4. Add to CI/CD pipeline

## Current Test Coverage

- **Component Tests**: 7 tests covering rendering, interactions, and styling
- **Integration Tests**: 3 tests covering hook behavior and state management
- **Unit Tests**: Backend endpoint tests for onboarding status API