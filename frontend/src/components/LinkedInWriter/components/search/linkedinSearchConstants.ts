import type { LinkedInSearchCategory } from './linkedinSearchTypes';

export const LINKEDIN_SEARCH_PRIMARY = '#0a66c2';

export interface LinkedInSearchCategoryTab {
  id: LinkedInSearchCategory;
  label: string;
  resultType: 'POST' | 'JOB' | 'PEOPLE' | 'COMPANY';
}

/** v1: only Unipile Classic Search categories. */
export const LINKEDIN_SEARCH_CATEGORY_TABS: LinkedInSearchCategoryTab[] = [
  { id: 'posts', label: 'Posts', resultType: 'POST' },
  { id: 'jobs', label: 'Jobs', resultType: 'JOB' },
  { id: 'people', label: 'People', resultType: 'PEOPLE' },
  { id: 'companies', label: 'Companies', resultType: 'COMPANY' },
];

export const DEFAULT_LINKEDIN_SEARCH_CATEGORY: LinkedInSearchCategory = 'posts';

export const LINKEDIN_SEARCH_NOT_CONNECTED_MESSAGE =
  'Connect your LinkedIn account to search.';
