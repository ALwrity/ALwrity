import React from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import CodeIcon from '@mui/icons-material/Code';
import AccessibilityIcon from '@mui/icons-material/Accessibility';
import MobileIcon from '@mui/icons-material/MobileFriendly';
import SearchIcon from '@mui/icons-material/Search';
import ArticleIcon from '@mui/icons-material/Article';

// SEO Analysis Utilities
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'excellent':
      return '#00C853';
    case 'good':
      return '#4CAF50';
    case 'needs_improvement':
      return '#FF9800';
    case 'poor':
      return '#D32F2F'; // Softer red instead of bright #F44336
    default:
      return '#9E9E9E';
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'excellent':
      return <CheckCircleIcon sx={{ color: '#00C853' }} />;
    case 'good':
      return <CheckCircleIcon sx={{ color: '#4CAF50' }} />;
    case 'needs_improvement':
      return <WarningIcon sx={{ color: '#FF9800' }} />;
    case 'poor':
      return <ErrorIcon sx={{ color: '#D32F2F' }} />; // Softer red
    default:
      return <InfoIcon sx={{ color: '#9E9E9E' }} />;
  }
};

export const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'url_structure':
      return <SearchIcon sx={{ color: '#2196F3' }} />;
    case 'meta_data':
      return <ArticleIcon sx={{ color: '#FF9800' }} />;
    case 'content_analysis':
      return <ArticleIcon sx={{ color: '#4CAF50' }} />;
    case 'technical_seo':
      return <CodeIcon sx={{ color: '#9C27B0' }} />;
    case 'performance':
      return <SpeedIcon sx={{ color: '#00BCD4' }} />;
    case 'accessibility':
      return <AccessibilityIcon sx={{ color: '#FF5722' }} />;
    case 'user_experience':
      return <MobileIcon sx={{ color: '#795548' }} />;
    case 'security_headers':
      return <SecurityIcon sx={{ color: '#E91E63' }} />;
    default:
      return <InfoIcon sx={{ color: '#607D8B' }} />;
  }
};

export const getCategoryTitle = (category: string) => {
  const titles: { [key: string]: string } = {
    'url_structure': 'URL Structure & Security',
    'meta_data': 'Meta Data & Technical SEO',
    'content_analysis': 'Content Analysis',
    'technical_seo': 'Technical SEO',
    'performance': 'Performance',
    'accessibility': 'Accessibility',
    'user_experience': 'User Experience',
    'security_headers': 'Security Headers',
    'keyword_analysis': 'Keyword Analysis'
  };
  return titles[category] || category.replace('_', ' ').toUpperCase();
};

export const getAnalysisDetails = () => {
  return [
    {
      title: "URL Structure & Security",
      description: "Analyzes URL format, length, special characters, and security protocols like HTTPS.",
      tests: ["URL length check", "Special character analysis", "HTTPS implementation", "URL readability"]
    },
    {
      title: "Meta Data & Technical SEO",
      description: "Examines title tags, meta descriptions, viewport settings, and character encoding.",
      tests: ["Title tag optimization", "Meta description length", "Viewport meta tag", "Character encoding"]
    },
    {
      title: "Content Analysis",
      description: "Evaluates content quality, word count, heading structure, and readability.",
      tests: ["Content length analysis", "Heading hierarchy", "Readability scoring", "Internal linking"]
    },
    {
      title: "Technical SEO",
      description: "Checks robots.txt, sitemaps, structured data, and canonical URLs.",
      tests: ["Robots.txt accessibility", "XML sitemap presence", "Structured data markup", "Canonical URLs"]
    },
    {
      title: "Performance",
      description: "Measures page load speed, compression, caching, and optimization.",
      tests: ["Page load time", "GZIP compression", "Caching headers", "Resource optimization"]
    },
    {
      title: "Accessibility",
      description: "Ensures alt text, form labels, heading structure, and color contrast.",
      tests: ["Image alt text", "Form accessibility", "Heading hierarchy", "Color contrast"]
    },
    {
      title: "User Experience",
      description: "Checks mobile responsiveness, navigation, contact info, and social links.",
      tests: ["Mobile optimization", "Navigation structure", "Contact information", "Social media links"]
    },
    {
      title: "Security Headers",
      description: "Analyzes security headers for protection against common vulnerabilities.",
      tests: ["X-Frame-Options", "X-Content-Type-Options", "X-XSS-Protection", "Content-Security-Policy"]
    }
  ];
};

export const categorizeAnalysisData = (analysisData: any) => {
  if (!analysisData?.data) return { good: [], bad: [], ugly: [] };

  const categories = Object.entries(analysisData.data);
  const categorized = {
    good: [] as any[],
    bad: [] as any[],
    ugly: [] as any[]
  };

  categories.forEach(([category, data]) => {
    if (!data || typeof data !== 'object' || !(data as any).score) return;
    
    const score = (data as any).score;
    if (score >= 80) {
      categorized.good.push({ category, data });
    } else if (score >= 60) {
      categorized.bad.push({ category, data });
    } else {
      categorized.ugly.push({ category, data });
    }
  });

  return categorized;
};

export const formatMessage = (message: string) => {
  if (message.includes(':')) {
    const [title, details] = message.split(':');
    return { title: title.trim(), details: details.trim() };
  }
  return { title: message, details: null };
}; 