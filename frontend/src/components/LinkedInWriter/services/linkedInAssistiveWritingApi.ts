import { apiClient } from '../../../api/client';

export interface LinkedInAssistiveSource {
  title: string;
  url: string;
  text?: string;
  author?: string;
  published_date?: string;
  score: number;
}

export interface LinkedInAssistiveSuggestion {
  text: string;
  confidence: number;
  sources: LinkedInAssistiveSource[];
}

export interface LinkedInAssistiveSuggestionResponse {
  success: boolean;
  suggestions: LinkedInAssistiveSuggestion[];
  message?: string;
}

/**
 * LinkedIn-specific assistive writing API client.
 * Separate from blogWriterApi.assistiveWritingApi to preserve separation of concerns.
 */
export const linkedInAssistiveWritingApi = {
  async getSuggestion(
    text: string,
    cursorPosition?: number,
  ): Promise<LinkedInAssistiveSuggestionResponse> {
    const { data } = await apiClient.post<LinkedInAssistiveSuggestionResponse>(
      '/api/writing-assistant/suggest',
      { text, cursor_position: cursorPosition },
    );
    return data;
  },
};

export function mapAssistiveWritingError(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Failed to get writing suggestion';

  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API quota exceeded. Please try again later or upgrade your plan.';
  }
  if (msg.includes('EXA_API_KEY not configured')) {
    return 'Search service not configured';
  }
  if (msg.includes('Gemini client not available')) {
    return 'AI service not available';
  }
  if (msg.includes('No relevant sources found')) {
    return 'No relevant sources found for this context';
  }
  return 'Failed to get writing suggestion';
}
