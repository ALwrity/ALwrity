/**
 * AdvancedProviderOptionsSection Component
 * 
 * Advanced provider options section with AI-optimized settings.
 * This is specific to IntentConfirmationPanel and includes AI justifications.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { AnalyzeIntentResponse } from '../../../types/intent.types';
import { ProviderAvailability } from '../../../../../api/researchConfig';
import { ExaOptions } from '../ExaOptions';
import { TavilyOptions } from '../TavilyOptions';
import { ProviderChips } from '../ProviderChips';
import { ResearchProvider } from '../../../../../services/researchApi';

interface AdvancedProviderOptionsSectionProps {
  intentAnalysis: AnalyzeIntentResponse;
  providerAvailability: ProviderAvailability;
  config: any;
  onConfigUpdate: (updates: any) => void;
  showAdvancedOptions: boolean;
  onAdvancedOptionsChange: (show: boolean) => void;
}

export const AdvancedProviderOptionsSection: React.FC<AdvancedProviderOptionsSectionProps> = ({
  intentAnalysis,
  providerAvailability,
  config,
  onConfigUpdate,
  showAdvancedOptions,
  onAdvancedOptionsChange,
}) => {
  const [activeTab, setActiveTab] = useState<number>(() => {
    // Initialize tab based on current provider
    if (config.provider === 'tavily' && providerAvailability.tavily_available) return 1;
    if (config.provider === 'exa' && providerAvailability.exa_available) return 0;
    // Default to first available provider
    if (providerAvailability.exa_available) return 0;
    if (providerAvailability.tavily_available) return 1;
    return 0;
  });

  // Sync active tab when provider changes externally
  useEffect(() => {
    if (config.provider === 'tavily' && providerAvailability.tavily_available) {
      setActiveTab(1);
    } else if (config.provider === 'exa' && providerAvailability.exa_available) {
      setActiveTab(0);
    }
  }, [config.provider, providerAvailability.exa_available, providerAvailability.tavily_available]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // Update provider based on selected tab
    if (newValue === 0 && providerAvailability.exa_available) {
      onConfigUpdate({ provider: 'exa' });
    } else if (newValue === 1 && providerAvailability.tavily_available) {
      onConfigUpdate({ provider: 'tavily' });
    }
  };

  return (
    <>
      {/* Toggle Advanced Options Button */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Button
          size="small"
          variant="text"
          onClick={() => onAdvancedOptionsChange(!showAdvancedOptions)}
          sx={{
            color: '#64748b',
            fontSize: '12px',
            '&:hover': {
              backgroundColor: '#f8fafc',
              color: '#0ea5e9',
            },
          }}
        >
          {showAdvancedOptions ? '▲ Hide Advanced Options' : '▼ Show Advanced Options'}
        </Button>
      </Box>

      {/* Advanced Options Section */}
      {showAdvancedOptions && (
        <Box sx={{
          mt: 2,
          pt: 2,
          borderTop: '1px dashed rgba(14, 165, 233, 0.3)',
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography
              variant="subtitle2"
              sx={{
                color: '#0c4a6e',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              ⚙️ AI-Optimized Settings
            </Typography>
            <Tooltip title="These settings were AI-configured based on your research intent. Hover over each for explanation." arrow>
              <InfoIcon sx={{ fontSize: 16, color: '#94a3b8', cursor: 'help' }} />
            </Tooltip>
          </Box>

          {/* AI Justification Banner */}
          {intentAnalysis?.optimized_config?.provider_justification && (
            <Box sx={{
              mb: 2,
              p: 1.5,
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
            }}>
              <span style={{ fontSize: '14px' }}>🤖</span>
              <Typography variant="body2" sx={{ color: '#166534', fontSize: '12px' }}>
                <strong>AI Recommendation:</strong> {intentAnalysis.optimized_config.provider_justification}
              </Typography>
            </Box>
          )}

          {/* Provider Selection with Justification */}
          <Box mb={2}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="caption" color="#666" fontWeight={600}>
                Research Provider
              </Typography>
              {intentAnalysis?.optimized_config?.provider_justification && (
                <Tooltip title={intentAnalysis.optimized_config.provider_justification} arrow>
                  <Chip
                    label="AI"
                    size="small"
                    sx={{
                      height: '16px',
                      fontSize: '9px',
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                    }}
                  />
                </Tooltip>
              )}
            </Box>
            <ProviderChips providerAvailability={providerAvailability} />
          </Box>

          {/* Provider Tabs */}
          <Box sx={{ mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  minHeight: '40px',
                  '&.Mui-selected': {
                    color: '#0ea5e9',
                    fontWeight: 600,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#0ea5e9',
                },
              }}
            >
              {providerAvailability.exa_available && (
                <Tab 
                  label="Exa Options" 
                  disabled={!providerAvailability.exa_available}
                />
              )}
              {providerAvailability.tavily_available && (
                <Tab 
                  label="Tavily Options" 
                  disabled={!providerAvailability.tavily_available}
                />
              )}
            </Tabs>
          </Box>

          {/* Provider-specific Options */}
          {activeTab === 0 && providerAvailability.exa_available && (
            <ExaOptions
              config={config}
              onConfigUpdate={onConfigUpdate}
              optimizedConfig={intentAnalysis?.optimized_config}
            />
          )}

          {activeTab === 1 && providerAvailability.tavily_available && (
            <TavilyOptions
              config={config}
              onConfigUpdate={onConfigUpdate}
            />
          )}
        </Box>
      )}
    </>
  );
};
