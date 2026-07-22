/**
 * localStorage helpers for LinkedIn social connection selections and avatar cache.
 */

export type LinkedInPostTarget = 'profile' | 'organization';

export const LEGACY_STORAGE_ACCOUNT = 'linkedin_social_selected_account';
export const LEGACY_STORAGE_TARGET = 'linkedin_social_selected_target';
export const LEGACY_STORAGE_ORG = 'linkedin_social_selected_org';

const AVATAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function linkedInStorageKey(key: string, userId: string): string {
  return `linkedin_social_${key}_${userId}`;
}

export function readCachedAvatar(uid: string): string | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(linkedInStorageKey('avatar_url', uid));
    if (!raw) return null;
    const { url, cachedAt } = JSON.parse(raw) as { url?: string; cachedAt?: number };
    if (!cachedAt || Date.now() - cachedAt > AVATAR_CACHE_TTL_MS) {
      localStorage.removeItem(linkedInStorageKey('avatar_url', uid));
      return null;
    }
    return url ?? null;
  } catch (err) {
    console.warn('[LinkedInConnect] failed to read cached avatar:', err);
    return null;
  }
}

export function writeCachedAvatar(uid: string, url: string): void {
  if (!url || !uid) return;
  try {
    localStorage.setItem(
      linkedInStorageKey('avatar_url', uid),
      JSON.stringify({ url, cachedAt: Date.now() })
    );
  } catch (err) {
    console.warn('[LinkedInConnect] failed to write cached avatar (storage full?):', err);
  }
}

export function clearCachedAvatar(uid: string): void {
  if (!uid) return;
  try {
    localStorage.removeItem(linkedInStorageKey('avatar_url', uid));
  } catch (err) {
    console.warn('[LinkedInConnect] failed to clear cached avatar:', err);
  }
}

export function readStoredAccountId(uid: string): string {
  try {
    if (uid) {
      return localStorage.getItem(linkedInStorageKey('selected_account', uid)) || '';
    }
    return localStorage.getItem(LEGACY_STORAGE_ACCOUNT) || '';
  } catch (err) {
    console.warn('[LinkedInConnect] failed to read stored account id:', err);
    return '';
  }
}

export function readStoredTarget(uid: string): LinkedInPostTarget {
  try {
    const raw = uid
      ? localStorage.getItem(linkedInStorageKey('selected_target', uid))
      : localStorage.getItem(LEGACY_STORAGE_TARGET);
    return raw === 'organization' ? 'organization' : 'profile';
  } catch (err) {
    console.warn('[LinkedInConnect] failed to read stored target:', err);
    return 'profile';
  }
}

export function readStoredOrgId(uid: string): string {
  try {
    if (uid) {
      return localStorage.getItem(linkedInStorageKey('selected_org', uid)) || '';
    }
    return localStorage.getItem(LEGACY_STORAGE_ORG) || '';
  } catch (err) {
    console.warn('[LinkedInConnect] failed to read stored org id:', err);
    return '';
  }
}

export function writeStoredAccountId(uid: string, accountId: string): void {
  try {
    if (uid) {
      localStorage.setItem(linkedInStorageKey('selected_account', uid), accountId);
    } else {
      localStorage.setItem(LEGACY_STORAGE_ACCOUNT, accountId);
    }
  } catch (err) {
    console.warn('[LinkedInConnect] failed to write stored account id:', err);
  }
}

export function writeStoredTarget(uid: string, target: LinkedInPostTarget): void {
  try {
    if (uid) {
      localStorage.setItem(linkedInStorageKey('selected_target', uid), target);
    } else {
      localStorage.setItem(LEGACY_STORAGE_TARGET, target);
    }
  } catch (err) {
    console.warn('[LinkedInConnect] failed to write stored target:', err);
  }
}

export function writeStoredOrgId(uid: string, orgId: string): void {
  try {
    if (uid) {
      localStorage.setItem(linkedInStorageKey('selected_org', uid), orgId);
    } else {
      localStorage.setItem(LEGACY_STORAGE_ORG, orgId);
    }
  } catch (err) {
    console.warn('[LinkedInConnect] failed to write stored org id:', err);
  }
}

/** Clears user-scoped and legacy selection keys from localStorage. */
export function clearSelectionKeys(uid: string): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_ACCOUNT);
    localStorage.removeItem(LEGACY_STORAGE_TARGET);
    localStorage.removeItem(LEGACY_STORAGE_ORG);
    if (uid) {
      localStorage.removeItem(linkedInStorageKey('selected_account', uid));
      localStorage.removeItem(linkedInStorageKey('selected_target', uid));
      localStorage.removeItem(linkedInStorageKey('selected_org', uid));
    }
  } catch (err) {
    console.warn('[LinkedInConnect] failed to clear selection keys:', err);
  }
}

/** Removes legacy selection keys after user-scoped keys are in use. */
export function clearLegacySelectionKeys(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_ACCOUNT);
    localStorage.removeItem(LEGACY_STORAGE_TARGET);
    localStorage.removeItem(LEGACY_STORAGE_ORG);
  } catch (err) {
    console.warn('[LinkedInConnect] failed to clear legacy selection keys:', err);
  }
}
