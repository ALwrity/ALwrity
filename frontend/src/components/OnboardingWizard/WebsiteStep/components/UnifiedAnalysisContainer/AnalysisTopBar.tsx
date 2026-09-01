import React from 'react';
import { Box, Tooltip, FormControlLabel, Switch, Button, Chip, Typography } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TuneIcon from '@mui/icons-material/Tune';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import type { TabKey, DomainKey } from './types';
import { DOMAIN_ACCENT } from './AnalysisSidebar';

// Tabs in the new order: Insights, Guidelines, Refine & Actions
const TABS: { key: TabKey; label: string; icon: React.ReactNode; tooltip: string }[] = [
  {
    key: 'insights',
    label: 'Insights',
    icon: <AnalyticsIcon fontSize="small" />,
    tooltip: 'Core metrics, extracted data and audit results for this domain.',
  },
  {
    key: 'guidelines',
    label: 'Guidelines',
    icon: <AutoAwesomeIcon fontSize="small" />,
    tooltip: 'AI-generated writing rules, tone guidance and best-practice cards for this domain.',
  },
  {
    key: 'refine_actions',
    label: 'Refine & Actions',
    icon: <TuneIcon fontSize="small" />,
    tooltip: 'Edit the brand profile, fine-tune AI values, and view strategic suggestions.',
  },
];

interface AnalysisTopBarProps {
  activeTab: TabKey;
  activeDomain: DomainKey;
  onTabChange: (tab: TabKey) => void;
  isEditable: boolean;
  onEditableChange: (v: boolean) => void;
  confidence?: number;
  onSave?: () => void;
}

const AnalysisTopBar: React.FC<AnalysisTopBarProps> = ({
  activeTab,
  activeDomain,
  onTabChange,
  isEditable,
  onEditableChange,
  confidence,
  onSave,
}) => {
  const accent = DOMAIN_ACCENT[activeDomain];
  const currentTabIndex = TABS.findIndex((t) => t.key === activeTab);
  const isDomainEditable = ['overview', 'brand', 'audience', 'content'].includes(activeDomain);

  const confidenceColor =
    confidence !== undefined
      ? confidence >= 0.7
        ? 'success'
        : confidence >= 0.4
        ? 'warning'
        : 'error'
      : undefined;

  return (
    <Box
      data-testid="analysis-top-bar"
      sx={{
        bgcolor: '#FFFFFF',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        width: '100%',
        minHeight: 64,
      }}
    >
      {/* Tabs */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Tooltip key={tab.key} title={tab.tooltip} placement="bottom" arrow>
              <Box
                data-testid={`top-tab-${tab.key}`}
                onClick={() => onTabChange(tab.key)}
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: { xs: 2.5, sm: 3.5 },
                  py: 1,
                  minWidth: { xs: 120, sm: 160 },
                  cursor: 'pointer',
                  bgcolor: isActive ? '#FFFFFF' : '#F8FAFC',
                  color: isActive ? accent : '#64748B',
                  borderRight: '1px solid #E2E8F0',
                  borderBottom: isActive ? `3px solid ${accent}` : '3px solid transparent',
                  transition: 'all 0.2s ease',
                  gap: 1.2,
                  '&:hover': {
                    bgcolor: isActive ? '#FFFFFF' : '#F1F5F9',
                    color: isActive ? accent : '#475569',
                  },
                }}
              >
                <Box
                  sx={{
                    color: isActive ? accent : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& svg': {
                      fontSize: '1.2rem',
                    },
                  }}
                >
                  {tab.icon}
                </Box>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    textTransform: 'none',
                    letterSpacing: '0.01em',
                  }}
                >
                  {tab.label}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Global controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', px: 2, py: 1 }}>
        {/* Confidence chip - always show */}
        {confidence !== undefined && (
          <Tooltip title="AI confidence in the accuracy of this analysis." arrow>
            <Chip
              data-testid="confidence-chip"
              size="small"
              label={`${(confidence * 100).toFixed(0)}% confidence`}
              color={confidenceColor}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}

        {/* Global controls - visible under Refine & Actions tab */}
        {activeTab === 'refine_actions' && (
          <>
            {/* Edit mode toggle */}
            {isDomainEditable && (
              <FormControlLabel
                data-testid="edit-mode-switch"
                control={
                  <Switch
                    checked={isEditable}
                    onChange={(e) => onEditableChange(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase': {
                        color: '#94A3B8 !important', // Inactive floating circle is standard grey
                        '&.Mui-checked': {
                          color: `${accent} !important`, // Active floating circle gets the accent color
                          '& + .MuiSwitch-track': {
                            backgroundColor: '#E2E8F0 !important', // Track remains solid light grey
                            opacity: '1 !important',
                          },
                        },
                      },
                      '& .MuiSwitch-track': {
                        backgroundColor: '#CBD5E1 !important', // Track is grey when unchecked
                        opacity: '1 !important',
                      },
                    }}
                  />
                }
                label="Edit Mode"
                sx={{
                  m: 0,
                  '& .MuiTypography-root': {
                    color: '#4a5568 !important',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  },
                }}
              />
            )}

            {/* Save button */}
            {onSave && (
              <Button
                data-testid="save-button"
                size="small"
                variant="contained"
                startIcon={<SaveIcon fontSize="small" />}
                onClick={onSave}
                sx={{
                  background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                  color: 'white',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  boxShadow: 'none',
                  '&:hover': { filter: 'brightness(1.1)', boxShadow: 'none' },
                }}
              >
                Save
              </Button>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export { TABS };
export default AnalysisTopBar;
