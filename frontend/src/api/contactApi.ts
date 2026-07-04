import { apiClient } from './client';

export interface ContactFormPayload {
  name: string;
  email: string;
  message: string;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
}

export async function submitContactForm(payload: ContactFormPayload): Promise<ContactFormResponse> {
  const { data } = await apiClient.post<ContactFormResponse>('/api/contact', payload);
  return data;
}
