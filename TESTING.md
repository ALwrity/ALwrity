# Testing Framework Documentation

This document outlines the testing strategy, framework structure, and execution guidelines for the ALwrity project.

## 1. Testing Architecture

The project employs a multi-layered testing approach across the backend and frontend to ensure stability, reliability, and feature correctness.

### Backend (Python/Pytest)
The backend uses `pytest` and is organized into three primary categories:

- **Framework (`backend/tests/framework/`)**: Contains base classes, fixtures, and utility functions shared across different test suites.
- **Functional Tests (`backend/tests/functional/`)**: High-level end-to-end tests that validate business requirements and critical user journeys (e.g., subscription flows).
- **Service Tests (`backend/tests/services/`)**: Targeted unit and integration tests for specific business logic, such as:
    - **LinkedIn Integrations**: Profile optimization, Unipile health, and publishing services.
    - **Content Generation**: Story writer and bible logic.
    - **Infrastructure**: OAuth monitoring, WordPress dispatch, and VFS context.

#### SIF (System Integration Framework)
The SIF suite provides a tiered validation approach:
- `test_sif1` to `test_sif2`: Foundation, P0 requirements, and immediate bug fixes.
- `test_sif3` to test_sif4`: Quick wins and core linguistic analysis.
- `test_sif5 to test_sif6`: Persistence validation and full "Today Workflow" coverage.

### Frontend (TypeScript/Jest)
The frontend uses `Jest` and `React Testing Library`, following a component-driven testing pattern:

- **Utility Tests (`frontend/src/utils/__tests__/`)**: Validates pure functions (e.g., markdown parsing).
- **Hook Tests (`frontend/src/hooks/__tests__/`)**: Validates custom React hooks (e.g., `useUndoRedo`).
- **Component/Service Tests**:
    - **LinkedIn Writer**: Validates publishing readiness and media services (Image/Video).
    - **Blog Writer**: Validates integration patterns like polling.

---

## 2. CI/CD Integration (GitHub Flow)

### Pipeline Workflow
1. **Pull Request**: Triggered on every PR to `main` or `develop`.
    - Runs linting.
    - Executes `linkedin-tests.yml` and general suite.
    - **Gate**: PRs cannot be merged if any test fails.
2. **Staging**: Upon merge to `staging`, the functional test suite runs against the staging API.
3. **Production**: Smoke tests run post-deployment to verify critical paths.

### GitHub Action Config
The primary workflow for LinkedIn tests is located at `.github/workflows/linkedin-tests.yml`.

---

## 3. Execution Guide

### Running Backend Tests
```bash
# Run all tests
pytest backend/tests

# Run specific SIF level
pytest backend/tests/test_sif4_p0_foundation.py

# Run functional tests
pytest backend/tests/functional/
```

### Running Frontend Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- frontend/src/hooks/__tests__/useUndoRedo.test.ts
```

---

## 4. Contribution Guidelines
- **New Features**: Every new feature must include corresponding tests in the `services` (backend) or `__tests__` (frontend) directories.
- **Regression**: When fixing a bug, add a regression test case to the relevant suite before applying the fix.
- **Naming**: Use the prefix `test_` for Python functions and `.test.ts/tsx` for frontend files.
