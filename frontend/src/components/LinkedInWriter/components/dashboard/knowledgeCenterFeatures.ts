export interface KnowledgeCenterFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  image?: string;
  action: 'factCheck' | 'googleGround' | 'persona' | 'assistive' | 'copilot' | 'multimodal';
}

export const KNOWLEDGE_CENTER_FEATURES: KnowledgeCenterFeature[] = [
  {
    id: 'fact-check',
    title: 'Fact Check',
    description: 'Verify claims with web-backed evidence before you publish.',
    icon: '🔍',
    accent: '#6366f1',
    image: '/Alwrity-fact-check.png',
    action: 'factCheck',
  },
  {
    id: 'google-ground',
    title: 'Live Web Research',
    description: 'Pull fresh facts and sources from the web while you write.',
    icon: '🌐',
    accent: '#0ea5e9',
    action: 'googleGround',
  },
  {
    id: 'persona-aware',
    title: 'Persona-Aware Writing',
    description: 'Content tailored to your voice, audience, and brand persona.',
    icon: '👤',
    accent: '#ec4899',
    action: 'persona',
  },
  {
    id: 'assistive',
    title: 'Assistive Writing',
    description: 'Inline suggestions as you type, with citations where it helps.',
    icon: '✍️',
    accent: '#f97316',
    image: '/ALwrity-assistive-writing.png',
    action: 'assistive',
  },
  {
    id: 'copilot',
    title: 'ALwrity Co-Pilot',
    description: 'Chat-first assistant for research, drafting, and editing.',
    icon: '🤖',
    accent: '#8b5cf6',
    image: '/Alwrity-copilot1.png',
    action: 'copilot',
  },
  {
    id: 'multimodal',
    title: 'Multimodal Generation',
    description: 'Create with images, video scripts, and rich media assets.',
    icon: '🎨',
    accent: '#10b981',
    action: 'multimodal',
  },
];
