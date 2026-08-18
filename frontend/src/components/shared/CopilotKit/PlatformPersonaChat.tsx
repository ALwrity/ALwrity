/**
 * Platform Persona Chat Component
 * CopilotKit integration for platform-specific persona-aware conversations
 * Provides intelligent, contextual assistance based on user's writing persona
 */

import React, { useCallback, useMemo, useState } from 'react';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { usePlatformPersonaContext } from '../PersonaContext';
import { PlatformType, CorePersona, PlatformPersona } from '../../../types/PlatformPersonaTypes';

// Platform-specific chat configurations
interface PlatformChatConfig {
  systemMessage: string;
  placeholder: string;
  welcomeMessage: string;
  suggestedPrompts: string[];
}

// Platform chat configurations
const getPlatformChatConfig = (
  platform: PlatformType,
  corePersona: CorePersona | null,
  platformPersona: PlatformPersona | null
): PlatformChatConfig => {
  const baseConfig = {
    systemMessage: `You are an expert ${platform} content strategist and writer.`,
    placeholder: `Ask me about ${platform} content strategy...`,
    welcomeMessage: `Hello! I'm your ${platform} content assistant. How can I help you today?`,
    suggestedPrompts: [
      `Help me create a ${platform} post about...`,
      `What's the best time to post on ${platform}?`,
      `How can I improve my ${platform} engagement?`
    ]
  };

  if (!corePersona || !platformPersona) {
    return baseConfig;
  }

  // Enhanced configuration with persona data
  return {
    systemMessage: `You are an expert ${platform} content strategist and writer, specializing in ${corePersona.persona_name} style content.`,
    placeholder: `Ask me about ${platform} content using your ${corePersona.persona_name} style...`,
    welcomeMessage: `Hello! I'm your ${platform} content assistant, trained on your "${corePersona.persona_name}" writing style. How can I help you create ${platform}-optimized content today?`,
    suggestedPrompts: [
      `Create a ${platform} post about [topic] using my ${corePersona.persona_name} style`,
      `How can I adapt my ${corePersona.persona_name} voice for ${platform}?`,
      `What ${platform} content strategy fits my ${corePersona.archetype} archetype?`,
      `Help me optimize my ${platform} posts for better engagement`
    ]
  };
};

// Enhanced system message generator
const generateEnhancedSystemMessage = (
  platform: PlatformType,
  corePersona: CorePersona | null,
  platformPersona: PlatformPersona | null
): string => {
  if (!corePersona || !platformPersona) {
    return `You are an expert ${platform} content strategist and writer. Provide helpful advice for creating engaging ${platform} content.`;
  }

  const linguisticFingerprint = corePersona.linguistic_fingerprint;
  const platformConstraints = platformPersona.content_format_rules;
  const engagementPatterns = platformPersona.engagement_patterns;

  return `
You are an expert ${platform} content strategist and writer, specializing in ${corePersona.persona_name} style content.

## CORE PERSONA CONTEXT
- **Persona Name**: ${corePersona.persona_name}
- **Archetype**: ${corePersona.archetype}
- **Core Belief**: ${corePersona.core_belief}
- **Confidence Score**: ${corePersona.confidence_score}%

## LINGUISTIC FINGERPRINT
- **Sentence Length**: ${linguisticFingerprint?.sentence_metrics?.average_sentence_length_words || 'Unknown'} words average
- **Voice Ratio**: ${linguisticFingerprint?.sentence_metrics?.active_to_passive_ratio || 'Unknown'}
- **Go-to Words**: ${linguisticFingerprint?.lexical_features?.go_to_words?.join(", ") || 'Unknown'}
- **Avoid Words**: ${linguisticFingerprint?.lexical_features?.avoid_words?.join(", ") || 'Unknown'}
- **Vocabulary Level**: ${linguisticFingerprint?.lexical_features?.vocabulary_level || 'Unknown'}

## ${platform.toUpperCase()} PLATFORM OPTIMIZATION
- **Platform**: ${platformPersona.platform_type}
- **Character Limit**: ${platformConstraints?.character_limit || 'Unknown'}
- **Optimal Length**: ${platformConstraints?.optimal_length || 'Unknown'}
- **Hashtag Limit**: ${platformConstraints?.hashtag_limit || 'Unknown'}
- **Posting Frequency**: ${engagementPatterns?.posting_frequency || 'Unknown'}

## WRITING GUIDELINES
1. **Always match the user's linguistic fingerprint** - use their preferred sentence length, vocabulary level, and writing style
2. **Respect platform constraints** - stay within character limits and follow ${platform} best practices
3. **Maintain persona consistency** - every piece of content should sound like it was written by ${corePersona.persona_name}
4. **Optimize for engagement** - use ${platform}-specific strategies for better reach and interaction
5. **Incorporate go-to words and phrases** naturally, while avoiding words the user dislikes

## RESPONSE FORMAT
- Provide specific, actionable advice
- Include examples that match the user's writing style
- Reference platform-specific constraints and opportunities
- Suggest content ideas that align with their archetype and core beliefs

Remember: You're not just giving generic ${platform} advice - you're helping ${corePersona.persona_name} create content that sounds authentically like them while being perfectly optimized for ${platform}.
  `.trim();
};

// Platform-specific action suggestions
const getPlatformActions = (platform: PlatformType): string[] => {
  const actions: Record<PlatformType, string[]> = {
    linkedin: [
      "Create thought leadership post",
      "Optimize for professional networking",
      "Suggest industry hashtags",
      "Improve engagement strategy"
    ],
    facebook: [
      "Create community-focused content",
      "Suggest trending topics",
      "Optimize for shares and comments",
      "Plan content calendar"
    ],
    instagram: [
      "Create visual-first content ideas",
      "Suggest hashtag strategy",
      "Optimize for stories and reels",
      "Improve aesthetic appeal"
    ],
    twitter: [
      "Create viral tweet ideas",
      "Suggest trending hashtags",
      "Optimize for retweets",
      "Plan thread strategy"
    ],
    blog: [
      "Create SEO-optimized content",
      "Suggest headline strategies",
      "Optimize for readability",
      "Plan content series"
    ],
    medium: [
      "Create publication strategy",
      "Suggest storytelling approaches",
      "Optimize for engagement",
      "Plan article series"
    ],
    substack: [
      "Create newsletter strategy",
      "Suggest subscriber engagement",
      "Optimize for conversions",
      "Plan content themes"
    ]
  };

  return actions[platform] || [];
};

// Main component interface
interface PlatformPersonaChatProps {
  platform: PlatformType;
  className?: string;
  showWelcomeMessage?: boolean;
  showSuggestedPrompts?: boolean;
  customSystemMessage?: string;
}

export const PlatformPersonaChat: React.FC<PlatformPersonaChatProps> = ({
  platform,
  className = "",
  showWelcomeMessage = true,
  showSuggestedPrompts = true,
  customSystemMessage
}) => {
  const { corePersona, platformPersona, loading, error } = usePlatformPersonaContext();
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Generate platform-specific chat configuration
  const chatConfig = useMemo(() => 
    getPlatformChatConfig(platform, corePersona, platformPersona),
    [platform, corePersona, platformPersona]
  );

  // Generate enhanced system message
  const systemMessage = useMemo(() => 
    customSystemMessage || generateEnhancedSystemMessage(platform, corePersona, platformPersona),
    [customSystemMessage, platform, corePersona, platformPersona]
  );

  // Get platform-specific actions
  const platformActions = useMemo(() => 
    getPlatformActions(platform),
    [platform]
  );

  // Custom makeSystemMessage function for CopilotKit
  const makeSystemMessage = useCallback((contextString: string) => {
    return `${systemMessage}\n\nCurrent Context: ${contextString}`;
  }, [systemMessage]);

  // Loading state — only block if persona data is not yet available
  if (loading && !corePersona) {
    return (
      <div className="flex items-center justify-center p-6 border rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading {platform} persona chat...</p>
        </div>
      </div>
    );
  }

  // Error state — only block if persona data is missing; with defaults, continue normally
  if (error && !corePersona) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Chat Unavailable</h3>
            <p className="text-sm text-red-700 mt-1">Unable to load persona data for {platform}.</p>
          </div>
        </div>
      </div>
    );
  }

  // Persona info display
  const PersonaInfo = () => (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-blue-900">
            {corePersona ? `Chatting as ${corePersona.persona_name}` : `${platform} Content Assistant`}
          </h4>
          {corePersona && (
            <p className="text-xs text-blue-700 mt-1">
              {corePersona.archetype} • {corePersona.confidence_score}% confidence
            </p>
          )}
        </div>
        <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
          {platform}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`platform-persona-chat-container ${className}`}>
      {/* Persona Information Header */}
      <PersonaInfo />
      
      {/* Platform Actions Suggestions */}
      {platformActions.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h5 className="text-sm font-medium text-gray-900 mb-2">Quick Actions for {platform}</h5>
          <div className="flex flex-wrap gap-2">
            {platformActions.map((action, index) => (
              <button
                key={index}
                className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                onClick={() => {
                  // This could trigger a specific action or pre-fill the chat
                  console.log(`Suggested action: ${action}`);
                }}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      <div className="text-center">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isChatOpen ? 'Close Chat' : 'Open AI Assistant'}
        </button>
      </div>

      {/* CopilotKit Sidebar */}
      {isChatOpen && (
        <CopilotSidebar 
          className="alwrity-copilot-sidebar platform-persona-chat"
          labels={{
            title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Content Assistant`,
            initial: chatConfig.welcomeMessage
          }}
          suggestions={chatConfig.suggestedPrompts}
          makeSystemMessage={makeSystemMessage}
          observabilityHooks={{
            onChatExpanded: () => {
              console.log(`[${platform}] Persona chat opened`);
            },
            onMessageSent: (message: any) => {
              const text = typeof message === 'string' ? message : (message?.content ?? '');
              if (text) {
                console.log(`[${platform}] User message:`, { content_length: text.length });
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default PlatformPersonaChat;
