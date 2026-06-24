/**
 * DEPRECATED — /pricing uses PricingComparisonGrid only (Jun 26, 2026).
 * Do not re-enable without syncing limits and copy with pricingGridConfig.ts + API.
 */
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Check as CheckIcon,
  Star as StarIcon,
  WorkspacePremium as PremiumIcon,
  Info as InfoIcon,
  Psychology,
  Search as SearchIcon,
  Edit,
  Assistant,
  Verified,
  Timeline,
  Analytics,
  Support,
  Business,
  Group,
} from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ImageIcon from '@mui/icons-material/Image';
import VideoIcon from '@mui/icons-material/VideoLibrary';
import AudioIcon from '@mui/icons-material/Audiotrack';
import { useTheme } from '@mui/material/styles';
import { getPlanPriceDisplay } from '../planPricingDisplay';

interface SubscriptionPlan {
  id: number;
  name: string;
  tier: string;
  price_monthly: number;
  price_yearly: number;
  description: string;
  features: string[];
  limits: {
    gemini_calls: number;
    openai_calls: number;
    anthropic_calls: number;
    mistral_calls: number;
    tavily_calls: number;
    serper_calls: number;
    metaphor_calls: number;
    firecrawl_calls: number;
    stability_calls: number;
    monthly_cost: number;
    image_edit_calls?: number;
    video_calls?: number;
    audio_calls?: number;
    ai_text_generation_calls_limit?: number;
    exa_calls?: number;
    wavespeed_calls?: number;
  };
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  yearlyBilling: boolean;
  selectedPlanId: number | null;
  subscribing: boolean;
  isSelfServe: boolean;
  onPlanCtaClick: (planId: number) => void;
  openKnowMoreModal: (title: string, content: React.ReactNode) => void;
}

const getCtaLabel = (tier: string, isSelfServe: boolean): string => {
  if (!isSelfServe) {
    return tier === 'enterprise' ? 'Contact for Enterprise' : 'Contact for Pro';
  }
  if (tier === 'free') return 'Start for Free';
  if (tier === 'basic') return 'Subscribe to Basic';
  return `Subscribe to ${tier}`;
};

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  yearlyBilling,
  selectedPlanId,
  subscribing,
  isSelfServe,
  onPlanCtaClick,
  openKnowMoreModal,
}) => {
  const theme = useTheme();

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'free':
        return <CheckIcon color="success" />;
      case 'basic':
        return <StarIcon color="primary" />;
      case 'pro':
        return <PremiumIcon color="secondary" />;
      case 'enterprise':
        return <PremiumIcon sx={{ color: theme.palette.warning.main }} />;
      default:
        return <CheckIcon />;
    }
  };

  const getPlanColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'success' as const;
      case 'basic':
        return 'primary' as const;
      case 'pro':
        return 'secondary' as const;
      case 'enterprise':
        return 'warning' as const;
      default:
        return undefined;
    }
  };

  const isSelected = selectedPlanId === plan.id;
  const priceDisplay = getPlanPriceDisplay(plan, yearlyBilling);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        bgcolor: '#FFFFFF',
        color: '#1a1a2e',
        border: isSelected ? '2px solid #6366f1' : '1px solid #E5E7EB',
        boxShadow: isSelected
          ? '0 8px 32px rgba(99, 102, 241, 0.18)'
          : '0 2px 12px rgba(0, 0, 0, 0.06)',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.3s ease-in-out',
      }}
    >
      {plan.tier === 'pro' && (
        <Chip
          label="Popular"
          color="primary"
          size="small"
          sx={{
            position: 'absolute',
            top: -8,
            right: 16,
            zIndex: 1,
          }}
        />
      )}

      <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 3 }}>
        {/* Row 1: Icon + Plan name */}
        <Box sx={{ mb: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Box sx={{ fontSize: 32 }}>{getPlanIcon(plan.tier)}</Box>
          <Typography variant="h5" component="h2" fontWeight={700} sx={{ color: '#1a1a2e' }}>
            {plan.name}
          </Typography>
        </Box>

        {/* Row 2: Short description */}
        <Typography
          variant="body2"
          sx={{ mb: 2, color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, minHeight: { md: 72 } }}
        >
          {plan.description}
        </Typography>

        {/* Row 3: Price */}
        <Box sx={{ mb: 2 }} aria-live="polite">
          <Typography variant="h3" component="span" fontWeight={800} sx={{ color: '#1a1a2e' }}>
            ${priceDisplay.amount}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            /{priceDisplay.periodLabel}
          </Typography>
          {priceDisplay.billingNote && (
            <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.5 }}>
              {priceDisplay.billingNote}
            </Typography>
          )}
          {priceDisplay.savingsAmount != null && priceDisplay.savingsAmount > 0 && (
            <Typography variant="caption" sx={{ display: 'block', color: '#059669', mt: 0.25 }}>
              Save ${priceDisplay.savingsAmount.toFixed(0)} vs paying monthly
            </Typography>
          )}
        </Box>

        {/* Row 4: CTA */}
        <Button
          variant={isSelfServe ? 'contained' : 'outlined'}
          color={getPlanColor(plan.tier)}
          size="large"
          fullWidth
          disabled={subscribing}
          onClick={() => onPlanCtaClick(plan.id)}
          sx={{
            mb: 2.5,
            py: 1.25,
            fontWeight: 600,
            ...(isSelfServe
              ? {}
              : {
                  borderColor: '#1a1a2e',
                  color: '#1a1a2e',
                  '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.06)' },
                }),
          }}
        >
          {subscribing && isSelected ? (
            <CircularProgress size={22} sx={{ color: isSelfServe ? 'white' : '#6366f1' }} />
          ) : (
            getCtaLabel(plan.tier, isSelfServe)
          )}
        </Button>

        <List dense sx={{ textAlign: 'left' }}>
          {(plan.tier === 'free' || plan.tier === 'basic') && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, fontWeight: 600 }}>
                ✨ All ALwrity Tools Included:
              </Typography>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Edit color="primary" fontSize="small" />
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <ListItemText
                    primary="Blog Writer"
                    secondary="AI-powered blog post creation with SEO optimization"
                  />
                  <Tooltip
                    title="Learn more about Blog Writer"
                    onClick={() =>
                      openKnowMoreModal(
                        'Blog Writer',
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Blog Writer
                          </Typography>
                          <Typography variant="body2" paragraph>
                            Create engaging blog posts with AI assistance. Includes SEO optimization,
                            keyword research, and content structure suggestions.
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Features:</strong>
                          </Typography>
                          <Typography variant="body2">• SEO-optimized content generation</Typography>
                          <Typography variant="body2">• Keyword research integration</Typography>
                          <Typography variant="body2">• Content structure suggestions</Typography>
                          <Typography variant="body2">• Publishing assistance</Typography>
                        </Box>,
                      )
                    }
                  >
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Business color="primary" fontSize="small" />
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <ListItemText
                    primary="LinkedIn Writer"
                    secondary="Professional LinkedIn content creation and posting"
                  />
                  <Tooltip
                    title="Learn more about LinkedIn Writer"
                    onClick={() =>
                      openKnowMoreModal(
                        'LinkedIn Writer',
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            LinkedIn Writer
                          </Typography>
                          <Typography variant="body2" paragraph>
                            Create professional LinkedIn posts, articles, and carousels that engage your network and
                            showcase your expertise.
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Features:</strong>
                          </Typography>
                          <Typography variant="body2">• Professional post generation</Typography>
                          <Typography variant="body2">• Article writing assistance</Typography>
                          <Typography variant="body2">• Carousel creation</Typography>
                          <Typography variant="body2">• Network engagement optimization</Typography>
                        </Box>,
                      )
                    }
                  >
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Group color="primary" fontSize="small" />
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <ListItemText
                    primary="Facebook Writer"
                    secondary="Engaging Facebook posts and content creation"
                  />
                  <Tooltip
                    title="Learn more about Facebook Writer"
                    onClick={() =>
                      openKnowMoreModal(
                        'Facebook Writer',
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Facebook Writer
                          </Typography>
                          <Typography variant="body2" paragraph>
                            Create engaging Facebook posts, stories, and reels that drive engagement and grow your
                            community.
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Features:</strong>
                          </Typography>
                          <Typography variant="body2">• Post and story creation</Typography>
                          <Typography variant="body2">• Reel script generation</Typography>
                          <Typography variant="body2">• Community management</Typography>
                          <Typography variant="body2">• Engagement optimization</Typography>
                        </Box>,
                      )
                    }
                  >
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <MenuBookIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Story Studio"
                  secondary="Create campaign-ready stories with AI: outline, images, narration, and video"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <AudioIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Podcast Creator"
                  secondary="AI-powered research, scriptwriting, and voice narration"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <ImageIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Image Generator & Editor"
                  secondary="AI image creation and editing (background removal, inpainting)"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <VideoIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Video Studio & YouTube Creator"
                  secondary="AI video creation for social media and YouTube"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <SearchIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="All SEO Tools & Dashboards"
                  secondary="Keyword research, content optimization, SEO analytics"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Timeline color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Content Planning & Strategy"
                  secondary="Content calendars, strategy planning, and analytics"
                />
              </ListItem>
            </>
          )}

          {(plan.tier === 'free' ||
            plan.tier === 'basic' ||
            plan.tier === 'pro' ||
            plan.tier === 'enterprise') &&
            (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                  Platform Integrations:
                </Typography>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Business color="success" fontSize="small" />
                  </ListItemIcon>
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <ListItemText
                      primary="Wix Integration"
                      secondary="Direct publishing to Wix websites"
                    />
                    <Tooltip
                      title="Learn more about Wix integration"
                      onClick={() =>
                        openKnowMoreModal(
                          'Wix Integration',
                          <Box>
                            <Typography variant="h6" gutterBottom>
                              Wix Integration
                            </Typography>
                            <Typography variant="body2" paragraph>
                              Seamlessly publish your content directly to Wix websites.
                              No manual copying required.
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                              <strong>Features:</strong>
                            </Typography>
                            <Typography variant="body2">• Direct blog post publishing</Typography>
                            <Typography variant="body2">• SEO metadata sync</Typography>
                            <Typography variant="body2">• Image optimization</Typography>
                            <Typography variant="body2">• Publishing queue management</Typography>
                          </Box>,
                        )
                      }
                    >
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Edit color="success" fontSize="small" />
                  </ListItemIcon>
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <ListItemText
                      primary="WordPress Integration"
                      secondary="Publish to WordPress sites with API integration"
                    />
                    <Tooltip
                      title="Learn more about WordPress integration"
                      onClick={() =>
                        openKnowMoreModal(
                          'WordPress Integration',
                          <Box>
                            <Typography variant="h6" gutterBottom>
                              WordPress Integration
                            </Typography>
                            <Typography variant="body2" paragraph>
                              Connect directly to WordPress sites for seamless content publishing.
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                              <strong>Features:</strong>
                            </Typography>
                            <Typography variant="body2">• REST API integration</Typography>
                            <Typography variant="body2">• Draft and publish modes</Typography>
                            <Typography variant="body2">• Category and tag management</Typography>
                            <Typography variant="body2">• Featured image handling</Typography>
                          </Box>,
                        )
                      }
                    >
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Analytics color="success" fontSize="small" />
                  </ListItemIcon>
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <ListItemText
                      primary="Google Search Console"
                      secondary="SEO performance tracking and insights"
                    />
                    <Tooltip
                      title="Learn more about GSC integration"
                      onClick={() =>
                        openKnowMoreModal(
                          'Google Search Console',
                          <Box>
                            <Typography variant="h6" gutterBottom>
                              Google Search Console
                            </Typography>
                            <Typography variant="body2" paragraph>
                              Monitor your website's SEO performance and get actionable insights
                              for content optimization.
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                              <strong>Features:</strong>
                            </Typography>
                            <Typography variant="body2">• Search performance tracking</Typography>
                            <Typography variant="body2">• Keyword ranking insights</Typography>
                            <Typography variant="body2">• Technical SEO monitoring</Typography>
                            <Typography variant="body2">• Content optimization suggestions</Typography>
                          </Box>,
                        )
                      }
                    >
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              </>
            )}

          {(plan.tier === 'pro' || plan.tier === 'enterprise') && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                Social Media & Website Management:
              </Typography>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Group color="secondary" fontSize="small" />
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <ListItemText
                    primary="6 Major Social Platforms"
                    secondary="LinkedIn, Facebook, Instagram, Twitter, TikTok, YouTube"
                  />
                  <Tooltip
                    title="Learn more about social media platforms"
                    onClick={() =>
                      openKnowMoreModal(
                        '6 Major Social Platforms',
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            6 Major Social Platforms
                          </Typography>
                          <Typography variant="body2" paragraph>
                            Comprehensive social media management across all major platforms with AI-powered content
                            optimization.
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Features:</strong>
                          </Typography>
                          <Typography variant="body2">• Cross-platform scheduling</Typography>
                          <Typography variant="body2">• Content performance insights</Typography>
                          <Typography variant="body2">• Engagement analytics</Typography>
                          <Typography variant="body2">• Platform-specific optimization</Typography>
                        </Box>,
                      )
                    }
                  >
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Support color="secondary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Team Collaboration"
                  secondary="Invite team members, assign roles, and manage content workflows"
                />
              </ListItem>
            </>
          )}

          <ListItem>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <Edit color="primary" fontSize="small" />
            </ListItemIcon>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <ListItemText
                primary="Text Generation"
                secondary={
                  plan.tier === 'free' || plan.tier === 'basic'
                    ? 'AI-powered text content creation'
                    : 'Advanced text generation with multimodal capabilities'
                }
              />
              <Tooltip
                title="Learn more about text generation"
                onClick={() =>
                  openKnowMoreModal(
                    'Text Generation',
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        AI Text Generation
                      </Typography>
                      <Typography variant="body2" paragraph>
                        Generate high-quality text content with AI assistance. From blog posts to social media updates,
                        create engaging content effortlessly.
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <strong>Capabilities:</strong>
                      </Typography>
                      <Typography variant="body2">• Blog posts and articles</Typography>
                      <Typography variant="body2">• Social media content</Typography>
                      <Typography variant="body2">• Email newsletters</Typography>
                      <Typography variant="body2">• Marketing copy</Typography>
                      {(plan.tier === 'pro' || plan.tier === 'enterprise') && (
                        <>
                          <Typography variant="body2">• Audio transcription</Typography>
                          <Typography variant="body2">• Video script writing</Typography>
                        </>
                      )}
                    </Box>,
                  )
                }
              >
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </ListItem>

          <ListItem>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <Assistant color="primary" fontSize="small" />
            </ListItemIcon>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <ListItemText
                primary="Image Generation"
                secondary={
                  plan.tier === 'free' || plan.tier === 'basic'
                    ? 'AI image creation for visual content'
                    : 'Advanced image generation with video capabilities'
                }
              />
              <Tooltip
                title="Learn more about image generation"
                onClick={() =>
                  openKnowMoreModal(
                    'Image Generation',
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        AI Image Generation
                      </Typography>
                      <Typography variant="body2" paragraph>
                        Create stunning visuals with AI-powered image generation. Perfect for social media, blog posts,
                        and marketing materials.
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <strong>Capabilities:</strong>
                      </Typography>
                      <Typography variant="body2">• Social media graphics</Typography>
                      <Typography variant="body2">• Blog featured images</Typography>
                      <Typography variant="body2">• Marketing visuals</Typography>
                      <Typography variant="body2">• Custom illustrations</Typography>
                      {(plan.tier === 'pro' || plan.tier === 'enterprise') && (
                        <>
                          <Typography variant="body2">• Video thumbnail generation</Typography>
                          <Typography variant="body2">• Animated graphics</Typography>
                        </>
                      )}
                    </Box>,
                  )
                }
              >
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </ListItem>

          {(plan.limits.audio_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <AudioIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Audio Generation"
                secondary={
                  plan.tier === 'basic'
                    ? 'AI voice synthesis for podcasts, stories, and narration'
                    : 'AI-powered audio content creation and voice synthesis'
                }
              />
            </ListItem>
          )}

          {(plan.limits.video_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <VideoIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Video Generation"
                secondary={
                  plan.tier === 'basic'
                    ? 'Create AI videos for YouTube, social media, and stories'
                    : 'AI video creation with script writing and editing'
                }
              />
            </ListItem>
          )}

          {plan.tier !== 'free' && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                Support & Analytics:
              </Typography>

              <ListItem>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Support color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Priority Support" />
              </ListItem>

              {plan.tier === 'pro' && (
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Analytics color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Advanced Analytics & Insights" />
                </ListItem>
              )}

              {plan.tier === 'enterprise' && (
                <>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <Business color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Custom Integrations" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <Support color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Dedicated Account Manager" />
                  </ListItem>
                </>
              )}
            </>
          )}

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, fontWeight: 600 }}>
            Monthly Usage Limits:
          </Typography>

          {plan.tier === 'basic' && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <Psychology color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="50 AI Text Generations"
                secondary="~16-25 blog posts or ~25-50 social posts per month"
                sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem', fontWeight: 500 } }}
              />
            </ListItem>
          )}

          {plan.tier !== 'basic' && (
            <>
              {plan.limits.gemini_calls > 0 && (
                <ListItem>
                  <ListItemText
                    primary={`${plan.limits.gemini_calls === 0 ? '∞' : plan.limits.gemini_calls} Gemini AI calls`}
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>
              )}
              {plan.limits.openai_calls > 0 && (
                <ListItem>
                  <ListItemText
                    primary={`${plan.limits.openai_calls === 0 ? '∞' : plan.limits.openai_calls} OpenAI calls`}
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>
              )}
            </>
          )}

          {plan.limits.stability_calls > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <ImageIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.stability_calls} AI Images`}
                secondary={
                  plan.tier === 'basic'
                    ? 'Powered by open-source models (25% cost savings)'
                    : undefined
                }
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: plan.tier === 'basic' ? 500 : 400,
                  },
                }}
              />
            </ListItem>
          )}

          {(plan.limits.image_edit_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <Edit color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.image_edit_calls ?? 0} Image Edits`}
                secondary={
                  plan.tier === 'basic'
                    ? 'Background removal, inpainting, recolor (50% cost savings with OSS)'
                    : undefined
                }
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: plan.tier === 'basic' ? 500 : 400,
                  },
                }}
              />
            </ListItem>
          )}

          {(plan.limits.video_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <VideoIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.video_calls ?? 0} AI Videos`}
                secondary={
                  plan.tier === 'basic'
                    ? '~5-6 full video projects (5 scenes each) per month'
                    : undefined
                }
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: plan.tier === 'basic' ? 500 : 400,
                  },
                }}
              />
            </ListItem>
          )}

          {(plan.limits.audio_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <AudioIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.audio_calls ?? 0} Audio Generations`}
                secondary={
                  plan.tier === 'basic'
                    ? 'Podcast narration, story audio, voice synthesis'
                    : undefined
                }
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: plan.tier === 'basic' ? 500 : 400,
                  },
                }}
              />
            </ListItem>
          )}

          {plan.limits.tavily_calls > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <SearchIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.tavily_calls} Research Searches`}
                secondary="Web research, fact-checking, content discovery"
                sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
              />
            </ListItem>
          )}

          {(plan.limits.exa_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <SearchIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.exa_calls} Exa AI Searches`}
                secondary="AI-powered search and content discovery"
                sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
              />
            </ListItem>
          )}

          {(plan.limits.wavespeed_calls ?? 0) > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <AudioIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${plan.limits.wavespeed_calls} WaveSpeed AI Calls`}
                secondary="TTS, video, image, and LLM via Minimax"
                sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
              />
            </ListItem>
          )}

          {plan.limits.monthly_cost > 0 && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <Verified color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`$${plan.limits.monthly_cost} Monthly Cost Cap`}
                secondary="Automatic protection - you'll never exceed this amount"
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'success.main',
                  },
                }}
              />
            </ListItem>
          )}

          {plan.tier === 'basic' && (
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                bgcolor: 'info.lighter',
                borderRadius: 1,
                mx: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}
              >
                <StarIcon fontSize="small" sx={{ color: 'info.main' }} />
                Powered by Open-Source AI Models
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
              >
                We use cost-effective open-source models to give you more value. 25-50% savings vs
                proprietary models.
              </Typography>
            </Box>
          )}
        </List>
      </CardContent>
    </Card>
  );
};

export default PlanCard;
