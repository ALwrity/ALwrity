import React from 'react';
import { Box, Grid, Typography, Chip } from '@mui/material';
import {
  ContentPaste as ContentIcon,
  TrendingUp as TrendingIcon,
  Psychology as StrategyIcon,
  EmojiEvents as FeaturesIcon,
  Speed as AlgorithmIcon,
  Business as ProfessionalIcon,
  CheckCircle as BestPracticeIcon
} from '@mui/icons-material';
import { SectionAccordion } from '../components/SectionAccordion';
import { EditableTextField } from '../components/EditableTextField';
import { EditableChipArray } from '../components/EditableChipArray';
import { platformPersonaTooltips } from '../utils/personaTooltips';

interface PlatformPersonaDisplayProps {
  platformPersona: any;
  platformName: string;
  onChange: (updatedPersona: any) => void;
}

/**
 * Comprehensive display for Platform-Specific Persona data
 * Shows all platform-optimized fields (LinkedIn example shown)
 */
export const PlatformPersonaDisplay: React.FC<PlatformPersonaDisplayProps> = ({
  platformPersona,
  platformName,
  onChange
}) => {
  // Helper function to update nested fields
  const updateField = (path: string[], value: any) => {
    const updatedPersona = { ...platformPersona };
    let current = updatedPersona;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    onChange(updatedPersona);
  };

  // Safe getter for nested properties
  const getNestedValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((current, key) => current?.[key], obj) ?? defaultValue;
  };

  const isLinkedIn = platformName.toLowerCase() === 'linkedin';
  const isFacebook = platformName.toLowerCase() === 'facebook';
  const isYoutube = platformName.toLowerCase() === 'youtube';
  const isPodcast = platformName.toLowerCase() === 'podcast';

  return (
    <Box>
      {/* Platform Overview */}
      <Box sx={{
        p: 3,
        mb: 3,
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
          {platformName.charAt(0).toUpperCase() + platformName.slice(1)} Persona
        </Typography>
        <Chip
          label={getNestedValue(platformPersona, ['platform_type'], platformName)}
          sx={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            fontWeight: 600
          }}
          size="small"
        />
      </Box>

      {/* Generic sections — only for generic-schema platforms (blog, twitter,
          instagram, youtube, podcast). LinkedIn/Facebook have dedicated
          structures and render their own sections below. */}
      {!isLinkedIn && !isFacebook && !isYoutube && !isPodcast && (
        <>
      {/* 1. Content Format Rules Section */}
      <SectionAccordion
        title="Content Format Rules"
        subtitle="Platform-specific formatting guidelines"
        icon={<ContentIcon />}
        defaultExpanded={true}
        color="primary.main"
      >
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Content Guidelines
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Character Limit"
                value={getNestedValue(platformPersona, ['content_format_rules', 'character_limit'], '')}
                onChange={(val) => updateField(['content_format_rules', 'character_limit'], Number(val))}
                type="number"
                placeholder="e.g., 3000"
                helperText="Maximum characters allowed per post"
                tooltipInfo={platformPersonaTooltips.characterLimit}
              />
              <EditableTextField
                label="Paragraph Structure"
                value={getNestedValue(platformPersona, ['content_format_rules', 'paragraph_structure'])}
                onChange={(val) => updateField(['content_format_rules', 'paragraph_structure'], val)}
                multiline
                placeholder="Describe ideal paragraph structure..."
                helperText="How to structure paragraphs for this platform"
                tooltipInfo={platformPersonaTooltips.paragraphStructure}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Call-to-Action Style"
                value={getNestedValue(platformPersona, ['content_format_rules', 'call_to_action_style'])}
                onChange={(val) => updateField(['content_format_rules', 'call_to_action_style'], val)}
                multiline
                placeholder="Describe CTA approach..."
                helperText="How to craft effective CTAs"
                tooltipInfo={platformPersonaTooltips.ctaStyle}
              />
              <EditableTextField
                label="Link Placement"
                value={getNestedValue(platformPersona, ['content_format_rules', 'link_placement'])}
                onChange={(val) => updateField(['content_format_rules', 'link_placement'], val)}
                multiline
                placeholder="Where and how to place links..."
                helperText="Best practices for link positioning"
                tooltipInfo={platformPersonaTooltips.linkPlacement}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Sentence Metrics */}
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Sentence Metrics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Max Sentence Length"
                value={getNestedValue(platformPersona, ['sentence_metrics', 'max_sentence_length'], '')}
                onChange={(val) => updateField(['sentence_metrics', 'max_sentence_length'], Number(val))}
                type="number"
                placeholder="e.g., 25"
                helperText="Maximum words per sentence"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Optimal Sentence Length"
                value={getNestedValue(platformPersona, ['sentence_metrics', 'optimal_sentence_length'], '')}
                onChange={(val) => updateField(['sentence_metrics', 'optimal_sentence_length'], Number(val))}
                type="number"
                placeholder="e.g., 15"
                helperText="Ideal words per sentence"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <EditableTextField
                label="Sentence Variety"
                value={getNestedValue(platformPersona, ['sentence_metrics', 'sentence_variety'])}
                onChange={(val) => updateField(['sentence_metrics', 'sentence_variety'], val)}
                placeholder="e.g., High, Moderate, Low"
                helperText="Variety in sentence structure"
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>

      {/* 2. Engagement Strategy Section */}
      <SectionAccordion
        title="Engagement Strategy"
        subtitle="Posting and community interaction tactics"
        icon={<TrendingIcon />}
        color="secondary.main"
      >
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Community Engagement
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Posting Frequency"
                value={getNestedValue(platformPersona, ['engagement_patterns', 'posting_frequency'])}
                onChange={(val) => updateField(['engagement_patterns', 'posting_frequency'], val)}
                placeholder="e.g., 3-5 times per week"
                helperText="Recommended posting frequency"
                tooltipInfo={platformPersonaTooltips.postingFrequency}
              />
              <EditableTextField
                label="Community Interaction"
                value={getNestedValue(platformPersona, ['engagement_patterns', 'community_interaction'])}
                onChange={(val) => updateField(['engagement_patterns', 'community_interaction'], val)}
                multiline
                placeholder="Describe community engagement approach..."
                helperText="How to interact with community"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableChipArray
                label="Optimal Posting Times"
                values={getNestedValue(platformPersona, ['engagement_patterns', 'optimal_posting_times'], [])}
                onChange={(vals) => updateField(['engagement_patterns', 'optimal_posting_times'], vals)}
                placeholder="Add posting times..."
                color="primary"
                helperText="Best times to post for engagement"
                tooltipInfo={platformPersonaTooltips.optimalTimes}
              />
              <EditableChipArray
                label="Engagement Tactics"
                values={getNestedValue(platformPersona, ['engagement_patterns', 'engagement_tactics'], [])}
                onChange={(vals) => updateField(['engagement_patterns', 'engagement_tactics'], vals)}
                placeholder="Add engagement tactics..."
                color="secondary"
                helperText="Specific tactics to boost engagement"
                tooltipInfo={platformPersonaTooltips.engagementTactics}
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>

      {/* 3. Lexical Adaptations Section */}
      <SectionAccordion
        title="Lexical Adaptations"
        subtitle="Platform-specific language and expressions"
        icon={<StrategyIcon />}
        color="info.main"
      >
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          mb: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Language & Expression
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <EditableChipArray
                label="Platform-Specific Words"
                values={getNestedValue(platformPersona, ['lexical_adaptations', 'platform_specific_words'], [])}
                onChange={(vals) => updateField(['lexical_adaptations', 'platform_specific_words'], vals)}
                placeholder="Add platform-specific terms..."
                color="primary"
                helperText="Words and terms unique to this platform"
              />
              <EditableTextField
                label="Hashtag Strategy"
                value={getNestedValue(platformPersona, ['lexical_adaptations', 'hashtag_strategy'])}
                onChange={(val) => updateField(['lexical_adaptations', 'hashtag_strategy'], val)}
                multiline
                placeholder="Describe hashtag approach..."
                helperText="How to use hashtags effectively"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EditableTextField
                label="Emoji Usage"
                value={getNestedValue(platformPersona, ['lexical_adaptations', 'emoji_usage'])}
                onChange={(val) => updateField(['lexical_adaptations', 'emoji_usage'], val)}
                multiline
                placeholder="Describe emoji usage..."
                helperText="When and how to use emojis"
              />
              <EditableTextField
                label="Mention Strategy"
                value={getNestedValue(platformPersona, ['lexical_adaptations', 'mention_strategy'])}
                onChange={(val) => updateField(['lexical_adaptations', 'mention_strategy'], val)}
                multiline
                placeholder="Describe mention approach..."
                helperText="How to mention others effectively"
              />
            </Grid>
          </Grid>
        </Box>
      </SectionAccordion>
        </>
      )}

      {/* LinkedIn-specific sections */}
      {isLinkedIn && (
        <>
          {/* 4. LinkedIn Features Section */}
          <SectionAccordion
            title="LinkedIn Features Optimization"
            subtitle="Leverage LinkedIn-specific features"
            icon={<FeaturesIcon />}
            color="warning.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
                Platform Features
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Articles Strategy"
                    value={getNestedValue(platformPersona, ['linkedin_features', 'articles_strategy'])}
                    onChange={(val) => updateField(['linkedin_features', 'articles_strategy'], val)}
                    multiline
                    placeholder="How to use LinkedIn Articles..."
                    helperText="Strategy for long-form articles"
                  />
                  <EditableTextField
                    label="Polls Optimization"
                    value={getNestedValue(platformPersona, ['linkedin_features', 'polls_optimization'])}
                    onChange={(val) => updateField(['linkedin_features', 'polls_optimization'], val)}
                    multiline
                    placeholder="How to create engaging polls..."
                    helperText="Best practices for LinkedIn polls"
                  />
                  <EditableTextField
                    label="Events Networking"
                    value={getNestedValue(platformPersona, ['linkedin_features', 'events_networking'])}
                    onChange={(val) => updateField(['linkedin_features', 'events_networking'], val)}
                    multiline
                    placeholder="How to leverage LinkedIn Events..."
                    helperText="Strategy for events and networking"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Carousels Education"
                    value={getNestedValue(platformPersona, ['linkedin_features', 'carousels_education'])}
                    onChange={(val) => updateField(['linkedin_features', 'carousels_education'], val)}
                    multiline
                    placeholder="How to create carousel posts..."
                    helperText="Strategy for educational carousels"
                  />
                  <EditableTextField
                    label="Live Discussions"
                    value={getNestedValue(platformPersona, ['linkedin_features', 'live_discussions'])}
                    onChange={(val) => updateField(['linkedin_features', 'live_discussions'], val)}
                    multiline
                    placeholder="How to host LinkedIn Live..."
                    helperText="Approach to live streaming"
                  />
                  <EditableTextField
                    label="Native Video"
                    value={getNestedValue(platformPersona, ['linkedin_features', 'native_video'])}
                    onChange={(val) => updateField(['linkedin_features', 'native_video'], val)}
                    multiline
                    placeholder="Video content strategy..."
                    helperText="Best practices for native video"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* 5. Algorithm Optimization Section */}
          <SectionAccordion
            title="Algorithm Optimization"
            subtitle="Maximize reach and engagement"
            icon={<AlgorithmIcon />}
            color="error.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
                Algorithm Strategies
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Engagement Patterns"
                    values={getNestedValue(platformPersona, ['algorithm_optimization', 'engagement_patterns'], [])}
                    onChange={(vals) => updateField(['algorithm_optimization', 'engagement_patterns'], vals)}
                    placeholder="Add engagement patterns..."
                    color="primary"
                    helperText="Patterns that boost algorithmic reach"
                  />
                  <EditableChipArray
                    label="Content Timing"
                    values={getNestedValue(platformPersona, ['algorithm_optimization', 'content_timing'], [])}
                    onChange={(vals) => updateField(['algorithm_optimization', 'content_timing'], vals)}
                    placeholder="Add timing strategies..."
                    color="secondary"
                    helperText="Timing strategies for maximum reach"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Professional Value Metrics"
                    values={getNestedValue(platformPersona, ['algorithm_optimization', 'professional_value_metrics'], [])}
                    onChange={(vals) => updateField(['algorithm_optimization', 'professional_value_metrics'], vals)}
                    placeholder="Add value metrics..."
                    color="info"
                    helperText="Metrics the algorithm values"
                  />
                  <EditableChipArray
                    label="Network Interaction Strategies"
                    values={getNestedValue(platformPersona, ['algorithm_optimization', 'network_interaction_strategies'], [])}
                    onChange={(vals) => updateField(['algorithm_optimization', 'network_interaction_strategies'], vals)}
                    placeholder="Add interaction strategies..."
                    color="success"
                    helperText="How to interact with network"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* 6. Professional Networking Section */}
          <SectionAccordion
            title="Professional Networking"
            subtitle="Build thought leadership and authority"
            icon={<ProfessionalIcon />}
            color="success.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
                Leadership & Authority
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Thought Leadership Positioning"
                    value={getNestedValue(platformPersona, ['professional_networking', 'thought_leadership_positioning'])}
                    onChange={(val) => updateField(['professional_networking', 'thought_leadership_positioning'], val)}
                    multiline
                    placeholder="How to position as thought leader..."
                    helperText="Strategy for thought leadership"
                  />
                  <EditableTextField
                    label="Industry Authority Building"
                    value={getNestedValue(platformPersona, ['professional_networking', 'industry_authority_building'])}
                    onChange={(val) => updateField(['professional_networking', 'industry_authority_building'], val)}
                    multiline
                    placeholder="How to build industry authority..."
                    helperText="Approach to establishing authority"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Professional Relationship Strategies"
                    values={getNestedValue(platformPersona, ['professional_networking', 'professional_relationship_strategies'], [])}
                    onChange={(vals) => updateField(['professional_networking', 'professional_relationship_strategies'], vals)}
                    placeholder="Add relationship strategies..."
                    color="primary"
                    helperText="Strategies for building relationships"
                  />
                  <EditableTextField
                    label="Career Advancement Focus"
                    value={getNestedValue(platformPersona, ['professional_networking', 'career_advancement_focus'])}
                    onChange={(val) => updateField(['professional_networking', 'career_advancement_focus'], val)}
                    multiline
                    placeholder="Career advancement approach..."
                    helperText="How to focus on career growth"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* 7. Professional Context Optimization */}
          <SectionAccordion
            title="Professional Context Optimization"
            subtitle="Industry and audience-specific adaptations"
            icon={<ProfessionalIcon />}
            color="primary.dark"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
                Context & Positioning
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Industry-Specific Positioning"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'industry_specific_positioning'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'industry_specific_positioning'], val)}
                    multiline
                    placeholder="Industry-specific approach..."
                    helperText="How to position within your industry"
                  />
                  <EditableTextField
                    label="Expertise Level Adaptation"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'expertise_level_adaptation'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'expertise_level_adaptation'], val)}
                    multiline
                    placeholder="Expertise positioning..."
                    helperText="How to communicate expertise level"
                  />
                  <EditableTextField
                    label="Company Size Considerations"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'company_size_considerations'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'company_size_considerations'], val)}
                    multiline
                    placeholder="Company size strategy..."
                    helperText="Adaptations based on company size"
                  />
                  <EditableTextField
                    label="Business Model Alignment"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'business_model_alignment'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'business_model_alignment'], val)}
                    multiline
                    placeholder="Business model approach..."
                    helperText="How to align with business model"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Professional Role Authority"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'professional_role_authority'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'professional_role_authority'], val)}
                    multiline
                    placeholder="Role authority strategy..."
                    helperText="How to leverage professional role"
                  />
                  <EditableChipArray
                    label="Demographic Targeting"
                  values={getNestedValue(platformPersona, ['professional_context_optimization', 'demographic_targeting'], [])}
                  onChange={(vals) => updateField(['professional_context_optimization', 'demographic_targeting'], vals)}
                  placeholder="Add target demographics..."
                  color="info"
                  helperText="Target audience demographics"
                />
                  <EditableTextField
                    label="Psychographic Engagement"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'psychographic_engagement'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'psychographic_engagement'], val)}
                    multiline
                    placeholder="Psychographic approach..."
                    helperText="Engagement based on psychographics"
                  />
                  <EditableTextField
                    label="Conversion Optimization"
                    value={getNestedValue(platformPersona, ['professional_context_optimization', 'conversion_optimization'])}
                    onChange={(val) => updateField(['professional_context_optimization', 'conversion_optimization'], val)}
                    multiline
                    placeholder="Conversion strategy..."
                    helperText="How to optimize for conversions"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>
        </>
      )}

      {/* Facebook-specific sections */}
      {isFacebook && (
        <>
          {/* Facebook Identity */}
          <SectionAccordion
            title="Facebook Persona Identity"
            subtitle="Name, archetype and core belief"
            icon={<StrategyIcon />}
            defaultExpanded={true}
            color="info.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Persona Name"
                    value={getNestedValue(platformPersona, ['persona_name'])}
                    onChange={(val) => updateField(['persona_name'], val)}
                    placeholder="e.g., The Community Builder"
                    helperText="Name of the Facebook-optimized persona"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Archetype"
                    value={getNestedValue(platformPersona, ['archetype'])}
                    onChange={(val) => updateField(['archetype'], val)}
                    placeholder="e.g., The Community Catalyst"
                    helperText="Persona archetype"
                  />
                </Grid>
                <Grid item xs={12}>
                  <EditableTextField
                    label="Core Belief"
                    value={getNestedValue(platformPersona, ['core_belief'])}
                    onChange={(val) => updateField(['core_belief'], val)}
                    multiline
                    placeholder="Core belief driving the Facebook persona..."
                    helperText="The belief that drives the Facebook voice"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Facebook Algorithm Optimization */}
          <SectionAccordion
            title="Facebook Algorithm Optimization"
            subtitle="Engagement, quality, timing and targeting"
            icon={<AlgorithmIcon />}
            color="secondary.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Engagement Optimization"
                    values={getNestedValue(platformPersona, ['facebook_algorithm_optimization', 'engagement_optimization'], [])}
                    onChange={(vals) => updateField(['facebook_algorithm_optimization', 'engagement_optimization'], vals)}
                    placeholder="Add engagement strategies..."
                    color="primary"
                    helperText="Strategies to boost engagement"
                  />
                  <EditableChipArray
                    label="Content Quality Optimization"
                    values={getNestedValue(platformPersona, ['facebook_algorithm_optimization', 'content_quality_optimization'], [])}
                    onChange={(vals) => updateField(['facebook_algorithm_optimization', 'content_quality_optimization'], vals)}
                    placeholder="Add content quality strategies..."
                    color="secondary"
                    helperText="Strategies to improve content quality"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Timing Optimization"
                    values={getNestedValue(platformPersona, ['facebook_algorithm_optimization', 'timing_optimization'], [])}
                    onChange={(vals) => updateField(['facebook_algorithm_optimization', 'timing_optimization'], vals)}
                    placeholder="Add timing strategies..."
                    color="success"
                    helperText="Optimal posting timing"
                  />
                  <EditableChipArray
                    label="Audience Targeting Optimization"
                    values={getNestedValue(platformPersona, ['facebook_algorithm_optimization', 'audience_targeting_optimization'], [])}
                    onChange={(vals) => updateField(['facebook_algorithm_optimization', 'audience_targeting_optimization'], vals)}
                    placeholder="Add targeting strategies..."
                    color="warning"
                    helperText="Audience targeting optimization"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Facebook Engagement Strategies */}
          <SectionAccordion
            title="Facebook Engagement Strategies"
            subtitle="Community, content and conversion"
            icon={<TrendingIcon />}
            color="info.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Community Building"
                    values={getNestedValue(platformPersona, ['facebook_engagement_strategies', 'community_building'], [])}
                    onChange={(vals) => updateField(['facebook_engagement_strategies', 'community_building'], vals)}
                    placeholder="Add community strategies..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Content Engagement"
                    values={getNestedValue(platformPersona, ['facebook_engagement_strategies', 'content_engagement'], [])}
                    onChange={(vals) => updateField(['facebook_engagement_strategies', 'content_engagement'], vals)}
                    placeholder="Add content engagement..."
                    color="secondary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Conversion Optimization"
                    values={getNestedValue(platformPersona, ['facebook_engagement_strategies', 'conversion_optimization'], [])}
                    onChange={(vals) => updateField(['facebook_engagement_strategies', 'conversion_optimization'], vals)}
                    placeholder="Add conversion strategies..."
                    color="success"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Facebook Audience Targeting */}
          <SectionAccordion
            title="Facebook Audience Targeting"
            subtitle="Demographic, interest and behavioral"
            icon={<ProfessionalIcon />}
            color="warning.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Demographic Targeting"
                    values={getNestedValue(platformPersona, ['facebook_audience_targeting', 'demographic_targeting'], [])}
                    onChange={(vals) => updateField(['facebook_audience_targeting', 'demographic_targeting'], vals)}
                    placeholder="Add demographics..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Interest Targeting"
                    values={getNestedValue(platformPersona, ['facebook_audience_targeting', 'interest_targeting'], [])}
                    onChange={(vals) => updateField(['facebook_audience_targeting', 'interest_targeting'], vals)}
                    placeholder="Add interests..."
                    color="secondary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Behavioral Targeting"
                    values={getNestedValue(platformPersona, ['facebook_audience_targeting', 'behavioral_targeting'], [])}
                    onChange={(vals) => updateField(['facebook_audience_targeting', 'behavioral_targeting'], vals)}
                    placeholder="Add behaviors..."
                    color="success"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Facebook Community Building */}
          <SectionAccordion
            title="Facebook Community Building"
            subtitle="Groups, events and live streaming"
            icon={<FeaturesIcon />}
            color="success.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Group Management"
                    values={getNestedValue(platformPersona, ['facebook_community_building', 'group_management'], [])}
                    onChange={(vals) => updateField(['facebook_community_building', 'group_management'], vals)}
                    placeholder="Add group strategies..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Event Management"
                    values={getNestedValue(platformPersona, ['facebook_community_building', 'event_management'], [])}
                    onChange={(vals) => updateField(['facebook_community_building', 'event_management'], vals)}
                    placeholder="Add event strategies..."
                    color="secondary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Live Streaming"
                    values={getNestedValue(platformPersona, ['facebook_community_building', 'live_streaming'], [])}
                    onChange={(vals) => updateField(['facebook_community_building', 'live_streaming'], vals)}
                    placeholder="Add live strategies..."
                    color="success"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Facebook Content Formats */}
          <SectionAccordion
            title="Facebook Content Formats"
            subtitle="Text, image, video and carousel post optimizations"
            icon={<ContentIcon />}
            color="info.main"
          >
            <Box sx={{
              p: 3,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              mb: 3
            }}>
              {/* Text Posts */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                Text Posts
              </Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <EditableTextField
                    label="Optimal Length"
                    value={getNestedValue(platformPersona, ['facebook_content_formats', 'text_posts', 'optimal_length'])}
                    onChange={(val) => updateField(['facebook_content_formats', 'text_posts', 'optimal_length'], val)}
                    placeholder="e.g., 40-80 words"
                    helperText="Optimal text post length"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Structure Guidelines"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'text_posts', 'structure_guidelines'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'text_posts', 'structure_guidelines'], vals)}
                    placeholder="Add structure guidelines..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableChipArray
                    label="Hook Strategies"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'text_posts', 'hook_strategies'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'text_posts', 'hook_strategies'], vals)}
                    placeholder="Add hook strategies..."
                    color="secondary"
                  />
                </Grid>
              </Grid>

              {/* Image Posts */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                Image Posts
              </Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Image Guidelines"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'image_posts', 'image_guidelines'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'image_posts', 'image_guidelines'], vals)}
                    placeholder="Add image guidelines..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Caption Strategies"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'image_posts', 'caption_strategies'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'image_posts', 'caption_strategies'], vals)}
                    placeholder="Add caption strategies..."
                    color="secondary"
                  />
                </Grid>
              </Grid>

              {/* Video Posts */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                Video Posts
              </Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Video Length Guidelines"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'video_posts', 'video_length_guidelines'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'video_posts', 'video_length_guidelines'], vals)}
                    placeholder="Add video length guidelines..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Engagement Hooks"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'video_posts', 'engagement_hooks'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'video_posts', 'engagement_hooks'], vals)}
                    placeholder="Add engagement hooks..."
                    color="secondary"
                  />
                </Grid>
              </Grid>

              {/* Carousel Posts */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                Carousel Posts
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Slide Structure"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'carousel_posts', 'slide_structure'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'carousel_posts', 'slide_structure'], vals)}
                    placeholder="Add slide structure..."
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray
                    label="Storytelling Flow"
                    values={getNestedValue(platformPersona, ['facebook_content_formats', 'carousel_posts', 'storytelling_flow'], [])}
                    onChange={(vals) => updateField(['facebook_content_formats', 'carousel_posts', 'storytelling_flow'], vals)}
                    placeholder="Add storytelling flow..."
                    color="secondary"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>
        </>
      )}

      {/* YouTube-specific sections */}
      {isYoutube && (
        <>
          {/* YouTube Identity */}
          <SectionAccordion
            title="YouTube Persona Identity"
            subtitle="Name, archetype and core belief"
            icon={<StrategyIcon />}
            defaultExpanded={true}
            color="info.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Persona Name"
                    value={getNestedValue(platformPersona, ['persona_name'])}
                    onChange={(val) => updateField(['persona_name'], val)}
                    placeholder="e.g., The Fast-Paced Explainer"
                    helperText="Name of the YouTube persona"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Archetype"
                    value={getNestedValue(platformPersona, ['archetype'])}
                    onChange={(val) => updateField(['archetype'], val)}
                    placeholder="e.g., The Hands-On Educator"
                    helperText="Persona archetype"
                  />
                </Grid>
                <Grid item xs={12}>
                  <EditableTextField
                    label="Core Belief"
                    value={getNestedValue(platformPersona, ['core_belief'])}
                    onChange={(val) => updateField(['core_belief'], val)}
                    multiline
                    placeholder="Core belief driving the channel..."
                    helperText="The belief that drives the channel"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Tone & Pacing */}
          <SectionAccordion
            title="Tone & Pacing"
            subtitle="Delivery energy, pace and style"
            icon={<AlgorithmIcon />}
            color="secondary.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Default Tone"
                    value={getNestedValue(platformPersona, ['tone_and_pacing', 'default_tone'])}
                    onChange={(val) => updateField(['tone_and_pacing', 'default_tone'], val)}
                    placeholder="e.g., energetic, encouraging"
                  />
                  <EditableTextField
                    label="Pace"
                    value={getNestedValue(platformPersona, ['tone_and_pacing', 'pace'])}
                    onChange={(val) => updateField(['tone_and_pacing', 'pace'], val)}
                    placeholder="e.g., fast — cut every 2-3s"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Energy Level"
                    value={getNestedValue(platformPersona, ['tone_and_pacing', 'energy_level'])}
                    onChange={(val) => updateField(['tone_and_pacing', 'energy_level'], val)}
                    placeholder="e.g., high, medium, low"
                  />
                  <EditableTextField
                    label="Delivery Style"
                    value={getNestedValue(platformPersona, ['tone_and_pacing', 'delivery_style'])}
                    onChange={(val) => updateField(['tone_and_pacing', 'delivery_style'], val)}
                    placeholder="e.g., direct-to-camera, voiceover"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Script Structure */}
          <SectionAccordion
            title="Script Structure"
            subtitle="Hook, intro, body and CTA"
            icon={<ContentIcon />}
            color="info.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Hook Style" value={getNestedValue(platformPersona, ['script_structure', 'hook_style'])} onChange={(val) => updateField(['script_structure', 'hook_style'], val)} multiline placeholder="e.g., bold claim or question in first 5s" />
                  <EditableTextField label="Intro Format" value={getNestedValue(platformPersona, ['script_structure', 'intro_format'])} onChange={(val) => updateField(['script_structure', 'intro_format'], val)} multiline placeholder="e.g., promise + why it matters" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Body Structure" value={getNestedValue(platformPersona, ['script_structure', 'body_structure'])} onChange={(val) => updateField(['script_structure', 'body_structure'], val)} multiline placeholder="e.g., 3 steps, each with an example" />
                  <EditableTextField label="CTA Style" value={getNestedValue(platformPersona, ['script_structure', 'cta_style'])} onChange={(val) => updateField(['script_structure', 'cta_style'], val)} multiline placeholder="e.g., subscribe + comment" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Visual Style */}
          <SectionAccordion
            title="Visual Style"
            subtitle="Brand colors, thumbnails, text and framing"
            icon={<FeaturesIcon />}
            color="warning.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <EditableChipArray label="Color Palette" values={getNestedValue(platformPersona, ['visual_style', 'color_palette'], [])} onChange={(vals) => updateField(['visual_style', 'color_palette'], vals)} placeholder="Add brand colors..." color="primary" helperText="Brand color palette" />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Thumbnail Style" value={getNestedValue(platformPersona, ['visual_style', 'thumbnail_style'])} onChange={(val) => updateField(['visual_style', 'thumbnail_style'], val)} multiline placeholder="e.g., bold 3-word headline + face + contrast" />
                  <EditableTextField label="On-Screen Text" value={getNestedValue(platformPersona, ['visual_style', 'on_screen_text'])} onChange={(val) => updateField(['visual_style', 'on_screen_text'], val)} multiline placeholder="e.g., minimal, large key terms" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="B-Roll" value={getNestedValue(platformPersona, ['visual_style', 'b_roll'])} onChange={(val) => updateField(['visual_style', 'b_roll'], val)} multiline placeholder="e.g., screen recordings + stock clips" />
                  <EditableTextField label="Camera Framing" value={getNestedValue(platformPersona, ['visual_style', 'camera_framing'])} onChange={(val) => updateField(['visual_style', 'camera_framing'], val)} placeholder="e.g., centered medium shot" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Title & Description */}
          <SectionAccordion
            title="Title & Description"
            subtitle="SEO strategy for titles and descriptions"
            icon={<TrendingIcon />}
            color="success.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Title Strategy" value={getNestedValue(platformPersona, ['title_description', 'title_strategy'])} onChange={(val) => updateField(['title_description', 'title_strategy'], val)} multiline placeholder="e.g., curiosity/benefit-driven titles" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Description Strategy" value={getNestedValue(platformPersona, ['title_description', 'description_strategy'])} onChange={(val) => updateField(['title_description', 'description_strategy'], val)} multiline placeholder="e.g., summary + keywords + chapters" />
                </Grid>
                <Grid item xs={12}>
                  <EditableChipArray label="SEO Keywords" values={getNestedValue(platformPersona, ['title_description', 'seo_keywords'], [])} onChange={(vals) => updateField(['title_description', 'seo_keywords'], vals)} placeholder="Add SEO keywords..." color="primary" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Target Audience */}
          <SectionAccordion
            title="Target Audience"
            subtitle="Who this channel serves"
            icon={<ProfessionalIcon />}
            color="info.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <EditableTextField label="Expertise Level" value={getNestedValue(platformPersona, ['target_audience', 'expertise_level'])} onChange={(val) => updateField(['target_audience', 'expertise_level'], val)} placeholder="e.g., beginner, intermediate, expert" />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Interests" values={getNestedValue(platformPersona, ['target_audience', 'interests'], [])} onChange={(vals) => updateField(['target_audience', 'interests'], vals)} placeholder="Add interests..." color="primary" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Pain Points" values={getNestedValue(platformPersona, ['target_audience', 'pain_points'], [])} onChange={(vals) => updateField(['target_audience', 'pain_points'], vals)} placeholder="Add pain points..." color="error" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Engagement */}
          <SectionAccordion
            title="Engagement"
            subtitle="Call-to-action and prompts"
            icon={<BestPracticeIcon />}
            color="success.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <EditableTextField label="Call to Action" value={getNestedValue(platformPersona, ['engagement', 'call_to_action'])} onChange={(val) => updateField(['engagement', 'call_to_action'], val)} multiline placeholder="e.g., subscribe + comment your blocker" />
              <EditableChipArray label="Engagement Prompts" values={getNestedValue(platformPersona, ['engagement', 'engagement_prompts'], [])} onChange={(vals) => updateField(['engagement', 'engagement_prompts'], vals)} placeholder="Add engagement prompts..." color="secondary" />
            </Box>
          </SectionAccordion>

          {/* Prompt Defaults */}
          <SectionAccordion
            title="Prompt Defaults"
            subtitle="Ready-to-inject fragments for image/video models"
            icon={<ContentIcon />}
            color="warning.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <EditableTextField label="Image Base Prompt" value={getNestedValue(platformPersona, ['prompt_defaults', 'image_base_prompt'])} onChange={(val) => updateField(['prompt_defaults', 'image_base_prompt'], val)} multiline helperText="Stable visual identity for thumbnails/b-roll/scenes" />
              <EditableTextField label="Video Base Prompt" value={getNestedValue(platformPersona, ['prompt_defaults', 'video_base_prompt'])} onChange={(val) => updateField(['prompt_defaults', 'video_base_prompt'], val)} multiline helperText="Stable framing + pacing cues for video generation" />
              <EditableTextField label="Negative Prompt" value={getNestedValue(platformPersona, ['prompt_defaults', 'negative_prompt'])} onChange={(val) => updateField(['prompt_defaults', 'negative_prompt'], val)} multiline helperText="What to avoid" />
            </Box>
          </SectionAccordion>
        </>
      )}

      {/* Podcast-specific sections */}
      {isPodcast && (
        <>
          {/* Podcast Identity */}
          <SectionAccordion
            title="Podcast Persona Identity"
            subtitle="Name, archetype and core belief"
            icon={<StrategyIcon />}
            defaultExpanded={true}
            color="info.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Persona Name"
                    value={getNestedValue(platformPersona, ['persona_name'])}
                    onChange={(val) => updateField(['persona_name'], val)}
                    placeholder="e.g., The Curious Host"
                    helperText="Name of the podcast persona"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField
                    label="Archetype"
                    value={getNestedValue(platformPersona, ['archetype'])}
                    onChange={(val) => updateField(['archetype'], val)}
                    placeholder="e.g., The Storyteller"
                    helperText="Persona archetype"
                  />
                </Grid>
                <Grid item xs={12}>
                  <EditableTextField
                    label="Core Belief"
                    value={getNestedValue(platformPersona, ['core_belief'])}
                    onChange={(val) => updateField(['core_belief'], val)}
                    multiline
                    placeholder="Core belief driving the show..."
                    helperText="The belief that drives the show"
                  />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Host */}
          <SectionAccordion
            title="Host"
            subtitle="Voice, personality and visual look"
            icon={<ProfessionalIcon />}
            color="secondary.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Name" value={getNestedValue(platformPersona, ['host', 'name'])} onChange={(val) => updateField(['host', 'name'], val)} placeholder="e.g., Alex" />
                  <EditableTextField label="Background" value={getNestedValue(platformPersona, ['host', 'background'])} onChange={(val) => updateField(['host', 'background'], val)} multiline placeholder="Professional background..." />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Expertise Level" value={getNestedValue(platformPersona, ['host', 'expertise_level'])} onChange={(val) => updateField(['host', 'expertise_level'], val)} placeholder="e.g., expert, practitioner" />
                  <EditableTextField label="Vocal Style" value={getNestedValue(platformPersona, ['host', 'vocal_style'])} onChange={(val) => updateField(['host', 'vocal_style'], val)} multiline placeholder="e.g., warm, conversational" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Personality Traits" values={getNestedValue(platformPersona, ['host', 'personality_traits'], [])} onChange={(vals) => updateField(['host', 'personality_traits'], vals)} placeholder="Add traits..." color="primary" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Catchphrases" values={getNestedValue(platformPersona, ['host', 'catchphrases'], [])} onChange={(vals) => updateField(['host', 'catchphrases'], vals)} placeholder="Add catchphrases..." color="secondary" />
                </Grid>
                <Grid item xs={12}>
                  <EditableTextField label="Look" value={getNestedValue(platformPersona, ['host', 'look'])} onChange={(val) => updateField(['host', 'look'], val)} multiline placeholder="Visual description for avatar..." helperText="Market-fit and style only (no sensitive traits)" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Visual Style */}
          <SectionAccordion
            title="Visual Style"
            subtitle="Studio, lighting and palette"
            icon={<FeaturesIcon />}
            color="warning.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Style Preset" value={getNestedValue(platformPersona, ['visual_style', 'style_preset'])} onChange={(val) => updateField(['visual_style', 'style_preset'], val)} placeholder="e.g., Professional Studio" />
                  <EditableTextField label="Environment" value={getNestedValue(platformPersona, ['visual_style', 'environment'])} onChange={(val) => updateField(['visual_style', 'environment'], val)} placeholder="e.g., warm office with bookshelf" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Lighting" value={getNestedValue(platformPersona, ['visual_style', 'lighting'])} onChange={(val) => updateField(['visual_style', 'lighting'], val)} placeholder="e.g., soft studio lighting" />
                  <EditableTextField label="Camera Style" value={getNestedValue(platformPersona, ['visual_style', 'camera_style'])} onChange={(val) => updateField(['visual_style', 'camera_style'], val)} placeholder="e.g., static mid-shot" />
                </Grid>
                <Grid item xs={12}>
                  <EditableChipArray label="Color Palette" values={getNestedValue(platformPersona, ['visual_style', 'color_palette'], [])} onChange={(vals) => updateField(['visual_style', 'color_palette'], vals)} placeholder="Add brand colors..." color="primary" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Audio Environment */}
          <SectionAccordion
            title="Audio Environment"
            subtitle="Soundscape, music and sound effects"
            icon={<TrendingIcon />}
            color="info.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <EditableTextField label="Soundscape" value={getNestedValue(platformPersona, ['audio_environment', 'soundscape'])} onChange={(val) => updateField(['audio_environment', 'soundscape'], val)} placeholder="e.g., quiet studio" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableTextField label="Music Mood" value={getNestedValue(platformPersona, ['audio_environment', 'music_mood'])} onChange={(val) => updateField(['audio_environment', 'music_mood'], val)} placeholder="e.g., subtle, professional" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <EditableTextField label="SFX Style" value={getNestedValue(platformPersona, ['audio_environment', 'sfx_style'])} onChange={(val) => updateField(['audio_environment', 'sfx_style'], val)} placeholder="e.g., minimal, tech-inspired" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Show Rules */}
          <SectionAccordion
            title="Show Rules"
            subtitle="Intro, outro and interaction tone"
            icon={<ContentIcon />}
            color="success.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Intro Format" value={getNestedValue(platformPersona, ['show_rules', 'intro_format'])} onChange={(val) => updateField(['show_rules', 'intro_format'], val)} multiline placeholder="e.g., welcome + episode promise" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Outro Format" value={getNestedValue(platformPersona, ['show_rules', 'outro_format'])} onChange={(val) => updateField(['show_rules', 'outro_format'], val)} multiline placeholder="e.g., recap + subscribe" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Interaction Tone" value={getNestedValue(platformPersona, ['show_rules', 'interaction_tone'])} onChange={(val) => updateField(['show_rules', 'interaction_tone'], val)} placeholder="e.g., conversational" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Constraints" values={getNestedValue(platformPersona, ['show_rules', 'constraints'], [])} onChange={(vals) => updateField(['show_rules', 'constraints'], vals)} placeholder="Add constraints..." color="warning" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Audience */}
          <SectionAccordion
            title="Audience"
            subtitle="Who this show serves"
            icon={<ProfessionalIcon />}
            color="info.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <EditableTextField label="Expertise Level" value={getNestedValue(platformPersona, ['audience', 'expertise_level'])} onChange={(val) => updateField(['audience', 'expertise_level'], val)} placeholder="e.g., beginner, intermediate, expert" />
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Interests" values={getNestedValue(platformPersona, ['audience', 'interests'], [])} onChange={(vals) => updateField(['audience', 'interests'], vals)} placeholder="Add interests..." color="primary" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableChipArray label="Pain Points" values={getNestedValue(platformPersona, ['audience', 'pain_points'], [])} onChange={(vals) => updateField(['audience', 'pain_points'], vals)} placeholder="Add pain points..." color="error" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Brand */}
          <SectionAccordion
            title="Brand"
            subtitle="Tone, communication style and key messages"
            icon={<BestPracticeIcon />}
            color="success.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Tone" value={getNestedValue(platformPersona, ['brand', 'tone'])} onChange={(val) => updateField(['brand', 'tone'], val)} placeholder="e.g., professional, inspirational" />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EditableTextField label="Communication Style" value={getNestedValue(platformPersona, ['brand', 'communication_style'])} onChange={(val) => updateField(['brand', 'communication_style'], val)} placeholder="e.g., storytelling, socratic" />
                </Grid>
                <Grid item xs={12}>
                  <EditableChipArray label="Key Messages" values={getNestedValue(platformPersona, ['brand', 'key_messages'], [])} onChange={(vals) => updateField(['brand', 'key_messages'], vals)} placeholder="Add key messages..." color="primary" />
                </Grid>
              </Grid>
            </Box>
          </SectionAccordion>

          {/* Prompt Defaults */}
          <SectionAccordion
            title="Prompt Defaults"
            subtitle="Ready-to-inject fragments for image/video models"
            icon={<ContentIcon />}
            color="warning.main"
          >
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 3, mb: 3 }}>
              <EditableTextField label="Host Image Prompt" value={getNestedValue(platformPersona, ['prompt_defaults', 'host_image_prompt'])} onChange={(val) => updateField(['prompt_defaults', 'host_image_prompt'], val)} multiline helperText="Host/avatar visual fragment" />
              <EditableTextField label="Studio Prompt" value={getNestedValue(platformPersona, ['prompt_defaults', 'studio_prompt'])} onChange={(val) => updateField(['prompt_defaults', 'studio_prompt'], val)} multiline helperText="Studio/setting visual fragment" />
              <EditableTextField label="Negative Prompt" value={getNestedValue(platformPersona, ['prompt_defaults', 'negative_prompt'])} onChange={(val) => updateField(['prompt_defaults', 'negative_prompt'], val)} multiline helperText="What to avoid" />
            </Box>
          </SectionAccordion>
        </>
      )}

      {/* 8. Best Practices Section (for all platforms) */}
      <SectionAccordion
        title="Platform Best Practices"
        subtitle="Recommended practices and tips"
        icon={<BestPracticeIcon />}
        color="success.main"
      >
        <Box sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 3
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 3 }}>
            Best Practices
          </Typography>
          <EditableChipArray
            label="Platform Best Practices"
            values={getNestedValue(platformPersona, ['platform_best_practices'], [])}
            onChange={(vals) => updateField(['platform_best_practices'], vals)}
            placeholder="Add best practices..."
            color="success"
            helperText="Platform-specific recommendations and tips"
          />
        </Box>
      </SectionAccordion>
    </Box>
  );
};

export default PlatformPersonaDisplay;

