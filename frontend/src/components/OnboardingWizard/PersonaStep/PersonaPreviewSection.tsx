import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Fade
} from '@mui/material';
import { CheckCircle, Cancel, Refresh } from '@mui/icons-material';
import { CorePersonaDisplay } from './sections/CorePersonaDisplay';
import { PlatformPersonaDisplay } from './sections/PlatformPersonaDisplay';
import { HowWeBuiltThisPersona } from './sections/HowWeBuiltThisPersona';
import {
  PLATFORM_ICONS,
  PLATFORM_COLORS,
  DEFAULT_PLATFORM_ICON,
  DEFAULT_PLATFORM_COLOR,
} from './utils/personaPlatformMeta';
import type { PersonaPlatform } from '../../../api/personaApi';

interface PersonaPreviewSectionProps {
  showPreview: boolean;
  corePersona: any;
  platformPersonas: Record<string, any>;
  qualityMetrics: any;
  /** Canonical platform list from the backend registry (names/flags). */
  platforms?: PersonaPlatform[];
  setCorePersona: (persona: any) => void;
  setPlatformPersonas: (personas: Record<string, any>) => void;
  /** Trigger on-demand generation for a platform (used by "Generate Now"). */
  onGenerateNow?: (platformId: string) => void;
  /** Phase 2: deterministic completeness from the backend, plumbed to HowWeBuiltThisPersona. */
  completeness?: {
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null;
  /** Phase 2: data-sufficiency (0-100) from the backend. */
  data_sufficiency?: number | null;
}

export const PersonaPreviewSection: React.FC<PersonaPreviewSectionProps> = ({
  showPreview,
  corePersona,
  platformPersonas,
  qualityMetrics,
  platforms = [],
  setCorePersona,
  setPlatformPersonas,
  onGenerateNow,
  completeness,
  data_sufficiency,
}) => {
  const [activeTab, setActiveTab] = useState<string>('core');

  if (!showPreview || !corePersona) {
    return null;
  }

  const enabledPlatforms = platforms.filter((p) => p.enabled);

  const isGenerated = (platformId: string): boolean => {
    const pp = platformPersonas[platformId];
    return !!(pp && typeof pp === 'object' && !pp.error && Object.keys(pp).length > 0);
  };

  return (
    <Fade in={true}>
      <Box>
        <Tabs
          value={activeTab}
          onChange={(_event, value) => setActiveTab(value as string)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: '1px solid #e2e8f0',
            mb: 2,
            minHeight: 40,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab value="core" label="Core" />
          {enabledPlatforms.map((p) => (
            <Tab
              key={p.id}
              value={p.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{p.name}</span>
                  {isGenerated(p.id) ? (
                    <CheckCircle sx={{ fontSize: 14, color: '#10b981' }} />
                  ) : (
                    <Cancel sx={{ fontSize: 14, color: '#ef4444' }} />
                  )}
                </Box>
              }
              icon={PLATFORM_ICONS[p.id] ?? DEFAULT_PLATFORM_ICON}
              iconPosition="start"
            />
          ))}
        </Tabs>

        {activeTab === 'core' && (
          <Box>
            <CorePersonaDisplay
              persona={corePersona}
              onChange={setCorePersona}
              completeness={completeness}
              data_sufficiency={data_sufficiency}
            />
            {qualityMetrics && (
              <Box sx={{ mt: 3 }}>
                <HowWeBuiltThisPersona
                  persona={corePersona}
                  completeness={completeness}
                  data_sufficiency={data_sufficiency}
                  qualityMetrics={qualityMetrics}
                />
              </Box>
            )}
          </Box>
        )}

        {enabledPlatforms.map((p) => {
          if (activeTab !== p.id) {
            return null;
          }

          if (isGenerated(p.id)) {
            return (
              <Box key={p.id}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => onGenerateNow?.(p.id)}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                  >
                    Regenerate
                  </Button>
                </Box>
                <PlatformPersonaDisplay
                  platformPersona={platformPersonas[p.id]}
                  platformName={p.id}
                  onChange={(updatedPersona) =>
                    setPlatformPersonas({ ...platformPersonas, [p.id]: updatedPersona })
                  }
                />
              </Box>
            );
          }

          return (
            <Box
              key={p.id}
              sx={{
                textAlign: 'center',
                py: 6,
                px: 2,
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px dashed #cbd5e1',
                borderRadius: 3,
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: `${PLATFORM_COLORS[p.id] ?? DEFAULT_PLATFORM_COLOR}22`,
                  color: PLATFORM_COLORS[p.id] ?? DEFAULT_PLATFORM_COLOR,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                {PLATFORM_ICONS[p.id] ?? DEFAULT_PLATFORM_ICON}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
                {p.name} persona not ready yet
              </Typography>
              <Typography variant="body2" sx={{ color: '#6b7280', maxWidth: 380, mx: 'auto', mb: 2 }}>
                {p.scheduled
                  ? 'Scheduled — this persona will be generated automatically in the background after you finish onboarding (about 10 minutes). Generate it now if you want it right away.'
                  : 'This persona has not been generated yet.'}
              </Typography>
              <Button
                variant="contained"
                onClick={() => onGenerateNow?.(p.id)}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 3 }}
              >
                Generate Now
              </Button>
            </Box>
          );
        })}
      </Box>
    </Fade>
  );
};

export default PersonaPreviewSection;
