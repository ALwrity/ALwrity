import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Grid,
  TextField,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Edit from '@mui/icons-material/Edit';
import PlayArrow from '@mui/icons-material/PlayArrow';
import AttachMoney from '@mui/icons-material/AttachMoney';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Description from '@mui/icons-material/Description';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Info from '@mui/icons-material/Info';
import { motion } from 'framer-motion';
import { ImageStudioLayout } from '../ImageStudio/ImageStudioLayout';
import { GlassyCard } from '../ImageStudio/ui/GlassyCard';
import { SectionHeader } from '../ImageStudio/ui/SectionHeader';
import { CampaignFlowIndicator } from './CampaignFlowIndicator';
import { useCampaignCreator, AssetProposal } from '../../hooks/useCampaignCreator';

interface ProposalReviewProps {
  campaignId: string;
  onBack: () => void;
  onComplete: () => void;
}

export const ProposalReview: React.FC<ProposalReviewProps> = ({
  campaignId,
  onBack,
  onComplete,
}) => {
  const {
    getCampaignProposals,
    proposals,
    isGeneratingProposals,
    generateAsset,
    isGeneratingAsset,
    error,
  } = useCampaignCreator();

  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [editingProposal, setEditingProposal] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load proposals for this campaign
    getCampaignProposals(campaignId).catch(console.error);
  }, [campaignId, getCampaignProposals]);

  const handleToggleProposal = (assetId: string) => {
    setSelectedProposals((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (proposals && proposals.proposals) {
      if (selectedProposals.size === Object.keys(proposals.proposals).length) {
        setSelectedProposals(new Set());
      } else {
        setSelectedProposals(new Set(Object.keys(proposals.proposals)));
      }
    }
  };

  const handleEditPrompt = (assetId: string, currentPrompt: string) => {
    setEditingProposal(assetId);
    setEditedPrompts((prev) => ({
      ...prev,
      [assetId]: currentPrompt,
    }));
  };

  const handleSavePrompt = (assetId: string) => {
    setEditingProposal(null);
    // Prompt is already saved in editedPrompts state
  };

  const handleGenerateSelected = async () => {
    if (!proposals || !proposals.proposals || selectedProposals.size === 0) {
      return;
    }

    setIsGenerating(true);
    const progress: Record<string, boolean> = {};

    try {
      // Generate assets one by one
      for (const assetId of selectedProposals) {
        const proposal = proposals.proposals[assetId];
        if (!proposal) continue;

        progress[assetId] = true;
        setGenerationProgress({ ...progress });

        try {
          // Use edited prompt if available
          const promptToUse = editedPrompts[assetId] || proposal.proposed_prompt;

          await generateAsset(
            {
              ...proposal,
              proposed_prompt: promptToUse,
            },
            {}
          );

          progress[assetId] = false;
          setGenerationProgress({ ...progress });
        } catch (err) {
          console.error(`Failed to generate asset ${assetId}:`, err);
          progress[assetId] = false;
          setGenerationProgress({ ...progress });
        }
      }

      // After all assets are generated, complete the flow
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (err) {
      console.error('Error generating assets:', err);
    } finally {
      setIsGenerating(false);
      setGenerationProgress({});
    }
  };

  const totalCost = proposals
    ? Object.values(proposals.proposals)
        .filter((p, idx) => selectedProposals.has(Object.keys(proposals.proposals)[idx]))
        .reduce((sum, p) => sum + (p.cost_estimate || 0), 0)
    : 0;

  const proposalsList = proposals?.proposals ? Object.entries(proposals.proposals) : [];

  return (
    <ImageStudioLayout
      headerProps={{
        title: 'Review Asset Proposals',
        subtitle: 'Review and approve AI-generated proposals for your campaign assets',
      }}
    >
      <GlassyCard
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          p: { xs: 3, md: 4 },
        }}
      >
        <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 3 }}>
          Back to Campaign
        </Button>

        <CampaignFlowIndicator currentStep="review" />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => {}}>
            {error}
          </Alert>
        )}

        {isGeneratingProposals ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={6}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Generating Proposals...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI is creating personalized asset proposals based on your brand DNA
            </Typography>
          </Box>
        ) : proposalsList.length === 0 ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            No proposals found. Generate proposals first.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Header with actions */}
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  {proposalsList.length} Asset Proposals
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Review and select proposals to generate assets
                </Typography>
              </Box>
              <Box display="flex" gap={2}>
                <Button variant="outlined" onClick={handleSelectAll}>
                  {selectedProposals.size === proposalsList.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={isGenerating ? <CircularProgress size={16} /> : <PlayArrow />}
                  onClick={handleGenerateSelected}
                  disabled={selectedProposals.size === 0 || isGenerating}
                >
                  {isGenerating ? 'Generating...' : `Generate ${selectedProposals.size} Selected`}
                </Button>
              </Box>
            </Box>

            {/* Cost Summary */}
            {selectedProposals.size > 0 && (
              <Alert severity="info" icon={<AttachMoney />}>
                <Typography variant="body2">
                  <strong>Estimated Cost:</strong> ${totalCost.toFixed(2)} for {selectedProposals.size} asset(s)
                </Typography>
              </Alert>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Proposals List */}
            <Grid container spacing={2}>
              {proposalsList.map(([assetId, proposal]) => {
                const isSelected = selectedProposals.has(assetId);
                const isGenerating = generationProgress[assetId];
                const isEditing = editingProposal === assetId;
                const editedPrompt = editedPrompts[assetId] || proposal.proposed_prompt || '';

                return (
                  <Grid item xs={12} key={assetId}>
                    <GlassyCard
                      sx={{
                        border: isSelected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <CardContent>
                        <Stack spacing={2}>
                          {/* Proposal Header */}
                          <Box display="flex" justifyContent="space-between" alignItems="start">
                            <Box display="flex" alignItems="center" gap={2}>
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleToggleProposal(assetId)}
                                disabled={isGenerating}
                              />
                              <Box>
                                <Typography variant="h6" fontWeight={700}>
                                  {proposal.asset_type.toUpperCase()} - {proposal.channel}
                                </Typography>
                                <Box display="flex" gap={1} mt={1}>
                                  <Chip
                                    label={proposal.channel}
                                    size="small"
                                    icon={<PhotoLibrary />}
                                  />
                                  <Chip
                                    label={proposal.recommended_provider || 'Auto'}
                                    size="small"
                                    color="secondary"
                                  />
                                  <Chip
                                    label={`$${proposal.cost_estimate?.toFixed(2) || '0.00'}`}
                                    size="small"
                                    icon={<AttachMoney />}
                                    color="success"
                                  />
                                </Box>
                              </Box>
                            </Box>
                            {isGenerating && (
                              <CircularProgress size={24} />
                            )}
                          </Box>

                          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                          {/* Concept Summary */}
                          {proposal.concept_summary && (
                            <Box>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Concept
                              </Typography>
                              <Typography variant="body1">{proposal.concept_summary}</Typography>
                            </Box>
                          )}

                          {/* Prompt */}
                          <Accordion sx={{ background: 'rgba(255,255,255,0.02)' }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <AutoAwesome fontSize="small" />
                                <Typography variant="body2" fontWeight={600}>
                                  AI-Generated Prompt
                                </Typography>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              {isEditing ? (
                                <Stack spacing={2}>
                                  <TextField
                                    multiline
                                    rows={4}
                                    value={editedPrompt}
                                    onChange={(e) =>
                                      setEditedPrompts((prev) => ({
                                        ...prev,
                                        [assetId]: e.target.value,
                                      }))
                                    }
                                    fullWidth
                                    sx={{
                                      '& .MuiInputBase-root': {
                                        background: 'rgba(255,255,255,0.05)',
                                      },
                                    }}
                                  />
                                  <Box display="flex" gap={2}>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      onClick={() => handleSavePrompt(assetId)}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => {
                                        setEditingProposal(null);
                                        setEditedPrompts((prev) => {
                                          const next = { ...prev };
                                          delete next[assetId];
                                          return next;
                                        });
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </Box>
                                </Stack>
                              ) : (
                                <Stack spacing={2}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {editedPrompt}
                                  </Typography>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<Edit />}
                                    onClick={() => handleEditPrompt(assetId, editedPrompt)}
                                  >
                                    Edit Prompt
                                  </Button>
                                </Stack>
                              )}
                            </AccordionDetails>
                          </Accordion>

                          {/* Template Info */}
                          {proposal.recommended_template && (
                            <Box>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Recommended Template
                              </Typography>
                              <Chip label={proposal.recommended_template} size="small" />
                            </Box>
                          )}
                        </Stack>
                      </CardContent>
                    </GlassyCard>
                  </Grid>
                );
              })}
            </Grid>

            {/* Bottom Actions */}
            <Box
              sx={{
                position: 'sticky',
                bottom: 0,
                background: 'rgba(15,23,42,0.95)',
                backdropFilter: 'blur(20px)',
                p: 3,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                mt: 4,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {selectedProposals.size} of {proposalsList.length} proposals selected
                  </Typography>
                  {selectedProposals.size > 0 && (
                    <Typography variant="h6" color="success.main">
                      Estimated Cost: ${totalCost.toFixed(2)}
                    </Typography>
                  )}
                </Box>
                <Box display="flex" gap={2}>
                  <Button variant="outlined" onClick={onBack}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={isGenerating ? <CircularProgress size={20} /> : <AutoAwesome />}
                    onClick={handleGenerateSelected}
                    disabled={selectedProposals.size === 0 || isGenerating}
                  >
                    {isGenerating
                      ? 'Generating Assets...'
                      : `Generate ${selectedProposals.size} Asset${selectedProposals.size !== 1 ? 's' : ''}`}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Stack>
        )}
      </GlassyCard>
    </ImageStudioLayout>
  );
};

