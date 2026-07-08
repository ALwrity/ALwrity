import { create } from 'zustand';
import { AdCampaignResponse, AdCampaignRequest, generateAdCampaign, AdCopyVariation } from '../api/adStudioApi';

interface AdStudioState {
  campaign: AdCampaignResponse | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  generateCampaign: (request: AdCampaignRequest) => Promise<void>;
  resetCampaign: () => void;
}

export const useAdStudioStore = create<AdStudioState>((set) => ({
  campaign: null,
  isLoading: false,
  error: null,

  generateCampaign: async (request: AdCampaignRequest) => {
    set({ isLoading: true, error: null });
    try {
      const result = await generateAdCampaign(request);
      set({ campaign: result, isLoading: false });
    } catch (err: any) {
      set({ 
        isLoading: false, 
        error: err.response?.data?.detail || err.message || 'Failed to generate campaign' 
      });
    }
  },

  resetCampaign: () => {
    set({ campaign: null, error: null });
  }
}));
