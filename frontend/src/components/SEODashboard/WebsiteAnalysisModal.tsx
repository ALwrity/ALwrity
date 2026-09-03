/**
 * WebsiteAnalysisModal Component
 * Read-only modal that re-displays the saved onboarding Website Analysis
 * (brand style, guidelines, SEO audit, sitemap) in the SEO Dashboard.
 * The saved analysis is fetched lazily the first time the modal is opened.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Chip,
  Alert,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PaletteIcon from '@mui/icons-material/Palette';
import VerifiedIcon from '@mui/icons-material/Verified';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { seoDashboardAPI, SavedWebsiteAnalysis } from '../../api/seoDashboard';
import UnifiedAnalysisContainer from '../OnboardingWizard/WebsiteStep/components/UnifiedAnalysisContainer/index';
import { SiteHealthSummaryCard } from '../OnboardingWizard/WebsiteStep/SiteHealthSummaryCard';
import { ContentAuditSummaryCard } from '../OnboardingWizard/WebsiteStep/ContentAuditSummaryCard';
import { buildAnalysisDisplayModel, extractDomainName } from '../OnboardingWizard/WebsiteStep/utils/websiteUtils';

interface WebsiteAnalysisModalProps {
  open: boolean;
  onClose: () => void;
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) return 'Unknown date';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Unknown date';
  }
};

const WebsiteAnalysisModal: React.FC<WebsiteAnalysisModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const fetchedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<SavedWebsiteAnalysis | null>(null);
  const [mapped, setMapped] = useState<any>(null);
  const [domainName, setDomainName] = useState<string>('');

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await seoDashboardAPI.getSavedWebsiteAnalysis();
        if (res.success && res.analysis) {
          const saved = res.analysis;
          const name = extractDomainName(saved.website_url);
          setRow(saved);
          setDomainName(name);
          setMapped(buildAnalysisDisplayModel(saved));
        } else {
          setRow(null);
          setMapped(null);
          setError(res.error || 'No saved website analysis found.');
        }
      } catch (e) {
        console.error('WebsiteAnalysisModal: Failed to load saved analysis:', e);
        setRow(null);
        setMapped(null);
        setError('Failed to load your saved website analysis.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open]);

  const handleGoToOnboarding = () => {
    onClose();
    navigate('/onboarding');
  };

  const statusColor =
    row?.status === 'completed' ? 'success' : row?.status === 'failed' ? 'error' : 'warning';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      scroll="paper"
      PaperProps={{
        sx: {
          maxHeight: '92vh',
          bgcolor: '#f8fafc',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            flexShrink: 0,
          }}
        >
          <PaletteIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a202c' }}>
            Saved Website Analysis
          </Typography>
          <Typography variant="caption" sx={{ color: '#4a5568', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {domainName || row?.website_url || 'Your website'}
          </Typography>
        </Box>
        {row && (
          <>
            <Chip size="small" label={`Analyzed ${formatDate(row.analysis_date)}`} variant="outlined" />
            <Chip size="small" color={statusColor} label={(row.status || 'unknown').toUpperCase()} />
          </>
        )}
        <IconButton aria-label="Close" onClick={onClose} size="small" sx={{ color: '#4a5568' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#f8fafc' }}>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ color: '#4a5568' }}>
              Loading your saved website analysis...
            </Typography>
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ py: 4 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                No website analysis available yet
              </Typography>
              <Typography variant="body2">
                Complete the Website Analysis step during onboarding to unlock your brand voice,
                style guidelines, SEO audit, and sitemap insights here.
              </Typography>
            </Alert>
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              onClick={handleGoToOnboarding}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Go to Onboarding
            </Button>
          </Box>
        )}

        {!loading && mapped && row && (
          <>
            <UnifiedAnalysisContainer
              analysis={mapped}
              domainName={domainName}
              crawlResult={row.crawl_result}
              warning={row.warning_message || undefined}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 3 }}>
              <ContentAuditSummaryCard brandAnalysis={mapped.brand_analysis} />
              <SiteHealthSummaryCard seoAudit={mapped.seo_audit} />
            </Box>
          </>
        )}
      </DialogContent>

      {!loading && mapped && row && (
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc' }}>
          <Tooltip title={`Analysis details for ${row.website_url}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#4a5568' }}>
              <VerifiedIcon sx={{ fontSize: 16, color: '#10b981' }} />
              <Typography variant="caption">Completed by ALwrity AI</Typography>
            </Box>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', gap: 2, color: '#4a5568' }}>
            <Tooltip title="Style guidelines & brand voice">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PaletteIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption">Style</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Technical SEO audit results">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AnalyticsIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption">SEO</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Sitemap analysis">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LinkIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption">Sitemap</Typography>
              </Box>
            </Tooltip>
          </Box>
          <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default WebsiteAnalysisModal;
