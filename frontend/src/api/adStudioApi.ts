import axios from 'axios';

// Interfaces based on backend models
export interface AdCampaignRequest {
  product_name: string;
  product_description: string;
  target_audience: string;
  platform: 'meta' | 'google';
  tone: string;
  num_variations: number;
}

export interface AdCopyVariation {
  headline: string;
  primary_text: string;
  call_to_action: string;
  description?: string;
  predicted_ctr?: number;
}

export interface AdCampaignResponse {
  campaign_id: string;
  platform: string;
  variations: AdCopyVariation[];
  recommended_keywords: string[];
}

export interface AdCreativeRequest {
  campaign_id: string;
  prompt: string;
  aspect_ratio: string;
}

export interface AdCreativeResponse {
  image_url: string;
  variation_id?: string;
}

export const generateAdCampaign = async (request: AdCampaignRequest): Promise<AdCampaignResponse> => {
  const response = await axios.post('/api/ads/generate-campaign', request);
  return response.data;
};

export const generateAdCreative = async (request: AdCreativeRequest): Promise<AdCreativeResponse> => {
  const response = await axios.post('/api/ads/generate-creative', request);
  return response.data;
};
