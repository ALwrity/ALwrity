import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Paper,
  // Divider,
  // IconButton,
  Tooltip,
  TextField,
  Collapse,
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button, 
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
  AccessibilityNew as AccessibilityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  // Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

const METRIC_TOOLTIPS: { [key: string]: string } = {
  // Meta Data
  title_length: "The title tag is the first thing users see in search results. Ideally 30-60 characters to avoid truncation.",
  meta_description_length: "A summary of your page content. Keep it between 70-160 characters to encourage clicks from search results.",
  has_viewport: "Essential for mobile devices. Ensures your site scales correctly on different screen sizes.",
  charset: "Defines the character set (e.g., UTF-8) to ensure text is displayed correctly.",
  og_tags: "Open Graph tags control how your content appears when shared on social media like Facebook and LinkedIn.",
  twitter_card: "Twitter Cards enable rich media experiences (images, video) in Tweets about your content.",
  robots_meta: "Instructions for search engine crawlers (e.g., index, follow) specifically for this page.",
  
  // Content
  word_count: "Content depth signal. While there's no magic number, 300+ words is a common baseline for SEO-friendly pages.",
  h1_count: "There should be exactly one H1 tag per page to clearly signal the main topic to search engines.",
  images_without_alt: "Alternative text describes images for screen readers and search engines. Essential for accessibility and image SEO.",
  total_images: "Images enrich content but should be optimized for size and accessibility.",
  
  // Technical
  has_robots_txt: "A file that gives instructions to web robots about which pages to crawl or ignore.",
  has_sitemap: "A blueprint of your website that helps search engines find, crawl, and index all of your website's content.",
  canonical_tag: "A tag that tells search engines which URL is the 'master' copy of a page to prevent duplicate content issues.",
  schema_markup: "Structured data (Schema) helps search engines understand your content and can lead to rich snippets in search results.",
  
  // Performance
  load_time: "The time it takes for a page to fully display content. Faster pages rank better and keep users engaged.",
  ttfb: "Time to First Byte. How long the browser waits for the server's first response. Lower is better.",
  
  // UX & Accessibility
  mobile_friendly: "Confirms if your page passes basic mobile usability tests. Critical as Google uses mobile-first indexing.",
  nav_elements: "Checks for standard navigation structures (header, footer) that help users find their way.",
  contrast_ratio: "Ensures text stands out against its background. clear text is vital for readability and accessibility."
};

interface SEOAuditSectionProps {
  seoAudit: any;
  domainName: string;
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
  crawledLinks?: Array<{ text: string; href: string }>;
  onRunAudit?: (url: string) => Promise<any>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`seo-tabpanel-${index}`}
      aria-labelledby={`seo-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SEOAuditSection: React.FC<SEOAuditSectionProps> = ({
  seoAudit,
  domainName,
  isEditable = false,
  onUpdate,
  crawledLinks = [],
  onRunAudit
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [expandedIssues, setExpandedIssues] = useState(true);
  const [expandedWarnings, setExpandedWarnings] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [localAuditData, setLocalAuditData] = useState<any>(null);

  // Use local audit data if available (from manual run), otherwise fallback to props
  const displayAudit = localAuditData || seoAudit;

  const handleAnalyzeUrl = async () => {
    if (!selectedUrl || !onRunAudit) return;
    
    setAnalyzing(true);
    try {
      const result = await onRunAudit(selectedUrl);
      if (result && result.data) {
        setLocalAuditData(result.data);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!seoAudit) return null;

  const isAuditDegraded = displayAudit?.html_unavailable;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getValidationStatus = (key: string, value: any): { status: 'success' | 'warning' | 'error' | 'info', message?: string } => {
    // Helper to extract number from string (e.g., "24 chars" -> 24, "2.5s" -> 2.5)
    const getNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const match = val.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[0]) : 0;
      }
      return 0;
    };

    const numValue = getNumber(value);
    const strValue = String(value).toLowerCase();

    // Check for "missing" or "none" strings which indicate empty/zero
    if (typeof value === 'string' && (value.toLowerCase().includes('missing') || value.toLowerCase() === 'none')) {
        return { status: 'error', message: 'Missing value - Fix Scheduled' };
    }

    switch (key) {
      case 'title_length':
        // SEO Title Length: 30-60 is optimal.
        if (numValue >= 30 && numValue <= 60) return { status: 'success', message: 'Optimal length (30-60 chars)' };
        if (numValue > 0 && numValue < 30) return { status: 'warning', message: 'Too short (recommended 30-60 chars)' };
        if (numValue > 60) return { status: 'error', message: 'Too long - Fix Scheduled (recommended 30-60 chars)' };
        return { status: 'error', message: 'Missing title - Fix Scheduled' };
      
      case 'meta_description_length':
        // Meta Description: 70-160 is optimal.
        if (numValue >= 70 && numValue <= 160) return { status: 'success', message: 'Optimal length (70-160 chars)' };
        if (numValue > 0 && numValue < 70) return { status: 'warning', message: 'Too short (recommended 70-160 chars)' };
        if (numValue > 160) return { status: 'error', message: 'Too long - Fix Scheduled (recommended 70-160 chars)' };
        return { status: 'error', message: 'Missing meta description - Fix Scheduled' };

      case 'word_count':
        if (numValue >= 300) return { status: 'success', message: 'Good content depth (>300 words)' };
        return { status: 'warning', message: 'Thin content (recommended >300 words)' };

      case 'h1_count':
        if (numValue === 1) return { status: 'success', message: 'Perfect (1 H1 tag)' };
        if (numValue === 0) return { status: 'error', message: 'Missing H1 tag - Fix Scheduled' };
        return { status: 'error', message: 'Multiple H1 tags - Fix Scheduled' };

      case 'images_without_alt':
        if (numValue === 0) return { status: 'success', message: 'All images have alt text' };
        return { status: 'error', message: `${numValue} images missing alt text - Fix Scheduled` };

      case 'load_time':
        if (numValue > 0 && numValue <= 2.5) return { status: 'success', message: 'Fast load time (<2.5s)' };
        if (numValue > 2.5 && numValue <= 4) return { status: 'warning', message: 'Moderate load time (2.5s-4s)' };
        if (numValue > 4) return { status: 'error', message: 'Slow load time (>4s)' };
        return { status: 'info' };

      case 'ttfb':
        if (numValue > 0 && numValue <= 0.8) return { status: 'success', message: 'Good server response (<0.8s)' };
        if (numValue > 0.8) return { status: 'warning', message: 'Slow server response (>0.8s)' };
        return { status: 'info' };

      case 'charset':
         if (strValue.includes('utf-8')) return { status: 'success', message: 'Standard UTF-8 encoding' };
         return { status: 'warning', message: 'Non-standard charset' };

      case 'canonical_tag':
         if (strValue && strValue !== 'none' && strValue !== 'missing') return { status: 'success', message: 'Canonical tag present' };
         return { status: 'warning', message: 'Missing canonical tag' };

      case 'robots_meta':
         if (strValue.includes('index') && strValue.includes('follow')) return { status: 'success', message: 'Page is indexable' };
         if (strValue.includes('noindex')) return { status: 'warning', message: 'Page is set to noindex' };
         return { status: 'info', message: strValue };

      case 'readability':
         if (strValue === 'good') return { status: 'success', message: 'Content is easy to read' };
         return { status: 'warning', message: 'Improve readability (simplify sentences)' };

      case 'total_images':
         if (numValue > 0) return { status: 'success', message: `${numValue} images found` };
         return { status: 'warning', message: 'No images found - Consider adding visuals' };

      case 'og_tags':
      case 'twitter_card':
         if (strValue && strValue.length > 0 && !strValue.toLowerCase().includes('missing')) return { status: 'success', message: 'Tags detected' };
         return { status: 'warning', message: 'Missing tags' };

      default:
        // Fallback for other metrics
        if (typeof value === 'boolean') {
            return value ? { status: 'success' } : { status: 'error' };
        }
        return { status: 'info' };
    }
  };

  const renderUrlSelector = () => (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
       <Box display="flex" alignItems="center" gap={2} mb={2}>
         <ScheduleIcon color="primary" fontSize="small" />
         <Typography variant="body2" color="text.secondary">
           <strong>Note:</strong> A full SEO audit for all discovered pages is scheduled to run automatically after onboarding. 
           Use this tool to spot-check specific pages now.
         </Typography>
       </Box>
       <Box display="flex" gap={2} alignItems="center">
         <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
           <InputLabel>Select a page to analyze</InputLabel>
           <Select
             value={selectedUrl}
             label="Select a page to analyze"
             onChange={(e) => setSelectedUrl(e.target.value)}
           >
             {crawledLinks.map((link, idx) => (
               <MenuItem key={idx} value={link.href}>
                 {link.href}
               </MenuItem>
             ))}
           </Select>
         </FormControl>
         <Button
           variant="contained"
           onClick={handleAnalyzeUrl}
           disabled={!selectedUrl || analyzing}
           startIcon={analyzing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
           sx={{ minWidth: 180, height: 40 }}
         >
           {analyzing ? 'Analyzing...' : 'Analyze Page'}
         </Button>
       </Box>
     </Paper>
  );

  const renderDetailsTable = (data: any, title: string) => (
    <Box mb={3}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ color: '#1f2937' }}>
        {title}
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={1.5}>
        {Object.entries(data || {}).map(([key, value]: [string, any]) => {
          if (key === 'score' || key === 'issues' || key === 'warnings' || key === 'recommendations') return null;
          
          // Format key
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          // Format value & determine status
          let displayValue: React.ReactNode = String(value);
          let isBoolean = false;
          let isPassed = false;
          let validation = { status: 'info', message: '' };

          if (typeof value === 'boolean') {
            isBoolean = true;
            isPassed = value;
            validation.status = value ? 'success' : 'error';
            validation.message = value ? 'Passed check' : 'Failed check - Fix Scheduled';
          } else if (Array.isArray(value)) {
            displayValue = value.length > 0 ? value.join(', ') : 'None';
            // Simple array check: empty usually means missing data unless specific field
            if (value.length === 0 && (key === 'og_tags' || key === 'twitter_card')) {
                validation.status = 'warning';
                validation.message = 'Missing tags';
            } else if (value.length > 0) {
                validation.status = 'success';
            }
          } else if (typeof value === 'object' && value !== null) {
             displayValue = JSON.stringify(value);
          } else {
             // Run smart validation for number/string fields
             const check = getValidationStatus(key, value);
             validation.status = check.status as any;
             validation.message = check.message || '';
          }

          // Override validation message if tooltip exists and no specific validation message
          const tooltipContent = `${validation.message ? validation.message + '. ' : ''}${METRIC_TOOLTIPS[key] || ''}`.trim();

          // Style Configuration based on status
          const styles = {
             success: {
                 bg: '#ecfdf5', // green-50
                 border: '#bbf7d0', // green-200
                 text: '#166534', // green-800
                 icon: '#15803d' // green-700
             },
             warning: {
                 bg: '#fefce8', // yellow-50
                 border: '#fde047', // yellow-300
                 text: '#854d0e', // yellow-800
                 icon: '#a16207' // yellow-700
             },
             error: {
                 bg: '#fef2f2', // red-50
                 border: '#fecaca', // red-200
                 text: '#991b1b', // red-800
                 icon: '#b91c1c' // red-700
             },
             info: {
                 bg: '#f1f5f9', // slate-100 - Improved contrast
                 border: '#cbd5e1', // slate-300
                 text: '#334155', // slate-700
                 icon: '#64748b' // slate-500
             }
          };
          
          const currentStyle = styles[validation.status as keyof typeof styles] || styles.info;

          return (
            <Tooltip key={key} title={tooltipContent} arrow placement="top">
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2, // Softer corners, less pill-like
                  border: '1px solid',
                  borderColor: currentStyle.border,
                  bgcolor: currentStyle.bg,
                  color: currentStyle.text,
                  minWidth: 'fit-content',
                  transition: 'all 0.2s',
                  cursor: 'default',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  '&:hover': {
                    borderColor: currentStyle.icon, // Darker border on hover
                    bgcolor: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                {/* Status Indicator / Icon */}
                {isBoolean ? (
                    isPassed ? 
                    <CheckCircleIcon sx={{ fontSize: 16, color: currentStyle.icon }} /> : 
                    <ErrorIcon sx={{ fontSize: 16, color: currentStyle.icon }} />
                ) : (
                    // Dot indicator for non-boolean values to save space but show status
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: currentStyle.icon }} />
                )}

                <Box display="flex" flexDirection="column" justifyContent="center">
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, lineHeight: 1, mb: 0.2, color: currentStyle.text }}>
                        {label}
                    </Typography>
                    
                    {isEditable && typeof value === 'string' ? (
                         <TextField
                            variant="standard"
                            size="small"
                            value={value}
                            disabled
                            InputProps={{ 
                                disableUnderline: true, 
                                sx: { 
                                    fontSize: '0.85rem', 
                                    fontWeight: 700, 
                                    padding: 0,
                                    '& .MuiInputBase-input.Mui-disabled': {
                                        color: currentStyle.text,
                                        WebkitTextFillColor: currentStyle.text,
                                        opacity: 1
                                    }
                                } 
                            }}
                            sx={{ minWidth: 50 }}
                         />
                    ) : (
                         <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.2, color: currentStyle.text }}>
                             {displayValue}
                         </Typography>
                    )}
         </Box>
         
         {/* Warnings Summary */}
         {displayAudit.summary?.warnings && displayAudit.summary.warnings.length > 0 && (
           <Box sx={{ p: 2, bgcolor: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center" 
                onClick={() => setExpandedWarnings(!expandedWarnings)}
                sx={{ cursor: 'pointer' }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                   <WarningIcon color="warning" fontSize="small" />
                   <Typography variant="subtitle2" fontWeight="bold" color="#92400E">
                     {displayAudit.summary.warnings.length} Warnings
                   </Typography>
                </Box>
                {expandedWarnings ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </Box>
              
              <Collapse in={expandedWarnings}>
                <List dense sx={{ mt: 1 }}>
                  {displayAudit.summary.warnings.map((warning: any, i: number) => (
                    <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <WarningIcon fontSize="small" color="warning" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={typeof warning === 'string' ? warning : warning.message}
                        primaryTypographyProps={{ variant: 'body2', color: '#78350F' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
           </Box>
         )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Card sx={{ mb: 4, overflow: 'visible', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
      <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <SpeedIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight="bold" color="#111827">
              Home Page SEO Snapshot for {domainName}
            </Typography>
            <Typography variant="caption" color="#6B7280">
              Full-site audit runs automatically after onboarding.
            </Typography>
          </Box>
        </Box>
        <Chip 
          label={`Score: ${displayAudit.overall_score || seoAudit.overall_score}/100`} 
          color={getScoreColor(displayAudit.overall_score || seoAudit.overall_score)}
          sx={{ fontWeight: 'bold' }}
        />
        {isAuditDegraded && (
          <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic' }}>
            (Limited — page HTML was unavailable for full audit)
          </Typography>
        )}
      </Box>

      <CardContent sx={{ p: 0 }}>
        {isAuditDegraded && (
          <Alert severity="warning" sx={{ m: 1 }}>
            SEO audit ran with limited data — the page HTML could not be fetched.
            Scores and checks may be incomplete. Consider re-running the analysis.
          </Alert>
        )}
        {/* Issues Summary */}
        <Box sx={{ p: 2, bgcolor: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
           <Box 
             display="flex" 
             justifyContent="space-between" 
             alignItems="center" 
             onClick={() => setExpandedIssues(!expandedIssues)}
             sx={{ cursor: 'pointer' }}
           >
             <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon color="error" fontSize="small" />
                <Typography variant="subtitle2" fontWeight="bold" color="#991B1B">
                  {displayAudit.summary?.critical_issues?.length || 0} Critical Issues Found
                </Typography>
             </Box>
             {expandedIssues ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
           </Box>
           
           <Collapse in={expandedIssues}>
             <List dense sx={{ mt: 1 }}>
               {displayAudit.summary?.critical_issues?.map((issue: any, i: number) => (
                 <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                   <ListItemIcon sx={{ minWidth: 24 }}>
                     <ErrorIcon fontSize="small" color="error" />
                   </ListItemIcon>
                   <ListItemText 
                     primary={issue.message} 
                     primaryTypographyProps={{ variant: 'body2', color: '#7F1D1D' }}
                   />
                 </ListItem>
               ))}
               {(!displayAudit.summary?.critical_issues || displayAudit.summary?.critical_issues?.length === 0) && (
                 <Typography variant="body2" color="success.main" sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                   <CheckCircleIcon fontSize="small" /> No critical issues found. Great job!
                 </Typography>
               )}
             </List>
           </Collapse>
        </Box>

        <Box sx={{ width: '100%' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}
          >
            <Tab label="Meta Data" icon={<DescriptionIcon />} iconPosition="start" />
            <Tab label="Content" icon={<CodeIcon />} iconPosition="start" />
            <Tab label="Technical" icon={<SecurityIcon />} iconPosition="start" />
            <Tab label="Performance" icon={<SpeedIcon />} iconPosition="start" />
            <Tab label="UX & A11y" icon={<AccessibilityIcon />} iconPosition="start" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
             {renderUrlSelector()}
             {renderDetailsTable(displayAudit.meta, "Meta Tags Analysis")}
             {renderDetailsTable(displayAudit.url_structure, "URL Structure")}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
             {renderUrlSelector()}
             {renderDetailsTable(displayAudit.content_health, "Content Structure & Quality")}
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
             {renderDetailsTable(displayAudit.technical, "Technical SEO Checks")}
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
             {renderDetailsTable(displayAudit.performance, "Performance Metrics")}
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
             {renderDetailsTable(displayAudit.accessibility, "Accessibility")}
             {renderDetailsTable(displayAudit.ux, "User Experience")}
          </TabPanel>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SEOAuditSection;
