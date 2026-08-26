import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  IconButton,
  Paper
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BusinessIcon from '@mui/icons-material/Business';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
import BuildIcon from '@mui/icons-material/Build';
import BrandingIcon from '@mui/icons-material/Palette';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import { motion } from 'framer-motion';

interface EnterpriseDatapointsModalProps {
  open: boolean;
  onClose: () => void;
  onProceedWithCurrent: () => void;
  onAddEnterpriseDatapoints: () => void;
}

const EnterpriseDatapointsModal: React.FC<EnterpriseDatapointsModalProps> = ({
  open,
  onClose,
  onProceedWithCurrent,
  onAddEnterpriseDatapoints
}) => {
  const enterpriseCategories = [
    {
      title: 'Content Distribution & Channel Strategy',
      icon: <TrendingUpIcon />,
      fields: 6,
      description: 'Multi-channel distribution and promotion strategy',
      color: 'primary'
    },
    {
      title: 'Content Calendar & Planning',
      icon: <ScheduleIcon />,
      fields: 5,
      description: 'Structured content planning and scheduling',
      color: 'secondary'
    },
    {
      title: 'Audience Segmentation & Personas',
      icon: <GroupIcon />,
      fields: 6,
      description: 'Detailed audience analysis and personas',
      color: 'success'
    },
    {
      title: 'Content Performance & Optimization',
      icon: <AnalyticsIcon />,
      fields: 5,
      description: 'Performance tracking and optimization',
      color: 'info'
    },
    {
      title: 'Content Creation & Production',
      icon: <BuildIcon />,
      fields: 5,
      description: 'Content creation workflow and processes',
      color: 'warning'
    },
    {
      title: 'Brand & Messaging Strategy',
      icon: <BrandingIcon />,
      fields: 5,
      description: 'Brand positioning and messaging',
      color: 'error'
    },
    {
      title: 'Technology & Platform Strategy',
      icon: <StorageIcon />,
      fields: 5,
      description: 'Technology stack and integrations',
      color: 'primary'
    }
  ];

  const benefits = [
    {
      icon: <StarIcon />,
      title: '3x Better Performance',
      description: 'Strategies with 60+ datapoints show significantly better results'
    },
    {
      icon: <SpeedIcon />,
      title: 'Months → Minutes',
      description: 'Get enterprise-grade analysis in minutes, not months'
    },
    {
      icon: <SecurityIcon />,
      title: 'Risk Mitigation',
      description: 'Comprehensive analysis reduces strategy risks'
    },
    {
      icon: <BusinessIcon />,
      title: '$50K+ Value',
      description: 'Enterprise consulting value democratized with AI'
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        console.log('🎯 Enterprise modal onClose called with reason:', reason);
        // Only allow closing via the close button, not by clicking outside or pressing escape
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          console.log('🎯 Preventing modal close via backdrop/escape');
          return;
        }
        onClose();
      }}
      maxWidth="xl"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(102, 126, 234, 0.1)',
          overflow: 'hidden',
          maxHeight: '95vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none'
        }
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 2, 
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <AutoAwesomeIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                Unlock Enterprise-Grade Content Strategy
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                Transform your basic strategy into an enterprise-grade content strategy that drives real results
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ 
              color: 'white',
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)' 
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 4 }}>
          {/* Value Proposition Section */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={8}>
              <Typography variant="h5" gutterBottom sx={{ color: '#667eea', fontWeight: 600 }}>
                Why Enterprise Datapoints Matter
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Access 30+ additional datapoints that enterprise teams spend months analyzing. 
                Get enterprise-quality insights without the enterprise price tag.
              </Typography>
              
              <Grid container spacing={2}>
                {benefits.map((benefit, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card variant="outlined" sx={{ 
                        height: '100%',
                        border: '1px solid rgba(102, 126, 234, 0.1)',
                        '&:hover': {
                          borderColor: '#667eea',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)'
                        }
                      }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                          <Box sx={{ 
                            display: 'inline-flex',
                            p: 1,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            mb: 1
                          }}>
                            {benefit.icon}
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                            {benefit.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {benefit.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 3, 
                background: 'linear-gradient(135deg, #f8f9ff 0%, #eef3fb 100%)',
                border: '2px solid rgba(102, 126, 234, 0.2)',
                borderRadius: 3
              }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#667eea', fontWeight: 600 }}>
                  Strategy Comparison
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Current Strategy (30 fields)
                  </Typography>
                  <List dense>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Basic strategy elements"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Functional content strategy"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Quick implementation"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  </List>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Enterprise Strategy (60+ fields)
                  </Typography>
                  <List dense>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <StarIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Comprehensive coverage"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <StarIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Operational excellence"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <StarIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="3x better performance"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  </List>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Enterprise Categories Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ color: '#667eea', fontWeight: 600 }}>
              Enterprise Datapoints Categories
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Unlock 30+ additional fields across 7 enterprise categories for comprehensive strategy coverage.
            </Typography>
            
            <Grid container spacing={2}>
              {enterpriseCategories.map((category, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card variant="outlined" sx={{ 
                      height: '100%',
                      border: '1px solid rgba(102, 126, 234, 0.1)',
                      '&:hover': {
                        borderColor: '#667eea',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.15)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ 
                            p: 0.5, 
                            borderRadius: 1, 
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {category.icon}
                          </Box>
                          <Chip 
                            label={`${category.fields} fields`} 
                            size="small" 
                            color={category.color as any}
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          {category.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Process Information */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              How It Works
            </Typography>
            <Typography variant="body2">
              AI will autofill 80% of enterprise fields using your existing data and industry insights. 
              You'll only need to review and customize 20% of the fields. 
              Additional time: 10-15 minutes for enterprise-grade strategy.
            </Typography>
          </Alert>

          {/* Social Proof */}
          <Paper sx={{ 
            p: 3, 
            background: 'linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            borderRadius: 2
          }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#667eea', fontWeight: 600 }}>
              What Users Say
            </Typography>
            <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              "The enterprise datapoints transformed our basic strategy into a comprehensive, 
              actionable plan that our entire team could follow. The AI autofill saved us hours 
              of manual work while maintaining quality."
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color: '#667eea' }}>
              — Marketing Director, Tech Startup
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 4, 
        pt: 0,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Limited time access to enterprise features
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Get $50K+ consulting value for free
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={onProceedWithCurrent}
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1.5,
              fontWeight: 600,
              borderColor: 'rgba(102, 126, 234, 0.3)',
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.05)'
              }
            }}
          >
            Proceed with Current Strategy
          </Button>
          
          <Button
            variant="contained"
            onClick={onAddEnterpriseDatapoints}
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
              }
            }}
            endIcon={<ArrowForwardIcon />}
          >
            Add Enterprise Datapoints
            <Chip 
              label="Coming Soon" 
              size="small" 
              sx={{ 
                ml: 1, 
                backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                color: 'white',
                fontSize: '0.7rem',
                height: 20
              }} 
            />
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default EnterpriseDatapointsModal;
