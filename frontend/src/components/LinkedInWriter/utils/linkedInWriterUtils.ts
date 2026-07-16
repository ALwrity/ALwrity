import { LinkedInPostType, LinkedInTone, SearchEngine } from '../../../services/linkedInWriterApi';

// LinkedIn Writer Utilities
export const PREFS_KEY = 'linkedinwriter:preferences';

// LinkedIn-specific validation constants
export const VALID_POST_TYPES = [
  'professional',
  'thought_leadership',
  'industry_news',
  'personal_story',
  'company_update',
  'poll'
] as const;

export const VALID_TONES = [
  'professional',
  'conversational',
  'authoritative',
  'inspirational',
  'educational',
  'friendly'
] as const;

export const VALID_SEARCH_ENGINES = [
  'google',
  'tavily',
  'exa'
] as const;

export const VALID_INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Manufacturing',
  'Retail',
  'Marketing',
  'Consulting',
  'Real Estate',
  'Legal',
  'Non-profit',
  'Government',
  'Entertainment',
  'Sports',
  'Food & Beverage',
  'Automotive',
  'Energy',
  'Telecommunications',
  'Media',
  'Custom'
] as const;

export const VALID_RESPONSE_TYPES = [
  'professional',
  'appreciative',
  'clarifying',
  'disagreement',
  'value_add'
] as const;

// Professional hashtag categories
export const PROFESSIONAL_HASHTAGS = {
  technology: ['#TechInnovation', '#DigitalTransformation', '#AI', '#MachineLearning', '#CloudComputing'],
  healthcare: ['#HealthcareInnovation', '#DigitalHealth', '#PatientCare', '#MedicalTechnology', '#HealthTech'],
  finance: ['#FinTech', '#DigitalBanking', '#Investment', '#FinancialServices', '#WealthManagement'],
  education: ['#EdTech', '#OnlineLearning', '#ProfessionalDevelopment', '#SkillsDevelopment', '#LifelongLearning'],
  marketing: ['#DigitalMarketing', '#ContentMarketing', '#SocialMediaMarketing', '#BrandStrategy', '#GrowthMarketing'],
  leadership: ['#Leadership', '#Management', '#TeamBuilding', '#ProfessionalGrowth', '#CareerDevelopment'],
  general: ['#Networking', '#ProfessionalDevelopment', '#Business', '#Innovation', '#Success']
};

// Utility functions
export function readPrefs(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function writePrefs(p: Record<string, any>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

export function logAssistant(content: string) {
  try {
    window.dispatchEvent(new CustomEvent('linkedinwriter:assistantMessage', { detail: { content } }));
  } catch {}
}

export function normalizeEnum(input: string | undefined | null): string {
  return (input || '').trim().toLowerCase();
}

// LinkedIn-specific mapping functions
export function mapPostType(postType: string | undefined): LinkedInPostType {
  const pt = normalizeEnum(postType);
  if (!pt) return LinkedInPostType.PROFESSIONAL;
  
  const exact = VALID_POST_TYPES.find(v => v.toLowerCase() === pt);
  if (exact) return exact as LinkedInPostType;
  
  if (pt.includes('thought') || pt.includes('leadership')) return LinkedInPostType.THOUGHT_LEADERSHIP;
  if (pt.includes('news') || pt.includes('industry')) return LinkedInPostType.INDUSTRY_NEWS;
  if (pt.includes('personal') || pt.includes('story')) return LinkedInPostType.PERSONAL_STORY;
  if (pt.includes('company') || pt.includes('update')) return LinkedInPostType.COMPANY_UPDATE;
  if (pt.includes('poll') || pt.includes('question')) return LinkedInPostType.POLL;
  
  return LinkedInPostType.PROFESSIONAL;
}

export function mapTone(tone: string | undefined): LinkedInTone {
  const t = normalizeEnum(tone);
  if (!t) return LinkedInTone.PROFESSIONAL;
  
  const exact = VALID_TONES.find(v => v.toLowerCase() === t);
  if (exact) return exact as LinkedInTone;
  
  if (t.includes('authoritative') || t.includes('expert')) return LinkedInTone.AUTHORITATIVE;
  if (t.includes('conversational') || t.includes('casual')) return LinkedInTone.CONVERSATIONAL;
  if (t.includes('inspirational') || t.includes('motivational')) return LinkedInTone.INSPIRATIONAL;
  if (t.includes('educational') || t.includes('informative')) return LinkedInTone.EDUCATIONAL;
  if (t.includes('friendly') || t.includes('approachable')) return LinkedInTone.FRIENDLY;
  
  return LinkedInTone.PROFESSIONAL;
}

export function mapIndustry(industry: string | undefined): string {
  const ind = normalizeEnum(industry);
  if (!ind) return 'Technology';
  
  const exact = VALID_INDUSTRIES.find(v => v.toLowerCase() === ind);
  if (exact) return exact;
  
  if (ind.includes('tech') || ind.includes('software')) return 'Technology';
  if (ind.includes('health') || ind.includes('medical')) return 'Healthcare';
  if (ind.includes('finance') || ind.includes('bank')) return 'Finance';
  if (ind.includes('educat') || ind.includes('learn')) return 'Education';
  if (ind.includes('manufactur') || ind.includes('factory')) return 'Manufacturing';
  if (ind.includes('retail') || ind.includes('shop')) return 'Retail';
  if (ind.includes('market') || ind.includes('brand')) return 'Marketing';
  if (ind.includes('consult') || ind.includes('advisory')) return 'Consulting';
  if (ind.includes('real') || ind.includes('property')) return 'Real Estate';
  if (ind.includes('legal') || ind.includes('law')) return 'Legal';
  if (ind.includes('non') || ind.includes('charity')) return 'Non-profit';
  if (ind.includes('government') || ind.includes('public')) return 'Government';
  if (ind.includes('entertain') || ind.includes('media')) return 'Entertainment';
  if (ind.includes('sport') || ind.includes('fitness')) return 'Sports';
  if (ind.includes('food') || ind.includes('beverage')) return 'Food & Beverage';
  if (ind.includes('auto') || ind.includes('car')) return 'Automotive';
  if (ind.includes('energy') || ind.includes('power')) return 'Energy';
  if (ind.includes('telecom') || ind.includes('communication')) return 'Telecommunications';
  
  return 'Technology';
}

export function mapSearchEngine(engine: string | undefined): SearchEngine {
  const eng = normalizeEnum(engine);
  if (!eng) return SearchEngine.EXA;
  
  const exact = VALID_SEARCH_ENGINES.find(v => v.toLowerCase() === eng);
  if (exact) return exact as SearchEngine;
  
  if (eng.includes('exa')) return SearchEngine.EXA;
  if (eng.includes('google')) return SearchEngine.GOOGLE;
  if (eng.includes('tavily')) return SearchEngine.TAVILY;
  
  return SearchEngine.EXA;
}

export function mapResponseType(responseType: string | undefined): string {
  const rt = normalizeEnum(responseType);
  if (!rt) return 'professional';
  
  const exact = VALID_RESPONSE_TYPES.find(v => v.toLowerCase() === rt);
  if (exact) return exact;
  
  if (rt.includes('appreciat') || rt.includes('thank')) return 'appreciative';
  if (rt.includes('clarify') || rt.includes('explain')) return 'clarifying';
  if (rt.includes('disagree') || rt.includes('differ')) return 'disagreement';
  if (rt.includes('value') || rt.includes('add')) return 'value_add';
  
  return 'professional';
}

// Professional content helpers
export function getIndustryHashtags(industry: string): string[] {
  const mappedIndustry = mapIndustry(industry);
  const industryKey = mappedIndustry.toLowerCase().replace(/[^a-z]/g, '');
  
  return PROFESSIONAL_HASHTAGS[industryKey as keyof typeof PROFESSIONAL_HASHTAGS] || 
         PROFESSIONAL_HASHTAGS.general;
}

export function getProfessionalSuggestions(contentType: string, industry: string): string[] {
  const suggestions = {
    post: [
      `Share insights about ${industry} trends`,
      `Discuss professional challenges in ${industry}`,
      `Highlight innovation in ${industry}`,
      `Share lessons learned in ${industry}`,
      `Discuss future of ${industry}`
    ],
    article: [
      `Comprehensive guide to ${industry} best practices`,
      `Future trends in ${industry}`,
      `How to succeed in ${industry}`,
      `Innovation strategies for ${industry}`,
      `Professional development in ${industry}`
    ],
    carousel: [
      `Key insights about ${industry}`,
      `Best practices in ${industry}`,
      `Trends shaping ${industry}`,
      `Success strategies for ${industry}`,
      `Innovation in ${industry}`
    ]
  };
  
  return suggestions[contentType as keyof typeof suggestions] || suggestions.post;
}

// Dynamic placeholder generation based on preferences
export function getPersonalizedPlaceholder(
  contentType: string, 
  fieldType: string, 
  prefs: Record<string, any>
): string {
  const industry = prefs.industry || 'Technology';
  const tone = prefs.tone || 'professional';
  const audience = prefs.target_audience || 'professionals';

  const placeholders = {
    post: {
      topic: `e.g., ${industry} innovation trends for ${new Date().getFullYear()}`,
      target_audience: `e.g., ${industry} ${audience} and decision makers`,
      key_points: `• Key insight about ${industry}\n• Challenge ${audience} face\n• Solution or recommendation`
    },
    article: {
      topic: `e.g., The Future of ${industry}: A ${tone} Guide`,
      target_audience: `e.g., ${industry} leaders, ${audience}, and stakeholders`,
      key_sections: `• Introduction to ${industry} landscape\n• Current challenges and opportunities\n• Best practices and recommendations\n• Future outlook and trends`
    },
    carousel: {
      topic: `e.g., 5 Essential ${industry} Strategies for ${audience}`,
      target_audience: `e.g., ${audience} in ${industry} seeking growth`,
      key_takeaways: `• Key strategy for ${industry} success\n• Important trend ${audience} should know\n• Actionable tip for immediate implementation`
    },
    video: {
      topic: `e.g., ${industry} Leadership Tips for ${audience}`,
      target_audience: `e.g., Aspiring ${industry} leaders and ${audience}`,
      key_messages: `• Core message about ${industry} leadership\n• Practical advice for ${audience}\n• Call to action for viewers`
    },
    comment: {
      original_post: `Paste the original LinkedIn post content here (${tone} tone recommended for ${industry})`,
      comment: `Paste the comment you want to respond to (maintain ${tone} tone)`,
      brand_voice: `e.g., ${tone}, ${industry}-focused, expert authority`
    }
  };

  const contentPlaceholders = placeholders[contentType as keyof typeof placeholders];
  if (contentPlaceholders) {
    return contentPlaceholders[fieldType as keyof typeof contentPlaceholders] || 
           `Enter ${fieldType.replace('_', ' ')} for ${industry} content`;
  }

  return `Enter ${fieldType.replace('_', ' ')} here`;
}

// Generate personalized suggestions for CopilotKit sidebar
export function getPersonalizedSuggestions(prefs: Record<string, any>): Array<{title: string, message: string}> {
  const industry = prefs.industry || 'Technology';
  const tone = prefs.tone || 'professional';
  const audience = prefs.target_audience || 'professionals';

  return [
    {
      title: `${industry} Post`,
      message: `Create a ${tone} LinkedIn post about ${industry} trends for ${audience}`
    },
    {
      title: `${industry} Article`,
      message: `Write a comprehensive ${tone} article about ${industry} best practices targeting ${audience}`
    },
    {
      title: `${industry} Carousel`,
      message: `Generate a visual carousel about ${industry} insights with a ${tone} tone for ${audience}`
    },
    {
      title: 'Video Script',
      message: `Create a ${tone} video script about ${industry} topics for ${audience}`
    },
    {
      title: 'Comment Response',
      message: `Help me respond to LinkedIn comments with a ${tone} tone appropriate for ${industry}`
    }
  ];
}

// Generate context-aware suggestions based on current state
export function getContextAwareSuggestions(
  prefs: Record<string, any>,
  currentDraft: string = '',
  recentHistory: Array<any> = [],
  lastUsedActions: string[] = []
): Array<{title: string, message: string, priority: 'high' | 'medium' | 'low'}> {
  const industry = prefs.industry || 'Technology';
  const tone = prefs.tone || 'professional';
  const audience = prefs.target_audience || 'professionals';
  
  const suggestions: Array<{title: string, message: string, priority: 'high' | 'medium' | 'low'}> = [];

  // High Priority: Context-based suggestions
  if (currentDraft.trim()) {
    const draftLength = currentDraft.length;
    const wordCount = currentDraft.split(/\s+/).length;
    
    if (draftLength > 0 && draftLength < 100) {
      suggestions.push({
        title: '📝 Expand Draft',
        message: `Help me expand this ${draftLength}-character draft into a full ${industry} post`,
        priority: 'high'
      });
    } else if (wordCount > 200) {
      suggestions.push({
        title: '✂️ Refine Content',
        message: `Help me refine and polish this ${wordCount}-word ${industry} content`,
        priority: 'high'
      });
    }
    
    if (currentDraft.includes('#')) {
      suggestions.push({
        title: '🏷️ Optimize Hashtags',
        message: `Suggest relevant ${industry} hashtags for this content`,
        priority: 'high'
      });
    }
  }

  // Medium Priority: Recent activity suggestions
  if (recentHistory.length > 0) {
    const lastMessage = recentHistory[recentHistory.length - 1];
    if (lastMessage?.action === 'generateLinkedInPost') {
      suggestions.push({
        title: '🔄 Create Follow-up',
        message: `Create a follow-up post to the ${industry} content we just generated`,
        priority: 'medium'
      });
    } else if (lastMessage?.action === 'generateLinkedInArticle') {
      suggestions.push({
        title: '📊 Create Summary',
        message: `Create a carousel summarizing the key points from the ${industry} article`,
        priority: 'medium'
      });
    }
  }

  // Medium Priority: Frequently used actions
  if (lastUsedActions.length > 0) {
    const mostUsed = lastUsedActions[0];
    if (mostUsed === 'generateLinkedInPost') {
      suggestions.push({
        title: '📱 Another Post',
        message: `Create another ${tone} LinkedIn post for ${industry} ${audience}`,
        priority: 'medium'
      });
    } else if (mostUsed === 'generateLinkedInCarousel') {
      suggestions.push({
        title: '🎠 New Carousel',
        message: `Design a new ${industry} carousel with a ${tone} approach`,
        priority: 'medium'
      });
    }
  }

  // Low Priority: General suggestions (fallback to personalized)
  const personalizedSuggestions = getPersonalizedSuggestions(prefs);
  personalizedSuggestions.forEach(suggestion => {
    suggestions.push({
      ...suggestion,
      priority: 'low'
    });
  });

  // Sort by priority and return top 8 suggestions
  return suggestions
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 8);
}

// Generate smart follow-up suggestions based on content type
export function getSmartFollowUpSuggestions(
  contentType: string,
  content: string,
  prefs: Record<string, any>
): Array<{title: string, message: string}> {
  const industry = prefs.industry || 'Technology';
  const tone = prefs.tone || 'professional';
  
  const followUps: Record<string, Array<{title: string, message: string}>> = {
    post: [
      {
        title: '📊 Create Supporting Carousel',
        message: `Design a carousel that expands on the key points from this ${industry} post`
      },
      {
        title: '🎬 Make Video Script',
        message: `Convert this ${industry} post into a video script for ${tone} presentation`
      },
      {
        title: '💬 Generate Comment Responses',
        message: `Prepare professional responses to potential comments on this ${industry} post`
      }
    ],
    article: [
      {
        title: '🎠 Create Executive Summary',
        message: `Design a carousel summarizing the main insights from this ${industry} article`
      },
      {
        title: '📱 Social Media Posts',
        message: `Create multiple social media posts highlighting key points from this ${industry} article`
      },
      {
        title: '🎬 Video Content',
        message: `Transform this ${industry} article into an engaging video script`
      }
    ],
    carousel: [
      {
        title: '📝 Expand to Article',
        message: `Develop this ${industry} carousel into a comprehensive article`
      },
      {
        title: '📱 Create Post Series',
        message: `Generate individual posts for each slide in this ${industry} carousel`
      },
      {
        title: '🎬 Video Adaptation',
        message: `Adapt this ${industry} carousel content for video format`
      }
    ]
  };

  return followUps[contentType] || followUps.post;
}

export function validateLinkedInContent(content: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  // Keep in sync with linkedInPostFormatConstants.LINKEDIN_POST_HARD_LIMIT
  const HARD_LIMIT = 3000;

  if (!content || content.trim().length === 0) {
    issues.push('Content cannot be empty');
  }
  
  if (content.length > HARD_LIMIT) {
    issues.push(`Content exceeds LinkedIn post limit (${HARD_LIMIT} characters)`);
  }
  
  if (content.length < 50) {
    issues.push('Content is too short for a professional post');
  }
  
  // Check for professional tone indicators
  const informalWords = ['hey', 'hi', 'hello', 'cool', 'awesome', 'amazing'];
  const hasInformalWords = informalWords.some(word => 
    content.toLowerCase().includes(word)
  );
  
  if (hasInformalWords) {
    issues.push('Consider using more professional language');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

export function formatLinkedInContent(content: string, hashtags: string[] = []): string {
  let formatted = content.trim();
  
  // Add hashtags if provided
  if (hashtags.length > 0) {
    const hashtagString = hashtags.map(tag => 
      tag.startsWith('#') ? tag : `#${tag}`
    ).join(' ');
    formatted += `\n\n${hashtagString}`;
  }
  
  return formatted;
}

// Professional engagement helpers
export function getEngagementTips(contentType: string): string[] {
  const tips = {
    post: [
      'Ask a thought-provoking question',
      'Share personal insights or experiences',
      'Include relevant industry statistics',
      'Tag relevant professionals or companies',
      'Use professional hashtags strategically'
    ],
    article: [
      'Start with a compelling hook',
      'Include actionable insights',
      'Use subheadings for readability',
      'End with a call to action',
      'Share personal expertise'
    ],
    carousel: [
      'Create a clear narrative flow',
      'Use consistent visual elements',
      'Include data or statistics',
      'End with a strong call to action',
      'Optimize for mobile viewing'
    ]
  };
  
  return tips[contentType as keyof typeof tips] || tips.post;
}
