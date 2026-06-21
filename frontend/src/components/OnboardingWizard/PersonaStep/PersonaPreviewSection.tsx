import React from 'react';
import {
  Box,
  Typography,
  Alert,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  ButtonGroup,
  Fade
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  LinkedIn as LinkedInIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  Article as ArticleIcon,
  Instagram as InstagramIcon
} from '@mui/icons-material';
import { CorePersonaDisplay } from './sections/CorePersonaDisplay';
import { PlatformPersonaDisplay } from './sections/PlatformPersonaDisplay';
import { HowWeBuiltThisPersona } from './sections/HowWeBuiltThisPersona';

/** Accordion ids the "Expand all / Collapse all" button controls.
 *  Order matches the visual order in the UI (top to bottom). */
const PERSONA_ACCORDION_IDS = ['core', 'platforms', 'how-we-built'] as const;

interface PersonaPreviewSectionProps {
  showPreview: boolean;
  corePersona: any;
  platformPersonas: Record<string, any>;
  qualityMetrics: any;
  selectedPlatforms: string[];
  /**
   * Phase 4: now an array of open accordion ids. The "Expand all"
   * button sets this to all 3 ids; "Collapse all" sets it to [].
   * Each accordion checks `.includes(id)` to decide its open state.
   */
  expandedAccordion: string[];
  setExpandedAccordion: (accordion: string[]) => void;
  setCorePersona: (persona: any) => void;
  setPlatformPersonas: (personas: Record<string, any>) => void;
  handleRegenerate: () => void;
  /** Phase 2: deterministic completeness from the backend, plumbed to HowWeBuiltThisPersona. */
  completeness?: {
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null;
  /** Phase 2: data-sufficiency (0-100) from the backend. */
  data_sufficiency?: number | null;
}

const availablePlatforms = [
  { id: 'linkedin', name: 'LinkedIn', icon: <LinkedInIcon />, color: '#0077B5' },
  { id: 'facebook', name: 'Facebook', icon: <FacebookIcon />, color: '#1877F2' },
  { id: 'twitter', name: 'Twitter', icon: <TwitterIcon />, color: '#1DA1F2' },
  { id: 'blog', name: 'Blog', icon: <ArticleIcon />, color: '#FF6B35' },
  { id: 'instagram', name: 'Instagram', icon: <InstagramIcon />, color: '#E4405F' }
];

export const PersonaPreviewSection: React.FC<PersonaPreviewSectionProps> = ({
  showPreview,
  corePersona,
  platformPersonas,
  qualityMetrics,
  selectedPlatforms,
  expandedAccordion,
  setExpandedAccordion,
  setCorePersona,
  setPlatformPersonas,
  handleRegenerate,
  completeness,
  data_sufficiency,
}) => {
  // Phase 4: helper to toggle a single accordion in the array state.
  const toggleAccordion = (id: string) => {
    setExpandedAccordion(
      expandedAccordion.includes(id)
        ? expandedAccordion.filter((x) => x !== id)
        : [...expandedAccordion, id],
    );
  };

  // "Expand all" / "Collapse all" — drive all 3 accordions together.
  // The 'platforms' accordion only counts if the user has selected
  // any platforms, so we don't show an empty one.
  const visibleIds = PERSONA_ACCORDION_IDS.filter(
    (id) => id !== 'platforms' || selectedPlatforms.length > 0,
  );
  const allExpanded = visibleIds.every((id) => expandedAccordion.includes(id));
  const expandAll = () => setExpandedAccordion([...visibleIds]);
  const collapseAll = () => setExpandedAccordion([]);
  if (!showPreview || !corePersona) {
    return null;
  }

  return (
    <Fade in={true}>
      <Box>
        {/* The "Your Brand Voice" header and "Why this matters" alert are now
            consolidated into the Step4Hero card at the top of the step.
            The Regenerate button lives in the hero too. */}

        {/* Phase 4: "Expand all / Collapse all" button bar.
            Drives all 3 persona accordions together. Hidden on
            mobile (the accordions are big enough to scroll; the
            button is a power-user convenience for desktop). */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'flex-end', mb: 1.5 }}>
          <ButtonGroup size="small" variant="outlined" aria-label="expand or collapse all persona accordions">
            <Button
              onClick={expandAll}
              disabled={allExpanded}
              startIcon={<UnfoldMoreIcon sx={{ fontSize: 18 }} />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Expand all
            </Button>
            <Button
              onClick={collapseAll}
              disabled={expandedAccordion.length === 0}
              startIcon={<UnfoldLessIcon sx={{ fontSize: 18 }} />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Collapse all
            </Button>
          </ButtonGroup>
        </Box>

        {/* Core Persona */}
        <Accordion
          expanded={expandedAccordion.includes('core')}
          onChange={() => toggleAccordion('core')}
          sx={{
            mb: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            '&:before': {
              display: 'none'
            },
            '&.Mui-expanded': {
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#64748b' }} />}
            sx={{
              px: 4,
              py: 3,
              '&:hover': {
                backgroundColor: '#f8fafc'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <PsychologyIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 0.5 }}>
                  Your core writing style
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Tone, vocabulary, sentence structure, and personality — fully editable.
                </Typography>
              </Box>
              {/* Phase 3: the 'X% Quality' chip was dropped here because it
                  duplicated the chip in the merged 'How we built this
                  persona' accordion. The user can see the score there. */}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 4, pb: 4 }}>
            <CorePersonaDisplay
              persona={corePersona}
              onChange={(updatedPersona) => {
                setCorePersona(updatedPersona);
                // TODO: Add debounced auto-save
              }}
              completeness={completeness}
              data_sufficiency={data_sufficiency}
            />
          </AccordionDetails>
        </Accordion>

        {/* Platform Adaptations */}
        <Accordion
          expanded={expandedAccordion.includes('platforms')}
          onChange={() => toggleAccordion('platforms')}
          sx={{
            mb: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            '&:before': {
              display: 'none'
            },
            '&.Mui-expanded': {
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#64748b' }} />}
            sx={{
              px: 4,
              py: 3,
              '&:hover': {
                backgroundColor: '#f8fafc'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 0.5 }}>
                  How it changes per platform
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Your voice on LinkedIn, blogs, Twitter, etc. — adapted for each audience.
                </Typography>
              </Box>
              <Chip
                label={`${selectedPlatforms.length} Platforms`}
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  fontWeight: 600,
                  '& .MuiChip-label': {
                    px: 2
                  }
                }}
                size="small"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 4, pb: 4 }}>
            <Box>
              {selectedPlatforms.map((platformId, index) => {
                const platformInfo = availablePlatforms.find(p => p.id === platformId);
                return (
                  <Box key={platformId} sx={{ mb: index < selectedPlatforms.length - 1 ? 4 : 0 }}>
                    <Divider sx={{ mb: 3 }}>
                      <Chip
                        icon={platformInfo?.icon}
                        label={platformInfo?.name || platformId}
                        sx={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          color: 'white',
                          fontWeight: 600
                        }}
                      />
                    </Divider>
                    <PlatformPersonaDisplay
                      platformPersona={platformPersonas[platformId] || {}}
                      platformName={platformId}
                      onChange={(updatedPersona) => {
                        setPlatformPersonas({
                          ...platformPersonas,
                          [platformId]: updatedPersona
                        });
                        // TODO: Add debounced auto-save
                      }}
                    />
                  </Box>
                );
              })}
              {selectedPlatforms.length === 0 && (
                <Alert severity="info" sx={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  border: '1px solid #0ea5e9',
                  color: '#0c4a6e'
                }}>
                  No platforms selected. Please select at least one platform to see optimized personas.
                </Alert>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Phase 3 (merge): the old "How well did we capture your voice?"
            accordion and the old EvidenceAccordion (inside
            CorePersonaDisplay) are both replaced by this single merged
            "How we built this persona" accordion. Nothing is dropped —
            it has 3 sub-sections: output quality, confidence & evidence,
            and data gaps. Phase 4: wired into the expandedAccordion
            array state so "Expand all / Collapse all" drives it. */}
        {qualityMetrics && (
          <Box sx={{ mb: 4 }}>
            <HowWeBuiltThisPersona
              persona={corePersona}
              completeness={completeness}
              data_sufficiency={data_sufficiency}
              qualityMetrics={qualityMetrics}
              expanded={expandedAccordion.includes('how-we-built')}
              onChange={(_, isExpanded) => {
                if (isExpanded) {
                  setExpandedAccordion(
                    Array.from(new Set([...expandedAccordion, 'how-we-built'])),
                  );
                } else {
                  setExpandedAccordion(
                    expandedAccordion.filter((x) => x !== 'how-we-built'),
                  );
                }
              }}
            />
          </Box>
        )}
      </Box>
    </Fade>
  );
};
