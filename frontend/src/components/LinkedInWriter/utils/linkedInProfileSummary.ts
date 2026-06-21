import type {

  LinkedInAccount,

  LinkedInConnectionStatus,

  LinkedInOrganization,

} from '../../../api/linkedinSocial';



export interface LinkedInCompanyPage {

  name: string;

  id: string;

}



export interface LinkedInProfileSummary {

  displayName: string;

  accountTypeLabel: string;

  providerLabel: string;

  connectionSourceLabel: string;

  accountIdDisplay: string | null;

  companyPages: LinkedInCompanyPage[];

}



const MAX_COMPANY_PAGES = 5;



function truncateId(id: string, maxLen = 12): string {

  if (id.length <= maxLen) return id;

  return `${id.slice(0, maxLen)}…`;

}



function formatProviderLabel(provider: string): string {

  if (provider === 'zernio') return 'Zernio';

  if (provider === 'native') return 'LinkedIn';

  return provider.charAt(0).toUpperCase() + provider.slice(1);

}



function isInternalUserId(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith('user_'));
}



function findPersonalAccount(accounts: LinkedInAccount[]): LinkedInAccount | undefined {

  return (

    accounts.find((a) => a.account_type === 'personal') ||

    accounts.find((a) => a.account_type !== 'organization') ||

    accounts[0]

  );

}



export function buildLinkedInProfileSummary(params: {

  status: LinkedInConnectionStatus | null;

  accounts: LinkedInAccount[];

  organizations: LinkedInOrganization[];

  provider: string;

}): LinkedInProfileSummary {

  const { status, accounts, organizations, provider } = params;



  const personalAccount = findPersonalAccount(accounts);

  const statusPersonal = status?.accounts?.find(

    (a) => a.account_type === 'personal' || a.account_type !== 'organization'

  );



  const statusAccountName = status?.account_name?.trim();
  const displayName =
    personalAccount?.username?.trim() ||
    (statusAccountName && !isInternalUserId(statusAccountName)
      ? statusAccountName
      : undefined) ||
    'LinkedIn account';



  const accountId =

    personalAccount?.account_id || statusPersonal?.account_id || accounts[0]?.account_id;



  const accountTypeLabel =

    personalAccount?.account_type === 'organization'

      ? 'Company page'

      : 'Personal profile';



  const companyPages: LinkedInCompanyPage[] = organizations

    .slice(0, MAX_COMPANY_PAGES)

    .map((org) => ({

      name: org.name?.trim() || org.organization_id,

      id: org.organization_id,

    }));



  const orgAccount = accounts.find((a) => a.account_type === 'organization');

  if (companyPages.length === 0 && orgAccount?.username) {

    companyPages.push({

      name: orgAccount.username,

      id: orgAccount.account_id,

    });

  }



  return {

    displayName,

    accountTypeLabel,

    providerLabel: formatProviderLabel(provider),

    connectionSourceLabel: 'Your account',

    accountIdDisplay: accountId ? truncateId(accountId) : null,

    companyPages,

  };

}



export function getInitials(name: string): string {

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'LI';

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();

}


