import { apiClient, aiApiClient } from './client';

const ONBOARDING_ASSET_QUERY_BASE = '/api/onboarding/assets';

export interface AssetResponse {
  success: boolean;
  image_url?: string;
  image_base64?: string;
  optimized_prompt?: string;
  prompt?: string;
  asset_id?: number;
  message?: string;
  error?: string;
}

export interface VoiceCloneResponse {
  success: boolean;
  custom_voice_id?: string;
  voice_name?: string;
  preview_audio_url?: string;
  asset_id?: number;
  engine?: string;
  message?: string;
  error?: string;
}

export const getLatestBrandAvatar = async (): Promise<AssetResponse> => {
  try {
    // validateStatus prevents axios from throwing on 404, so the global error
    // interceptor in client.ts never fires for the expected "no avatar yet" case.
    const response = await apiClient.get(`${ONBOARDING_ASSET_QUERY_BASE}/latest-avatar`, {
      validateStatus: (status) => status < 500,
    });
    if (response.status === 404) {
      return { success: false, message: 'No avatar found' };
    }
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch latest avatar:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to fetch latest avatar'
    };
  }
};

export const generateBrandAvatar = async (
  prompt: string,
  stylePreset?: string,
  aspectRatio: string = "1:1",
  model?: string,
  renderingSpeed?: string,
  provider?: string
): Promise<AssetResponse> => {
  try {
    const response = await apiClient.post('/onboarding/assets/generate-avatar', {
      prompt,
      style_preset: stylePreset,
      aspect_ratio: aspectRatio,
      model,
      rendering_speed: renderingSpeed,
      provider,
      user_id: "current_user" // Backend extracts actual user
    });
    return response.data;
  } catch (error: any) {
    console.error('Avatar generation error:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to generate avatar'
    };
  }
};

export const optimizeAvatarPrompt = async (prompt: string): Promise<AssetResponse> => {
  try {
    const response = await apiClient.post('/onboarding/assets/enhance-prompt', {
      prompt,
      user_id: "current_user"
    });
    return response.data;
  } catch (error: any) {
    console.error('Prompt enhancement error:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to enhance prompt'
    };
  }
};

export const createAvatarVariation = async (
  prompt: string,
  file: File
): Promise<AssetResponse> => {
  try {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('file', file);
    formData.append('user_id', "current_user");

    const response = await apiClient.post('/onboarding/assets/create-variation', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Avatar variation error:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to create avatar variation'
    };
  }
};

export const enhanceBrandAvatar = async (
  file: File
): Promise<AssetResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', "current_user");

    const response = await apiClient.post('/onboarding/assets/enhance-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Avatar enhancement error:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to enhance avatar'
    };
  }
};

export const setBrandAvatar = async (
  data: {
    image_base64: string;
    domain_name?: string;
    title: string;
  }
): Promise<AssetResponse> => {
    // TODO: Implement backend endpoint to set as active avatar
    // For now, simulate success
    return {
        success: true,
        message: "Avatar set as active"
    };
};

export const getLatestVoiceClone = async (): Promise<VoiceCloneResponse> => {
  try {
    const response = await apiClient.get(`${ONBOARDING_ASSET_QUERY_BASE}/latest-voice-clone`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { success: false, message: 'No voice clone found' };
    }
    console.error('Failed to fetch latest voice clone:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to fetch latest voice clone'
    };
  }
};

export const setBrandVoice = async (
  data: {
    audio_url?: string;
    custom_voice_id?: string;
    voice_description?: string;
  }
): Promise<AssetResponse> => {
    // TODO: Implement backend endpoint to set as active voice
    // For now, simulate success
    return {
        success: true,
        message: "Voice set as active brand voice"
    };
};

export interface VoiceCloneParams {
  audioFile: File;
  engine: 'minimax' | 'qwen3';
  customVoiceId?: string;
  model?: string;
  text?: string;
  referenceText?: string;
  language?: string;
  needNoiseReduction?: boolean;
  needVolumeNormalization?: boolean;
  accuracy?: number;
  languageBoost?: string;
}

export const createVoiceClone = async (
  params: VoiceCloneParams
): Promise<VoiceCloneResponse> => {
  try {
    console.log('[VoiceClone] Creating voice clone with engine:', params.engine);
    
    const formData = new FormData();
    formData.append('file', params.audioFile);
    formData.append('engine', params.engine);
    formData.append('user_id', "current_user");

    if (params.customVoiceId) formData.append('custom_voice_id', params.customVoiceId);
    if (params.model) formData.append('model', params.model);
    if (params.text) formData.append('text', params.text);
    if (params.referenceText) formData.append('reference_text', params.referenceText);
    if (params.language) formData.append('language', params.language);
    if (params.needNoiseReduction !== undefined) formData.append('need_noise_reduction', String(params.needNoiseReduction));
    if (params.needVolumeNormalization !== undefined) formData.append('need_volume_normalization', String(params.needVolumeNormalization));
    if (params.accuracy !== undefined) formData.append('accuracy', String(params.accuracy));
    if (params.languageBoost) formData.append('language_boost', params.languageBoost);

    // Legacy field support (voiceName was used before)
    // We might want to remove this if backend doesn't need it
    formData.append('voice_name', 'My Voice Clone'); 

    console.log('[VoiceClone] Sending request to /onboarding/assets/create-voice-clone');
    const response = await aiApiClient.post('/onboarding/assets/create-voice-clone', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('[VoiceClone] Response received:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[VoiceClone] Error creating voice clone:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to create voice clone'
    };
  }
};

export interface VoiceDesignParams {
  text: string;
  voiceDescription: string;
  language?: string;
}

export const createVoiceDesign = async (
  params: VoiceDesignParams
): Promise<VoiceCloneResponse> => {
  try {
    const response = await aiApiClient.post('/onboarding/assets/create-voice-design', {
      text: params.text,
      voice_description: params.voiceDescription,
      language: params.language || 'auto',
      user_id: "current_user"
    });
    return response.data;
  } catch (error: any) {
    console.error('Voice design error:', error);
    return {
      success: false,
      error: error.response?.data?.detail || 'Failed to create voice design'
    };
  }
};
