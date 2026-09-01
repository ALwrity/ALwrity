/**
 * UnifiedAnalysisContainer
 *
 * A layout shell that hosts all website-analysis sections in a
 * [Left Sidebar × Top Tab Bar] matrix layout.
 *
 * Realigned and updated according to user request:
 *  1. Horizontal tabs merged into a single "Refine & Actions" tab.
 *  2. "Use for AI generation" checkbox removed completely (Option A).
 *  3. Vertical tabs are constant and always visible.
 */

import React, { useState, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Alert } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import AnalysisSidebar from './AnalysisSidebar';
import AnalysisTopBar from './AnalysisTopBar';
import AnalysisContentStage from './AnalysisContentStage';
import type { DomainKey, TabKey, UnifiedAnalysisContainerProps } from './types';
import { TAB_CORRESPONDING_DOMAINS } from './types';
import { apiClient } from '../../../../../api/client';

const UnifiedAnalysisContainer: React.FC<UnifiedAnalysisContainerProps> = ({
  analysis,
  domainName,
  crawlResult,
  onAnalysisUpdate,
  warning,
  onSave,
  defaultDomain = 'overview',
  defaultTab = 'insights',
}) => {
  // Ensure starting activeDomain is valid for the starting activeTab
  const initialTab = defaultTab === 'refine' || defaultTab === 'actions' ? 'refine_actions' : defaultTab;
  const initialDomain = TAB_CORRESPONDING_DOMAINS[initialTab].includes(defaultDomain)
    ? defaultDomain
    : TAB_CORRESPONDING_DOMAINS[initialTab][0];

  const [activeDomain, setActiveDomain] = useState<DomainKey>(initialDomain);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [isEditable, setIsEditable] = useState(false);

  // Reset edit mode when domain changes to avoid stale edit state
  const handleDomainChange = useCallback((domain: DomainKey) => {
    setActiveDomain(domain);
    setIsEditable(false);
  }, []);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setIsEditable(false);

    // If current activeDomain is not valid for the new tab, switch to the first valid one
    const validDomains = TAB_CORRESPONDING_DOMAINS[tab];
    if (!validDomains.includes(activeDomain)) {
      setActiveDomain(validDomains[0]);
    }
  }, [activeDomain]);

  // Generic field-path updater — mirrors AnalysisResultsDisplay.handleSectionUpdate
  const handleSectionUpdate = useCallback(
    (section: string, fieldPath: string, value: any) => {
      if (!onAnalysisUpdate) return;
      const updated = { ...analysis };
      if (section === fieldPath) {
        (updated as any)[section] = value;
      } else if (
        typeof (updated as any)[section] === 'object' &&
        (updated as any)[section] !== null &&
        !Array.isArray((updated as any)[section])
      ) {
        (updated as any)[section] = {
          ...(updated as any)[section],
          [fieldPath]: value,
        };
      } else {
        (updated as any)[section] = { [fieldPath]: value };
      }
      onAnalysisUpdate(updated);
    },
    [analysis, onAnalysisUpdate],
  );

  const handleRunSEOAudit = async (url: string) => {
    const response = await apiClient.post('/api/seo/on-page-analysis', {
      url,
      analyze_images: true,
      analyze_content_quality: true,
    });
    return response.data;
  };

  const warningParts = warning
    ? warning.split('|').map((p) => p.trim()).filter(Boolean)
    : [];
  const guidelineWarning = warningParts.find((p) =>
    p.toLowerCase().startsWith('guidelines generation failed'),
  );

  if (!analysis) return null;

  return (
    <Card
      data-testid="unified-analysis-container"
      elevation={0}
      sx={{
        border: '1px solid #E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: '#FFFFFF',
      }}
    >
      {/* ── Card header ─────────────────────────────── */}
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: '#7C3AED', fontSize: 20 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>
              Brand Intelligence Dashboard
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              AI Analysis Complete — navigate domains on the left, switch lenses above.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Guideline warning ───────────────────────── */}
      {guidelineWarning && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          {guidelineWarning}
        </Alert>
      )}

      <CardContent sx={{ p: 0 }}>
        {/* ── Combined Header Row: ANALYSIS DOMAINS + Horizontal Tabs ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            borderBottom: '1px solid #E2E8F0',
            bgcolor: '#FFFFFF',
          }}
        >
          {/* Left: ANALYSIS DOMAINS Label (aligned with sidebar) */}
          <Box
            sx={{
              width: 200,
              flexShrink: 0,
              borderRight: '1px solid #E2E8F0',
              bgcolor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 1.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: '#94A3B8',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                fontSize: '0.65rem',
              }}
            >
              Analysis Domains
            </Typography>
          </Box>

          {/* Right: Horizontal Tabs & Controls */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <AnalysisTopBar
              activeTab={activeTab}
              activeDomain={activeDomain}
              onTabChange={handleTabChange}
              isEditable={isEditable}
              onEditableChange={setIsEditable}
              confidence={analysis.meta?.confidence}
              onSave={onSave}
            />
          </Box>
        </Box>

        {/* ── Body: Sidebar + Content Stage ───────────────────────────── */}
        <Box sx={{ display: 'flex', minHeight: 500 }}>
          <AnalysisSidebar
            activeDomain={activeDomain}
            onDomainChange={handleDomainChange}
            analysis={analysis}
            crawlResult={crawlResult}
            activeTab={activeTab}
          />

          <Box
            data-testid="content-stage"
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: '#FFFFFF',
              '& .MuiTypography-root': { color: '#111827' },
              '& .MuiPaper-root': { backgroundColor: '#ffffff' },
              '& .MuiCard-root': { backgroundColor: '#ffffff' },
            }}
          >
            <AnalysisContentStage
              activeDomain={activeDomain}
              activeTab={activeTab}
              analysis={analysis}
              crawlResult={crawlResult}
              domainName={domainName}
              isEditable={isEditable}
              onUpdate={handleSectionUpdate}
              onSave={onSave}
              onRunSEOAudit={handleRunSEOAudit}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UnifiedAnalysisContainer;
