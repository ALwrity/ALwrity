import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Chip, 
  LinearProgress, 
  IconButton, 
  Tooltip, 
  Stack
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LanguageIcon from '@mui/icons-material/Language';
import HelpIcon from '@mui/icons-material/Help';
import { motion, AnimatePresence } from 'framer-motion';

// Shared styled components
import { GlassCard } from '../../shared/styled';

// Types
import { SEOAnalyzerPanelProps } from '../../shared/types';

// Utilities
import { 
  getStatusColor, 
  getStatusIcon, 
  categorizeAnalysisData 
} from './seoUtils';

// Components
import CriticalIssueCard from './CriticalIssueCard';
import AnalysisTabs from './AnalysisTabs';
import IssueDetailsDialog from './IssueDetailsDialog';
import AnalysisDetailsDialog from './AnalysisDetailsDialog';
import SEOAnalysisLoading from './SEOAnalysisLoading';
import SEOAnalysisError from './SEOAnalysisError';
import PageAuditList from './PageAuditList';

const SEOAnalyzerPanel: React.FC<SEOAnalyzerPanelProps> = ({
  analysisData,
  onRunAnalysis,
  loading,
  error
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showError, setShowError] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Debug logging
  console.log('SEOAnalyzerPanel received data:', {
    analysisData,
    loading,
    error,
    hasUrl: analysisData?.url,
    hasData: analysisData?.data,
    criticalIssues: analysisData?.critical_issues?.length
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleIssueClick = (issue: any) => {
    setSelectedIssue(issue);
    setShowIssueDialog(true);
  };

  const handleAIAction = (action: string, issue: any) => {
    // This would integrate with AI to generate specific fixes
    console.log(`AI Action: ${action} for issue:`, issue);
    // In a real implementation, this would call an AI service
  };

  const categorizedData = categorizeAnalysisData(analysisData);

  return (
    <>
      <GlassCard sx={{ p: 3, mb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 600 }}>
            🔍 AI-Powered SEO Analysis
          </Typography>
          
          <Stack direction="row" spacing={2}>
            {/* Index Entire Website Button - Region 1 */}
            <Tooltip 
              title="Pro Feature: Index your entire website with AI-powered analysis. Get comprehensive insights across all pages, blog posts, and content. Coming soon!"
              placement="top"
            >
              <span>
                <Button
                  variant="outlined"
                  startIcon={<LanguageIcon />}
                  disabled
                  sx={{
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)'
                    },
                    '&.Mui-disabled': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }
                  }}
                >
                  Index Entire Website
                </Button>
              </span>
            </Tooltip>
            
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={onRunAnalysis}
              disabled={loading}
              sx={{
                background: 'linear-gradient(45deg, #2196F3, #21CBF3)',
                color: 'white',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976D2, #1E88E5)',
                },
              }}
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Stack>
        </Box>

        {/* Error Display */}
        <SEOAnalysisError 
          error={error}
          showError={showError}
          onCloseError={() => setShowError(false)}
        />

        {/* Loading State */}
        <SEOAnalysisLoading loading={loading} />

        {/* Analysis Results */}
        <AnimatePresence>
          {analysisData && analysisData.url && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Grid container spacing={3}>
                {/* Left Column - Overall Score & Critical Issues */}
                <Grid item xs={12} md={4}>
                  {/* Overall Score - Region 2 */}
                  <Box sx={{ mb: 3, p: 2, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {getStatusIcon(analysisData.health_status)}
                      <Typography variant="h6" sx={{ color: 'white', ml: 1, fontWeight: 600 }}>
                        Overall Score: {analysisData.overall_score}/100
                      </Typography>
                      <Chip
                        label={analysisData.health_status.replace('_', ' ').toUpperCase()}
                        sx={{
                          ml: 2,
                          backgroundColor: getStatusColor(analysisData.health_status),
                          color: 'white',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                    
                    <LinearProgress
                      variant="determinate"
                      value={analysisData.overall_score}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getStatusColor(analysisData.health_status),
                          borderRadius: 4,
                        },
                      }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Analyzed: {analysisData.url}
                      </Typography>
                      
                      <Tooltip title="View detailed information about all SEO tests performed">
                        <IconButton
                          size="small"
                          onClick={() => setShowDetailsDialog(true)}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { color: 'white' }
                          }}
                        >
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Critical Issues Summary - Region 4 */}
                  {analysisData.critical_issues && analysisData.critical_issues.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" sx={{ color: '#D32F2F', fontWeight: 600, mb: 2 }}>
                        🚨 Critical Issues ({analysisData.critical_issues.length})
                      </Typography>
                      {analysisData.critical_issues.slice(0, 2).map((issue, index) => (
                        <CriticalIssueCard
                          key={index}
                          issue={issue}
                          index={index}
                          onClick={handleIssueClick}
                          onAIAction={handleAIAction}
                        />
                      ))}
                    </Box>
                  )}
                </Grid>

                {/* Right Column - Detailed Analysis Tabs (Area A) */}
                <Grid item xs={12} md={8}>
                  <AnalysisTabs
                    categorizedData={categorizedData}
                    expandedCategories={expandedCategories}
                    onToggleCategory={toggleCategory}
                    onIssueClick={handleIssueClick}
                    onAIAction={handleAIAction}
                  />
                </Grid>
              </Grid>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Full Site Page List */}
      <PageAuditList />

      {/* Dialogs */}
      <IssueDetailsDialog
        open={showIssueDialog}
        issue={selectedIssue}
        onClose={() => setShowIssueDialog(false)}
        onAIAction={handleAIAction}
      />

      <AnalysisDetailsDialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
      />
    </>
  );
};

export default SEOAnalyzerPanel; 