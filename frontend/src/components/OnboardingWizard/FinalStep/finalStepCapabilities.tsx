import CheckCircle from '@mui/icons-material/CheckCircle';
import type { Capability, OnboardingData } from './types';

export function buildFinalStepCapabilities(
  onboardingData: OnboardingData,
  isLinkedIn: boolean
): Capability[] {
  if (isLinkedIn) {
    return [
      {
        id: 'linkedin-persona',
        title: 'LinkedIn Persona',
        description: 'A custom persona based on your profile, posts, and growth goals',
        icon: <CheckCircle />,
        unlocked: !!onboardingData.personalizationSettings,
        required: ['Persona Generation'],
      },
      {
        id: 'linkedin-research',
        title: 'LinkedIn Research',
        description: 'Audience, content, and competitor insights for LinkedIn',
        icon: <CheckCircle />,
        unlocked: !!onboardingData.researchPreferences,
        required: ['Research Configuration'],
      },
      {
        id: 'linkedin-content',
        title: 'LinkedIn Content Engine',
        description: 'Generate posts, articles, and carousels matched to your voice',
        icon: <CheckCircle />,
        unlocked: !!onboardingData.personalizationSettings,
        required: ['Persona Generation'],
      },
      {
        id: 'linkedin-monitoring',
        title: 'LinkedIn Monitoring',
        description: 'Scheduled profile sync, post analytics, and growth reanalysis',
        icon: <CheckCircle />,
        unlocked: !!onboardingData.researchPreferences && !!onboardingData.personalizationSettings,
        required: ['Research & Persona'],
      },
      {
        id: 'linkedin-integrations',
        title: 'Content Preferences',
        description: 'Posting cadence, formats, topics, and engagement goals',
        icon: <CheckCircle />,
        unlocked: !!onboardingData.integrations,
        required: ['Preferences'],
      },
    ];
  }

  return [
    {
      id: 'ai-content',
      title: 'AI Content Generation',
      description: 'Generate high-quality, personalized content using advanced AI models',
      icon: <CheckCircle />,
      unlocked: true,
    },
    {
      id: 'style-analysis',
      title: 'Style Analysis',
      description: "Analyze and match your brand's writing style and tone",
      icon: <CheckCircle />,
      unlocked: !!onboardingData.websiteUrl,
      required: ['Website URL'],
    },
    {
      id: 'research-tools',
      title: 'AI Research Tools',
      description: 'Automated research and fact-checking capabilities',
      icon: <CheckCircle />,
      unlocked: !!onboardingData.researchPreferences,
      required: ['Research Configuration'],
    },
    {
      id: 'personalization',
      title: 'Content Personalization',
      description: 'Tailored content based on your brand voice and preferences',
      icon: <CheckCircle />,
      unlocked: !!onboardingData.personalizationSettings,
      required: ['Personalization Settings'],
    },
    {
      id: 'integrations',
      title: 'Third-party Integrations',
      description: 'Connect with external tools and platforms',
      icon: <CheckCircle />,
      unlocked: !!onboardingData.integrations,
      required: ['Integration Setup'],
    },
  ];
}

export function getFinalStepMissingRequirements(
  onboardingData: OnboardingData,
  isLinkedIn: boolean
): string[] {
  const missing: string[] = [];

  if (isLinkedIn) {
    if (!onboardingData.researchPreferences) {
      missing.push('LinkedIn research data');
    }
    if (!onboardingData.personalizationSettings) {
      missing.push('LinkedIn persona data');
    }
    return missing;
  }

  if (!onboardingData.websiteUrl) {
    missing.push('Website URL for style analysis');
  }

  return missing;
}
