import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import { BlogSEOMetadataResponse } from '../services/blogWriterApi';
import { storeEncrypted, readEncrypted, storeEncryptedSync } from '../utils/wixTokenStorage';
import { markConnectionHandled, isAlreadyHandled } from '../utils/wixConnectionDedup';
import { OAuthEventTypes } from '../utils/oauthEventTypes';

export interface WixStatus {
  connected: boolean;
  has_permissions: boolean;
  site_info?: any;
  error?: string;
  reconnect_required?: boolean;
}

export interface WixPublishResult {
  success: boolean;
  url?: string;
  post_id?: string;
  message: string;
  action_required?: string;
  warning?: string;
}

const WIX_TOKEN_KEY = 'wix_access_token';
const WIX_CONNECTED_KEY = 'wix_connected';

const CONTENT_MAX_LENGTH = 50000;
const CONTENT_WARNING_LENGTH = 30000;

function validatePublishContent(content: string): { valid: boolean; warning?: string } {
  if (!content || !content.trim()) {
    return { valid: false, warning: 'Cannot publish: content is empty.' };
  }
  const stripped = content.trim();
  if (stripped.length < 10) {
    return { valid: false, warning: 'Content is too short to publish. Write more before publishing.' };
  }
  let boldOpen = 0;
  let i = 0;
  while (i < stripped.length) {
    if (i < stripped.length - 1 && stripped[i] === '*' && stripped[i + 1] === '*') {
      boldOpen++;
      i += 2;
      continue;
    }
    i++;
  }
  if (boldOpen % 2 !== 0) {
    return { valid: false, warning: 'Content has an unmatched ** (bold marker). Please fix formatting before publishing.' };
  }
  let codeTicks = 0;
  const codeMatch = stripped.match(/```/g);
  if (codeMatch) codeTicks = codeMatch.length;
  if (codeTicks % 2 !== 0) {
    return { valid: false, warning: 'Content has an unmatched ``` (code block marker). Please fix formatting before publishing.' };
  }
  if (stripped.length > CONTENT_MAX_LENGTH) {
    return { valid: false, warning: `Content is ${Math.round(stripped.length / 1000)}K characters — maximum is ${CONTENT_MAX_LENGTH / 1000}K. Please shorten your content.` };
  }
  if (stripped.length > CONTENT_WARNING_LENGTH) {
    return { valid: true, warning: `Content is ${Math.round(stripped.length / 1000)}K characters. Very long posts may take longer to publish on Wix.` };
  }
  return { valid: true };
}

export function useWixPublish() {
  const [wixStatus, setWixStatus] = useState<WixStatus | null>(null);
  const [checkingWix, setCheckingWix] = useState(false);
  const [publishingWix, setPublishingWix] = useState(false);
  const [showWixConnectModal, setShowWixConnectModal] = useState(false);
  const pendingPublishRef = useRef<(() => Promise<WixPublishResult>) | null>(null);

  const clearStaleWixState = useCallback(() => {
    try {
      localStorage.removeItem(WIX_CONNECTED_KEY);
      localStorage.removeItem(`wix_ek_${WIX_TOKEN_KEY}`);
      sessionStorage.removeItem(WIX_CONNECTED_KEY);
      sessionStorage.removeItem('wix_tokens');
      sessionStorage.removeItem('wix_site_info');
      window.name = '';
    } catch {}
  }, []);

  const checkWixStatus = useCallback(async () => {
    setCheckingWix(true);
    try {
      // 1. Cross-tab handoff from OAuth callback (ngrok → localhost redirect)
      if (typeof window.name === 'string' && window.name.startsWith('WIX_RESULT::')) {
        try {
          const payload = JSON.parse(atob(window.name.replace('WIX_RESULT::', '')));
          if (payload.access_token) {
            await storeEncrypted(WIX_TOKEN_KEY, payload.access_token);
          }
          markConnectionHandled();
          localStorage.setItem(WIX_CONNECTED_KEY, 'true');
          sessionStorage.setItem(WIX_CONNECTED_KEY, 'true');
          window.name = '';
          setWixStatus({ connected: true, has_permissions: true, site_info: payload.site_info });
          return;
        } catch {}
      }

      // 2. PRIMARY: Ask backend — it actually validates the DB token against Wix APIs
      try {
        const resp = await apiClient.get('/api/wix/connection/status');
        if (resp.data?.connected) {
          // Backend says token is valid — sync local state and show connected
          localStorage.setItem(WIX_CONNECTED_KEY, 'true');
          setWixStatus({
            connected: true,
            has_permissions: resp.data.has_permissions ?? true,
            site_info: resp.data.site_info,
          });
          return;
        }
        // Backend says NOT connected (401 or valid response with connected:false)
        // → token expired / revoked / missing → clear all local state
        clearStaleWixState();
        setWixStatus({ connected: false, has_permissions: false });
        return;
      } catch (err: any) {
        // Backend error (network, 500, etc.) — can't validate token
        // Show disconnected rather than stale cached state — user should reconnect
        console.warn('[Wix] Backend connection check failed (showing disconnected):', err?.message || err);
      }

      // 3. Network error fallback — never trust local cache over backend
      clearStaleWixState();
      setWixStatus({ connected: false, has_permissions: false, error: 'Unable to verify connection' });
    } catch {
      setWixStatus({ connected: false, has_permissions: false });
    } finally {
      setCheckingWix(false);
    }
  }, [clearStaleWixState]);

  useEffect(() => {
    checkWixStatus();
  }, [checkWixStatus]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (isAlreadyHandled()) return;
      if (e.key === WIX_CONNECTED_KEY && e.newValue === 'true') {
        markConnectionHandled();
        setWixStatus({ connected: true, has_permissions: true });
        setShowWixConnectModal(false);
      }
      if (e.key === `wix_ek_${WIX_TOKEN_KEY}` && e.newValue) {
        setWixStatus(prev => prev ? prev : { connected: true, has_permissions: true });
      }
    };
    window.addEventListener('storage', handler);

    const msgHandler = (e: MessageEvent) => {
      if (isAlreadyHandled()) return;
      if (e.data?.type === OAuthEventTypes.WIX.SUCCESS && e.data?.success) {
        markConnectionHandled();
        if (e.data.access_token) storeEncryptedSync(WIX_TOKEN_KEY, e.data.access_token);
        localStorage.setItem(WIX_CONNECTED_KEY, 'true');
        sessionStorage.setItem(WIX_CONNECTED_KEY, 'true');
        setWixStatus({ connected: true, has_permissions: true, site_info: e.data.site_info });
        setShowWixConnectModal(false);
      }
    };
    window.addEventListener('message', msgHandler);

    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('message', msgHandler);
    };
  }, []);

  const publishToWix = useCallback(async (
    content: string,
    metadata: BlogSEOMetadataResponse | null,
    explicitTitle?: string,
  ): Promise<WixPublishResult> => {
    const title = explicitTitle
      || metadata?.seo_title
      || content.match(/^#\s+(.+)$/m)?.[1]
      || content.match(/^##\s+(.+)$/m)?.[1]?.replace(/^\d+[\.\)]\s*/, '')
      || 'Blog Post';

    let coverImageUrl: string | undefined;
    let coverImageWarning: string | undefined;
    if (metadata?.open_graph?.image) {
      const img = metadata.open_graph.image;
      if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
        coverImageUrl = img;
      } else if (typeof img === 'string' && img.startsWith('data:image/')) {
        coverImageWarning = 'Cover image is a data URI (base64) and will not be included in Wix publish. Wix requires a public image URL.';
      }
    }

    try {
      const validation = validatePublishContent(content);
      if (!validation.valid) {
        return { success: false, message: validation.warning || 'Content validation failed.' };
      }

      let frontendAccessToken: string | undefined;

      if (typeof window.name === 'string' && window.name.startsWith('WIX_RESULT::')) {
        try {
          const payload = JSON.parse(atob(window.name.replace('WIX_RESULT::', '')));
          if (payload.access_token) {
            await storeEncrypted(WIX_TOKEN_KEY, payload.access_token);
            frontendAccessToken = payload.access_token;
          }
          window.name = '';
        } catch {}
      }

      if (!frontendAccessToken) {
        try {
          const raw = sessionStorage.getItem('wix_tokens');
          if (raw) {
            const parsed = JSON.parse(raw);
            frontendAccessToken = parsed.accessToken?.value || parsed.access_token || undefined;
          }
        } catch {}
      }

      if (!frontendAccessToken) {
        try {
          frontendAccessToken = (await readEncrypted(WIX_TOKEN_KEY)) || undefined;
        } catch {}
      }

      console.log('[WixPublish] Publishing — backend DB is authoritative token source; frontend token sent as fallback only.');

      const response = await apiClient.post('/api/wix/publish', {
        title,
        content,
        cover_image_url: coverImageUrl,
        category_names: metadata?.blog_categories || [],
        tag_names: metadata?.blog_tags || [],
        publish: true,
        ...(frontendAccessToken ? { access_token: frontendAccessToken } : {}),
        seo_metadata: metadata ? {
          seo_title: metadata.seo_title,
          meta_description: metadata.meta_description,
          focus_keyword: metadata.focus_keyword,
          url_slug: metadata.url_slug,
          blog_categories: metadata.blog_categories || [],
          blog_tags: metadata.blog_tags || [],
          social_hashtags: metadata.social_hashtags || [],
          open_graph: metadata.open_graph || {},
          twitter_card: metadata.twitter_card || {},
          canonical_url: metadata.canonical_url,
        } : undefined,
      });

      if (response.data.success) {
        const url = response.data.url;
        const apiWarning = response.data.warning;
        const warnings = [apiWarning, coverImageWarning].filter(Boolean);
        return {
          success: true,
          url,
          post_id: response.data.post_id,
          message: url
            ? `Blog post published to Wix! View it here: ${url}`
            : 'Blog post published successfully to Wix!',
          ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
        };
      }
      return {
        success: false,
        message: response.data.error || 'Failed to publish to Wix',
      };
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearStaleWixState();
        setWixStatus({ connected: false, has_permissions: false });
        pendingPublishRef.current = async () => publishToWix(content, metadata);
        setShowWixConnectModal(true);
        return {
          success: false,
          message: 'Wix tokens expired. Please reconnect your Wix account.',
          action_required: 'reconnect_wix',
        };
      }
      return {
        success: false,
        message: `Failed to publish to Wix: ${error.response?.data?.detail || error.message}`,
      };
    }
  }, [clearStaleWixState]);

  const handleWixConnectionSuccess = useCallback(async () => {
    await checkWixStatus();
    const fn = pendingPublishRef.current;
    if (fn) {
      pendingPublishRef.current = null;
      setTimeout(async () => {
        try {
          setPublishingWix(true);
          await fn();
        } catch {} finally {
          setPublishingWix(false);
        }
      }, 500);
    }
  }, [checkWixStatus]);

  const closeWixConnectModal = useCallback(() => {
    setShowWixConnectModal(false);
    pendingPublishRef.current = null;
  }, []);

  return {
    wixStatus,
    checkingWix,
    publishingWix,
    setPublishingWix,
    checkWixStatus,
    publishToWix,
    showWixConnectModal,
    setShowWixConnectModal,
    closeWixConnectModal,
    handleWixConnectionSuccess,
    validateWixContent: validatePublishContent,
  };
}