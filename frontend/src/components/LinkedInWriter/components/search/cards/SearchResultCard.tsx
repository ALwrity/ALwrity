import React from 'react';

import type { LinkedInSearchResultItem } from '../linkedinSearchTypes';
import { CompanyResultCard } from './CompanyResultCard';
import { JobResultCard } from './JobResultCard';
import { PeopleResultCard } from './PeopleResultCard';
import { PostResultCard } from './PostResultCard';

interface SearchResultCardProps {
  item: LinkedInSearchResultItem;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ item }) => {
  switch (item.type) {
    case 'PEOPLE':
      return <PeopleResultCard item={item} />;
    case 'COMPANY':
      return <CompanyResultCard item={item} />;
    case 'POST':
      return <PostResultCard item={item} />;
    case 'JOB':
      return <JobResultCard item={item} />;
    default:
      return null;
  }
};
