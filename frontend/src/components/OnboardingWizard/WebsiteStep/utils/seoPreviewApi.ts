/**
 * SEO Preview API — lightweight subset of full site audit for onboarding.
 */
import { longRunningApiClient } from "../../../../api/client";

export interface SeoPageResult {
  url: string;
  overall_score: number;
  meta: { score: number; issues?: string[] };
  content: { score: number; issues?: string[] };
  technical: { score: number; issues?: string[] };
  url_structure: { score: number; issues?: string[] };
  accessibility: { score: number; issues?: string[] };
  ux: { score: number; issues?: string[] };
  top_issues: Array<{
    category: string;
    severity?: string;
    issue?: string;
    message?: string;
    fix?: string;
    location?: string;
  }>;
}

export interface SeoPreviewResult {
  success: boolean;
  error?: string;
  pages_analyzed?: number;
  average_score?: number;
  total_issues_found?: number;
  preview_mode?: boolean;
  pages?: SeoPageResult[];
}

export async function runSeoPreview(websiteUrl: string): Promise<SeoPreviewResult> {
  const response = await longRunningApiClient.post(
    "/api/onboarding/step2/preview-seo-audit",
    { website_url: websiteUrl }
  );
  return response.data;
}

export async function getSeoPreview(websiteUrl?: string): Promise<SeoPreviewResult> {
  const response = await longRunningApiClient.get(
    "/api/onboarding/step2/preview-seo-audit",
    { params: websiteUrl ? { website_url: websiteUrl } : undefined }
  );
  return response.data;
}
