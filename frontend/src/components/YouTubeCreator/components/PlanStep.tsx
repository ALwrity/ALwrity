/**
 * Plan Step Component
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Tooltip,
  IconButton,
  Grid,
  Button,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import CloudUpload from '@mui/icons-material/CloudUpload';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Delete from '@mui/icons-material/Delete';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Collections from '@mui/icons-material/Collections';
import { motion } from 'framer-motion';
import {
  inputSx,
  labelSx,
  helperSx,
  selectSx,
  selectMenuProps,
  paperSx,
  sectionTitleSx,
  tooltipSx,
} from '../styles';
import {
  DurationType,
  VideoType,
  VIDEO_TYPES,
  VIDEO_TYPE_CONFIGS,
  TARGET_AUDIENCE_OPTIONS,
  VIDEO_GOAL_OPTIONS,
  BRAND_STYLE_OPTIONS,
  YOUTUBE_CONTENT_LANGUAGE_OPTIONS,
  type YouTubeContentLanguage,
} from '../constants';
import { OperationButton } from '../../shared/OperationButton';
import { AssetLibraryImageModal } from '../../shared/AssetLibraryImageModal';
import { ContentAsset } from '../../../hooks/useContentAssets';
import { buildVideoPlanningOperation, buildImageEditingOperation } from '../utils/operationHelpers';
import { useAvatarBlobUrl } from '../hooks/useAvatarBlobUrl';
import { SelectWithCustom } from './SelectWithCustom';
import { PlanTopicDiscoveryBar } from './PlanTopicDiscoveryBar';
import { PlanUrlImportBar, type YouTubeSourceArticle } from './PlanUrlImportBar';
import { ChannelBiblePanel } from './ChannelBiblePanel';
import type { YouTubeChannelBible } from '../../../services/youtubeApi';

interface PlanStepProps {
  userIdea: string;
  durationType: DurationType;
  videoType?: VideoType;
  targetAudience?: string;
  videoGoal?: string;
  brandStyle?: string;
  referenceImage: string;
  loading: boolean;
  avatarPreview?: string | null;
  avatarUrl?: string | null;
  uploadingAvatar?: boolean;
  makingPresentable?: boolean;
  language: YouTubeContentLanguage;
  onIdeaChange: (idea: string) => void;
  onSourceArticleChange: (article: YouTubeSourceArticle | null) => void;
  onDurationChange: (duration: DurationType) => void;
  onVideoTypeChange: (type: VideoType | '') => void;
  onTargetAudienceChange: (audience: string) => void;
  onVideoGoalChange: (goal: string) => void;
  onBrandStyleChange: (style: string) => void;
  onReferenceImageChange: (image: string) => void;
  onLanguageChange: (language: YouTubeContentLanguage) => void;
  onGeneratePlan: () => void;
  onAvatarUpload: (file: File) => void;
  onRemoveAvatar: () => void;
  onMakePresentable: () => void;
  onAvatarSelectFromLibrary: (asset: ContentAsset) => void;
  channelBible: YouTubeChannelBible | null;
  bibleLoading?: boolean;
  bibleSaving?: boolean;
  bibleError?: string | null;
  onBibleChange: (bible: YouTubeChannelBible) => void;
  onSaveBible: () => void;
  onApplyBible: () => void;
}

export const PlanStep: React.FC<PlanStepProps> = React.memo(({
  userIdea,
  durationType,
  videoType,
  targetAudience,
  videoGoal,
  brandStyle,
  referenceImage,
  loading,
  avatarPreview,
  avatarUrl,
  uploadingAvatar = false,
  makingPresentable = false,
  language,
  onIdeaChange,
  onSourceArticleChange,
  onDurationChange,
  onVideoTypeChange,
  onTargetAudienceChange,
  onVideoGoalChange,
  onBrandStyleChange,
  onReferenceImageChange,
  onLanguageChange,
  onGeneratePlan,
  onAvatarUpload,
  onRemoveAvatar,
  onMakePresentable,
  onAvatarSelectFromLibrary,
  channelBible,
  bibleLoading = false,
  bibleSaving = false,
  bibleError = null,
  onBibleChange,
  onSaveBible,
  onApplyBible,
}) => {
  // Memoize operation objects to avoid recreating on every render
  const videoPlanningOperation = useMemo(
    () => buildVideoPlanningOperation(durationType),
    [durationType]
  );

  const imageEditingOperation = useMemo(
    () => buildImageEditingOperation(),
    [] // No dependencies - always returns same object
  );

  // Load avatar with query-token authentication for YouTube API endpoints
  const { avatarBlobUrl, avatarLoading } = useAvatarBlobUrl(avatarPreview);

  // State for custom values
  const [customTargetAudience, setCustomTargetAudience] = useState('');
  const [customVideoGoal, setCustomVideoGoal] = useState('');
  const [customBrandStyle, setCustomBrandStyle] = useState('');
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);

  // Initialize custom values from props if they're custom (not in predefined options)
  useEffect(() => {
    if (targetAudience && !TARGET_AUDIENCE_OPTIONS.some(opt => opt.value === targetAudience)) {
      setCustomTargetAudience(targetAudience);
    }
  }, [targetAudience]);

  useEffect(() => {
    if (videoGoal && !VIDEO_GOAL_OPTIONS.some(opt => opt.value === videoGoal)) {
      setCustomVideoGoal(videoGoal);
    }
  }, [videoGoal]);

  useEffect(() => {
    if (brandStyle && !BRAND_STYLE_OPTIONS.some(opt => opt.value === brandStyle)) {
      setCustomBrandStyle(brandStyle);
    }
  }, [brandStyle]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAvatarUpload(file);
    }
  };

  const handleAssetLibrarySelect = useCallback(
    (asset: ContentAsset) => {
      if (!asset.file_url) return;
      onAvatarSelectFromLibrary(asset);
      setAssetLibraryOpen(false);
    },
    [onAvatarSelectFromLibrary]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Paper sx={{ ...paperSx, p: { xs: 2.5, md: 3 } }}>
        <Typography variant="h5" sx={sectionTitleSx}>
          1️⃣ Plan Your Video
        </Typography>

        <Stack spacing={2.5}>
          <ChannelBiblePanel
            bible={channelBible}
            loading={bibleLoading}
            saving={bibleSaving}
            error={bibleError}
            disabled={loading}
            planAvatarUrl={avatarUrl}
            onChange={onBibleChange}
            onSave={onSaveBible}
            onApplyToThisVideo={onApplyBible}
          />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InputLabel sx={labelSx} required>
                What's your video about?
              </InputLabel>
              <Tooltip
                title="Be specific! Include: 1) Your topic, 2) Target audience, 3) What viewers will learn/do, 4) Your goal (views, subscribers, sales). Example: 'Explain quantum computing to tech beginners, aiming for 10K views and 500 subscribers.'"
                arrow
                sx={tooltipSx}
              >
                <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: '#64748b' }}>
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <TextField
              placeholder="Example: 'AI explains black holes in 60 seconds for science enthusiasts' or 'Budget travel guide for Tokyo targeting young professionals'"
              value={userIdea}
              onChange={(e) => onIdeaChange(e.target.value)}
              multiline
              rows={4}
              fullWidth
              required
              helperText="Describe your video idea in 1-2 sentences. Include who it's for, what they'll learn, and your goal (views, subscribers, sales, etc.)."
              sx={inputSx}
              FormHelperTextProps={{ sx: helperSx }}
            />
            <PlanTopicDiscoveryBar
              userIdea={userIdea}
              onIdeaChange={onIdeaChange}
              disabled={loading}
            />
            <PlanUrlImportBar
              userIdea={userIdea}
              onIdeaChange={onIdeaChange}
              onSourceArticleChange={onSourceArticleChange}
              disabled={loading}
            />
          </Box>

          {/* Video Type */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InputLabel sx={labelSx}>Video Type</InputLabel>
              <Tooltip
                title="Selecting a video type helps AI optimize the script structure, pacing, visuals, and avatar style. Each type has different best practices for engagement."
                arrow
                sx={tooltipSx}
              >
                <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: '#64748b' }}>
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <FormControl fullWidth>
              <Select
                value={videoType || ''}
                onChange={(e) => onVideoTypeChange(e.target.value as VideoType | '')}
                sx={selectSx}
                displayEmpty
                MenuProps={selectMenuProps}
              >
                <MenuItem value="">
                  <em>Select video type (Recommended)</em>
                </MenuItem>
                {VIDEO_TYPES.map((type) => {
                  const config = VIDEO_TYPE_CONFIGS[type];
                  return (
                    <MenuItem key={type} value={type}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#0f172a' }}>
                          {config.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
                          {config.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
              <FormHelperText sx={helperSx}>
                Helps optimize plan, visuals, and avatar for better results. Highly recommended!
              </FormHelperText>
            </FormControl>
          </Box>

          {/* Target Audience and Video Goal in a row on wider screens */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SelectWithCustom
                label="Target Audience"
                value={targetAudience || ''}
                options={TARGET_AUDIENCE_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: opt.label,
                  description: opt.description,
                }))}
                customValue={customTargetAudience}
                onSelectChange={(value) => {
                  onTargetAudienceChange(value);
                  // If selecting a predefined option, clear custom value
                  if (TARGET_AUDIENCE_OPTIONS.some(opt => opt.value === value)) {
                    setCustomTargetAudience('');
                  } else if (value) {
                    // If it's a custom value, store it
                    setCustomTargetAudience(value);
                  }
                }}
                onCustomChange={(value) => {
                  setCustomTargetAudience(value);
                  onTargetAudienceChange(value);
                }}
                tooltipText="Knowing your audience helps AI tailor the tone, pace, complexity, and visual style. Be specific: age range, interests, skill level, and what they care about."
                placeholder="Example: 'Tech-savvy professionals aged 25-40, interested in productivity tools'"
                helperText="Who is this video for? Helps tailor tone, pace, and style."
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <SelectWithCustom
                label="Primary Goal"
                value={videoGoal || ''}
                options={VIDEO_GOAL_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: opt.label,
                  description: opt.description,
                }))}
                customValue={customVideoGoal}
                onSelectChange={(value) => {
                  onVideoGoalChange(value);
                  // If selecting a predefined option, clear custom value
                  if (VIDEO_GOAL_OPTIONS.some(opt => opt.value === value)) {
                    setCustomVideoGoal('');
                  } else if (value) {
                    // If it's a custom value, store it
                    setCustomVideoGoal(value);
                  }
                }}
                onCustomChange={(value) => {
                  setCustomVideoGoal(value);
                  onVideoGoalChange(value);
                }}
                tooltipText="What action should viewers take after watching? This shapes the call-to-action (CTA), content structure, and hook. Examples: Subscribe, Buy, Learn, Share, etc."
                placeholder="Example: 'Educate viewers on AI basics and drive 500 subscribers'"
                helperText="What should viewers do after watching? Shapes CTA and structure."
              />
            </Grid>
          </Grid>

          {/* Brand Style */}
          <SelectWithCustom
            label="Brand Style / Visual Aesthetic"
            value={brandStyle || ''}
            options={BRAND_STYLE_OPTIONS.map(opt => ({
              value: opt.value,
              label: opt.label,
              description: opt.description,
            }))}
            customValue={customBrandStyle}
            onSelectChange={(value) => {
              onBrandStyleChange(value);
              // If selecting a predefined option, clear custom value
              if (BRAND_STYLE_OPTIONS.some(opt => opt.value === value)) {
                setCustomBrandStyle('');
              } else if (value) {
                // If it's a custom value, store it
                setCustomBrandStyle(value);
              }
            }}
            onCustomChange={(value) => {
              setCustomBrandStyle(value);
              onBrandStyleChange(value);
            }}
            tooltipText="The visual aesthetic influences avatar appearance, scene colors, transitions, and overall video feel. Choose a style that matches your brand identity and resonates with your target audience."
            placeholder="Example: 'Modern minimalist, tech-forward, clean with blue accents'"
            helperText="Visual style influences avatar, scenes, and overall video aesthetic."
          />

          {/* Video Duration */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InputLabel sx={labelSx}>Video Duration</InputLabel>
              <Tooltip
                title="Shorts (≤60s): Vertical format, quick hooks, high energy. Best for viral content. Medium (1-4min): Balanced explainers, tutorials. Long (4-10min): Deep dives, comprehensive guides. Choose based on your content complexity and audience attention span."
                arrow
                sx={tooltipSx}
              >
                <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: '#64748b' }}>
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <FormControl fullWidth>
              <Select
                value={durationType}
                onChange={(e) => onDurationChange(e.target.value as DurationType)}
                sx={selectSx}
                MenuProps={selectMenuProps}
              >
                <MenuItem value="shorts">Shorts (15-60 seconds)</MenuItem>
                <MenuItem value="medium">Medium (1-4 minutes)</MenuItem>
                <MenuItem value="long">Long (4-10 minutes)</MenuItem>
              </Select>
              <FormHelperText sx={helperSx}>
                Shorts = vertical bite-sized (≤60s). Medium = quick explainers. Long = deep dives.
              </FormHelperText>
            </FormControl>
          </Box>

          {/* Content Language (affects multilingual audio) */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <InputLabel sx={labelSx}>Content Language</InputLabel>
              <Tooltip
                title="This controls narration pronunciation and the default voice selection for audio generation. You can still override per-scene in Audio Settings."
                arrow
                sx={tooltipSx}
              >
                <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: '#64748b' }}>
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <FormControl fullWidth>
              <Select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as YouTubeContentLanguage)}
                sx={selectSx}
                MenuProps={selectMenuProps}
              >
                {YOUTUBE_CONTENT_LANGUAGE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText sx={helperSx}>
                Sets default audio language (voice + pronunciation). Planning/scenes are still generated in English for now.
              </FormHelperText>
            </FormControl>
          </Box>

          {/* Avatar & Visual Style Section - Compact */}
          <Paper variant="outlined" sx={{ p: 2, borderColor: '#d1d5db', borderRadius: 2, bgcolor: '#f9fafb' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#0f172a' }}>
              Creator Avatar & Visual Style
            </Typography>
            
            <Stack spacing={2}>
              {/* Visual Style Description */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <InputLabel sx={{ ...labelSx, fontSize: '0.875rem' }}>
                    Visual Style Guide (Optional)
                  </InputLabel>
                  <Tooltip
                    title="Describe the visual style, mood, or specific scenes you want for your video. Use descriptive keywords like colors, lighting, composition, atmosphere. This helps AI generate consistent visuals that match your vision. Examples: 'neon-lit Tokyo alley, rainy night, cinematic bokeh' or 'bright, clean, modern office space'"
                    arrow
                    sx={tooltipSx}
                  >
                    <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: '#64748b' }}>
                      <InfoOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  placeholder="Example: 'neon-lit Tokyo alley, rainy night, cinematic bokeh' or 'bright, clean, modern office space'"
                  value={referenceImage}
                  onChange={(e) => onReferenceImageChange(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                  size="small"
                  helperText="Optional: Describe visual style, mood, or scenes to guide AI-generated visuals."
                  sx={{ ...inputSx, '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                  FormHelperTextProps={{ sx: { ...helperSx, fontSize: '0.75rem' } }}
                />
              </Box>

              {/* Avatar Upload Section */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: '#475569' }}>
                  Creator Avatar
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', mb: 1.5, display: 'block' }}>
                  <strong>Option 1:</strong> Upload your photo → Click "Make Presentable" to optimize it with AI<br />
                  <strong>Option 2:</strong> Skip upload → AI will auto-generate a creator avatar in the next step
                </Typography>
                
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                  {avatarPreview ? (
                    <>
                      <Box sx={{ position: 'relative', width: 120, flexShrink: 0 }}>
                        {avatarLoading ? (
                          <Box
                            sx={{
                              width: '100%',
                              height: 120,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: '#f1f5f9',
                              borderRadius: 1.5,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Loading...
                            </Typography>
                          </Box>
                        ) : (
                          <Box
                            component="img"
                            src={avatarBlobUrl || undefined}
                            alt="Avatar preview"
                            onError={() => {
                              console.warn('[PlanStep] Avatar image failed to load');
                            }}
                            sx={{
                              width: '100%',
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 1.5,
                              border: '1px solid #e2e8f0',
                              display: avatarBlobUrl ? 'block' : 'none',
                            }}
                          />
                        )}
                        <IconButton
                          size="small"
                          onClick={onRemoveAvatar}
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            bgcolor: 'white',
                            border: '1px solid #e2e8f0',
                            width: 24,
                            height: 24,
                            '&:hover': { bgcolor: '#f8fafc' },
                            '& svg': { fontSize: '0.875rem' },
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <OperationButton
                          operation={imageEditingOperation}
                          label="Make Presentable"
                          variant="contained"
                          size="medium"
                          color="primary"
                          startIcon={<AutoAwesome fontSize="small" />}
                          onClick={onMakePresentable}
                          disabled={makingPresentable}
                          loading={makingPresentable}
                          checkOnHover={true}
                          checkOnMount={false}
                          showCost={true}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            textTransform: 'none',
                            borderRadius: 1.5,
                            px: 2,
                            py: 0.875,
                            boxShadow: '0 2px 8px 0 rgba(102, 126, 234, 0.3)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover:not(:disabled)': {
                              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                              boxShadow: '0 4px 12px 0 rgba(102, 126, 234, 0.4)',
                              transform: 'translateY(-1px)',
                            },
                            '&:disabled': {
                              background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
                              color: '#64748b',
                              boxShadow: 'none',
                            },
                            '& .MuiButton-startIcon': {
                              marginRight: 0.75,
                              '& svg': { fontSize: '1rem' },
                            },
                            '& .MuiCircularProgress-root': { color: 'white' },
                          }}
                          buttonProps={{
                            children: makingPresentable ? 'Transforming...' : undefined,
                          }}
                        />
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#64748b', fontSize: '0.75rem' }}>
                          AI will optimize your photo using your video type, audience, and style preferences.
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Button
                            variant="outlined"
                            startIcon={<Collections />}
                            onClick={() => setAssetLibraryOpen(true)}
                            fullWidth
                            sx={{
                              borderColor: '#d1d5db',
                              color: '#6b7280',
                              '&:hover': {
                                borderColor: '#9ca3af',
                                backgroundColor: '#f9fafb',
                              },
                            }}
                          >
                            Upload from Asset Library
                          </Button>
                        </Stack>
                      </Box>
                    </>
                  ) : (
                    <Box
                      component="label"
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        minHeight: 100,
                        border: '2px dashed #cbd5e1',
                        borderRadius: 1.5,
                        bgcolor: '#f8fafc',
                        cursor: 'pointer',
                        py: 1.5,
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: '#667eea', bgcolor: '#f1f5f9' },
                      }}
                    >
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      <CloudUpload sx={{ color: '#94a3b8', fontSize: 28, mb: 0.75 }} />
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, fontSize: '0.875rem' }}>
                        {uploadingAvatar ? 'Uploading...' : 'Upload Your Photo (Optional)'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', textAlign: 'center', px: 2, fontSize: '0.75rem' }}>
                        Max 5MB. JPG, PNG, WebP. Clear, front-facing photos work best.
                      </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Collections />}
                    onClick={() => setAssetLibraryOpen(true)}
                    fullWidth
                    sx={{
                      mt: 1.5,
                      borderColor: '#d1d5db',
                      color: '#6b7280',
                      '&:hover': {
                        borderColor: '#9ca3af',
                        backgroundColor: '#f9fafb',
                      },
                    }}
                  >
                    Upload from Asset Library
                  </Button>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Paper>

          <OperationButton
            operation={videoPlanningOperation}
            label="Generate Video Plan"
            variant="contained"
            color="error"
            size="large"
            startIcon={<PlayArrow />}
            onClick={onGeneratePlan}
            disabled={loading || !userIdea.trim()}
            loading={loading}
            checkOnHover={true}
            checkOnMount={false}
            showCost={true}
            sx={{ alignSelf: 'flex-start', px: 4 }}
          />
        </Stack>
      </Paper>
    <AssetLibraryImageModal
      open={assetLibraryOpen}
      onClose={() => setAssetLibraryOpen(false)}
      onSelect={handleAssetLibrarySelect}
      title="Select Avatar from Asset Library"
      sourceModule={undefined}
      allowFavoritesOnly={false}
      showBrandAvatarShortcut
    />
    </motion.div>
  );
});

PlanStep.displayName = 'PlanStep';

