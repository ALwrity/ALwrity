import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Tooltip,
  Link,
  CircularProgress,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AutofillDataTransparency from './AutofillDataTransparency';

/**
 * Compact strategy banner (Phase 2 redesign).
 *
 * Row 1: title + subtitle
 * Row 2: stats strip — [Fields ready X/Y] [Data quality N%] [Sources N] [Refreshed]
 *        + category-review progress line
 * Row 3: actions — context-aware primary CTA, autofill secondary,
 *        regenerate-AI text link, know-more link
 *
 * All numbers are real values resolved by the parent from formData /
 * the autofill response / the review state — nothing fabricated here.
 */

interface HeaderSectionProps {
  // Stats (authoritative, parent-resolved)
  fieldsReady: number;
  fieldsTotal: number;
  /** Real pipeline data-quality percent (0-100). */
  dataQuality: number;
  /** Distinct onboarding sources used (deduped). */
  onboardingSources: number;
  /** Preformatted "time ago" label, or null when never refreshed. */
  refreshedLabel: string | null;

  // Category review progress
  reviewedCount: number;
  totalCategories: number;
  allCategoriesReviewed: boolean;
  /** Categories not yet reviewed — the primary CTA when review is pending. */
  unreviewedCategories: string[];

  // Actions
  loading: boolean;
  onAutofill: () => void;
  onRegenerateAI?: () => void;
  /** Scroll to the first unreviewed category. */
  onReviewNext: () => void;
  /** Create the strategy (parent gates on all-reviewed). */
  onCreateStrategy: () => void;

  // Transparency modal data
  autoPopulatedFields: any;
  dataSources: any;
  inputDataPoints: any;
  personalizationData: any;
  confidenceScores?: any;
  lastAutofillTime?: string;
  dataSource?: string;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  fieldsReady,
  fieldsTotal,
  dataQuality,
  onboardingSources,
  refreshedLabel,
  reviewedCount,
  totalCategories,
  allCategoriesReviewed,
  unreviewedCategories,
  loading,
  onAutofill,
  onRegenerateAI,
  onReviewNext,
  onCreateStrategy,
  autoPopulatedFields,
  dataSources,
  inputDataPoints,
  personalizationData,
  confidenceScores,
  lastAutofillTime,
  dataSource,
}) => {
  const [showTransparencyModal, setShowTransparencyModal] = useState(false);

  const reviewPercent = totalCategories > 0
    ? Math.round((reviewedCount / totalCategories) * 100)
    : 0;

  const qualityColor =
    dataQuality >= 80 ? '#4caf50' : dataQuality >= 60 ? '#ff9800' : '#ef5350';

  return (
    <Box sx={{ mb: 2 }}>
      {/* ── Row 1: Title ─────────────────────────────────────────── */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0d47a1', lineHeight: 1.2 }}>
          AI Content Strategy Co-pilot
        </Typography>
        <Typography variant="body2" sx={{ color: '#555' }}>
          Build a comprehensive content strategy with {fieldsTotal} strategic inputs
        </Typography>
      </Box>

      {/* ── Row 2: Compact stats strip ───────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          p: 1.25,
          mb: 1,
          borderRadius: 2,
          backgroundColor: 'rgba(227, 242, 253, 0.6)',
          border: '1px solid rgba(33, 150, 243, 0.25)',
        }}
      >
        {/* Fields ready X/Y */}
        <Tooltip
          title={`${fieldsReady} of ${fieldsTotal} strategic inputs are filled. Review each category to complete your strategy.`}
          arrow
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 1.5, backgroundColor: '#fff' }}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: '#1976d2' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d47a1' }}>
              Fields ready {fieldsReady}/{fieldsTotal}
            </Typography>
          </Box>
        </Tooltip>

        {/* Data quality (real pipeline score) */}
        <Tooltip
          title="Real data-quality assessment from the onboarding integration pipeline — completeness, freshness, relevance and confidence of your connected data sources. A lower score usually means some sources (e.g. Google Search Console, LinkedIn) are not connected yet."
          arrow
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 1.5, backgroundColor: '#fff' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: qualityColor }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d47a1' }}>
              Data quality {dataQuality}%
            </Typography>
          </Box>
        </Tooltip>

        {/* Onboarding sources (deduped count) */}
        <Tooltip
          title={`${onboardingSources} distinct onboarding data sources fed these fields (website analysis, persona, research preferences, competitors, AI…). Click "Know more" for the full breakdown.`}
          arrow
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 1.5, backgroundColor: '#fff' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d47a1' }}>
              Sources {onboardingSources}
            </Typography>
          </Box>
        </Tooltip>

        {/* Refreshed */}
        {refreshedLabel && (
          <Tooltip
            title={`Fields were last refreshed ${refreshedLabel}. Click "Autofill from onboarding" to pull the latest onboarding data.`}
            arrow
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 1.5, backgroundColor: '#fff' }}>
              <RefreshIcon sx={{ fontSize: 16, color: '#1976d2' }} />
              <Typography variant="body2" sx={{ color: '#0d47a1' }}>
                Refreshed {refreshedLabel}
              </Typography>
            </Box>
          </Tooltip>
        )}

        {/* Know more */}
        <Link
          component="button"
          type="button"
          onClick={() => setShowTransparencyModal(true)}
          sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem', color: '#1976d2' }}
        >
          <VisibilityIcon sx={{ fontSize: 16 }} />
          Know more
        </Link>

        {/* Category review progress — compact chip with circular indicator */}
        <Tooltip
          title={
            allCategoriesReviewed
              ? `All ${totalCategories} categories reviewed — you can create your strategy.`
              : `${reviewedCount} of ${totalCategories} categories reviewed. Next up: ${unreviewedCategories[0] ? unreviewedCategories[0].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}. Click "Review Fields" below.`
          }
          arrow
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              backgroundColor: allCategoriesReviewed ? 'rgba(76, 175, 80, 0.08)' : 'rgba(255, 152, 0, 0.08)',
              border: `1px solid ${allCategoriesReviewed ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255, 152, 0, 0.4)'}`,
            }}
          >
            {allCategoriesReviewed ? (
              <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
            ) : (
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress
                  variant="determinate"
                  value={reviewPercent}
                  size={18}
                  thickness={5}
                  sx={{ color: '#ff9800' }}
                />
                <Typography
                  sx={{ position: 'absolute', fontSize: '0.42rem', fontWeight: 700, color: '#e65100', lineHeight: 1 }}
                >
                  {reviewPercent}
                </Typography>
              </Box>
            )}
            <Typography variant="body2" sx={{ fontWeight: 600, color: allCategoriesReviewed ? '#2e7d32' : '#e65100', fontSize: '0.8rem' }}>
              {allCategoriesReviewed
                ? `All ${totalCategories} categories reviewed`
                : `${reviewedCount}/${totalCategories} reviewed — next up: ${unreviewedCategories[0] ? unreviewedCategories[0].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}`}
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* ── Row 3: Actions ───────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {allCategoriesReviewed ? (
          <Button
            variant="contained"
            onClick={onCreateStrategy}
            startIcon={<CheckCircleIcon />}
            sx={{
              backgroundColor: '#2e7d32',
              '&:hover': { backgroundColor: '#1b5e20' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create Strategy
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={onReviewNext}
            startIcon={<VisibilityIcon />}
            sx={{
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#1565c0' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Review Fields ({totalCategories - reviewedCount} remaining)
          </Button>
        )}

        <Button
          variant="outlined"
          onClick={onAutofill}
          disabled={loading}
          startIcon={<AutoAwesomeIcon />}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {loading ? 'Autofilling…' : 'Autofill from onboarding'}
        </Button>

        {onRegenerateAI && (
          <Tooltip title="Re-run AI generation for AI-sourced fields only. Your onboarding-grounded (database) fields are preserved." arrow>
            <Link
              component="button"
              type="button"
              onClick={onRegenerateAI}
              sx={{ fontSize: '0.8rem', color: '#6b7280' }}
            >
              Regenerate AI fields
            </Link>
          </Tooltip>
        )}
      </Box>

      {/* Transparency modal (know-more) */}
      <AutofillDataTransparency
        open={showTransparencyModal}
        onClose={() => setShowTransparencyModal(false)}
        autoPopulatedFields={autoPopulatedFields}
        dataSources={dataSources}
        inputDataPoints={inputDataPoints}
        personalizationData={personalizationData}
        confidenceScores={confidenceScores}
        lastAutofillTime={lastAutofillTime}
        dataSource={dataSource}
      />
    </Box>
  );
};

export default HeaderSection;
