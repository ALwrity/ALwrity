import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import GavelIcon from '@mui/icons-material/Gavel';
import ShieldIcon from '@mui/icons-material/Shield';
import SecurityIcon from '@mui/icons-material/Security';
import { apiClient } from '../../../api/client';

interface QualityScore {
  score: number;
  pages_analyzed: number;
}

interface BrandVoice {
  compliance_score: number;
  pages_checked: number;
}

interface SafetyIssues {
  has_issues: boolean;
  flagged_pages: number;
}

interface CannibalizationIssues {
  total_warnings?: number;
  high_risk?: number;
  warnings?: Array<{ url: string; similar_to: string; score: number }>;
}

interface AuditData {
  has_audit: boolean;
  status: string;
  message?: string;
  audit_timestamp?: string;
  website_url?: string;
  total_pages_crawled?: number;
  content_quality?: QualityScore;
  brand_voice_consistency?: BrandVoice;
  safety_issues?: SafetyIssues;
  cannibalization_issues?: CannibalizationIssues;
  last_execution_time?: string;
}

const scoreColor = (score: number): string => {
  if (score >= 0.8) return '#22c55e';
  if (score >= 0.5) return '#f59e0b';
  return '#ef4444';
};

const scoreLabel = (score: number): string => {
  if (score >= 0.8) return 'Good';
  if (score >= 0.5) return 'Needs Work';
  return 'Critical';
};

const MetricBox: React.FC<{
  icon: React.ReactNode;
  label: string;
  score?: number;
  statusText?: string;
  subText?: string;
  color?: string;
}> = ({ icon, label, score, statusText, subText, color }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'rgba(255,255,255,0.03)',
    }}
  >
    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
      {icon}
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
    </Box>
    {score !== undefined ? (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="h5" fontWeight={700} sx={{ color: color || scoreColor(score) }}>
          {(score * 100).toFixed(0)}%
        </Typography>
        <Chip
          label={scoreLabel(score)}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.6rem',
            fontWeight: 700,
            bgcolor: `${color || scoreColor(score)}22`,
            color: color || scoreColor(score),
          }}
        />
      </Box>
    ) : statusText ? (
      <Typography variant="body2" fontWeight={600} sx={{ color: color || '#9e9e9e' }}>
        {statusText}
      </Typography>
    ) : null}
    {subText && (
      <Typography variant="caption" color="text.secondary">
        {subText}
      </Typography>
    )}
  </Box>
);

const ContentGuardianCard: React.FC = () => {
  const [audit, setAudit] = React.useState<AuditData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const fetchAudit = async () => {
      try {
        const resp = await apiClient.get('/api/seo-dashboard/guardian-audit');
        setAudit(resp.data);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
    const interval = setInterval(fetchAudit, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <GavelIcon sx={{ fontSize: 20 }} />
          <Typography variant="h6" fontWeight={700}>
            Content Guardian Audit
          </Typography>
        </Box>
        {audit?.audit_timestamp && (
          <Typography variant="caption" color="text.secondary">
            {new Date(audit.audit_timestamp).toLocaleDateString()}
          </Typography>
        )}
      </Box>

      {loading && (
        <Box py={3} textAlign="center">
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && error && (
        <Typography variant="body2" color="text.secondary">
          Unable to load audit data.
        </Typography>
      )}

      {!loading && !error && audit && !audit.has_audit && (
        <Typography variant="body2" color="text.secondary">
          {audit.message || 'No audit available yet. Complete SIF indexing to generate a report.'}
        </Typography>
      )}

      {!loading && !error && audit?.has_audit && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1.5,
              mb: 1.5,
            }}
          >
            {audit.content_quality && (
              <MetricBox
                icon={<SecurityIcon sx={{ fontSize: 18, color: scoreColor(audit.content_quality.score) }} />}
                label="Content Quality"
                score={audit.content_quality.score}
                subText={`${audit.content_quality.pages_analyzed} pages`}
              />
            )}
            {audit.brand_voice_consistency && (
              <MetricBox
                icon={<ShieldIcon sx={{ fontSize: 18, color: scoreColor(audit.brand_voice_consistency.compliance_score) }} />}
                label="Brand Voice"
                score={audit.brand_voice_consistency.compliance_score}
                subText={`${audit.brand_voice_consistency.pages_checked} pages`}
              />
            )}
            {audit.safety_issues && (
              <MetricBox
                icon={
                  audit.safety_issues.has_issues ? (
                    <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                  ) : (
                    <CheckIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                  )
                }
                label="Safety"
                statusText={audit.safety_issues.has_issues ? `${audit.safety_issues.flagged_pages} flagged` : 'No issues'}
                color={audit.safety_issues.has_issues ? '#ef4444' : '#22c55e'}
              />
            )}
            {audit.cannibalization_issues && (
              <MetricBox
                icon={
                  (audit.cannibalization_issues.total_warnings || 0) > 0 ? (
                    <WarningIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                  ) : (
                    <CheckIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                  )
                }
                label="Cannibalization"
                statusText={
                  audit.cannibalization_issues.total_warnings
                    ? `${audit.cannibalization_issues.total_warnings} warning${audit.cannibalization_issues.total_warnings > 1 ? 's' : ''}`
                    : 'None detected'
                }
                color={
                  (audit.cannibalization_issues.total_warnings || 0) > 0
                    ? '#f59e0b'
                    : '#22c55e'
                }
              />
            )}
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {audit.total_pages_crawled !== undefined &&
                `${audit.total_pages_crawled} page${audit.total_pages_crawled !== 1 ? 's' : ''} crawled`}
            </Typography>
            {audit.website_url && (
              <Tooltip title={audit.website_url}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'default',
                  }}
                >
                  {audit.website_url.replace(/^https?:\/\//, '')}
                </Typography>
              </Tooltip>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default ContentGuardianCard;
