import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
import { contentPlanningApi } from '../../../services/contentPlanningApi';

const RefineAnalysisTab: React.FC = () => {
  const { 
    gapAnalyses, 
    loading, 
    error,
    loadGapAnalyses,
    analyzeContentGaps,
    updateGapAnalyses
  } = useContentPlanningStore();
  
  const [analysisForm, setAnalysisForm] = useState({
    website_url: '',
    competitors: [] as string[],
    keywords: [] as string[]
  });
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    loadGapAnalysisData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGapAnalysisData = async () => {
    try {
      setDataLoading(true);
      const response = await contentPlanningApi.getGapAnalysesSafe();
      
      console.log('Gap Analysis Response:', response);
      
      // Transform the backend response to match frontend expectations
      if (response && response.gap_analyses) {
        const transformedAnalyses = response.gap_analyses.map((analysis: any, index: number) => ({
          id: analysis.id || `analysis_${index}`,
          website_url: analysis.website_url || 'example.com',
          competitors: analysis.competitors || [],
          keywords: analysis.keywords || [],
          gaps: analysis.gaps || [],
          recommendations: analysis.recommendations || [],
          created_at: analysis.created_at || new Date().toISOString()
        }));
        
        console.log('Transformed Analyses:', transformedAnalyses);
        
        // Update the store with transformed data
        updateGapAnalyses(transformedAnalyses);
      } else {
        console.log('No gap analyses found in response');
        updateGapAnalyses([]);
      }
    } catch (error) {
      console.error('Error loading gap analysis data:', error);
      updateGapAnalyses([]);
    } finally {
      setDataLoading(false);
    }
  };

  const handleAddCompetitor = () => {
    if (newCompetitor.trim() && !analysisForm.competitors.includes(newCompetitor.trim())) {
      setAnalysisForm(prev => ({
        ...prev,
        competitors: [...prev.competitors, newCompetitor.trim()]
      }));
      setNewCompetitor('');
    }
  };

  const handleRemoveCompetitor = (competitorToRemove: string) => {
    setAnalysisForm(prev => ({
      ...prev,
      competitors: prev.competitors.filter(comp => comp !== competitorToRemove)
    }));
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !analysisForm.keywords.includes(newKeyword.trim())) {
      setAnalysisForm(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setAnalysisForm(prev => ({
      ...prev,
      keywords: prev.keywords.filter(keyword => keyword !== keywordToRemove)
    }));
  };

  const handleRunAnalysis = async () => {
    if (!analysisForm.website_url) {
      return;
    }

    try {
      setDataLoading(true);
      
      await analyzeContentGaps({
        website_url: analysisForm.website_url,
        competitors: analysisForm.competitors,
        keywords: analysisForm.keywords
      });

      // Reload data after analysis
      await loadGapAnalyses();
      
      // Reset form
      setAnalysisForm({
        website_url: '',
        competitors: [],
        keywords: []
      });
    } catch (error) {
      console.error('Error running gap analysis:', error);
    } finally {
      setDataLoading(false);
    }
  };

  // Ensure gapAnalyses is always an array and transform the data structure
  const safeGapAnalyses = Array.isArray(gapAnalyses) ? gapAnalyses : [];
  
  // Transform backend data structure to frontend expected structure
  const transformedGapAnalyses = safeGapAnalyses.map((analysis, index) => {
    // Handle the actual backend structure: { recommendations: [...] }
    const recommendations = analysis.recommendations || [];
    
    return {
      id: analysis.id || `analysis-${index}`,
      website_url: analysis.website_url || 'Unknown Website',
      competitors: analysis.competitors || [],
      keywords: analysis.keywords || [],
      recommendations: recommendations,
      created_at: analysis.created_at || new Date().toISOString(),
      // Extract gaps from recommendations if available
      gaps: recommendations.length > 0 ? 
        recommendations.filter((rec: any) => rec.type === 'gap').map((rec: any) => rec.title || rec.description || 'Content gap identified') : 
        []
    };
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Refine Analysis
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Analysis Setup */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <SearchIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Analysis Setup
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <TextField
              fullWidth
              label="Website URL"
              value={analysisForm.website_url}
              onChange={(e) => setAnalysisForm(prev => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://example.com"
              sx={{ mb: 2 }}
            />
            
            <Typography variant="subtitle2" gutterBottom>
              Competitors
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Add Competitor"
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                placeholder="competitor.com"
                onKeyPress={(e) => e.key === 'Enter' && handleAddCompetitor()}
              />
              <Button
                variant="outlined"
                onClick={handleAddCompetitor}
                disabled={!newCompetitor.trim()}
              >
                <AddIcon />
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {analysisForm.competitors.map((competitor, index) => (
                <Chip
                  key={index}
                  label={competitor}
                  onDelete={() => handleRemoveCompetitor(competitor)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
            
            <Typography variant="subtitle2" gutterBottom>
              Keywords
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Add Keyword"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="target keyword"
                onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
              />
              <Button
                variant="outlined"
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
              >
                <AddIcon />
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {analysisForm.keywords.map((keyword, index) => (
                <Chip
                  key={index}
                  label={keyword}
                  onDelete={() => handleRemoveKeyword(keyword)}
                  color="secondary"
                  variant="outlined"
                />
              ))}
            </Box>
            
            <Button
              variant="contained"
              fullWidth
              onClick={handleRunAnalysis}
              disabled={loading || dataLoading || !analysisForm.website_url}
              startIcon={<AssessmentIcon />}
            >
              {loading || dataLoading ? 'Running Analysis...' : 'Run Gap Analysis'}
            </Button>
          </Paper>
        </Grid>

        {/* Content Gaps */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Content Gaps
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {dataLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : transformedGapAnalyses.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No previous analyses found. Run your first analysis to see results here.
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {transformedGapAnalyses.map((analysis) => (
                  <Grid item xs={12} md={6} lg={4} key={analysis.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" component="div">
                          {analysis.website_url}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {new Date(analysis.created_at).toLocaleDateString()}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          <Chip
                            label={`${analysis.competitors?.length || 0} competitors`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={`${analysis.keywords?.length || 0} keywords`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={`${analysis.gaps?.length || 0} gaps found`}
                            size="small"
                            color="warning"
                          />
                          <Chip
                            label={`${analysis.recommendations?.length || 0} recommendations`}
                            size="small"
                            color="success"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>

          {/* Detailed Analysis Results */}
          {transformedGapAnalyses.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Detailed Analysis Results
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {transformedGapAnalyses.map((analysis, index) => (
                <Box key={index} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Analysis for {analysis.website_url}
                  </Typography>
                  
                  {analysis.gaps && analysis.gaps.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Identified Content Gaps:
                      </Typography>
                      <List dense>
                        {analysis.gaps.map((gap, gapIndex) => (
                          <ListItem key={gapIndex}>
                            <ListItemIcon>
                              <WarningIcon color="warning" />
                            </ListItemIcon>
                            <ListItemText primary={gap} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  
                  {analysis.recommendations && analysis.recommendations.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Recommendations:
                      </Typography>
                      <List dense>
                        {analysis.recommendations.map((rec, recIndex) => (
                          <ListItem key={recIndex}>
                            <ListItemIcon>
                              <CheckCircleIcon color="success" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={rec.title || rec.description || 'Recommendation'} 
                              secondary={rec.description}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default RefineAnalysisTab; 