/**
 * Plan Details Component
 *
 * Displays video plan information. When onPlanChange is provided, the user can
 * edit titles, summary, hook, and outline before Build Scenes.
 */

import React, { useState } from 'react';
import { Alert, Box, Button, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { VideoPlan } from '../../../services/youtubeApi';
import { YT_BORDER } from '../constants';
import { inputSx } from '../styles';
import { useAvatarBlobUrl } from '../hooks/useAvatarBlobUrl';
import { PlanDetailsCard } from './PlanDetailsCard';
import { AvatarCard } from './AvatarCard';
import { ContentOutlineCard } from './ContentOutlineCard';
import { SEOKeywordsCard } from './SEOKeywordsCard';
import { PlanTitleOptimizer } from './PlanTitleOptimizer';
import { PlanOutlineEditor } from './PlanOutlineEditor';
import { PlanMetaFieldsEditor } from './PlanMetaFieldsEditor';
import {
  fromOutlineItems,
  normalizeKeywordList,
  toOutlineItems,
  validatePlanEdits,
  type OutlineItem,
} from '../utils/planOutlineHelpers';

interface PlanDetailsProps {
  plan: VideoPlan;
  onAvatarRegenerate?: () => void;
  regeneratingAvatar?: boolean;
  onPlanChange?: (plan: VideoPlan) => void;
}

const CONTENT_TEXT_STYLES = {
  color: '#374151',
  lineHeight: 1.6,
  fontSize: '0.9375rem',
  fontWeight: 400,
};

const SUMMARY_TEXT_STYLES = {
  ...CONTENT_TEXT_STYLES,
  lineHeight: 1.7,
};

export const PlanDetails: React.FC<PlanDetailsProps> = React.memo(({
  plan,
  onAvatarRegenerate,
  regeneratingAvatar = false,
  onPlanChange,
}) => {
  const avatarUrl = plan.auto_generated_avatar_url;
  const { avatarBlobUrl, avatarLoading } = useAvatarBlobUrl(avatarUrl);
  const canEdit = Boolean(onPlanChange);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<VideoPlan | null>(null);
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const displayPlan = isEditing && draft ? draft : plan;
  const hasTitles = Boolean(
    (displayPlan.selected_title || '').trim() || (displayPlan.title_suggestions || []).length,
  );

  const handleAvatarError = React.useCallback(() => {
    console.warn('[PlanDetails] Avatar image failed to load');
  }, []);

  const handleStartEdit = () => {
    if (!canEdit) return;
    try {
      setDraft({
        ...plan,
        title_suggestions: plan.title_suggestions || [],
        selected_title: plan.selected_title || '',
      });
      setOutlineItems(toOutlineItems(plan.content_outline));
      setSaveError(null);
      setIsEditing(true);
      console.info('[PlanDetails] Edit plan started', {
        outlineCount: plan.content_outline?.length ?? 0,
        suggestionCount: plan.title_suggestions?.length ?? 0,
      });
    } catch (error) {
      console.error('[PlanDetails] Failed to start edit', error);
      setSaveError('Could not start editing. Try again.');
    }
  };

  const handleCancel = () => {
    setDraft(null);
    setOutlineItems([]);
    setSaveError(null);
    setIsEditing(false);
    console.info('[PlanDetails] Edit plan cancelled');
  };

  const handleSave = () => {
    if (!onPlanChange || !draft) return;
    const selectedTitle = (draft.selected_title || '').trim();
    const validationError = validatePlanEdits({ selectedTitle, outline: outlineItems });
    if (validationError) {
      setSaveError(validationError);
      console.warn('[PlanDetails] Save blocked', { reason: validationError });
      return;
    }

    const nextPlan: VideoPlan = {
      ...draft,
      video_summary: (draft.video_summary || '').trim(),
      hook_strategy: (draft.hook_strategy || '').trim(),
      target_audience: (draft.target_audience || '').trim(),
      video_goal: (draft.video_goal || '').trim(),
      key_message: (draft.key_message || '').trim(),
      call_to_action: (draft.call_to_action || '').trim(),
      visual_style: (draft.visual_style || '').trim(),
      tone: (draft.tone || '').trim(),
      seo_keywords: normalizeKeywordList(draft.seo_keywords),
      selected_title: selectedTitle,
      title_suggestions: draft.title_suggestions || [],
      content_outline: fromOutlineItems(outlineItems),
    };

    try {
      onPlanChange(nextPlan);
      setIsEditing(false);
      setDraft(null);
      setOutlineItems([]);
      setSaveError(null);
      console.info('[PlanDetails] Plan saved', {
        outlineCount: nextPlan.content_outline.length,
        titleLength: selectedTitle.length,
        keywordCount: nextPlan.seo_keywords.length,
      });
    } catch (error) {
      console.error('[PlanDetails] Could not save plan', error);
      setSaveError('Could not save plan. Try again.');
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        p: 3,
        border: `1px solid ${YT_BORDER}`,
        backgroundColor: '#fff',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: '#1a1a1a',
            fontSize: '1.125rem',
            letterSpacing: '-0.01em',
          }}
        >
          Plan Details
        </Typography>
        {canEdit && !isEditing && (
          <Button startIcon={<EditIcon />} onClick={handleStartEdit} sx={{ textTransform: 'none' }}>
            Edit plan
          </Button>
        )}
        {canEdit && isEditing && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<CloseIcon />} onClick={handleCancel} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              sx={{ textTransform: 'none' }}
            >
              Save
            </Button>
          </Box>
        )}
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}

      <Stack spacing={3}>
        {(isEditing || hasTitles) && (
          <PlanTitleOptimizer
            titleSuggestions={displayPlan.title_suggestions || []}
            selectedTitle={displayPlan.selected_title || ''}
            disabled={!isEditing}
            onChange={({ titleSuggestions, selectedTitle }) => {
              setDraft((prev) =>
                prev ? { ...prev, title_suggestions: titleSuggestions, selected_title: selectedTitle } : prev,
              );
              if (saveError) setSaveError(null);
            }}
          />
        )}

        {(avatarUrl || displayPlan.video_summary || isEditing) && (
          <Grid container spacing={3}>
            {avatarUrl && (
              <Grid item xs={12} sm={4} md={3}>
                <AvatarCard
                  avatarUrl={avatarUrl}
                  avatarBlobUrl={avatarBlobUrl}
                  avatarLoading={avatarLoading}
                  avatarReused={plan.avatar_reused}
                  avatarPrompt={plan.avatar_prompt}
                  onImageError={handleAvatarError}
                  onRegenerate={onAvatarRegenerate}
                  regenerating={regeneratingAvatar}
                />
              </Grid>
            )}
            {(displayPlan.video_summary || isEditing) && (
              <Grid item xs={12} sm={avatarUrl ? 8 : 12} md={avatarUrl ? 9 : 12}>
                <PlanDetailsCard title="Summary">
                  {isEditing && draft ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      value={draft.video_summary || ''}
                      onChange={(e) => setDraft({ ...draft, video_summary: e.target.value })}
                      inputProps={{ 'aria-label': 'Video summary' }}
                      sx={inputSx}
                    />
                  ) : (
                    <Typography variant="body1" sx={SUMMARY_TEXT_STYLES}>
                      {displayPlan.video_summary}
                    </Typography>
                  )}
                </PlanDetailsCard>
              </Grid>
            )}
          </Grid>
        )}

        {isEditing && draft ? (
          <>
            <PlanMetaFieldsEditor
              value={{
                target_audience: draft.target_audience || '',
                video_goal: draft.video_goal || '',
                key_message: draft.key_message || '',
                call_to_action: draft.call_to_action || '',
                visual_style: draft.visual_style || '',
                tone: draft.tone || '',
                seo_keywords: draft.seo_keywords || [],
              }}
              onChange={(next) => {
                setDraft({ ...draft, ...next });
                if (saveError) setSaveError(null);
              }}
            />
            <PlanDetailsCard title="Hook Strategy">
              <TextField
                fullWidth
                multiline
                minRows={2}
                value={draft.hook_strategy || ''}
                onChange={(e) => setDraft({ ...draft, hook_strategy: e.target.value })}
                inputProps={{ 'aria-label': 'Hook strategy' }}
                sx={inputSx}
              />
            </PlanDetailsCard>
          </>
        ) : (
          <>
            <Grid container spacing={3}>
              {plan.target_audience && (
                <Grid item xs={12} md={6}>
                  <PlanDetailsCard title="Target Audience" fullHeight>
                    <Typography variant="body1" sx={CONTENT_TEXT_STYLES}>
                      {plan.target_audience}
                    </Typography>
                  </PlanDetailsCard>
                </Grid>
              )}
              {plan.video_goal && (
                <Grid item xs={12} md={6}>
                  <PlanDetailsCard title="Goal" fullHeight>
                    <Typography variant="body1" sx={CONTENT_TEXT_STYLES}>
                      {plan.video_goal}
                    </Typography>
                  </PlanDetailsCard>
                </Grid>
              )}
            </Grid>

            <Grid container spacing={3}>
              {plan.key_message && (
                <Grid item xs={12} md={6}>
                  <PlanDetailsCard title="Key Message" fullHeight>
                    <Typography variant="body1" sx={CONTENT_TEXT_STYLES}>
                      {plan.key_message}
                    </Typography>
                  </PlanDetailsCard>
                </Grid>
              )}
              {plan.call_to_action && (
                <Grid item xs={12} md={6}>
                  <PlanDetailsCard title="Call to Action" fullHeight>
                    <Typography variant="body1" sx={CONTENT_TEXT_STYLES}>
                      {plan.call_to_action}
                    </Typography>
                  </PlanDetailsCard>
                </Grid>
              )}
            </Grid>

            <Grid container spacing={3}>
              {plan.hook_strategy && (
                <Grid item xs={12} md={6}>
                  <PlanDetailsCard title="Hook Strategy" fullHeight>
                    <Typography variant="body1" sx={CONTENT_TEXT_STYLES}>
                      {plan.hook_strategy}
                    </Typography>
                  </PlanDetailsCard>
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <PlanDetailsCard title="Style & Tone" fullHeight>
                  <Typography variant="body1" sx={CONTENT_TEXT_STYLES}>
                    Visual Style: {plan.visual_style || '—'} | Tone: {plan.tone || '—'}
                  </Typography>
                </PlanDetailsCard>
              </Grid>
            </Grid>

            <SEOKeywordsCard seoKeywords={plan.seo_keywords} />
          </>
        )}

        {isEditing ? (
          <PlanOutlineEditor
            items={outlineItems}
            targetSeconds={plan.duration_metadata?.target_seconds}
            maxSections={plan.duration_metadata?.max_scenes || 10}
            onChange={(items) => {
              setOutlineItems(items);
              if (saveError) setSaveError(null);
            }}
          />
        ) : (
          <ContentOutlineCard contentOutline={plan.content_outline} />
        )}
      </Stack>
    </Paper>
  );
});

PlanDetails.displayName = 'PlanDetails';
