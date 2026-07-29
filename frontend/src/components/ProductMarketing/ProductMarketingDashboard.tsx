import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Campaign,
  AutoAwesome,
  PhotoLibrary,
  Assessment,
  TrendingUp,
  CheckCircle,
  RadioButtonUnchecked,
  PhotoCamera,
} from '@mui/icons-material';
import Joyride, { ACTIONS, CallBackProps, EVENTS, STATUS } from 'react-joyride';
import { motion } from 'framer-motion';
import { ImageStudioLayout } from '../ImageStudio/ImageStudioLayout';
import { GlassyCard } from '../ImageStudio/ui/GlassyCard';
import { SectionHeader } from '../ImageStudio/ui/SectionHeader';
import { useCampaignCreator } from '../../hooks/useCampaignCreator';
import { useProductMarketing } from '../../hooks/useProductMarketing';
import { CampaignWizard } from './CampaignWizard';
import { AssetAuditPanel } from './AssetAuditPanel';
import { ProposalReview } from './ProposalReview';
import { PersonalizedRecommendations } from './PersonalizedRecommendations';
import { useNavigate } from 'react-router-dom';
import { productMarketingSteps } from '../../utils/walkthroughs/productMarketingSteps';
import { campaignCreatorSteps } from '../../utils/walkthroughs/campaignCreatorSteps';
import {
  ALWRITY_JOYRIDE_LOCALE,
  focusJoyrideTooltip,
  getAlwrityJoyrideStyles,
  getTourViewportVariant,
  hasTourBeenSeen,
  isTourCompactViewport,
  markTourFinished,
  markTourSkipped,
} from '../../utils/walkthroughs/alwrityJoyrideTheme';

const MotionCard = motion.create(Card);

interface CampaignSummary {
  campaign_id: string;
  campaign_name: string;
  goal: string;
  status: string;
  total_assets: number;
  completed_assets: number;
  channels: string[];
}

export const ProductMarketingDashboard: React.FC = () => {
  const {
    getBrandDNA,
    brandDNA,
    isLoadingBrandDNA,
    listCampaigns,
    campaigns: apiCampaigns,
    isLoadingCampaigns,
  } = useCampaignCreator();
  const [showWizard, setShowWizard] = useState(false);
  const [showAssetAudit, setShowAssetAudit] = useState(false);
  const [reviewCampaignId, setReviewCampaignId] = useState<string | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [tourType, setTourType] = useState<'campaign' | 'product'>('campaign');
  const navigate = useNavigate();

  useEffect(() => {
    // Load brand DNA on mount
    if (!brandDNA) {
      getBrandDNA();
    }
    // Load campaigns on mount
    listCampaigns();
    // Auto-run campaign tour for first-time visitors
    const hasSeenCampaignTour = hasTourBeenSeen('pm_campaign_tour_seen');
    if (!hasSeenCampaignTour) {
      setTourType('campaign');
      setRunTour(true);
    }
  }, [brandDNA, getBrandDNA, listCampaigns]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TOOLTIP) {
      if (action !== ACTIONS.CLOSE && action !== ACTIONS.SKIP) {
        focusJoyrideTooltip();
      }
    }

    if (status === STATUS.FINISHED) {
      setRunTour(false);
      const key = tourType === 'campaign' ? 'pm_campaign_tour_seen' : 'pm_product_tour_seen';
      markTourFinished(key);
    } else if (status === STATUS.SKIPPED) {
      setRunTour(false);
      const key = tourType === 'campaign' ? 'pm_campaign_tour_seen' : 'pm_product_tour_seen';
      markTourSkipped(key);
    }
  };

  const startTour = (type: 'campaign' | 'product') => {
    setTourType(type);
    setRunTour(true);
  };

  const handleCreateCampaign = () => {
    setShowWizard(true);
  };

  const handleJourneySelect = (journey: string) => {
    if (journey === 'launch') {
      setShowWizard(true);
    } else if (journey === 'photoshoot') {
      navigate('/campaign-creator/photoshoot');
    } else if (journey === 'animation') {
      navigate('/campaign-creator/animation');
    } else if (journey === 'video') {
      navigate('/campaign-creator/video');
    } else if (journey === 'avatar') {
      navigate('/campaign-creator/avatar');
    } else if (journey === 'optimize') {
      // TODO: Show optimization insights
      alert('Optimization insights coming soon!');
    }
  };

  const handleWizardComplete = (blueprint: any) => {
    setShowWizard(false);
    // Reload campaigns from API
    listCampaigns();
    // Navigate to proposal review
    setReviewCampaignId(blueprint.campaign_id);
  };

  if (showWizard) {
    return <CampaignWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />;
  }

  if (showAssetAudit) {
    return <AssetAuditPanel onClose={() => setShowAssetAudit(false)} />;
  }

  if (reviewCampaignId) {
    return (
      <ProposalReview
        campaignId={reviewCampaignId}
        onBack={() => {
          setReviewCampaignId(null);
          listCampaigns();
        }}
        onComplete={() => {
          setReviewCampaignId(null);
          listCampaigns();
        }}
      />
    );
  }

  return (
    <ImageStudioLayout
      headerProps={{
        title: 'Campaign Creator & Product Marketing',
        subtitle:
          'Create multi-channel campaigns or generate individual product assets. Choose your workflow below.',
      }}
    >
      <GlassyCard
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          p: { xs: 3, md: 5 },
        }}
      >
        {/* Walkthrough Controls */}
        <Box display="flex" justifyContent="flex-end" gap={1} mb={2}>
          <Button size="small" variant="outlined" onClick={() => startTour('campaign')}>
            Show Campaign Tour
          </Button>
          <Button size="small" variant="outlined" onClick={() => startTour('product')}>
            Show Product Tour
          </Button>
        </Box>

        <Joyride
          steps={tourType === 'campaign' ? campaignCreatorSteps : productMarketingSteps}
          continuous
          showSkipButton
          showProgress
          run={runTour}
          scrollToFirstStep={isTourCompactViewport()}
          disableScrolling={!isTourCompactViewport()}
          disableCloseOnEsc={false}
          locale={ALWRITY_JOYRIDE_LOCALE}
          styles={getAlwrityJoyrideStyles(getTourViewportVariant(), {
            primaryColor: '#7c3aed',
            zIndex: 3000,
          })}
          callback={handleJoyrideCallback}
        />

        {/* Brand DNA Status */}
        <Box data-tour="cc-recommendations">
          {isLoadingBrandDNA ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : brandDNA ? (
            <Alert severity="success" sx={{ mb: 3 }}>
              Your Brand Style loaded: {brandDNA.persona?.persona_name || 'Default Persona'} •{' '}
              {brandDNA.writing_style?.tone || 'professional'} tone • {brandDNA.target_audience?.industry_focus || 'general'} industry
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              Complete onboarding to enable personalized campaigns with your brand style.
            </Alert>
          )}

          {/* Personalized Recommendations */}
          <PersonalizedRecommendations variant="campaign_creator" />
        </Box>

        {/* Campaign Creator Section */}
        <SectionHeader
          title="Campaign Creator"
          subtitle="Create multi-channel marketing campaigns with AI-generated assets"
          sx={{ mb: 3 }}
        />

        <Grid container spacing={3} sx={{ mb: 4 }} data-tour="cc-journeys">
          <Grid item xs={12} md={4}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
              }}
              onClick={() => handleJourneySelect('launch')}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Campaign sx={{ color: '#c4b5fd', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Journey A: Launch Campaign
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Create a new marketing campaign from scratch. AI generates personalized assets based on your brand DNA.
                  </Typography>
                  <Button variant="contained" startIcon={<AutoAwesome />} fullWidth>
                    Start Campaign Wizard
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
              onClick={() => setShowAssetAudit(true)}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhotoLibrary sx={{ color: '#93c5fd', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Journey B: Enhance Assets
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Upload existing assets for AI-powered quality assessment and enhancement recommendations.
                  </Typography>
                  <Button variant="contained" startIcon={<PhotoLibrary />} fullWidth>
                    Upload & Audit
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
              onClick={() => handleJourneySelect('photoshoot')}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhotoCamera sx={{ color: '#6ee7b7', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Journey C: Product Photoshoot
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Generate professional product images for e-commerce listings and marketing campaigns.
                  </Typography>
                  <Button variant="contained" startIcon={<PhotoCamera />} fullWidth>
                    Launch Photoshoot Studio
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* Personalized Recommendations for Product Marketing */}
        <Box data-tour="pm-recommendations">
          <PersonalizedRecommendations variant="product_marketing" />
        </Box>

        {/* Product Marketing Section */}
        <SectionHeader
          title="Product Marketing Suite"
          subtitle="Generate individual product assets: images, animations, videos, and avatars"
          sx={{ mb: 3 }}
        />

        <Grid container spacing={3} sx={{ mb: 4 }} data-tour="pm-product-grid">
          <Grid item xs={12} md={4}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
              }}
              onClick={() => handleJourneySelect('animation')}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhotoCamera sx={{ color: '#fbbf24', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Product Animation Studio
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Transform product images into engaging animations. Create reveal animations, 360° rotations, and product demos.
                  </Typography>
                  <Button variant="contained" startIcon={<PhotoCamera />} fullWidth>
                    Launch Animation Studio
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
              onClick={() => handleJourneySelect('video')}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhotoLibrary sx={{ color: '#93c5fd', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Product Video Studio
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Create product demo videos from text descriptions. Generate demo videos, storytelling content, and feature highlights.
                  </Typography>
                  <Button variant="contained" startIcon={<PhotoLibrary />} fullWidth>
                    Launch Video Studio
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
              onClick={() => handleJourneySelect('avatar')}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhotoCamera sx={{ color: '#6ee7b7', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Product Avatar Studio
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Create product explainer videos with talking avatars. Generate overview videos, tutorials, and brand messages.
                  </Typography>
                  <Button variant="contained" startIcon={<PhotoCamera />} fullWidth>
                    Launch Avatar Studio
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* Quick Actions */}
        <Box data-tour="quick-actions">
          <SectionHeader
            title="Quick Actions"
            subtitle="Start a new campaign or enhance existing assets"
            sx={{ mb: 3 }}
          />

          <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
              }}
              onClick={handleCreateCampaign}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Campaign sx={{ color: '#c4b5fd', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Create Campaign
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Launch a new marketing campaign with AI-generated assets personalized to your brand.
                  </Typography>
                  <Button variant="contained" startIcon={<AutoAwesome />} fullWidth>
                    Start Campaign Wizard
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <MotionCard
              whileHover={{ scale: 1.02 }}
              sx={{
                height: '100%',
                cursor: 'pointer',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
              onClick={() => setShowAssetAudit(true)}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhotoLibrary sx={{ color: '#93c5fd', fontSize: 32 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Audit Assets
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Upload existing assets for AI-powered quality assessment and enhancement recommendations.
                  </Typography>
                  <Button variant="contained" startIcon={<PhotoLibrary />} fullWidth>
                    Upload & Audit
                  </Button>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* Active Campaigns */}
        <Box data-tour="active-campaigns">
          <SectionHeader
            title="Active Campaigns"
            subtitle={
              isLoadingCampaigns
                ? 'Loading campaigns...'
                : apiCampaigns.length === 0
                ? 'No active campaigns. Create your first campaign to get started.'
                : `${apiCampaigns.length} campaign(s) in progress`
            }
            sx={{ mb: 3 }}
          />

        {isLoadingCampaigns ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : apiCampaigns.length === 0 ? (
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            <Campaign sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No campaigns yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first campaign to start generating personalized marketing assets
            </Typography>
            <Button variant="contained" startIcon={<AutoAwesome />} onClick={handleCreateCampaign}>
              Create Campaign
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {apiCampaigns.map((campaign) => (
              <Grid item xs={12} md={6} key={campaign.campaign_id}>
                <GlassyCard sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="start">
                      <Box>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                          {campaign.campaign_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {campaign.goal}
                        </Typography>
                      </Box>
                      <Chip
                        label={campaign.status}
                        size="small"
                        color={campaign.status === 'ready' ? 'success' : 'default'}
                      />
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Progress
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box flex={1}>
                          <Box
                            sx={{
                              height: 8,
                              borderRadius: 1,
                              background: 'rgba(255,255,255,0.1)',
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                width: `${((campaign.asset_nodes?.filter((n: any) => n.status === 'ready' || n.status === 'approved').length || 0) / (campaign.asset_nodes?.length || 1)) * 100}%`,
                                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {campaign.asset_nodes?.filter((n: any) => n.status === 'ready' || n.status === 'approved').length || 0}/{campaign.asset_nodes?.length || 0}
                        </Typography>
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Channels
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {campaign.channels.map((channel) => (
                          <Chip key={channel} label={channel} size="small" />
                        ))}
                      </Box>
                    </Box>

                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => {
                        // Check if proposals exist, if so show review, otherwise show campaign
                        setReviewCampaignId(campaign.campaign_id);
                      }}
                    >
                      {campaign.asset_nodes?.some((n: any) => n.status === 'proposed') ? 'Review Proposals' : 'View Campaign'}
                    </Button>
                  </Stack>
                </GlassyCard>
              </Grid>
            ))}
          </Grid>
        )}
        </Box>
      </GlassyCard>
    </ImageStudioLayout>
  );
};

