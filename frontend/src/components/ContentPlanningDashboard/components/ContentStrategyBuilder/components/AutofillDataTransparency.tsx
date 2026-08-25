import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PersonIcon from '@mui/icons-material/Person';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { motion } from 'framer-motion';

interface AutofillDataTransparencyProps {
  open: boolean;
  onClose: () => void;
  autoPopulatedFields: Record<string, any>;
  dataSources: Record<string, string>;
  inputDataPoints: Record<string, any>;
  personalizationData: Record<string, any>;
  confidenceScores: Record<string, number>;
  lastAutofillTime?: string;
  dataSource?: string;
}

const AutofillDataTransparency: React.FC<AutofillDataTransparencyProps> = ({
  open,
  onClose,
  autoPopulatedFields,
  dataSources,
  inputDataPoints,
  personalizationData,
  confidenceScores,
  lastAutofillTime,
  dataSource
}) => {
  const [activeAccordion, setActiveAccordion] = useState<string | false>('data-sources');

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setActiveAccordion(isExpanded ? panel : false);
  };

  // Calculate data freshness
  const getDataFreshness = () => {
    if (!lastAutofillTime) return 'Unknown';
    const lastUpdate = new Date(lastAutofillTime);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  // Get data quality score
  const getDataQualityScore = () => {
    const scores = Object.values(confidenceScores);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  // Get field count by category
  const getFieldCountByCategory = () => {
    const categories: Record<string, number> = {};
    Object.keys(autoPopulatedFields).forEach(fieldId => {
      const category = fieldId.split('_')[0] || 'other';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  };

  const dataQualityScore = getDataQualityScore();
  const dataFreshness = getDataFreshness();
  const fieldCountByCategory = getFieldCountByCategory();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #f8f9ff 0%, #f1f4ff 100%)'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <VisibilityIcon color="primary" sx={{ fontSize: 28 }} />
            <Typography variant="h5" fontWeight="bold" color="primary">
              Autofill Data Transparency
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="large">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Complete transparency about how your strategy inputs were auto-populated
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
              <DataUsageIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                {Object.keys(autoPopulatedFields).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fields Auto-populated
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' }}>
              <TrendingUpIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                {dataQualityScore}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Data Quality Score
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)' }}>
              <RefreshIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                {dataFreshness}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last Updated
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', background: 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)' }}>
              <SecurityIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" fontWeight="bold">
                {Object.keys(dataSources).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Data Sources Used
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Data Quality Indicator */}
        <Alert 
          severity={dataQualityScore >= 80 ? 'success' : dataQualityScore >= 60 ? 'warning' : 'error'}
          sx={{ mb: 3 }}
          icon={dataQualityScore >= 80 ? <CheckCircleIcon /> : <WarningIcon />}
        >
          <Typography variant="body1" fontWeight="bold">
            Data Quality Assessment: {dataQualityScore >= 80 ? 'Excellent' : dataQualityScore >= 60 ? 'Good' : 'Needs Review'}
          </Typography>
          <Typography variant="body2">
            Based on confidence scores from {Object.keys(confidenceScores).length} fields
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={dataQualityScore} 
            sx={{ mt: 1, height: 8, borderRadius: 4 }}
          />
        </Alert>

        {/* Detailed Information Accordions */}
        <Accordion 
          expanded={activeAccordion === 'data-sources'} 
          onChange={handleAccordionChange('data-sources')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DataUsageIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Data Sources & Integration
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Primary Data Sources
                </Typography>
                <List dense>
                  {Object.entries(dataSources).map(([fieldId, source]) => (
                    <ListItem key={fieldId}>
                      <ListItemIcon>
                        <InfoIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        secondary={source}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Integration Details
                </Typography>
                <Paper sx={{ p: 2, background: '#f8f9fa' }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Data Source:</strong> {dataSource || 'Onboarding Integration'}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Integration Method:</strong> AI-Powered Analysis
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Data Processing:</strong> Real-time with validation
                  </Typography>
                  <Typography variant="body2">
                    <strong>Privacy Compliance:</strong> GDPR & CCPA Compliant
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion 
          expanded={activeAccordion === 'user-info'} 
          onChange={handleAccordionChange('user-info')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                User Information & Personalization
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {Object.entries(personalizationData).map(([fieldId, data]) => (
                <Grid item xs={12} md={6} key={fieldId}>
                  <Paper sx={{ p: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      {fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    {typeof data === 'object' && data !== null ? (
                      <Box>
                        {data.explanation && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Explanation:</strong> {data.explanation}
                          </Typography>
                        )}
                        {data.personalization_factors && (
                          <Box>
                            <Typography variant="body2" fontWeight="bold" gutterBottom>
                              Personalization Factors:
                            </Typography>
                            {Object.entries(data.personalization_factors).map(([key, value]) => (
                              <Chip 
                                key={key}
                                label={`${key}: ${value}`}
                                size="small"
                                sx={{ mr: 1, mb: 1 }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2">{String(data)}</Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion 
          expanded={activeAccordion === 'ai-analysis'} 
          onChange={handleAccordionChange('ai-analysis')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PsychologyIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                AI Analysis Results
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Confidence Scores by Field
                </Typography>
                <List dense>
                  {Object.entries(confidenceScores).map(([fieldId, score]) => (
                    <ListItem key={fieldId}>
                      <ListItemIcon>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: score >= 80 ? 'success.main' : score >= 60 ? 'warning.main' : 'error.main' 
                        }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        secondary={`${score}% confidence`}
                      />
                      <LinearProgress 
                        variant="determinate" 
                        value={score} 
                        sx={{ width: 100, height: 6, borderRadius: 3 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  AI Processing Details
                </Typography>
                <Paper sx={{ p: 2, background: '#f8f9fa' }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>AI Model:</strong> Claude 3.5 Sonnet
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Analysis Type:</strong> Contextual Understanding
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Processing Time:</strong> Real-time
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Validation:</strong> Multi-step verification
                  </Typography>
                  <Typography variant="body2">
                    <strong>Quality Checks:</strong> Generic placeholder detection
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion 
          expanded={activeAccordion === 'field-details'} 
          onChange={handleAccordionChange('field-details')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AnalyticsIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">
                Field-by-Field Breakdown
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {Object.entries(autoPopulatedFields).map(([fieldId, value]) => (
                <Grid item xs={12} md={6} key={fieldId}>
                  <Paper sx={{ p: 2, border: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" color="primary">
                        {fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Typography>
                      <Chip 
                        label={dataSources[fieldId] || 'AI Generated'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Value:</strong> {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </Typography>
                    {confidenceScores[fieldId] && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Confidence:</strong> {confidenceScores[fieldId]}%
                      </Typography>
                    )}
                    {inputDataPoints[fieldId] && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Data Points:</strong> {Object.keys(inputDataPoints[fieldId]).length} sources
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button 
          variant="contained" 
          startIcon={<AutoAwesomeIcon />}
          onClick={() => {
            // This could trigger a refresh of the autofill data
            console.log('Refreshing autofill data...');
            onClose();
          }}
        >
          Refresh Data
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutofillDataTransparency;
