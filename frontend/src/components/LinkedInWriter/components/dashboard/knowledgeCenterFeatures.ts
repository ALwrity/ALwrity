export interface KnowledgeCenterFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  image?: string;
  action: 'featureMap' | 'contentCoach' | 'persona' | 'bestPractices' | 'quickStart' | 'multimodal' | 'askAlwrity';
}

export const KNOWLEDGE_CENTER_FEATURES: KnowledgeCenterFeature[] = [
  {
    id: 'feature-map',
    title: 'Studio Guide',
    description: 'Interactive map of every feature and AI capability — with one-click launch.',
    icon: '🗺️',
    accent: '#6366f1',
    action: 'featureMap',
  },
  {
    id: 'content-coach',
    title: 'Content Coach',
    description: 'Real-time AI score of your draft with actionable fix buttons.',
    icon: '🎯',
    accent: '#0a66c2',
    action: 'contentCoach',
  },
  {
    id: 'persona-aware',
    title: 'Persona Writing',
    description: 'Content tailored to your voice, audience, and brand persona.',
    icon: '👤',
    accent: '#ec4899',
    action: 'persona',
  },
  {
    id: 'best-practices',
    title: 'Best Practices',
    description: 'LinkedIn format cheat sheets + viral patterns for your industry.',
    icon: '📋',
    accent: '#057642',
    action: 'bestPractices',
  },
  {
    id: 'quick-start',
    title: 'Quick Start',
    description: '3-step wizard: pick a goal, format, and topic — then generate.',
    icon: '🚀',
    accent: '#8b5cf6',
    action: 'quickStart',
  },
  {
    id: 'ask-alwrity',
    title: 'Ask ALwrity',
    description: 'LinkedIn Q&A with curated answers + your own free-text questions.',
    icon: '💬',
    accent: '#f97316',
    action: 'askAlwrity',
  },
  {
    id: 'multimodal',
    title: 'Multimodal',
    description: 'Create with images, video scripts, and rich media assets.',
    icon: '🎨',
    accent: '#10b981',
    action: 'multimodal',
  },
];
