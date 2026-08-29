import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SchoolIcon from '@mui/icons-material/School';
import RocketIcon from '@mui/icons-material/Rocket';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import GroupIcon from '@mui/icons-material/Group';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { motion, AnimatePresence } from 'framer-motion';

interface StrategyOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmStrategy: () => void;
  onEditStrategy: () => void;
  onCreateNewStrategy: () => void;
  currentStrategy: any;
  strategyStatus: 'active' | 'inactive' | 'pending' | 'none';
}

const StrategyOnboardingDialog: React.FC<StrategyOnboardingDialogProps> = ({
  open,
  onClose,
  onConfirmStrategy,
  onEditStrategy,
  onCreateNewStrategy,
  currentStrategy,
  strategyStatus
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const steps = [
    {
      label: 'Welcome to ALwrity',
      icon: <AutoAwesomeIcon />,
      content: (
        <Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            🚀 Your AI-Powered Content Strategy Copilot
          </Typography>
          <Typography variant="body1" paragraph>
            ALwrity democratizes professional content strategy and calendar creation, making it accessible to solopreneurs and small businesses.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <PsychologyIcon sx={{ mr: 1 }} />
                    AI-Enhanced Strategy
                  </Typography>
                  <Typography variant="body2">
                    Our AI analyzes your business, competitors, and market trends to create a comprehensive content strategy.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <CalendarIcon sx={{ mr: 1 }} />
                    Smart Calendar Creation
                  </Typography>
                  <Typography variant="body2">
                    Automatically generate content calendars with optimal posting times and content mix.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'What ALwrity Has Done',
      icon: <AssessmentIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            📊 Comprehensive Research & Analysis
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Market Research
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Industry trend analysis" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Competitor content audit" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Target audience insights" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Keyword opportunity analysis" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    <LightbulbIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Strategic Insights
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Content pillar identification" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Optimal content mix" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Posting frequency recommendations" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Performance predictions" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Your Journey with ALwrity',
      icon: <TimelineIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            🎯 Your 4-Step Success Path
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" sx={{ mr: 2, color: 'primary.main' }}>1</Typography>
                    <Typography variant="h6">Review & Confirm Strategy</Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Review the AI-generated content strategy tailored to your business. Make any adjustments and confirm to activate.
                  </Typography>
                  <Chip label="Current Step" color="primary" size="small" />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" sx={{ mr: 2, color: 'text.secondary' }}>2</Typography>
                    <Typography variant="h6">Create Content Calendar</Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    ALwrity generates a comprehensive content calendar with optimal posting times and content themes.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" sx={{ mr: 2, color: 'text.secondary' }}>3</Typography>
                    <Typography variant="h6">Measure Strategy KPIs</Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Track performance metrics and analyze content effectiveness to understand what works best.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" sx={{ mr: 2, color: 'text.secondary' }}>4</Typography>
                    <Typography variant="h6">Optimize with AI</Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Continuously improve your strategy based on performance data and AI recommendations.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'ALwrity as Your Copilot',
      icon: <RocketIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            🤖 Your AI Marketing Assistant
          </Typography>
          <Typography variant="body1" paragraph>
            Once your strategy is active, ALwrity becomes your 24/7 content marketing copilot, handling the heavy lifting while you focus on your business.
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SpeedIcon sx={{ mr: 1 }} />
                    Automated Execution
                  </Typography>
                  <Typography variant="body2">
                    ALwrity schedules, generates, reviews, and posts content according to your strategy, saving you hours every week.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <TrendingUpIcon sx={{ mr: 1 }} />
                    Performance Tracking
                  </Typography>
                  <Typography variant="body2">
                    Monitor your content performance in real-time with detailed analytics and actionable insights.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SecurityIcon sx={{ mr: 1 }} />
                    Quality Assurance
                  </Typography>
                  <Typography variant="body2">
                    Every piece of content is reviewed for quality, brand consistency, and strategic alignment.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Pro Tip:</strong> ALwrity learns from your content performance and continuously optimizes your strategy for better results.
            </Typography>
          </Alert>
        </Box>
      )
    },
    {
      label: 'Take Action',
      icon: <PlayArrowIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            🎯 Ready to Activate Your Strategy?
          </Typography>
          
          {strategyStatus === 'inactive' && currentStrategy ? (
            <Box>
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body1">
                  <strong>Strategy Found:</strong> We found an existing strategy that needs to be activated.
                </Typography>
              </Alert>
              
              <Card sx={{ mb: 3, border: '2px solid', borderColor: 'warning.main' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Current Strategy: {currentStrategy.name}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {currentStrategy.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Industry: ${currentStrategy.industry}`} color="primary" variant="outlined" />
                    <Chip label={`Target: ${currentStrategy.target_audience}`} color="secondary" variant="outlined" />
                  </Box>
                </CardContent>
              </Card>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={onConfirmStrategy}
                    startIcon={<CheckCircleIcon />}
                    sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': { transform: 'translateY(-2px)' },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Activate Strategy
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={onEditStrategy}
                    startIcon={<EditIcon />}
                  >
                    Edit Strategy
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={onCreateNewStrategy}
                    startIcon={<AddIcon />}
                  >
                    Create New
                  </Button>
                </Grid>
              </Grid>
            </Box>
          ) : strategyStatus === 'none' ? (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body1">
                  <strong>No Strategy Found:</strong> Let's create your first content strategy!
                </Typography>
              </Alert>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={onCreateNewStrategy}
                    startIcon={<AutoAwesomeIcon />}
                    sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': { transform: 'translateY(-2px)' },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Create Strategy with AI
                  </Button>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={onClose}
                    startIcon={<CloseIcon />}
                  >
                    Maybe Later
                  </Button>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body1">
                  <strong>Strategy Active:</strong> Your content strategy is already active and running!
                </Typography>
              </Alert>
              
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={onClose}
                startIcon={<CheckCircleIcon />}
                sx={{ 
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  '&:hover': { transform: 'translateY(-2px)' },
                  transition: 'all 0.3s ease'
                }}
              >
                Continue to Dashboard
              </Button>
            </Box>
          )}
        </Box>
      )
    }
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
          color: 'white',
          borderRadius: 3,
          minHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AutoAwesomeIcon sx={{ mr: 2, fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            ALwrity Content Strategy Onboarding
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 4 }}>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%',
                      background: activeStep >= index ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      {step.icon}
                    </Box>
                  )}
                >
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Box sx={{ mb: 3 }}>
                        {step.content}
                      </Box>
                      
                      {index < steps.length - 1 && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Button
                            variant="contained"
                            onClick={handleNext}
                            sx={{ 
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              '&:hover': { transform: 'translateY(-2px)' },
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {index === steps.length - 2 ? 'Finish' : 'Continue'}
                          </Button>
                          <Button
                            disabled={index === 0}
                            onClick={handleBack}
                            variant="outlined"
                            sx={{ color: 'white', borderColor: 'white' }}
                          >
                            Back
                          </Button>
                        </Box>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === steps.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Welcome to ALwrity!
                </Typography>
                <Typography variant="body1" paragraph>
                  You're now ready to start your content marketing journey with AI assistance.
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleReset}
                  sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': { transform: 'translateY(-2px)' },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Start Over
                </Button>
              </Box>
            </motion.div>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default StrategyOnboardingDialog; 