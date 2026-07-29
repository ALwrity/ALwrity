import React from 'react';
import {
  Article as ArticleIcon,
  Search as SearchIcon,
  Analytics as AnalyticsIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Speed as SpeedIcon,
  Business as BusinessIcon,
  SocialDistance as SocialIcon,
  Dashboard as DashboardIcon,
  Facebook as FacebookIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Instagram as InstagramIcon,
  Web as WebIcon,
  Timeline as StrategyIcon,
  CalendarMonth as CalendarIcon,
  AudioFile as AudioIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { ToolCategories } from '../components/shared/types';

// Export icons to avoid unused variable warning
export const Icons = {
  StrategyIcon,
  CalendarIcon
};

export const toolCategories: ToolCategories = {
  'Generate Content': {
    icon: React.createElement(AutoAwesomeIcon),
    color: '#4CAF50',
    gradient: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
    tools: [
      {
        name: 'Blog Writer',
        description: 'AI-powered blog post generation with SEO optimization',
        icon: React.createElement(ArticleIcon),
        status: 'beta',
        path: '/blog-writer',
        features: ['SEO Optimized', 'Multiple Formats', 'Custom Tone', 'Research Integration', 'Plagiarism Free'],
        isHighlighted: true
      },
      {
        name: 'Story Writer',
        description: 'Create stories with AI: outline, images, narration, and video',
        icon: React.createElement(MenuBookIcon),
        status: 'beta',
        path: '/story-writer',
        features: ['Structured Outline', 'Image Generation', 'Audio Narration', 'Story Video'],
        isHighlighted: true,
        featureKey: 'story_writer'
      },
      {
        name: 'Podcast Maker',
        description: 'Create professional podcast episodes with AI-powered research, scriptwriting, and voice narration',
        icon: React.createElement(AudioIcon),
        status: 'beta',
        path: '/podcast-maker',
        features: ['AI Research', 'Smart Scripting', 'Voice Narration', 'Export & Share', 'Episode Library'],
        isHighlighted: true
      },
      {
        name: 'Image Generator',
        description: 'AI image creation and visual content generation',
        icon: React.createElement(ImageIcon),
        status: 'beta',
        path: '/image-generator',
        features: ['AI Art Generation', 'Style Customization', 'High Resolution', 'Brand Consistency', 'Multiple Formats'],
        isHighlighted: true
      },
      {
        name: 'Image Editor',
        description: 'AI-powered editing: remove background, inpaint, recolor & relight',
        icon: React.createElement(ImageIcon),
        status: 'beta',
        path: '/image-editor',
        features: ['Background Removal', 'Inpainting', 'Outpainting', 'Recolor', 'Relight'],
        isHighlighted: true
      },
      {
        name: 'Audio Generator',
        description: 'AI voice synthesis and audio content creation',
        icon: React.createElement(AudioIcon),
        status: 'beta',
        path: '/audio-generator',
        features: ['Voice Synthesis', 'Multiple Languages', 'Custom Voices', 'Audio Editing', 'Export Options'],
        isHighlighted: true
      },
      {
        name: 'Video Studio',
        description: 'AI video creation, enhancement, and social-ready delivery',
        icon: React.createElement(VideoIcon),
        status: 'premium',
        path: '/video-studio',
        features: ['Text/Image to Video', 'Enhance & Upscale', 'Social Packs', 'Provider-Agnostic', 'Cost Transparency'],
        isHighlighted: true
      }
    ]
  },
  'SEO Tools': {
    icon: React.createElement(SearchIcon),
    color: '#2196F3',
    gradient: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
    subCategories: {
      'Enterprise & Advanced': {
        tools: [
          {
            name: 'SEO Dashboard',
            description: 'AI-powered SEO analysis and actionable insights',
            icon: React.createElement(AnalyticsIcon),
            status: 'beta',
            path: '/seo-dashboard',
            features: ['AI Insights', 'Performance Tracking', 'Actionable Recommendations'],
            isPinned: true,
            isHighlighted: true
          },
          {
            name: 'Content Planning Dashboard',
            description: 'AI-powered content strategy and planning with gap analysis',
            icon: React.createElement(PsychologyIcon),
            status: 'beta',
            path: '/content-planning',
            features: ['Content Strategy', 'Gap Analysis', 'AI Recommendations', 'Calendar Management'],
            isPinned: true,
            isHighlighted: true
          },
          {
            name: 'Backlink Outreach',
            description: 'Discover guest post opportunities with AI-powered deep scraping',
            icon: React.createElement(LinkIcon),
            status: 'beta',
            path: '/backlink-outreach',
            features: ['AI Discovery', 'Guest Post Opportunities', 'Campaign Management'],
            isPinned: true,
            isHighlighted: true
          },
          {
            name: 'AI Content Strategy Generator',
            description: 'Comprehensive content planning with market intelligence',
            icon: React.createElement(PsychologyIcon),
            status: 'beta',
            path: '/content-planning',
            features: ['Market Intelligence', 'Topic Clusters', 'Implementation Roadmaps']
          },
          {
            name: 'Enterprise SEO Suite',
            description: 'Unified workflow orchestration for comprehensive SEO management',
            icon: React.createElement(BusinessIcon),
            status: 'premium',
            path: '/enterprise-seo-suite',
            features: ['Complete Audits', 'AI Recommendations', 'Strategic Planning']
          },
          {
            name: 'Google Search Console Intelligence',
            description: 'Advanced GSC data analysis with AI-powered insights',
            icon: React.createElement(AnalyticsIcon),
            status: 'premium',
            path: '/gsc-intelligence',
            features: ['Content Opportunities', 'Search Intelligence', 'Competitive Analysis']
          }
        ]
      },
      'Technical SEO Tools': {
        tools: [
          {
            name: 'On-Page SEO Analyzer',
            description: 'Comprehensive page-level SEO optimization analysis',
            icon: React.createElement(SearchIcon),
            status: 'active',
            path: '/on-page-seo-analyzer',
            features: ['Technical SEO', 'Content Analysis', 'Optimization Suggestions']
          },
          {
            name: 'Technical SEO Crawler',
            description: 'Site-wide technical analysis and performance metrics',
            icon: React.createElement(SpeedIcon),
            status: 'active',
            path: '/technical-seo-crawler',
            features: ['Crawl Analysis', 'Performance Metrics', 'AI Recommendations']
          },
          {
            name: 'Google PageSpeed Insights',
            description: 'Website performance and Core Web Vitals analysis',
            icon: React.createElement(SpeedIcon),
            status: 'active',
            path: '/pagespeed-insights',
            features: ['Core Web Vitals', 'Speed Optimization', 'Mobile Performance']
          },
          {
            name: 'URL SEO Checker',
            description: 'Individual URL analysis and optimization recommendations',
            icon: React.createElement(SearchIcon),
            status: 'active',
            path: '/url-seo-checker',
            features: ['Technical Factors', 'Optimization Tips', 'Detailed Reports']
          },
          {
            name: 'Sitemap Analysis',
            description: 'XML and HTML sitemap analysis and optimization',
            icon: React.createElement(SearchIcon),
            status: 'active',
            path: '/sitemap-analysis',
            features: ['Sitemap Validation', 'Structure Analysis', 'Optimization Tips']
          }
        ]
      },
      'AI & Analysis Tools': {
        tools: [
          {
            name: 'Content Gap Analysis',
            description: 'Advanced competitive content analysis and opportunities',
            icon: React.createElement(SearchIcon),
            status: 'active',
            path: '/content-gap-analysis',
            features: ['Competitive Analysis', 'AI Insights', 'Opportunity Identification']
          },
          {
            name: 'CGPT SEO Analyzer',
            description: 'AI-powered SEO analysis using advanced language models',
            icon: React.createElement(PsychologyIcon),
            status: 'active',
            path: '/cgpt-seo-analyzer',
            features: ['AI Analysis', 'Advanced Insights', 'Strategic Recommendations']
          },
          {
            name: 'Webpage Content Analysis',
            description: 'Deep content analysis and optimization insights',
            icon: React.createElement(ArticleIcon),
            status: 'active',
            path: '/webpage-content-analysis',
            features: ['Content Quality', 'Readability Analysis', 'Optimization Tips']
          },
          {
            name: 'WordCloud Generator',
            description: 'Visual keyword and content analysis with word clouds',
            icon: React.createElement(AnalyticsIcon),
            status: 'active',
            path: '/wordcloud-generator',
            features: ['Visual Analysis', 'Keyword Mapping', 'Content Insights']
          },
          {
            name: 'TextStat Analysis',
            description: 'Advanced text statistics and readability analysis',
            icon: React.createElement(AnalyticsIcon),
            status: 'active',
            path: '/textstat-analysis',
            features: ['Readability Metrics', 'Text Statistics', 'Content Optimization']
          }
        ]
      },
      'SEO Optimization Tools': {
        tools: [
          {
            name: 'SEO Analysis',
            description: 'Comprehensive SEO analysis and reporting',
            icon: React.createElement(AnalyticsIcon),
            status: 'active',
            path: '/seo-analysis',
            features: ['Complete Analysis', 'Detailed Reports', 'Actionable Insights']
          },
          {
            name: 'OpenGraph Generator',
            description: 'Social media optimization for Facebook and LinkedIn',
            icon: React.createElement(SocialIcon),
            status: 'active',
            path: '/opengraph-generator',
            features: ['Social Optimization', 'Visual Appeal', 'Click Enhancement']
          },
          {
            name: 'Schema Markup Generator',
            description: 'Structured data creation for rich snippets',
            icon: React.createElement(SearchIcon),
            status: 'active',
            path: '/schema-generator',
            features: ['Rich Snippets', 'Search Enhancement', 'Content Understanding']
          }
        ]
      }
    }
  },
  'Social Media': {
    icon: React.createElement(SocialIcon),
    color: '#FF9800',
    gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
    tools: [
      {
        name: 'Facebook Content Writer',
        description: 'Engaging Facebook posts and ads with AI persona optimization',
        icon: React.createElement(SocialIcon),
        status: 'beta',
        path: '/facebook-writer',
        features: ['Persona-Aware AI', 'Engagement Focused', 'Ad Copy', 'Post Scheduling', 'Platform Optimization'],
        isHighlighted: true
      },
      {
        name: 'LinkedIn Content Writer',
        description: 'Professional LinkedIn content with AI persona optimization',
        icon: React.createElement(BusinessIcon),
        status: 'beta',
        path: '/linkedin-writer',
        features: ['Persona-Aware AI', 'Professional Tone', 'Thought Leadership', 'B2B Focus', 'Platform Optimization'],
        isHighlighted: true
      },
      {
        name: 'Twitter Content Writer',
        description: 'Viral Twitter threads and tweets',
        icon: React.createElement(SocialIcon),
        status: 'premium',
        path: '/twitter-writer',
        features: ['Viral Potential', 'Thread Creation', 'Hashtag Optimization']
      },
      {
        name: 'Instagram Content Writer',
        description: 'Visual and engaging Instagram content',
        icon: React.createElement(SocialIcon),
        status: 'premium',
        path: '/instagram-writer',
        features: ['Visual Descriptions', 'Hashtag Strategy', 'Story Content']
      },
      {
        name: 'YouTube Creator Studio',
        description: 'AI-powered YouTube video creation with scenes and rendering',
        icon: React.createElement(SocialIcon),
        status: 'active',
        path: '/youtube-creator',
        features: ['Video Planning', 'Scene Generation', 'AI Video Rendering', 'Cost Estimation']
      }
    ]
  },
  'Dashboards': {
    icon: React.createElement(DashboardIcon),
    color: '#9C27B0',
    gradient: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
    tools: [
      {
        name: 'SEO Dashboard',
        description: 'Comprehensive SEO analytics and performance tracking',
        icon: React.createElement(SearchIcon),
        status: 'beta',
        path: '/seo-dashboard',
        features: ['Keyword Rankings', 'Traffic Analytics', 'Backlink Monitoring', 'Site Health', 'Competitor Analysis'],
        isHighlighted: true
      },
      {
        name: 'Facebook Dashboard',
        description: 'Facebook page insights and content performance analytics',
        icon: React.createElement(FacebookIcon),
        status: 'beta',
        path: '/facebook-dashboard',
        features: ['Page Insights', 'Post Performance', 'Audience Analytics', 'Engagement Metrics', 'Ad Performance'],
        isHighlighted: true
      },
      {
        name: 'LinkedIn Dashboard',
        description: 'LinkedIn company page and content analytics',
        icon: React.createElement(LinkedInIcon),
        status: 'beta',
        path: '/linkedin-dashboard',
        features: ['Company Analytics', 'Content Performance', 'Lead Generation', 'B2B Insights', 'Network Growth'],
        isHighlighted: true
      },
      {
        name: 'Twitter Dashboard',
        description: 'Twitter analytics and engagement tracking',
        icon: React.createElement(TwitterIcon),
        status: 'pro',
        path: '/twitter-dashboard',
        features: ['Tweet Analytics', 'Follower Growth', 'Engagement Rates', 'Hashtag Performance', 'Mention Tracking']
      },
      {
        name: 'Instagram Dashboard',
        description: 'Instagram insights and visual content analytics',
        icon: React.createElement(InstagramIcon),
        status: 'pro',
        path: '/instagram-dashboard',
        features: ['Story Analytics', 'Post Performance', 'Reach & Impressions', 'Hashtag Insights', 'Audience Demographics']
      },
      {
        name: 'Website Dashboard',
        description: 'Website performance and visitor analytics',
        icon: React.createElement(WebIcon),
        status: 'pro',
        path: '/website-dashboard',
        features: ['Traffic Analysis', 'Page Performance', 'User Behavior', 'Conversion Tracking', 'Site Speed']
      },
      {
        name: 'Calendar Dashboard',
        description: 'Content calendar management and scheduling analytics',
        icon: React.createElement(CalendarIcon),
        status: 'beta',
        path: '/calendar-dashboard',
        features: ['Content Scheduling', 'Publishing Calendar', 'Performance Tracking', 'Team Collaboration', 'Content Planning']
      }
    ]
  }
}; 