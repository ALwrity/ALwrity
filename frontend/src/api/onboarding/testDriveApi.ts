import { aiApiClient } from '../client';

export interface TestTextRequest {
  prompt: string;
  persona?: {
    identity?: any;
    writing_style?: any;
    brand_voice?: any;
  };
  platform?: string;
}

export interface TestTextResponse {
  success: boolean;
  with_voice?: string;
  without_voice?: string;
  platform?: string;
  message?: string;
  error?: string;
}

export interface TestVoiceRequest {
  text: string;
}

export interface TestVoiceResponse {
  success: boolean;
  audio_url?: string | null;
  audio_base64?: string | null;
  format?: string | null;
  engine?: string | null;
  voice_id?: string | null;
  message?: string;
  error?: string;
}

export type TestImagePlatform =
  | 'blog'
  | 'podcast'
  | 'youtube'
  | 'instagram'
  | 'linkedin'
  | 'twitter';

export interface TestImageRequest {
  platform: TestImagePlatform;
  prompt_override?: string;
}

export interface TestImageResponse {
  success: boolean;
  image_url?: string | null;
  image_base64?: string | null;
  platform?: string;
  format?: string;
  prompt?: string;
  message?: string;
  error?: string;
}

export const testDriveApi = {
  /** Generate text with and without the persona for side-by-side comparison. */
  async testText(request: TestTextRequest): Promise<TestTextResponse> {
    try {
      const { data } = await aiApiClient.post('/api/onboarding/step4/test-text', request);
      return data;
    } catch (e: any) {
      return {
        success: false,
        message: e?.response?.data?.detail?.message || e?.message || 'Failed to generate text',
        error: 'network_error',
      };
    }
  },

  /** Synthesize new text using the user's stored voice clone. */
  async testVoice(request: TestVoiceRequest): Promise<TestVoiceResponse> {
    try {
      const { data } = await aiApiClient.post('/api/onboarding/step4/test-voice', request);
      return data;
    } catch (e: any) {
      return {
        success: false,
        message:
          e?.response?.data?.detail?.message ||
          e?.response?.data?.message ||
          e?.message ||
          'Failed to synthesize voice',
        error: 'network_error',
      };
    }
  },

  /** Generate a platform-tuned avatar variation. */
  async testImage(request: TestImageRequest): Promise<TestImageResponse> {
    try {
      const { data } = await aiApiClient.post('/api/onboarding/step4/test-image', request);
      return data;
    } catch (e: any) {
      return {
        success: false,
        message:
          e?.response?.data?.detail?.message ||
          e?.response?.data?.message ||
          e?.message ||
          'Failed to generate image',
        error: 'network_error',
      };
    }
  },
};

export default testDriveApi;
