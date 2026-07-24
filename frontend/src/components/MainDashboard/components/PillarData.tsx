import React from 'react';
import {
  // Plan pillar icons
  Assignment as PlanIcon,
  PersonAdd as OnboardingIcon,
  Business as StrategyIcon,
  CalendarMonth as CalendarIcon,
  RateReview as ReviewIcon,
  
  // Generate pillar icons
  AutoAwesome as GenerateIcon,
  ThumbUp as GoodIcon,
  ThumbDown as BadIcon,
  Warning as UglyIcon,
  
  // Publish pillar icons
  Publish as PublishIcon,
  
  // Analyze pillar icons
  Analytics as AnalyzeIcon,
  
  // Engage pillar icons
  Campaign as EngageIcon,
  
  // Remarket pillar icons
  Psychology as RemarketIcon,
  
  // Task icons
  Facebook as FacebookIcon,
  LinkedIn as LinkedInIcon,
  Language as WebsiteIcon,
  ChatBubbleOutline as ChatIcon,
  Assessment as AssessmentIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  Refresh as RefreshIcon,
  Article as ArticleIcon
} from '@mui/icons-material';
import { TodayTask } from '../../../types/workflow';

// Define the chip interface
export interface PillarChip {
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  gradient: string;
  bubbles: string[];
  value?: number | null;
}

// Define the pillar data interface
export interface PillarData {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  gradient: string;
  chips: {
    [key: string]: PillarChip;
  };
  todayTasks: TodayTask[];
}

// Enhanced pillar data with Today tasks
export const pillarData: PillarData[] = [
  {
    id: 'plan',
    title: 'Plan',
    icon: PlanIcon,
    color: '#2E7D32',
    gradient: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
    chips: {
      onboarding: { 
        label: 'On-Boarding', 
        icon: OnboardingIcon, 
        color: '#4CAF50', 
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)', 
        bubbles: ['User Profile Setup', 'Preferences Configured', 'Goals Defined'], 
        value: 2 
      },
      strategy: { 
        label: 'Strategy', 
        icon: StrategyIcon, 
        color: '#2196F3', 
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)', 
        bubbles: ['Content Strategy Defined', 'Target Audience Identified', 'Brand Voice Established'], 
        value: 7 
      },
      calendar: { 
        label: 'Calendar', 
        icon: CalendarIcon, 
        color: '#FF9800', 
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)', 
        bubbles: ['Publishing Schedule Set', 'Content Calendar Created', 'Campaign Timeline Planned'], 
        value: 11 
      },
      review: { 
        label: 'Review & Optimize', 
        icon: ReviewIcon, 
        color: '#9C27B0', 
        gradient: 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)', 
        bubbles: ['Content Calendar Generated', 'SEO Strategy Optimized', 'Topic Clusters Identified'], 
        value: null 
      }
    },
    todayTasks: [
      {
        id: 'content-calendar',
        pillarId: 'plan',
        title: 'Create Weekly Content Calendar',
        description: 'Plan and schedule content for the upcoming week',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 20,
        actionType: 'navigate' as const,
        actionUrl: '/content-planning-dashboard',
        icon: CalendarIcon,
        color: '#2E7D32',
        enabled: true,
        action: () => console.log('Navigate to content calendar')
      },
      {
        id: 'seo-strategy',
        pillarId: 'plan',
        title: 'Update SEO Strategy',
        description: 'Review and optimize SEO keywords and content strategy',
        status: 'pending' as const,
        priority: 'medium' as const,
        estimatedTime: 15,
        actionType: 'navigate' as const,
        actionUrl: '/seo-strategy',
        icon: AssessmentIcon,
        color: '#2196F3',
        enabled: true,
        action: () => console.log('Navigate to SEO strategy')
      },
      {
        id: 'competitor-analysis',
        pillarId: 'plan',
        title: 'Competitor Analysis',
        description: 'Analyze competitor content and identify opportunities',
        status: 'pending' as const,
        priority: 'low' as const,
        estimatedTime: 30,
        actionType: 'navigate' as const,
        actionUrl: '/competitor-analysis',
        icon: AnalyzeIcon,
        color: '#FF9800',
        enabled: false,
        action: () => {}
      }
    ]
  },
  {
    id: 'generate',
    title: 'Generate',
    icon: GenerateIcon,
    color: '#1565C0',
    gradient: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
    chips: {
      good: { 
        label: 'Quality Content', 
        icon: GoodIcon, 
        color: '#4CAF50', 
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
        bubbles: ['SEO Optimized', 'Brand Voice Consistent', 'Engaging Headlines'] 
      },
      bad: { 
        label: 'Content Issues', 
        icon: BadIcon, 
        color: '#F44336', 
        gradient: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)',
        bubbles: ['Poor Grammar', 'Weak CTAs', 'Generic Content'] 
      },
      ugly: { 
        label: 'Critical Problems', 
        icon: UglyIcon, 
        color: '#FF9800', 
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        bubbles: ['No Brand Voice', 'Plagiarized Content', 'No SEO Optimization'] 
      },
      review: { 
        label: 'Review & Optimize', 
        icon: ReviewIcon, 
        color: '#2196F3', 
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
        bubbles: ['Blog Post Generated', 'Social Media Content Created', 'Email Campaign Written'] 
      }
    },
    todayTasks: [
      {
        id: 'facebook-post',
        pillarId: 'generate',
        title: "Post 'ALwrity AI Content Generation' on Facebook",
        description: 'Create and publish engaging Facebook content',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 15,
        actionType: 'navigate' as const,
        actionUrl: '/facebook-writer',
        icon: FacebookIcon,
        color: '#1877F2',
        enabled: true,
        action: () => console.log('Navigate to Facebook writer')
      },
      {
        id: 'blog-post',
        pillarId: 'generate',
        title: 'Write Blog on "AI Image Generation Prompts"',
        description: 'Create comprehensive blog post for website',
        status: 'pending' as const,
        priority: 'medium' as const,
        estimatedTime: 45,
        actionType: 'navigate' as const,
        actionUrl: '/blog-writer',
        icon: ArticleIcon,
        color: '#FF6B35',
        enabled: false,
        action: () => {}
      },
      {
        id: 'linkedin-post',
        pillarId: 'generate',
        title: "Write & Post on LinkedIn 'AI Agents Frameworks'",
        description: 'Create professional LinkedIn content',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 20,
        actionType: 'navigate' as const,
        actionUrl: '/linkedin-studio',
        icon: LinkedInIcon,
        color: '#0077B5',
        enabled: true,
        action: () => console.log('Navigate to LinkedIn writer')
      }
    ]
  },
  {
    id: 'publish',
    title: 'Publish',
    icon: PublishIcon,
    color: '#E65100',
    gradient: 'linear-gradient(135deg, #E65100 0%, #BF360C 100%)',
    chips: {
      good: { 
        label: 'Smooth Publishing', 
        icon: GoodIcon, 
        color: '#4CAF50', 
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
        bubbles: ['Multi-Platform Sync', 'Optimal Timing', 'Auto-Scheduling'] 
      },
      bad: { 
        label: 'Publishing Issues', 
        icon: BadIcon, 
        color: '#F44336', 
        gradient: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)',
        bubbles: ['Manual Publishing', 'Poor Timing', 'Platform Errors'] 
      },
      ugly: { 
        label: 'Critical Failures', 
        icon: UglyIcon, 
        color: '#FF9800', 
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        bubbles: ['No Publishing Strategy', 'Content Not Published', 'Platform Disconnects'] 
      },
      review: { 
        label: 'Review & Optimize', 
        icon: ReviewIcon, 
        color: '#2196F3', 
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
        bubbles: ['Content Published to LinkedIn', 'Facebook Post Scheduled', 'Twitter Thread Live'] 
      }
    },
    todayTasks: [
      {
        id: 'schedule-posts',
        pillarId: 'publish',
        title: 'Schedule Today\'s Content',
        description: 'Schedule all content for optimal engagement times',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 10,
        actionType: 'navigate' as const,
        actionUrl: '/publishing-scheduler',
        icon: PublishIcon,
        color: '#E65100',
        enabled: true,
        action: () => console.log('Navigate to publishing scheduler')
      },
      {
        id: 'cross-platform',
        pillarId: 'publish',
        title: 'Cross-Platform Publishing',
        description: 'Publish content across all connected platforms',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 15,
        actionType: 'navigate' as const,
        actionUrl: '/cross-platform-publisher',
        icon: ShareIcon,
        color: '#4CAF50',
        enabled: true,
        action: () => console.log('Navigate to cross-platform publisher')
      },
      {
        id: 'publish-analytics',
        pillarId: 'publish',
        title: 'Publishing Analytics Review',
        description: 'Review publishing performance and optimize timing',
        status: 'pending' as const,
        priority: 'low' as const,
        estimatedTime: 20,
        actionType: 'navigate' as const,
        actionUrl: '/publishing-analytics',
        icon: AnalyzeIcon,
        color: '#2196F3',
        enabled: false,
        action: () => {}
      }
    ]
  },
  {
    id: 'analyze',
    title: 'Analyze',
    icon: AnalyzeIcon,
    color: '#6A1B9A',
    gradient: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)',
    chips: {
      good: { 
        label: 'Great Analytics', 
        icon: GoodIcon, 
        color: '#4CAF50', 
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
        bubbles: ['Real-time Tracking', 'Detailed Insights', 'ROI Measurement'] 
      },
      bad: { 
        label: 'Analytics Gaps', 
        icon: BadIcon, 
        color: '#F44336', 
        gradient: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)',
        bubbles: ['Limited Tracking', 'No ROI Data', 'Poor Reporting'] 
      },
      ugly: { 
        label: 'No Analytics', 
        icon: UglyIcon, 
        color: '#FF9800', 
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        bubbles: ['No Tracking Setup', 'No Performance Data', 'Blind Publishing'] 
      },
      review: { 
        label: 'Review & Optimize', 
        icon: ReviewIcon, 
        color: '#2196F3', 
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
        bubbles: ['Engagement Rate: +25%', 'Click-Through Rate Improved', 'Social Shares Increased'] 
      }
    },
    todayTasks: [
      {
        id: 'performance-report',
        pillarId: 'analyze',
        title: 'Generate Performance Report',
        description: 'Create comprehensive analytics report for this week',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 25,
        actionType: 'navigate' as const,
        actionUrl: '/analytics-dashboard',
        icon: AnalyzeIcon,
        color: '#6A1B9A',
        enabled: true,
        action: () => console.log('Navigate to analytics dashboard')
      },
      {
        id: 'engagement-analysis',
        pillarId: 'analyze',
        title: 'Engagement Analysis',
        description: 'Analyze engagement metrics and identify trends',
        status: 'pending' as const,
        priority: 'medium' as const,
        estimatedTime: 20,
        actionType: 'navigate' as const,
        actionUrl: '/engagement-analytics',
        icon: ThumbUpIcon,
        color: '#4CAF50',
        enabled: true,
        action: () => console.log('Navigate to engagement analytics')
      },
      {
        id: 'roi-calculator',
        pillarId: 'analyze',
        title: 'ROI Calculator Update',
        description: 'Update ROI calculations and performance metrics',
        status: 'pending' as const,
        priority: 'low' as const,
        estimatedTime: 15,
        actionType: 'navigate' as const,
        actionUrl: '/roi-calculator',
        icon: AssessmentIcon,
        color: '#FF9800',
        enabled: false,
        action: () => {}
      }
    ]
  },
  {
    id: 'engage',
    title: 'Engage',
    icon: EngageIcon,
    color: '#C2185B',
    gradient: 'linear-gradient(135deg, #C2185B 0%, #880E4F 100%)',
    chips: {
      good: { 
        label: 'High Engagement', 
        icon: GoodIcon, 
        color: '#4CAF50', 
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
        bubbles: ['Active Community', 'Quick Responses', 'Viral Content'] 
      },
      bad: { 
        label: 'Low Engagement', 
        icon: BadIcon, 
        color: '#F44336', 
        gradient: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)',
        bubbles: ['Slow Responses', 'Few Interactions', 'Poor Community'] 
      },
      ugly: { 
        label: 'No Engagement', 
        icon: UglyIcon, 
        color: '#FF9800', 
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        bubbles: ['No Community', 'No Responses', 'Ignored Content'] 
      },
      review: { 
        label: 'Review & Optimize', 
        icon: ReviewIcon, 
        color: '#2196F3', 
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
        bubbles: ['Comments Responded Automatically', 'Community Engagement Boosted', 'Customer Queries Resolved'] 
      }
    },
    todayTasks: [
      {
        id: 'respond-comments',
        pillarId: 'engage',
        title: 'Respond to Comments',
        description: 'Engage with audience comments across all platforms',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 30,
        actionType: 'navigate' as const,
        actionUrl: '/comment-management',
        icon: ChatIcon,
        color: '#C2185B',
        enabled: true,
        action: () => console.log('Navigate to comment management')
      },
      {
        id: 'community-building',
        pillarId: 'engage',
        title: 'Community Building',
        description: 'Foster community engagement and build relationships',
        status: 'pending' as const,
        priority: 'medium' as const,
        estimatedTime: 25,
        actionType: 'navigate' as const,
        actionUrl: '/community-tools',
        icon: ThumbUpIcon,
        color: '#4CAF50',
        enabled: true,
        action: () => console.log('Navigate to community tools')
      },
      {
        id: 'engagement-strategy',
        pillarId: 'engage',
        title: 'Engagement Strategy Review',
        description: 'Review and optimize engagement strategies',
        status: 'pending' as const,
        priority: 'low' as const,
        estimatedTime: 20,
        actionType: 'navigate' as const,
        actionUrl: '/engagement-strategy',
        icon: AssessmentIcon,
        color: '#FF9800',
        enabled: false,
        action: () => {}
      }
    ]
  },
  {
    id: 'remarket',
    title: 'Remarket',
    icon: RemarketIcon,
    color: '#00695C',
    gradient: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)',
    chips: {
      good: { 
        label: 'Smart Remarketing', 
        icon: GoodIcon, 
        color: '#4CAF50', 
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
        bubbles: ['Targeted Campaigns', 'High Conversion', 'ROI Optimized'] 
      },
      bad: { 
        label: 'Poor Remarketing', 
        icon: BadIcon, 
        color: '#F44336', 
        gradient: 'linear-gradient(135deg, #F44336 0%, #C62828 100%)',
        bubbles: ['Low Conversion', 'Poor Targeting', 'Wasted Budget'] 
      },
      ugly: { 
        label: 'No Remarketing', 
        icon: UglyIcon, 
        color: '#FF9800', 
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        bubbles: ['No Retargeting', 'Lost Opportunities', 'No Lead Nurturing'] 
      },
      review: { 
        label: 'Review & Optimize', 
        icon: ReviewIcon, 
        color: '#2196F3', 
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
        bubbles: ['Remarketing Campaign Launched', 'Content Amplified Successfully', 'Lead Nurturing Sequence Active'] 
      }
    },
    todayTasks: [
      {
        id: 'retargeting-campaign',
        pillarId: 'remarket',
        title: 'Launch Retargeting Campaign',
        description: 'Create and launch targeted remarketing campaigns',
        status: 'pending' as const,
        priority: 'high' as const,
        estimatedTime: 35,
        actionType: 'navigate' as const,
        actionUrl: '/remarketing-dashboard',
        icon: RemarketIcon,
        color: '#00695C',
        enabled: true,
        action: () => console.log('Navigate to remarketing dashboard')
      },
      {
        id: 'lead-nurturing',
        pillarId: 'remarket',
        title: 'Lead Nurturing Sequence',
        description: 'Set up automated lead nurturing workflows',
        status: 'pending' as const,
        priority: 'medium' as const,
        estimatedTime: 30,
        actionType: 'navigate' as const,
        actionUrl: '/lead-nurturing',
        icon: RefreshIcon,
        color: '#4CAF50',
        enabled: true,
        action: () => console.log('Navigate to lead nurturing')
      },
      {
        id: 'conversion-optimization',
        pillarId: 'remarket',
        title: 'Conversion Optimization',
        description: 'Optimize remarketing campaigns for better conversion',
        status: 'pending' as const,
        priority: 'low' as const,
        estimatedTime: 25,
        actionType: 'navigate' as const,
        actionUrl: '/conversion-optimization',
        icon: AssessmentIcon,
        color: '#FF9800',
        enabled: false,
        action: () => {}
      }
    ]
  }
];

export default pillarData;
