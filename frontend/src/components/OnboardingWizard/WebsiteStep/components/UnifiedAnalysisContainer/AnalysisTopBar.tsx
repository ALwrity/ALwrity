import React from 'react';
import { Box, Tabs, Tab, Tooltip, FormControlLabel, Switch, Button, Chip, Typography } from '@mui/material';
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
        borderBottom: '1px solid #E2E8F0',
        bgcolor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        flexWrap: 'wrap',
        gap: 1,
        width: '100%',
      }}
    >
      {/* Tabs */}
      <Tabs
        value={currentTabIndex === -1 ? 0 : currentTabIndex}
        onChange={(_, idx) => onTabChange(TABS[idx].key)}
        sx={{
          minHeight: 48,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 48,
            fontSize: '0.82rem',
            color: '#64748B',
            '&.Mui-selected': { color: accent },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: accent,
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        }}
      >
        {TABS.map((tab) => (
          <Tooltip key={tab.key} title={tab.tooltip} placement="bottom" arrow>
            <Tab
              data-testid={`top-tab-${tab.key}`}
              icon={tab.icon}
              iconPosition="start"
              label={tab.label}
            />
          </Tooltip>
        ))}
      </Tabs>

      {/* Global controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 0.5 }}>
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
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
                    Edit Mode
                  </Typography>
                }
                sx={{ m: 0 }}
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
