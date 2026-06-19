import type { EducationalContent } from '../types/contentStrategy.types';

// The runtime shape uses the canonical `EducationalContent` from
// types/contentStrategy.types.ts. The legacy helper returned a
// `points` / `tips` shape that did not match the canonical type;
// we now project the legacy fields onto the canonical
// `details` and `insight` arrays so consumers can read either.
export const getEducationalContent = (categoryId: string): EducationalContent => {
  switch (categoryId) {
    case 'business_context':
      return {
        title: 'Business Context',
        description: 'Understanding your business foundation is crucial for content strategy success.',
        details: [
          'Business objectives define what you want to achieve through content',
          'Target metrics help measure the success of your content strategy',
          'Content budget determines the scope and scale of your content efforts',
          'Team size affects content production capacity and frequency',
          'Implementation timeline sets realistic expectations for strategy rollout'
        ],
        insight: 'Be specific about your business goals, set measurable and achievable metrics, and consider your available resources realistically.'
      };
    case 'audience_intelligence':
      return {
        title: 'Audience Intelligence',
        description: 'Deep understanding of your audience drives content relevance and engagement.',
        details: [
          'Content preferences reveal what formats resonate with your audience',
          'Consumption patterns show when and how your audience engages',
          'Pain points help create content that solves real problems',
          'Buying journey mapping guides content at each stage',
          'Seasonal trends identify content opportunities throughout the year'
        ],
        insight: 'Research your audience thoroughly, create audience personas for better targeting, and monitor engagement patterns regularly.'
      };
    case 'competitive_intelligence':
      return {
        title: 'Competitive Intelligence',
        description: 'Understanding your competitive landscape helps differentiate your content.',
        details: [
          'Top competitors analysis reveals content gaps and opportunities',
          'Competitor strategies show what works in your industry',
          'Market gaps identify underserved content areas',
          'Industry trends keep your content current and relevant',
          'Emerging trends provide first-mover advantages'
        ],
        insight: 'Monitor competitors regularly, identify unique angles and perspectives, and stay ahead of industry trends.'
      };
    case 'content_strategy':
      return {
        title: 'Content Strategy',
        description: 'Your content approach defines how you\'ll achieve your business objectives.',
        details: [
          'Preferred formats align with audience preferences and business goals',
          'Content mix balances different types of content for maximum impact',
          'Content frequency should match audience expectations and team capacity',
          'Optimal timing maximizes content visibility and engagement',
          'Quality metrics ensure content meets audience standards'
        ],
        insight: 'Balance audience preferences with business goals, set realistic content production schedules, and maintain consistent quality standards.'
      };
    case 'performance_analytics':
      return {
        title: 'Performance & Analytics',
        description: 'Data-driven insights optimize your content strategy for better results.',
        details: [
          'Traffic sources show where your audience comes from',
          'Conversion rates measure content effectiveness',
          'ROI targets help justify content marketing investments',
          'A/B testing capabilities enable continuous optimization',
          'Regular analysis identifies improvement opportunities'
        ],
        insight: 'Track key metrics consistently, use data to inform content decisions, and continuously optimize based on performance.'
      };
    default:
      return {
        title: 'Category Information',
        description: 'Learn more about this content strategy category.',
        details: [],
        insight: ''
      };
  }
}; 