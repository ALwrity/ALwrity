# Phase 1 Implementation Roadmap: Backend API Foundation

## Overview
Phase 1 is broken into **4 sub-phases** that build incrementally. Each sub-phase produces testable code.

---

## Sub-Phase 1A: Pydantic Models & Unipile Client Method
**Goal:** Define data structures and add the low-level API client method

### Deliverables
1. Pydantic models for request/response
2. Unipile client `get_user_posts()` method

### Files to Create/Modify
- **NEW:** `backend/models/linkedin_posts_models.py`
- **MODIFY:** `backend/services/integrations/linkedin/unipile_client.py`

### Testing
- Verify models validate correctly
- Test Unipile client method with mock data

---

## Sub-Phase 1B: Posts Service (Business Logic)
**Goal:** Create service layer to normalize and process data

### Deliverables
1. Posts service with `fetch_user_posts()` function
2. Data normalization from Unipile format to our format
3. Engagement calculations

### Files to Create
- **NEW:** `backend/services/integrations/linkedin/posts_service.py`

### Testing
- Unit test service with sample Unipile response
- Verify normalized output matches our Pydantic models

---

## Sub-Phase 1C: API Route Handler
**Goal:** Create FastAPI endpoint with authentication

### Deliverables
1. GET `/api/linkedin/posts` endpoint
2. Clerk JWT authentication
3. Integration with OAuth service to get account credentials
4. Error handling

### Files to Create/Modify
- **NEW:** `backend/api/linkedin_posts_routes.py`

### Testing
- Test endpoint returns proper JSON structure
- Verify authentication works (401 without token)

---

## Sub-Phase 1D: Router Registration & Integration
**Goal:** Wire everything together and test end-to-end

### Deliverables
1. Register router in `main.py`
2. Import all components
3. Test full flow

### Files to Modify
- **MODIFY:** `backend/main.py`

### Testing
- Full end-to-end test with API client (Postman/curl)
- Verify all pieces work together

---

## Session Planning

| Session | Sub-Phase | Estimated Time | Testable Output |
|---------|-----------|----------------|-----------------|
| 1 | 1A: Models & Client | 45-60 min | Models validate, client method exists |
| 2 | 1B: Service Layer | 45-60 min | Service normalizes data correctly |
| 3 | 1C: API Route | 60-75 min | Endpoint returns JSON with auth |
| 4 | 1D: Integration | 30-45 min | Full API test with real/mock data |

---

## Dependencies Between Sub-Phases

```
1A (Models & Client)
    ↓
1B (Service) - uses models from 1A
    ↓
1C (API Route) - uses service from 1B, models from 1A
    ↓
1D (Integration) - wires 1A+1B+1C together
```

Each sub-phase can be developed independently but testing requires the previous phases.

---

## Common Patterns to Follow

### Unipile Client Pattern
```python
# From existing unipile_client.py methods
async def existing_method(self, account_id: str) -> dict[str, Any]:
    if not self._api_key:
        raise ValueError("Unipile API key is required")
    
    url = self._get_full_url("/api/v1/some_endpoint")
    params = {"account_id": account_id}
    
    async with httpx.AsyncClient(timeout=self._timeout) as client:
        response = await client.get(url, params=params, headers=_auth_headers(self._api_key))
        _raise_for_error(response)
        return response.json()
```

### Service Pattern
```python
# From existing services (profile_service.py pattern)
async def fetch_and_normalize(...) -> LinkedInPost:
    # Call client
    raw_data = await client.get_user_posts(...)
    # Normalize
    return LinkedInPost(...)
```

### Route Pattern
```python
# From existing routes (linkedin_social_routes.py)
@router.get("/posts", response_model=PostListResponse)
async def get_linkedin_posts(
    request: Request,
    user_id: str = Depends(get_current_user)
):
    # Get credentials
    # Call service
    # Return response
```

---

## Testing Checklist Per Sub-Phase

### Sub-Phase 1A
- [ ] Pydantic models validate test data correctly
- [ ] Models reject invalid data
- [ ] Unipile client method signature matches plan
- [ ] Client method has proper error handling

### Sub-Phase 1B
- [ ] Service function exists with correct signature
- [ ] Normalization handles all Unipile response fields
- [ ] Edge cases handled (missing fields, nulls)
- [ ] Returns proper Pydantic models

### Sub-Phase 1C
- [ ] Route is accessible at `/api/linkedin/posts`
- [ ] Returns 401 without authentication
- [ ] Returns 200 with valid auth
- [ ] Response matches PostListResponse schema
- [ ] Proper error responses (404, 429, 500)

### Sub-Phase 1D
- [ ] Full flow works: Auth → Credentials → Unipile → Response
- [ ] Can test with API client (Postman/curl)
- [ ] Response time is acceptable (< 3 seconds)
- [ ] Errors are handled gracefully

---

## Sample Unipile Response for Testing

Use this sample response to test normalization:

```json
{
  "object": "PostList",
  "items": [
    {
      "provider": "LINKEDIN",
      "id": "urn:li:share:123456789",
      "social_id": "123456789",
      "share_url": "https://linkedin.com/posts/user_post",
      "title": "My Post Title",
      "text": "This is the post content...",
      "date": "2024-01-15",
      "parsed_datetime": "2024-01-15T10:30:00Z",
      "reaction_counter": 150,
      "comment_counter": 25,
      "repost_counter": 10,
      "impressions_counter": 5000,
      "user_reacted": "LIKE",
      "author": {
        "public_identifier": "johndoe",
        "id": "urn:li:person:abc123",
        "name": "John Doe",
        "is_company": false,
        "headline": "Software Engineer",
        "profile_picture_url": "https://media.licdn.com/avatar.jpg"
      },
      "analytics": {
        "impressions": 5000,
        "engagements": 185,
        "engagement_rate": 0.037,
        "clicks": 45,
        "followers_gained_from_this_post": 12
      }
    }
  ],
  "cursor": "eyJwYWdlIjogMn0=",
  "paging": {
    "page_count": 5
  }
}
```

---

## Next Steps

1. **Confirm this roadmap** meets your expectations
2. **Choose which sub-phase** to start in this session
3. I'll implement the chosen sub-phase with full code
4. You test and approve before moving to next sub-phase

Which sub-phase would you like to start with?
