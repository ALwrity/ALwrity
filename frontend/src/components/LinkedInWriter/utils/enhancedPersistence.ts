/**
 * Enhanced persistence utility for CopilotKit integration
 * Uses localStorage and CopilotKit hooks for better state management
 */

import { useCopilotContext } from '@copilotkit/react-core';

// Optional debug flag: set to true to enable verbose logs locally
const DEBUG_PERSISTENCE = false;

// Storage keys for different types of data
export const STORAGE_KEYS = {
  CHAT_HISTORY: 'alwrity-copilot-chat-history',
  USER_PREFERENCES: 'alwrity-copilot-user-preferences',
  CONVERSATION_CONTEXT: 'alwrity-copilot-conversation-context',
  DRAFT_CONTENT: 'alwrity-copilot-draft-content',
  GROUNDING_DATA: 'alwrity-copilot-grounding-data',
  LAST_SESSION: 'alwrity-copilot-last-session'
};

// Chat message interface
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    action?: string;
    result?: any;
    context?: string;
  };
}

// User preferences interface
export interface UserPreferences {
  tone: string;
  industry: string;
  target_audience: string;
  content_goals: string[];
  writing_style: string;
  hashtag_preferences: boolean;
  cta_preferences: boolean;
  last_used_actions: string[];
  favorite_topics: string[];
  last_updated: number;
}

// Conversation context interface
export interface ConversationContext {
  currentTopic: string;
  industry: string;
  tone: string;
  targetAudience: string;
  keyPoints: string[];
  lastUpdated: number;
}

// Main persistence manager class
export class CopilotPersistenceManager {
  private static instance: CopilotPersistenceManager;
  
  private constructor() {}
  
  public static getInstance(): CopilotPersistenceManager {
    if (!CopilotPersistenceManager.instance) {
      CopilotPersistenceManager.instance = new CopilotPersistenceManager();
    }
    return CopilotPersistenceManager.instance;
  }
  
  // Chat history persistence
  public saveChatHistory(messages: ChatMessage[]): void {
    try {
      // Keep only last 100 messages to prevent excessive storage
      const trimmedMessages = messages.slice(-100);
      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(trimmedMessages));
      console.log(`💾 Saved ${trimmedMessages.length} chat messages`);
    } catch (error) {
      console.error('❌ Failed to save chat history:', error);
    }
  }
  
  public loadChatHistory(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (!stored) return [];
      
      const messages = JSON.parse(stored);
      console.log(`📖 Loaded ${messages.length} chat messages`);
      return messages;
    } catch (error) {
      console.error('❌ Failed to load chat history:', error);
      return [];
    }
  }
  
  public addChatMessage(message: ChatMessage): void {
    try {
      const existing = this.loadChatHistory();
      existing.push(message);
      this.saveChatHistory(existing);
    } catch (error) {
      console.error('❌ Failed to add chat message:', error);
    }
  }
  
  // User preferences persistence
  public saveUserPreferences(preferences: Partial<UserPreferences>): void {
    try {
      const existing = this.loadUserPreferences();
      const updated = { ...existing, ...preferences, last_updated: Date.now() };
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
      console.log('💾 Saved user preferences');
    } catch (error) {
      console.error('❌ Failed to save user preferences:', error);
    }
  }
  
  public loadUserPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (!stored) {
        return {
          tone: 'Professional',
          industry: 'Technology',
          target_audience: 'Professionals',
          content_goals: ['Engagement', 'Thought Leadership'],
          writing_style: 'Clear and Concise',
          hashtag_preferences: true,
          cta_preferences: true,
          last_used_actions: [],
          favorite_topics: [],
          last_updated: Date.now()
        };
      }
      
      const preferences = JSON.parse(stored);
      console.log('📖 Loaded user preferences');
      return preferences;
    } catch (error) {
      console.error('❌ Failed to load user preferences:', error);
      // Return default preferences instead of recursive call
      return {
        tone: 'Professional',
        industry: 'Technology',
        target_audience: 'Professionals',
        content_goals: ['Engagement', 'Thought Leadership'],
        writing_style: 'Clear and Concise',
        hashtag_preferences: true,
        cta_preferences: true,
        last_used_actions: [],
        favorite_topics: [],
        last_updated: Date.now()
      };
    }
  }
  
  // Conversation context persistence
  public saveConversationContext(context: Partial<ConversationContext>): void {
    try {
      const existing = this.loadConversationContext();
      const updated = { ...existing, ...context, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEYS.CONVERSATION_CONTEXT, JSON.stringify(updated));
      console.log('💾 Saved conversation context');
    } catch (error) {
      console.error('❌ Failed to save conversation context:', error);
    }
  }
  
  public loadConversationContext(): ConversationContext {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATION_CONTEXT);
      if (!stored) {
        return {
          currentTopic: '',
          industry: 'Technology',
          tone: 'Professional',
          targetAudience: 'Professionals',
          keyPoints: [],
          lastUpdated: Date.now()
        };
      }
      
      const context = JSON.parse(stored);
      console.log('📖 Loaded conversation context');
      return context;
    } catch (error) {
      console.error('❌ Failed to load conversation context:', error);
      // Return default context instead of recursive call
      return {
        currentTopic: '',
        industry: 'Technology',
        tone: 'Professional',
        targetAudience: 'Professionals',
        keyPoints: [],
        lastUpdated: Date.now()
      };
    }
  }
  
  // Draft content persistence
  public saveDraftContent(draft: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DRAFT_CONTENT, draft);
      if (DEBUG_PERSISTENCE) console.log('💾 Saved draft content');
    } catch (error) {
      console.error('❌ Failed to save draft content:', error);
    }
  }
  
  public loadDraftContent(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DRAFT_CONTENT);
      if (stored) {
        console.log('📖 Loaded draft content');
        return stored;
      }
      return '';
    } catch (error) {
      console.error('❌ Failed to load draft content:', error);
      return '';
    }
  }
  
  // Grounding data persistence (research sources, citations, quality metrics)
  public saveGroundingData(data: { researchSources?: any[]; citations?: any[]; qualityMetrics?: any; groundingEnabled?: boolean; searchQueries?: string[] }): void {
    try {
      const existing = this.loadGroundingData();
      const updated = { ...existing, ...data, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEYS.GROUNDING_DATA, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save grounding data:', error);
    }
  }

  public loadGroundingData(): { researchSources: any[]; citations: any[]; qualityMetrics: any; groundingEnabled: boolean; searchQueries: string[] } {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GROUNDING_DATA);
      if (stored) {
        const data = JSON.parse(stored);
        return {
          researchSources: data.researchSources || [],
          citations: data.citations || [],
          qualityMetrics: data.qualityMetrics || null,
          groundingEnabled: data.groundingEnabled || false,
          searchQueries: data.searchQueries || []
        };
      }
    } catch (error) {
      console.error('Failed to load grounding data:', error);
    }
    return { researchSources: [], citations: [], qualityMetrics: null, groundingEnabled: false, searchQueries: [] };
  }

  // Session management
  public saveLastSession(): void {
    try {
      const sessionData = {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      localStorage.setItem(STORAGE_KEYS.LAST_SESSION, JSON.stringify(sessionData));
      console.log('💾 Saved session data');
    } catch (error) {
      console.error('❌ Failed to save session data:', error);
    }
  }
  
  public loadLastSession(): any {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_SESSION);
      if (stored) {
        const session = JSON.parse(stored);
        console.log('📖 Loaded session data');
        return session;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to load session data:', error);
      return null;
    }
  }
  
  // Clear all persistence data
  public clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🗑️ Cleared all persistence data');
    } catch (error) {
      console.error('❌ Failed to clear persistence data:', error);
    }
  }
  
  // Get storage statistics
  public getStorageStats(): any {
    try {
      const stats = {
        chatHistory: this.loadChatHistory().length,
        hasUserPreferences: !!localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES),
        hasConversationContext: !!localStorage.getItem(STORAGE_KEYS.CONVERSATION_CONTEXT),
        hasDraftContent: !!localStorage.getItem(STORAGE_KEYS.DRAFT_CONTENT),
        hasLastSession: !!localStorage.getItem(STORAGE_KEYS.LAST_SESSION),
        totalKeys: Object.keys(localStorage).filter(key => key.includes('alwrity-copilot')).length
      };
      
      console.log('📊 Storage statistics:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return {};
    }
  }
}

// Hook for using persistence in React components
export const useCopilotPersistence = () => {
  const copilotContext = useCopilotContext();
  const persistenceManager = CopilotPersistenceManager.getInstance();
  
  return {
    persistenceManager,
    copilotContext,
    // Convenience methods
    saveChatHistory: persistenceManager.saveChatHistory.bind(persistenceManager),
    loadChatHistory: persistenceManager.loadChatHistory.bind(persistenceManager),
    addChatMessage: persistenceManager.addChatMessage.bind(persistenceManager),
    saveUserPreferences: persistenceManager.saveUserPreferences.bind(persistenceManager),
    loadUserPreferences: persistenceManager.loadUserPreferences.bind(persistenceManager),
    saveConversationContext: persistenceManager.saveConversationContext.bind(persistenceManager),
    loadConversationContext: persistenceManager.loadConversationContext.bind(persistenceManager),
    saveDraftContent: persistenceManager.saveDraftContent.bind(persistenceManager),
    loadDraftContent: persistenceManager.loadDraftContent.bind(persistenceManager),
    saveLastSession: persistenceManager.saveLastSession.bind(persistenceManager),
    loadLastSession: persistenceManager.loadLastSession.bind(persistenceManager),
    clearAllData: persistenceManager.clearAllData.bind(persistenceManager),
    getStorageStats: persistenceManager.getStorageStats.bind(persistenceManager)
  };
};
