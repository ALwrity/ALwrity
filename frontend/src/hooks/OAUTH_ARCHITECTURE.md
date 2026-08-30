# OAuth Architecture Documentation

## Overview

ALwrity supports OAuth connections to multiple platforms:
- **Google Search Console (GSC)** — SEO analytics
- **Bing Webmaster Tools** — SEO analytics  
- **WordPress.com** — Content publishing
- **Wix** — Content publishing (via Wix SDK)
- **LinkedIn** — Social platform

## OAuth Event Types

All OAuth events are defined in `src/utils/oauthEventTypes.ts`:

```typescript
export const OAuthEventTypes = {
  GSC: { SUCCESS: 'GSC_AUTH_SUCCESS', ERROR: 'GSC_AUTH_ERROR' },
  BING: { SUCCESS: 'BING_OAUTH_SUCCESS', ERROR: 'BING_OAUTH_ERROR' },
  WORDPRESS: { SUCCESS: 'WPCOM_OAUTH_SUCCESS', ERROR: 'WPCOM_OAUTH_ERROR' },
  WIX: { SUCCESS: 'WIX_OAUTH_SUCCESS', ERROR: 'WIX_OAUTH_ERROR' },
  LINKEDIN: { SUCCESS: 'LINKEDIN_OAUTH_SUCCESS', ERROR: 'LINKEDIN_OAUTH_ERROR' },
};
```

**Note:** GSC uses `AUTH` instead of `OAUTH` for historical reasons. Consider standardizing in the future.

## Common OAuth Pattern

Most platforms follow this pattern:

1. **Get Auth URL** — Call backend API to get OAuth redirect URL
2. **Open Popup** — Open OAuth provider page in popup window
3. **Wait for Callback** — Listen for `postMessage` from callback page
4. **Handle Success/Error** — Update connection state, show toast
5. **Cleanup** — Close popup, remove listeners

### Typical Hook Structure

```typescript
const connect = async () => {
  // 1. Get auth URL from backend
  const { auth_url } = await api.getAuthUrl();
  
  // 2. Open popup
  const popup = window.open(auth_url, 'platform-oauth', 'width=600,height=700');
  
  // 3. Listen for postMessage callback
  const handler = (event: MessageEvent) => {
    if (event.data.type === OAuthEventTypes.PLATFORM.SUCCESS) {
      // Handle success
      popup?.close();
    }
  };
  window.addEventListener('message', handler);
  
  // 4. Safety timeout (3 minutes)
  setTimeout(() => { popup?.close(); }, 3 * 60 * 1000);
};
```

## Platform-Specific Details

| Platform | Hook | Auth Method | Popup? | Notes |
|----------|------|-------------|--------|-------|
| GSC | `useGSCConnection` | Backend auth_url | Yes | postMessage listener |
| Bing | `useBingOAuth` | Backend auth_url | Yes | postMessage listener |
| WordPress | `useWordPressOAuth` | Backend auth_url | Yes | Also polls `popup.closed` |
| Wix | `usePlatformConnections` | Wix SDK | No (redirect) | Full-page redirect via OAuthStrategy |
| LinkedIn | `usePlatformConnections` | `linkedInOAuthConnect` util | Yes | postMessage listener |

## Key Files

### Hooks (Consumers)
- `src/hooks/useBingOAuth.ts` — Bing Webmaster OAuth
- `src/hooks/useWordPressOAuth.ts` — WordPress OAuth  
- `src/hooks/useWixConnection.ts` — Wix connection status
- `src/components/OnboardingWizard/common/useGSCConnection.ts` — GSC OAuth
- `src/components/OnboardingWizard/common/usePlatformConnections.ts` — Wix + LinkedIn + Bing toasts

### API Modules (Backend Communication)
- `src/api/bingOAuth.ts` — Bing OAuth API
- `src/api/wordpressOAuth.ts` — WordPress OAuth API
- `src/api/gsc.ts` — GSC API

### Callback Pages (Producers)
- `src/components/SEODashboard/components/GSCAuthCallback.tsx` — GSC callback
- `src/components/WordPressCallbackPage/WordPressCallbackPage.tsx` — WordPress callback
- `src/components/WixCallbackPage/WixCallbackPage.tsx` — Wix callback

### Utilities
- `src/utils/oauthEventTypes.ts` — Single source for event type strings
- `src/utils/linkedInOAuthConnect.ts` — LinkedIn OAuth utility

## Adding a New OAuth Platform

1. Add event types to `oauthEventTypes.ts`:
   ```typescript
   NEW_PLATFORM: { SUCCESS: 'NEWPLATFORM_OAUTH_SUCCESS', ERROR: 'NEWPLATFORM_OAUTH_ERROR' }
   ```

2. Create a hook (or reuse pattern):
   - Get auth URL from backend
   - Open popup
   - Listen for postMessage using `OAuthEventTypes.NEW_PLATFORM.SUCCESS`
   - Handle success/error

3. Add backend route to generate auth URL and handle callback

## State Management

Currently, connection state is tracked in multiple places:
- Individual hooks (`useBingOAuth`, `useWordPressOAuth`, etc.)
- `usePlatformConnections` — centralized for Wix/LinkedIn/Bing toasts
- Wizard props (`connectedPlatforms`)

**Recommendation:** Consolidate to single source of truth for connected platforms.

## Known Issues / Technical Debt

1. **Inconsistent event naming:** GSC uses `AUTH`, others use `OAUTH`
2. **Duplicated popup logic:** GSC, Bing, WordPress each implement similar popup code
3. **WordPress uses interval polling:** Watches `popup.closed` instead of postMessage
4. **Wix is different:** Uses Wix SDK with full-page redirect (not popup)
5. **Split state:** Multiple places track `connectedPlatforms`

These issues don't affect functionality but create maintenance burden. A shared `useOAuthPopupFlow` hook could consolidate the duplicated patterns.
