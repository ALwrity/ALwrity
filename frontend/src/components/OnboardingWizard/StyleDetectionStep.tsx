import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import { longRunningApiClient } from '../../api/client';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useOnboardingStyles } from './common/useOnboardingStyles';

interface StyleDetectionStepProps {
  onContinue: () => void;
}

interface StyleAnalysis {
  writing_style?: {
    tone: string;
    voice: string;
    complexity: string;
    engagement_level: string;
  };
  content_characteristics?: {
    sentence_structure: string;
    vocabulary_level: string;
    paragraph_organization: string;
    content_flow: string;
  };
  target_audience?: {
    demographics: string[];
    expertise_level: string;
    industry_focus: string;
    geographic_focus: string;
  };
  recommended_settings?: {
    writing_tone: string;
    target_audience: string;
    content_type: string;
    creativity_level: string;
    geographic_location: string;
  };
}

const StyleDetectionStep: React.FC<StyleDetectionStepProps> = ({ onContinue }) => {
  const classes = useOnboardingStyles();
  const [url, setUrl] = useState('');
  const [textSample, setTextSample] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');

  const handleAnalyze = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validate and fix URL format if using URL tab
      let requestUrl = url;
      if (activeTab === 'url') {
        const fixedUrl = fixUrlFormat(url);
        if (!fixedUrl) {
          setError('Please enter a valid website URL (starting with http:// or https://)');
          setLoading(false);
          return;
        }
        requestUrl = fixedUrl;
      }

      const requestData = {
        url: activeTab === 'url' ? requestUrl : undefined,
        text_sample: activeTab === 'text' ? textSample : undefined,
        include_patterns: true,
        include_guidelines: true
      };

      const response = await longRunningApiClient.post('/api/onboarding/style-detection/complete', requestData);

      if (response.data.success) {
        setAnalysis(response.data.style_analysis);
        setSuccess('Style analysis completed successfully!');
      } else {
        setError(response.data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Failed to analyze content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fixUrlFormat = (url: string): string | null => {
    if (!url) return null;
    
    // Remove leading/trailing whitespace
    let fixedUrl = url.trim();
    
    // Check if URL already has a protocol but is missing slashes
    if (fixedUrl.startsWith('https:/') && !fixedUrl.startsWith('https://')) {
      fixedUrl = fixedUrl.replace('https:/', 'https://');
    } else if (fixedUrl.startsWith('http:/') && !fixedUrl.startsWith('http://')) {
      fixedUrl = fixedUrl.replace('http:/', 'http://');
    }
    
    // Add protocol if missing
    if (!fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://')) {
      fixedUrl = 'https://' + fixedUrl;
    }
    
    // Fix missing slash after protocol
    if (fixedUrl.includes('://') && !fixedUrl.split('://')[1].startsWith('/')) {
      fixedUrl = fixedUrl.replace('://', ':///');
    }
    
    // Ensure only two slashes after protocol
    if (fixedUrl.includes(':///')) {
      fixedUrl = fixedUrl.replace(':///', '://');
    }
    
    // Basic URL validation
    try {
      new URL(fixedUrl);
      return fixedUrl;
    } catch {
      return null;
    }
  };

  const handleContinue = () => {
    if (analysis) {
      onContinue();
    } else {
      setError('Please complete style analysis before continuing');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderAnalysisSection = (title: string, data: any, icon: React.ReactNode) => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          {Object.entries(data).map(([key, value]) => (
            <Grid item xs={12} sm={6} key={key}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Typography variant="body2">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Box sx={classes.container}>
      <Typography variant="h4" gutterBottom sx={classes.headerTitle}>
        🎨 Style Detection
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Analyze your writing style to get personalized content generation recommendations.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Content Source
          </Typography>
          
          <Box mb={3}>
            <Button
              variant={activeTab === 'url' ? 'contained' : 'outlined'}
              onClick={() => setActiveTab('url')}
              sx={{ mr: 2 }}
            >
              Website URL
            </Button>
            <Button
              variant={activeTab === 'text' ? 'contained' : 'outlined'}
              onClick={() => setActiveTab('text')}
            >
              Text Sample
            </Button>
          </Box>

          {activeTab === 'url' ? (
            <TextField
              fullWidth
              label="Website URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              helperText="Enter your website URL to analyze your content style"
              margin="normal"
            />
          ) : (
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Text Sample"
              value={textSample}
              onChange={(e) => setTextSample(e.target.value)}
              placeholder="Paste your content samples here..."
              helperText="Provide 2-3 samples of your best content (min 50 characters)"
              margin="normal"
            />
          )}

          <Box mt={3}>
            <Button
              variant="contained"
              onClick={handleAnalyze}
              disabled={loading || (!url && !textSample)}
              startIcon={loading ? <CircularProgress size={20} /> : null}
              fullWidth
            >
              {loading ? 'Analyzing...' : 'Analyze Style'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}

      {analysis && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Style Analysis Results
            </Typography>
            
            {analysis.writing_style && renderAnalysisSection(
              'Writing Style',
              analysis.writing_style,
              <InfoIcon color="primary" />
            )}
            
            {analysis.content_characteristics && renderAnalysisSection(
              'Content Characteristics',
              analysis.content_characteristics,
              <InfoIcon color="secondary" />
            )}
            
            {analysis.target_audience && renderAnalysisSection(
              'Target Audience',
              analysis.target_audience,
              <InfoIcon color="success" />
            )}
            
            {analysis.recommended_settings && renderAnalysisSection(
              'Recommended Settings',
              analysis.recommended_settings,
              <CheckIcon color="primary" />
            )}
          </CardContent>
        </Card>
      )}

      <Box mt={3} display="flex" justifyContent="space-between">
        <Button variant="outlined" disabled>
          Previous
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!analysis}
          endIcon={<CheckIcon />}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );
};

export default StyleDetectionStep; 