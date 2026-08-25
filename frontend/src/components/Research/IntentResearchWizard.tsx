/**
 * IntentResearchWizard Component
 * 
 * A new research experience that:
 * 1. Understands what the user wants to accomplish
 * 2. Shows quick options for confirmation
 * 3. Executes targeted research
 * 4. Displays results organized by deliverable type
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BrainIcon from '@mui/icons-material/Psychology';
import CheckIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendIcon from '@mui/icons-material/TrendingUp';
import QuoteIcon from '@mui/icons-material/FormatQuote';
import StatsIcon from '@mui/icons-material/BarChart';
import CaseStudyIcon from '@mui/icons-material/School';
import CompareIcon from '@mui/icons-material/Compare';
import IdeaIcon from '@mui/icons-material/Lightbulb';
import PlayIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenIcon from '@mui/icons-material/OpenInNew';
import { useIntentResearch } from './hooks/useIntentResearch';
import {
  ResearchIntent,
  QuickOption,
  IntentDrivenResearchResponse,
  DELIVERABLE_DISPLAY,
  PURPOSE_DISPLAY,
  DEPTH_DISPLAY,
  ExpectedDeliverable,
} from './types/intent.types';

interface IntentResearchWizardProps {
  onComplete?: (result: IntentDrivenResearchResponse) => void;
  onCancel?: () => void;
  initialInput?: string;
  showQuickMode?: boolean;
}

export const IntentResearchWizard: React.FC<IntentResearchWizardProps> = ({
  onComplete,
  onCancel,
  initialInput = '',
  showQuickMode = true,
}) => {
  const [inputValue, setInputValue] = useState(initialInput);
  const [resultTab, setResultTab] = useState(0);
  
  const {
    state,
    isLoading,
    hasIntent,
    hasResults,
    needsConfirmation,
    confidence,
    analyzeIntent,
    updateQuickOption,
    toggleQuerySelection,
    confirmAndExecute,
    quickResearch,
    reset,
  } = useIntentResearch({
    usePersona: true,
    useCompetitorData: true,
    autoExecute: false,
  });

  // Handle result completion
  useEffect(() => {
    if (hasResults && state.result && onComplete) {
      onComplete(state.result);
    }
  }, [hasResults, state.result, onComplete]);

  // Handle input submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    await analyzeIntent(inputValue);
  };

  // Handle quick research
  const handleQuickResearch = async () => {
    if (!inputValue.trim()) return;
    await quickResearch(inputValue);
  };

  // Handle confirmation and execution
  const handleConfirmAndExecute = async () => {
    const result = await confirmAndExecute();
    if (result && onComplete) {
      onComplete(result);
    }
  };

  // Render input form
  const renderInputForm = () => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        color: 'white',
      }}
    >
      <Typography variant="h5" fontWeight={600} mb={1}>
        🔍 What do you want to research?
      </Typography>
      <Typography variant="body2" mb={3} sx={{ opacity: 0.9 }}>
        Enter your topic, question, or describe what you need. AI will understand your intent
        and find exactly what you need.
      </Typography>
      
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder='Examples:&#10;• "AI trends in healthcare 2025"&#10;• "What are the best project management tools?"&#10;• "I need to write a blog about sustainable fashion for millennials"'
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.95)',
              borderRadius: 2,
            },
          }}
          disabled={isLoading}
        />
        
        <Box display="flex" gap={2} justifyContent="flex-end">
          {showQuickMode && (
            <Button
              variant="outlined"
              onClick={handleQuickResearch}
              disabled={isLoading || !inputValue.trim()}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Quick Research
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <BrainIcon />}
            disabled={isLoading || !inputValue.trim()}
            sx={{
              backgroundColor: 'white',
              color: '#667eea',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
            }}
          >
            {state.isAnalyzing ? 'Analyzing...' : 'Analyze Intent'}
          </Button>
        </Box>
      </form>
    </Paper>
  );

  // Render intent confirmation
  const renderIntentConfirmation = () => {
    if (!state.intent) return null;

    return (
      <Paper elevation={0} sx={{ p: 3, mt: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <BrainIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            AI Understood Your Research
          </Typography>
          <Chip
            size="small"
            label={`${Math.round(confidence * 100)}% confident`}
            color={confidence > 0.8 ? 'success' : confidence > 0.6 ? 'warning' : 'error'}
          />
        </Box>

        {/* Analysis Summary */}
        <Typography variant="body1" color="text.secondary" mb={3}>
          {state.analysisSummary}
        </Typography>

        {/* Primary Question */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography fontWeight={500}>
            Main Question: {state.intent.primary_question}
          </Typography>
        </Alert>

        {/* Quick Options */}
        <Grid container spacing={2} mb={3}>
          {state.quickOptions.map((option) => (
            <Grid item xs={12} sm={6} key={option.id}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {option.label}
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {Array.isArray(option.display) 
                      ? option.display.slice(0, 3).join(', ') 
                      : option.display}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Expected Deliverables */}
        <Typography variant="subtitle2" gutterBottom>
          What I'll find for you:
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
          {state.intent.expected_deliverables.map((d) => (
            <Chip
              key={d}
              label={DELIVERABLE_DISPLAY[d as ExpectedDeliverable] || d}
              color="primary"
              variant="outlined"
              size="small"
              icon={getDeliverableIcon(d)}
            />
          ))}
        </Box>

        {/* Suggested Queries (collapsible) */}
        <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">
              Research Queries ({state.suggestedQueries.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {state.suggestedQueries.map((query, idx) => (
                <ListItem
                  key={idx}
                  button
                  onClick={() => toggleQuerySelection(query)}
                  selected={state.selectedQueries.some(q => q.query === query.query)}
                >
                  <ListItemIcon>
                    <Chip
                      size="small"
                      label={query.provider.toUpperCase()}
                      color={query.provider === 'exa' ? 'primary' : 'secondary'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={query.query}
                    secondary={`Finding: ${query.expected_results}`}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Action Buttons */}
        <Box display="flex" gap={2} justifyContent="flex-end" mt={3}>
          <Button variant="outlined" onClick={reset}>
            Start Over
          </Button>
          <Button
            variant="contained"
            startIcon={state.isResearching ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
            onClick={handleConfirmAndExecute}
            disabled={state.isResearching}
          >
            {state.isResearching ? 'Researching...' : 'Start Research'}
          </Button>
        </Box>
      </Paper>
    );
  };

  // Render results
  const renderResults = () => {
    if (!state.result) return null;

    const result = state.result;

    // Available tabs based on what we have
    const tabs = [
      { id: 'summary', label: 'Summary', count: 0 },
      { id: 'statistics', label: 'Statistics', count: result.statistics.length },
      { id: 'quotes', label: 'Expert Quotes', count: result.expert_quotes.length },
      { id: 'case_studies', label: 'Case Studies', count: result.case_studies.length },
      { id: 'trends', label: 'Trends', count: result.trends.length },
      { id: 'sources', label: 'Sources', count: result.sources.length },
    ].filter(t => t.id === 'summary' || t.id === 'sources' || t.count > 0);

    return (
      <Paper elevation={0} sx={{ mt: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <CheckIcon color="success" />
            <Typography variant="h6" fontWeight={600}>
              Research Complete
            </Typography>
            <Chip
              size="small"
              label={`${result.sources.length} sources`}
              color="primary"
              variant="outlined"
            />
          </Box>

          {/* Executive Summary */}
          <Typography variant="body1" color="text.secondary">
            {result.executive_summary}
          </Typography>
        </Box>

        {/* Tabs */}
        <Tabs
          value={resultTab}
          onChange={(_, v) => setResultTab(v)}
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {tabs.map((tab, idx) => (
            <Tab
              key={tab.id}
              label={
                <Box display="flex" alignItems="center" gap={0.5}>
                  {tab.label}
                  {tab.count > 0 && (
                    <Chip size="small" label={tab.count} color="primary" sx={{ height: 20 }} />
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* Summary Tab */}
          {tabs[resultTab]?.id === 'summary' && (
            <Box>
              {/* Primary Answer */}
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Answer to your question:
                </Typography>
                <Typography>{result.primary_answer}</Typography>
              </Alert>

              {/* Key Takeaways */}
              {result.key_takeaways.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Key Takeaways
                  </Typography>
                  <List dense>
                    {result.key_takeaways.map((takeaway, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <IdeaIcon color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={takeaway} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Best Practices */}
              {result.best_practices.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Best Practices
                  </Typography>
                  <List dense>
                    {result.best_practices.map((bp, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <CheckIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={bp} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Suggested Outline */}
              {result.suggested_outline.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Suggested Content Outline
                  </Typography>
                  <List dense>
                    {result.suggested_outline.map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}

          {/* Statistics Tab */}
          {tabs[resultTab]?.id === 'statistics' && (
            <Grid container spacing={2}>
              {result.statistics.map((stat, idx) => (
                <Grid item xs={12} md={6} key={idx}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="flex-start" gap={1}>
                        <StatsIcon color="primary" />
                        <Box flex={1}>
                          <Typography variant="body1" fontWeight={500}>
                            {stat.statistic}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stat.context}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            <Link href={stat.url} target="_blank" rel="noopener" variant="caption">
                              {stat.source} <OpenIcon sx={{ fontSize: 12 }} />
                            </Link>
                            <Chip
                              size="small"
                              label={`${Math.round(stat.credibility * 100)}% credible`}
                              color={stat.credibility > 0.8 ? 'success' : 'warning'}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Expert Quotes Tab */}
          {tabs[resultTab]?.id === 'quotes' && (
            <Grid container spacing={2}>
              {result.expert_quotes.map((quote, idx) => (
                <Grid item xs={12} key={idx}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" gap={2}>
                        <QuoteIcon color="primary" sx={{ fontSize: 40 }} />
                        <Box>
                          <Typography variant="body1" fontStyle="italic" mb={1}>
                            "{quote.quote}"
                          </Typography>
                          <Typography variant="subtitle2">
                            — {quote.speaker}
                            {quote.title && `, ${quote.title}`}
                            {quote.organization && ` at ${quote.organization}`}
                          </Typography>
                          <Link href={quote.url} target="_blank" rel="noopener" variant="caption">
                            Source: {quote.source} <OpenIcon sx={{ fontSize: 12 }} />
                          </Link>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Case Studies Tab */}
          {tabs[resultTab]?.id === 'case_studies' && (
            <Grid container spacing={2}>
              {result.case_studies.map((cs, idx) => (
                <Grid item xs={12} key={idx}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {cs.title}
                      </Typography>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        {cs.organization}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Challenge
                          </Typography>
                          <Typography variant="body2">{cs.challenge}</Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Solution
                          </Typography>
                          <Typography variant="body2">{cs.solution}</Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Outcome
                          </Typography>
                          <Typography variant="body2">{cs.outcome}</Typography>
                        </Grid>
                      </Grid>
                      {cs.key_metrics.length > 0 && (
                        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                          {cs.key_metrics.map((metric, i) => (
                            <Chip key={i} label={metric} size="small" color="success" variant="outlined" />
                          ))}
                        </Box>
                      )}
                      <Box mt={2}>
                        <Link href={cs.url} target="_blank" rel="noopener" variant="caption">
                          Read full case study <OpenIcon sx={{ fontSize: 12 }} />
                        </Link>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Trends Tab */}
          {tabs[resultTab]?.id === 'trends' && (
            <Grid container spacing={2}>
              {result.trends.map((trend, idx) => (
                <Grid item xs={12} md={6} key={idx}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <TrendIcon
                          color={trend.direction === 'growing' ? 'success' : trend.direction === 'declining' ? 'error' : 'info'}
                        />
                        <Typography variant="subtitle1" fontWeight={500}>
                          {trend.trend}
                        </Typography>
                        <Chip
                          size="small"
                          label={trend.direction}
                          color={trend.direction === 'growing' ? 'success' : trend.direction === 'declining' ? 'error' : 'info'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={1}>
                        {trend.impact}
                      </Typography>
                      {trend.timeline && (
                        <Typography variant="caption" color="text.secondary">
                          Timeline: {trend.timeline}
                        </Typography>
                      )}
                      <Box mt={1}>
                        <Typography variant="caption" color="text.secondary">
                          Evidence:
                        </Typography>
                        <List dense>
                          {trend.evidence.slice(0, 3).map((e, i) => (
                            <ListItem key={i} sx={{ py: 0 }}>
                              <ListItemText primary={e} primaryTypographyProps={{ variant: 'caption' }} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Sources Tab */}
          {tabs[resultTab]?.id === 'sources' && (
            <List>
              {result.sources.map((source, idx) => (
                <ListItem
                  key={idx}
                  component="a"
                  href={source.url}
                  target="_blank"
                  rel="noopener"
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <ListItemText
                    primary={source.title}
                    secondary={
                      <>
                        {source.excerpt && <Typography variant="caption">{source.excerpt}</Typography>}
                        <Box display="flex" gap={1} mt={0.5}>
                          {source.content_type && (
                            <Chip size="small" label={source.content_type} variant="outlined" />
                          )}
                          <Chip
                            size="small"
                            label={`${Math.round(source.relevance_score * 100)}% relevant`}
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={`${Math.round(source.credibility_score * 100)}% credible`}
                            color={source.credibility_score > 0.8 ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        </Box>
                      </>
                    }
                  />
                  <OpenIcon color="action" />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Button startIcon={<RefreshIcon />} onClick={reset}>
            New Research
          </Button>
          
          {result.gaps_identified.length > 0 && (
            <Tooltip
              title={
                <Box>
                  <Typography variant="caption" fontWeight={600}>Gaps Identified:</Typography>
                  <List dense>
                    {result.gaps_identified.map((gap, i) => (
                      <ListItem key={i} sx={{ py: 0 }}>
                        <ListItemText primary={gap} primaryTypographyProps={{ variant: 'caption' }} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              }
            >
              <Chip
                icon={<InfoIcon />}
                label={`${result.gaps_identified.length} gaps identified`}
                color="warning"
                variant="outlined"
                size="small"
              />
            </Tooltip>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      {/* Error display */}
      {state.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => reset()}>
          {state.error}
        </Alert>
      )}

      {/* Input Form (always visible unless we have results) */}
      {!hasResults && renderInputForm()}

      {/* Intent Confirmation */}
      {hasIntent && !hasResults && !state.isResearching && renderIntentConfirmation()}

      {/* Loading state during research */}
      {state.isResearching && (
        <Box display="flex" flexDirection="column" alignItems="center" py={4}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">Executing Research...</Typography>
          <Typography color="text.secondary">
            Finding exactly what you need...
          </Typography>
        </Box>
      )}

      {/* Results */}
      {hasResults && renderResults()}
    </Box>
  );
};

// Helper function to get icon for deliverable
const getDeliverableIcon = (deliverable: string): React.ReactElement | undefined => {
  const iconMap: Record<string, React.ReactElement> = {
    key_statistics: <StatsIcon fontSize="small" />,
    expert_quotes: <QuoteIcon fontSize="small" />,
    case_studies: <CaseStudyIcon fontSize="small" />,
    trends: <TrendIcon fontSize="small" />,
    comparisons: <CompareIcon fontSize="small" />,
    best_practices: <CheckIcon fontSize="small" />,
    step_by_step: <PlayIcon fontSize="small" />,
    examples: <IdeaIcon fontSize="small" />,
    predictions: <TrendIcon fontSize="small" />,
  };
  return iconMap[deliverable];
};

export default IntentResearchWizard;
