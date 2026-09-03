import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Warning from '@mui/icons-material/Warning';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Refresh from '@mui/icons-material/Refresh';
import MoreVert from '@mui/icons-material/MoreVert';
import Dashboard from '@mui/icons-material/Dashboard';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import { useUser } from '@clerk/clerk-react';
import { apiClient } from '../../api/client';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { usePriority2Alerts } from '../../hooks/usePriority2Alerts';
import Priority2AlertBanner from './Priority2AlertBanner';
import { UsagePeriodSelector } from './UsagePeriodSelector';
import { userBadgeSectionHeaderOnlyLabelSx } from './userBadgeMenuStyles';

interface UsageStats {
  total_calls: number;
  total_cost: number;
  usage_status: string;
  provider_breakdown: Record<string, {
    calls: number;
    tokens: number;
    cost: number;
  }>;
  billing_period?: string;
}

interface UsageLimits {
  limits: {
    ai_text_generation_calls: number;
    gemini_calls: number;
    openai_calls: number;
    anthropic_calls: number;
    mistral_calls: number;
    tavily_calls: number;
    serper_calls: number;
    metaphor_calls: number;
    exa_calls: number;
    firecrawl_calls: number;
    stability_calls: number;
    video_calls: number;
    image_edit_calls: number;
    audio_calls: number;
    wavespeed_calls: number;
    monthly_cost: number;
  };
}

interface DashboardData {
  total_usage: UsageStats;
  current_period_usage: UsageStats;
  limits: UsageLimits;
  projections: {
    projected_monthly_cost: number;
    cost_limit: number;
    projected_usage_percentage: number;
  };
  summary: {
    total_api_calls_this_month: number;
    total_cost_this_month: number;
    usage_status: string;
    unread_alerts: number;
  };
  trends?: { periods: string[] };
}

interface UsageDashboardProps {
  compact?: boolean;
  showFullDashboard?: boolean;
  /** Renders Usage Statistics header row with period picker aligned right (UserBadge menu). */
  menuSection?: boolean;
}

const UsageDashboard: React.FC<UsageDashboardProps> = ({ 
  compact = true, 
  showFullDashboard = false,
  menuSection = false,
}) => {
  const { subscription } = useSubscription();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);

  const { user } = useUser();
  const userId = localStorage.getItem('user_id') || user?.id;

  // Priority 2 Alerts - automatically appears in all tool headers
  const { alerts: priority2Alerts, dismissAlert: dismissPriority2Alert } = usePriority2Alerts({
    userId: userId || undefined,
    enabled: !!userId && subscription?.active,
    checkInterval: 120000, // Check every 2 minutes
  });

  const fetchUsageData = useCallback(async (period?: string, silent = false) => {
    if (!userId) return;
    
    // Don't block UI for silent background refreshes (menu open, visibility change)
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const url = period 
        ? `/api/subscription/dashboard/${userId}?billing_period=${period}`
        : `/api/subscription/dashboard/${userId}`;
        
      const response = await apiClient.get<any>(url);
      
      if (response.data && response.data.success) {
        setDashboardData(response.data.data);
        setLastUpdated(new Date());
        
        // Extract available periods from trends if not set
        if (!period && response.data.data.trends?.periods) {
          setAvailablePeriods(response.data.data.trends.periods);
          // Set current period if not selected
          if (!selectedPeriod) {
            const current = new Date().toISOString().slice(0, 7); // YYYY-MM
            setSelectedPeriod(current);
          }
        }
      } else {
        throw new Error(response.data?.error || 'Failed to fetch usage data');
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Error fetching usage data:', err);
        setError(err.message || 'Failed to load usage statistics');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [userId]);

  const handlePeriodChange = (event: SelectChangeEvent) => {
    const period = event.target.value;
    setSelectedPeriod(period);
    fetchUsageData(period);
  };

  useEffect(() => {
    // Initial fetch
    if (userId) {
      fetchUsageData();
    }
  }, [userId, fetchUsageData]);

  // Refresh on visibility change (user returns to tab) - only if data is stale (>60s old)
  useEffect(() => {
    const STALE_THRESHOLD_MS = 60000; // 60 seconds
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userId && lastUpdated) {
        const ageMs = Date.now() - lastUpdated.getTime();
        if (ageMs > STALE_THRESHOLD_MS) {
          fetchUsageData(selectedPeriod, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, fetchUsageData, selectedPeriod, lastUpdated]);

  const handleRefresh = () => {
    fetchUsageData(selectedPeriod);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    // Show cached data immediately, don't wait for fetch
    // Data will refresh when user clicks the manual refresh button
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewFullDashboard = () => {
    handleMenuClose();
    window.location.href = '/dashboard';
  };

  const getUsageColor = (current: number, max: number) => {
    if (max === 0) return '#9ca3af';
    const percentage = (current / max) * 100;
    if (percentage >= 100) return '#dc2626';
    if (percentage >= 80) return '#ea580c';
    return '#16a34a';
  };

  const getProviderDisplayName = (provider: string) => {
    // Map internal provider names to display names
    const displayNames: Record<string, string> = {
      'gemini': 'Google Gemini',
      'openai': 'OpenAI GPT-4',
      'anthropic': 'Anthropic Claude',
      'mistral': 'HuggingFace (Mistral)',
      'tavily': 'Tavily Search',
      'serper': 'Serper Google',
      'metaphor': 'Exa Search', // Metaphor is now Exa
      'exa': 'Exa Search',
      'firecrawl': 'Firecrawl',
      'stability': 'Stability AI',
      'video': 'Video Gen',
      'audio': 'Audio Gen',
      'image_edit': 'Image Edit',
      'wavespeed': 'WaveSpeed'
    };
    return displayNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  if (!dashboardData && loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error && !dashboardData) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <IconButton size="small" onClick={() => fetchUsageData(selectedPeriod)}>
          <Refresh fontSize="small" />
        </IconButton>
      </Alert>
    );
  }

  if (!dashboardData) return null;

  const totalUsage = dashboardData.total_usage;
  const currentPeriodUsage = dashboardData.current_period_usage;
  const limits = dashboardData.limits;

  if (compact) {
    // Compact view - show key metrics as chips
    // Use total_usage for accurate cost (properly coerced from provider breakdown)
    // Fallback to summary if total_usage is not available
    const usageData = dashboardData?.total_usage || {
        total_calls: dashboardData?.summary?.total_api_calls_this_month || 0,
        total_cost: dashboardData?.summary?.total_cost_this_month || 0,
        usage_status: dashboardData?.summary?.usage_status || 'active',
        provider_breakdown: {}
    };
    
    const totalCalls = usageData.total_calls;
    const totalCost = usageData.total_cost;
    const monthlyLimit = dashboardData?.limits?.limits?.monthly_cost || 0;
    const usagePercentage = monthlyLimit > 0 ? (totalCost / monthlyLimit) * 100 : 0;

    // Use current_period provider_breakdown for budget bars
    const periodBreakdown = currentPeriodUsage?.provider_breakdown || {};
    const providerLimits = dashboardData?.limits?.limits || {};

    // Aggregate AI text calls (gemini + openai + anthropic + mistral) — from current period
    const aiCalls = (periodBreakdown.gemini?.calls || 0) + (periodBreakdown.openai?.calls || 0) + (periodBreakdown.anthropic?.calls || 0) + (periodBreakdown.mistral?.calls || 0) + (periodBreakdown.huggingface?.calls || 0) + (periodBreakdown.wavespeed?.calls || 0);
    const aiCallLimit = providerLimits.ai_text_generation_calls || providerLimits.gemini_calls || 0;

    // Image calls (stability + wavespeed image) — from current period
    const imageCalls = (periodBreakdown.stability?.calls || 0) + (periodBreakdown.image_edit?.calls || 0);
    const imageCallLimit = providerLimits.stability_calls || 0;

    // Audio calls — from current period
    const audioCalls = periodBreakdown.audio?.calls || 0;
    const audioCallLimit = providerLimits.audio_calls || 0;

    // Video calls — from current period
    const videoCalls = periodBreakdown.video?.calls || 0;
    const videoCallLimit = providerLimits.video_calls || 0;

    // Research calls (exa + tavily + serper + firecrawl) — from current period
    const researchCalls = (periodBreakdown.exa?.calls || 0) + (periodBreakdown.tavily?.calls || 0) + (periodBreakdown.serper?.calls || 0) + (periodBreakdown.firecrawl?.calls || 0);
    const researchCallLimit = (providerLimits.exa_calls || 0) + (providerLimits.tavily_calls || 0) + (providerLimits.serper_calls || 0) + (providerLimits.firecrawl_calls || 0);

    // WaveSpeed calls (all WaveSpeed API calls) — from current period
    const wavespeedCalls = periodBreakdown.wavespeed?.calls || 0;
    const wavespeedCallLimit = providerLimits.wavespeed_calls || 0;

    const formatLimit = (used: number, limit: number) => {
      return limit === 0 ? `${used} / ∞` : `${used} / ${limit}`;
    };

    const periodControl = (
      <UsagePeriodSelector
        selectedPeriod={selectedPeriod}
        availablePeriods={availablePeriods}
        onChange={handlePeriodChange}
        menuHeader={menuSection}
      />
    );

    return (
      <Box sx={{ width: '100%' }}>
        {priority2Alerts.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Priority2AlertBanner 
              alerts={[priority2Alerts[0]]} 
              onDismiss={() => dismissPriority2Alert(priority2Alerts[0].id)} 
            />
          </Box>
        )}

        {menuSection && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mb: 0.75,
              minWidth: 0,
            }}
          >
            <Typography variant="caption" sx={{ ...userBadgeSectionHeaderOnlyLabelSx, flexShrink: 0 }}>
              Usage Statistics
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0 }}>
              {periodControl}
              <Tooltip title="Usage options">
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  sx={{
                    p: 0.35,
                    color: '#6b7280',
                    '&:hover': { bgcolor: '#f3f4f6' },
                  }}
                >
                  <MoreVert sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
        
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: menuSection ? 2 : 1,
            flexWrap: 'wrap',
            width: menuSection ? '100%' : undefined,
            justifyContent: menuSection ? 'space-between' : 'flex-start',
          }}
        >
        
        {/* Month Selector for Compact View (inline unless menuSection) */}
        {!menuSection && availablePeriods.length > 1 && (
          <FormControl variant="standard" size="small" sx={{ minWidth: 100, mr: 1 }}>
            <Select
              value={selectedPeriod}
              onChange={handlePeriodChange}
              disableUnderline
              sx={{ 
                fontSize: '0.875rem', 
                fontWeight: 500,
                color: '#374151',
                '& .MuiSelect-select': { py: 0.5 }
              }}
              IconComponent={() => <CalendarMonth sx={{ fontSize: 16, color: '#6b7280', ml: 0.5 }} />}
            >
              {availablePeriods.map((period) => (
                <MenuItem key={period} value={period} dense>
                  {period}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Status Chip */}
        <Tooltip title={`Status: ${usageData.usage_status}`}>
          <Chip
            icon={usageData.usage_status === 'active' ? <CheckCircle sx={{ fontSize: 14 }} /> : <Warning sx={{ fontSize: 14 }} />}
            label={usageData.usage_status === 'limit_reached' ? 'Limit Reached' : 'Active'}
            size="small"
            color={usageData.usage_status === 'limit_reached' ? 'error' : usageData.usage_status === 'warning' ? 'warning' : 'success'}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Tooltip>

        {/* Monthly Cost */}
        <Tooltip title={`$${totalCost.toFixed(2)} of $${monthlyLimit} monthly limit`}>
          <Chip
            icon={<TrendingUp sx={{ fontSize: 14 }} />}
            label={`$${totalCost.toFixed(2)}`}
            size="small"
            variant="outlined"
            sx={{
              bgcolor: `${getUsageColor(totalCost, monthlyLimit)}10`,
              borderColor: `${getUsageColor(totalCost, monthlyLimit)}60`,
              color: getUsageColor(totalCost, monthlyLimit),
              fontWeight: 600,
              '& .MuiChip-icon': {
                color: getUsageColor(totalCost, monthlyLimit)
              }
            }}
          />
        </Tooltip>

        {/* Usage Progress */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 60 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(usagePercentage, 100)}
            sx={{
              width: 40,
              height: 6,
              borderRadius: 3,
              bgcolor: '#e5e7eb',
              '& .MuiLinearProgress-bar': {
                bgcolor: getUsageColor(totalCost, monthlyLimit),
                borderRadius: 3
              }
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151' }}>
            {usagePercentage.toFixed(0)}%
          </Typography>
        </Box>

        {/* Refresh Button */}
        <Tooltip title="Refresh usage data">
          <IconButton
            size="small"
            onClick={handleRefresh}
            disabled={loading}
            sx={{ 
              p: 0.5,
              color: '#6b7280',
              '&:hover': { bgcolor: '#f3f4f6' }
            }}
          >
            <Refresh sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {/* More Options — inline unless menuSection (shown in header row) */}
        {!menuSection && (
        <Tooltip title="Usage options">
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{ 
              p: 0.5,
              color: '#6b7280',
              '&:hover': { bgcolor: '#f3f4f6' }
            }}
          >
            <MoreVert sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        )}
        </Box>

        {/* Per-Provider Usage Breakdown */}
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {aiCallLimit > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', minWidth: 60 }}>AI Calls</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, ml: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={aiCallLimit > 0 ? Math.min((aiCalls / aiCallLimit) * 100, 100) : 0}
                  sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getUsageColor(aiCalls, aiCallLimit), borderRadius: 2 } }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: getUsageColor(aiCalls, aiCallLimit), minWidth: 55, textAlign: 'right' }}>
                  {formatLimit(aiCalls, aiCallLimit)}
                </Typography>
              </Box>
            </Box>
          )}
          {imageCallLimit > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', minWidth: 60 }}>Images</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, ml: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={imageCallLimit > 0 ? Math.min((imageCalls / imageCallLimit) * 100, 100) : 0}
                  sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getUsageColor(imageCalls, imageCallLimit), borderRadius: 2 } }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: getUsageColor(imageCalls, imageCallLimit), minWidth: 55, textAlign: 'right' }}>
                  {formatLimit(imageCalls, imageCallLimit)}
                </Typography>
              </Box>
            </Box>
          )}
          {audioCallLimit > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', minWidth: 60 }}>Audio</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, ml: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={audioCallLimit > 0 ? Math.min((audioCalls / audioCallLimit) * 100, 100) : 0}
                  sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getUsageColor(audioCalls, audioCallLimit), borderRadius: 2 } }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: getUsageColor(audioCalls, audioCallLimit), minWidth: 55, textAlign: 'right' }}>
                  {formatLimit(audioCalls, audioCallLimit)}
                </Typography>
              </Box>
            </Box>
          )}
          {videoCallLimit > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', minWidth: 60 }}>Video</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, ml: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={videoCallLimit > 0 ? Math.min((videoCalls / videoCallLimit) * 100, 100) : 0}
                  sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getUsageColor(videoCalls, videoCallLimit), borderRadius: 2 } }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: getUsageColor(videoCalls, videoCallLimit), minWidth: 55, textAlign: 'right' }}>
                  {formatLimit(videoCalls, videoCallLimit)}
                </Typography>
              </Box>
            </Box>
          )}
          {researchCallLimit > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', minWidth: 60 }}>Research</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, ml: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={researchCallLimit > 0 ? Math.min((researchCalls / researchCallLimit) * 100, 100) : 0}
                  sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getUsageColor(researchCalls, researchCallLimit), borderRadius: 2 } }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: getUsageColor(researchCalls, researchCallLimit), minWidth: 55, textAlign: 'right' }}>
                  {formatLimit(researchCalls, researchCallLimit)}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              bgcolor: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }
          }}
        >
          <MenuItem onClick={handleViewFullDashboard} sx={{ color: '#374151', '&:hover': { bgcolor: '#f3f4f6' } }}>
            <Dashboard sx={{ mr: 1, fontSize: 18 }} />
            View Full Dashboard
          </MenuItem>
          <MenuItem onClick={handleRefresh} sx={{ color: '#374151', '&:hover': { bgcolor: '#f3f4f6' } }}>
            <Refresh sx={{ mr: 1, fontSize: 18 }} />
            Refresh Data
          </MenuItem>
          {lastUpdated && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Typography>
            </Box>
          )}
        </Menu>
      </Box>
    );
  }

  // Full dashboard view (for dedicated usage page)
  const usageData = dashboardData?.total_usage || {
    total_calls: dashboardData?.summary?.total_api_calls_this_month || 0,
    total_cost: dashboardData?.summary?.total_cost_this_month || 0,
    provider_breakdown: {}
  };
  
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Usage Dashboard
        </Typography>
        
        {/* Month Selector for Full View */}
        {availablePeriods.length > 1 && (
          <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Billing Period</InputLabel>
            <Select
              value={selectedPeriod}
              onChange={handlePeriodChange}
              label="Billing Period"
              startAdornment={<CalendarMonth sx={{ fontSize: 18, mr: 1, color: 'action.active' }} />}
            >
              {availablePeriods.map((period) => (
                <MenuItem key={period} value={period}>
                  {period}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
        {/* Total Calls */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Total API Calls
          </Typography>
          <Typography variant="h4" color="primary">
            {usageData.total_calls.toLocaleString()}
          </Typography>
        </Box>

        {/* Total Cost */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Monthly Cost
          </Typography>
          <Typography variant="h4" color="secondary">
            ${usageData.total_cost.toFixed(2)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            of ${dashboardData?.limits?.limits?.monthly_cost || 0} limit
          </Typography>
        </Box>

        {/* Usage by Provider */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Usage by Provider
          </Typography>
          {Object.entries(usageData.provider_breakdown || {}).map(([provider, stats]) => (
            <Box key={provider} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                {getProviderDisplayName(provider)}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {(stats as any).calls?.toLocaleString() || 0}
              </Typography>
            </Box>
          ))}
          {Object.keys(usageData.provider_breakdown || {}).length === 0 && (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No usage this period
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default UsageDashboard;
