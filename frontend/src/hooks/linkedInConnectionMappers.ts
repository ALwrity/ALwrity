/**
 * Pure mappers for LinkedIn connection status payloads.
 */

import type {
  LinkedInAccount,
  LinkedInConnectionStatus,
  LinkedInOrganization,
} from '../api/linkedinSocial';

/** Maps lightweight status.accounts entries into LinkedInAccount shape. */
export function statusAccountsToLinkedInAccounts(
  status: LinkedInConnectionStatus
): LinkedInAccount[] {
  return (status.accounts || []).map((a) => ({
    account_id: a.account_id,
    account_type: a.account_type ?? null,
    username: null,
    platform: 'linkedin',
  }));
}

/** Maps status.organizations entries into LinkedInOrganization shape. */
export function statusOrganizationsToLinkedInOrganizations(
  status: LinkedInConnectionStatus
): LinkedInOrganization[] {
  return (status.organizations || []).map((o) => ({
    organization_id: o.organization_id,
    name: o.name,
    urn: o.urn,
  }));
}
