import { apiClient } from './client';

console.log('🔄 Loading Business Info API client...');

export interface BusinessInfo {
  user_id?: number;
  business_description: string;
  industry?: string;
  target_audience?: string;
  business_goals?: string;
}

export interface BusinessInfoResponse extends BusinessInfo {
  id: number;
  created_at: string;
  updated_at: string;
}

export const businessInfoApi = {
  saveBusinessInfo: async (data: BusinessInfo): Promise<BusinessInfoResponse> => {
    console.log('API: Saving business info', data);
    const response = await apiClient.post<BusinessInfoResponse>('/api/onboarding/business-info', data);
    console.log('API: Business info saved successfully', response.data);
    return response.data;
  },

  getBusinessInfo: async (id: number): Promise<BusinessInfoResponse> => {
    console.log(`API: Getting business info for ID: ${id}`);
    const response = await apiClient.get<BusinessInfoResponse>(`/api/onboarding/business-info/${id}`);
    console.log('API: Business info retrieved successfully', response.data);
    return response.data;
  },

  getBusinessInfoByUserId: async (userId: number): Promise<BusinessInfoResponse> => {
    console.log(`API: Getting business info for user ID: ${userId}`);
    const response = await apiClient.get<BusinessInfoResponse>(`/api/onboarding/business-info/user/${userId}`);
    console.log('API: Business info retrieved successfully by user ID', response.data);
    return response.data;
  },

  updateBusinessInfo: async (id: number, data: BusinessInfo): Promise<BusinessInfoResponse> => {
    console.log(`API: Updating business info for ID: ${id}`, data);
    const response = await apiClient.put<BusinessInfoResponse>(`/api/onboarding/business-info/${id}`, data);
    console.log('API: Business info updated successfully', response.data);
    return response.data;
  },
};

console.log('✅ Business Info API client loaded successfully!');
