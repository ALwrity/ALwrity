import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface ApiPricingEntry {
  provider: string;
  model_name: string;
  cost_per_input_token: number;
  cost_per_output_token: number;
  cost_per_request: number;
  cost_per_search: number;
  cost_per_image: number;
  cost_per_page: number;
  description: string;
}

// Fallbacks derived directly from pricing.yaml
const DEFAULT_IMAGE_COSTS: Record<string, number> = {
  'qwen-image': 0.03,
  'ideogram-v3-turbo': 0.05,
  'flux-kontext-pro': 0.04,
  'black-forest-labs/FLUX.1-Krea-dev': 0.04,
  'black-forest-labs/FLUX.1-dev': 0.04,
  'runwayml/flux-dev': 0.04,
  'stable-diffusion-xl-1024-v1-0': 0.04,
  'stable-diffusion-xl-base-1.0': 0.04,
  'wavespeed-ai/ideogram-character': 0.30,
};

let cachedPricingData: ApiPricingEntry[] | null = null;
let fetchPromise: Promise<ApiPricingEntry[]> | null = null;

export const useModelPricing = () => {
  const [pricingList, setPricingList] = useState<ApiPricingEntry[]>(cachedPricingData || []);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedPricingData);

  useEffect(() => {
    if (cachedPricingData) {
      setPricingList(cachedPricingData);
      setIsLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = apiClient
        .get<{ success: boolean; data: { pricing: ApiPricingEntry[] } }>('/api/subscription/pricing')
        .then((res: any) => {
          const list: ApiPricingEntry[] = res.data?.data?.pricing || [];
          cachedPricingData = list;
          return list;
        })
        .catch((err: any) => {
          console.warn('[useModelPricing] Failed to fetch live pricing, using defaults:', err);
          return [] as ApiPricingEntry[];
        });
    }

    if (fetchPromise) {
      fetchPromise.then((list: ApiPricingEntry[]) => {
        setPricingList(list);
        setIsLoading(false);
      });
    }
  }, []);

  const getPricingEntry = useCallback(
    (modelName: string, provider?: string): ApiPricingEntry | undefined => {
      if (!modelName) return undefined;
      const cleanModel = modelName.trim().toLowerCase();
      const shortModel = cleanModel.split('/').pop() || cleanModel;

      return pricingList.find((p) => {
        const pModel = p.model_name.trim().toLowerCase();
        const pShort = pModel.split('/').pop() || pModel;
        const matchesModel = pModel === cleanModel || pShort === shortModel || cleanModel.includes(pShort);
        if (provider) {
          return matchesModel && p.provider.toLowerCase() === provider.toLowerCase();
        }
        return matchesModel;
      });
    },
    [pricingList]
  );

  const getImageCost = useCallback(
    (modelName: string, fallback?: number): number => {
      const cleanModel = (modelName || '').trim().toLowerCase();
      const entry = getPricingEntry(cleanModel, 'stability') || getPricingEntry(cleanModel);
      if (entry && (entry.cost_per_image > 0 || entry.cost_per_request > 0)) {
        return entry.cost_per_image || entry.cost_per_request;
      }
      if (cleanModel in DEFAULT_IMAGE_COSTS) {
        return DEFAULT_IMAGE_COSTS[cleanModel];
      }
      const shortName = cleanModel.split('/').pop() || cleanModel;
      if (shortName in DEFAULT_IMAGE_COSTS) {
        return DEFAULT_IMAGE_COSTS[shortName];
      }
      return fallback !== undefined ? fallback : 0.04;
    },
    [getPricingEntry]
  );

  const getImageCostDisplay = useCallback(
    (modelName: string, fallback?: number): string => {
      const cost = getImageCost(modelName, fallback);
      return `$${cost.toFixed(2)}/image`;
    },
    [getImageCost]
  );

  const getInfiniteTalkRate = useCallback(
    (resolution: string = '720p'): { costPerSecond: number; costPer5s: number } => {
      const is480 = resolution.toLowerCase() === '480p';
      const entry = getPricingEntry('wavespeed-ai/infinitetalk', 'video') || getPricingEntry('infinitetalk', 'video');
      const base5s = entry && entry.cost_per_request > 0 ? (is480 ? entry.cost_per_request / 2 : entry.cost_per_request) : (is480 ? 0.15 : 0.30);
      return {
        costPer5s: base5s,
        costPerSecond: base5s / 5.0,
      };
    },
    [getPricingEntry]
  );

  const getWanRate = useCallback(
    (resolution: string = '720p'): { costPerSecond: number } => {
      const res = resolution.toLowerCase();
      if (res === '480p') return { costPerSecond: 0.05 };
      if (res === '1080p') return { costPerSecond: 0.15 };
      return { costPerSecond: 0.10 }; // 720p default
    },
    []
  );

  return {
    pricingList,
    isLoading,
    getPricingEntry,
    getImageCost,
    getImageCostDisplay,
    getInfiniteTalkRate,
    getWanRate,
  };
};

export default useModelPricing;
