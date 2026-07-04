/**
 * TypeScript types for LinkedIn Studio search (Unipile Classic Search).
 * Shapes align with Unipile API responses for Phase 3 wiring.
 */

export type LinkedInSearchCategory = 'posts' | 'jobs' | 'people' | 'companies';

export type LinkedInSearchResultType = 'POST' | 'JOB' | 'PEOPLE' | 'COMPANY';

export interface LinkedInSearchPaging {
  start?: number;
  page_count?: number;
  total_count?: number;
}

export interface LinkedInSearchSkill {
  name?: string;
  endorsement_count?: number;
}

export interface LinkedInSearchPosition {
  company?: string;
  role?: string;
  location?: string;
  logo?: string;
}

export interface LinkedInSearchAuthor {
  public_identifier?: string;
  id?: string;
  name?: string;
  is_company?: boolean;
  headline?: string;
  profile_picture_url?: string;
}

export interface LinkedInSearchAttachment {
  type?: string;
  url?: string;
  unavailable?: boolean;
}

export interface LinkedInSearchJobCompany {
  id?: string;
  name?: string;
  profile_picture_url?: string;
  profile_url?: string;
}

export interface LinkedInSearchPeopleResult {
  object?: string;
  type: 'PEOPLE';
  id?: string;
  public_identifier?: string;
  public_profile_url?: string;
  profile_url?: string;
  profile_picture_url?: string;
  name?: string;
  headline?: string;
  location?: string;
  industry?: string;
  network_distance?: string;
  connections_count?: number;
  followers_count?: number;
  verified?: boolean;
  premium?: boolean;
  open_profile?: boolean;
  current_positions?: LinkedInSearchPosition[];
}

export interface LinkedInSearchCompanyResult {
  object?: string;
  type: 'COMPANY';
  id?: string;
  name?: string;
  location?: string;
  profile_url?: string;
  industry?: string;
  summary?: string;
  followers_count?: number;
  job_offers_count?: number;
  headcount?: string;
}

export interface LinkedInSearchPostResult {
  object?: string;
  type: 'POST';
  id?: string;
  share_url?: string;
  text?: string;
  date?: string;
  parsed_datetime?: string;
  reaction_counter?: number;
  comment_counter?: number;
  repost_counter?: number;
  author?: LinkedInSearchAuthor;
  attachments?: LinkedInSearchAttachment[];
}

export interface LinkedInSearchJobResult {
  object?: string;
  type: 'JOB';
  id?: string;
  title?: string;
  location?: string;
  posted_at?: string;
  url?: string;
  promoted?: boolean;
  easy_apply?: boolean;
  benefits?: string[];
  company?: LinkedInSearchJobCompany;
}

export type LinkedInSearchResultItem =
  | LinkedInSearchPeopleResult
  | LinkedInSearchCompanyResult
  | LinkedInSearchPostResult
  | LinkedInSearchJobResult;

export type LinkedInSearchErrorType = 'not_connected' | 'generic';

export interface UseLinkedInSearchOptions {
  connected: boolean;
}
