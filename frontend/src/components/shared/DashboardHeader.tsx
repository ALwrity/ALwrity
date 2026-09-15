import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button, Tooltip } from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { ShimmerHeader } from './styled';
import HeaderControls from './HeaderControls';
import { DashboardHeaderProps } from './types';

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  title, 
  subtitle, 
  statusChips = [],
  rightContent,
  customIcon,
  workflowControls
}) => {
  // State for enhanced start button behavior
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("🎯 Start your daily content workflow here!");

  // Check if this is first visit and set up enhanced behavior
  useEffect(() => {
    const hasVisited = localStorage.getItem('alwrity-has-visited');
    if (!hasVisited) {
      setIsFirstVisit(true);
      localStorage.setItem('alwrity-has-visited', 'true');
      
      // Set up floating CTA after 15 seconds
      const timer = setTimeout(() => {
        setShowFloatingCTA(true);
        // Auto-hide after 30 seconds
        setTimeout(() => setShowFloatingCTA(false), 30000);
      }, 15000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Progressive tooltip messages
  useEffect(() => {
    if (!isFirstVisit) return;
    
    const messages = [
      "🎯 Start your daily content workflow here!",
      "💡 This button launches your personalized content plan",
      "⚡ Click to begin your digital marketing automation"
    ];
    
    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setTooltipMessage(messages[messageIndex]);
    }, 10000); // Change message every 10 seconds
    
    return () => clearInterval(interval);
  }, [isFirstVisit]);
  return (
    <ShimmerHeader sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {customIcon && (
            <Box
              component="img"
              src={customIcon}
              alt="Alwrity Logo"
              sx={{
                width: { xs: 40, md: 48 },
                height: { xs: 40, md: 48 },
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
              }}
            />
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h2" component="h1" sx={{ 
                fontWeight: 800, 
                color: 'white',
                textShadow: '0 4px 8px rgba(0,0,0,0.3)',
                mb: subtitle ? 1 : 0,
                fontSize: { xs: '2rem', md: '3rem' },
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="h5" sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 400,
                  fontSize: { xs: '1rem', md: '1.25rem' },
                }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            
            {/* Workflow Controls */}
            {workflowControls && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Workflow Control Buttons */}
                {!workflowControls.isWorkflowActive ? (
                  /* Enhanced Start Button with Phase 1 Improvements */
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <Tooltip title={tooltipMessage} arrow placement="bottom">
                      <span>
                        <Button
                          variant="contained"
                          size={isFirstVisit ? "medium" : "small"}
                          startIcon={<PlayArrow />}
                          onClick={workflowControls.onStartWorkflow}
                          disabled={workflowControls.isLoading}
                        sx={{
                          position: 'relative',
                          overflow: 'hidden',
                          // Phase 1: Orange/Amber color psychology for action
                          background: 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)',
                          border: '2px solid transparent',
                          // Reduced size by 30% for both first visit and returning users
                          transform: isFirstVisit ? 'scale(0.875)' : 'scale(0.7)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #E55A2B 0%, #D1491F 100%)',
                            transform: isFirstVisit ? 'scale(0.95)' : 'scale(0.75)',
                          },
                          minWidth: 'auto',
                          px: isFirstVisit ? 3 : 2,
                          py: isFirstVisit ? 1.5 : 1,
                          fontSize: isFirstVisit ? '1rem' : '0.875rem',
                          fontWeight: 700,
                          // Phase 1: Enhanced pulsing animation
                          animation: isFirstVisit ? 'pulse 2s ease-in-out infinite' : 'none',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
                            animation: 'shimmer 2.5s infinite',
                            zIndex: 1,
                          },
                          // Phase 1: Stronger outer glow effect
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: -4,
                            left: -4,
                            right: -4,
                            bottom: -4,
                            background: 'linear-gradient(45deg, #FF6B35, #FF8C42, #FF6B35, #FF8C42)',
                            backgroundSize: '400% 400%',
                            borderRadius: 'inherit',
                            zIndex: -1,
                            animation: 'borderGlow 3s ease-in-out infinite',
                            // Enhanced glow effect
                            boxShadow: isFirstVisit 
                              ? '0 0 20px rgba(255, 107, 53, 0.6), 0 0 40px rgba(255, 107, 53, 0.4), 0 0 60px rgba(255, 107, 53, 0.2)'
                              : '0 0 15px rgba(255, 107, 53, 0.4), 0 0 30px rgba(255, 107, 53, 0.2)',
                          },
                          '@keyframes pulse': {
                            '0%, 100%': { 
                              transform: isFirstVisit ? 'scale(0.875)' : 'scale(0.7)',
                              boxShadow: '0 0 20px rgba(255, 107, 53, 0.6)'
                            },
                            '50%': { 
                              transform: isFirstVisit ? 'scale(0.95)' : 'scale(0.75)',
                              boxShadow: '0 0 30px rgba(255, 107, 53, 0.8)'
                            },
                          },
                          '@keyframes shimmer': {
                            '0%': { left: '-100%' },
                            '100%': { left: '100%' },
                          },
                          '@keyframes borderGlow': {
                            '0%, 100%': { backgroundPosition: '0% 50%' },
                            '50%': { backgroundPosition: '100% 50%' },
                          },
                        }}
                      >
                          {isFirstVisit ? '🚀 Start Journey' : 'Start'}
                        </Button>
                      </span>
                    </Tooltip>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        backgroundColor: '#1976d2',
                        color: 'white',
                        borderRadius: '12px',
                        px: 0.75,
                        py: 0.25,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                      }}
                    >
                      {`${workflowControls.completedTasks}/${workflowControls.totalTasks}`}
                    </Box>
                    
                    {/* Floating CTA for first-time users */}
                    {showFloatingCTA && isFirstVisit && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          mt: 2,
                          p: 2,
                          backgroundColor: 'rgba(255, 107, 53, 0.95)',
                          borderRadius: 2,
                          boxShadow: '0 8px 32px rgba(255, 107, 53, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(10px)',
                          zIndex: 1000,
                          animation: 'fadeInUp 0.5s ease-out',
                          maxWidth: 280,
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: -8,
                            right: 20,
                            width: 0,
                            height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderBottom: '8px solid rgba(255, 107, 53, 0.95)',
                          },
                          '@keyframes fadeInUp': {
                            '0%': {
                              opacity: 0,
                              transform: 'translateY(20px)',
                            },
                            '100%': {
                              opacity: 1,
                              transform: 'translateY(0)',
                            },
                          },
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'white',
                            fontWeight: 600,
                            mb: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          🎯 Ready to create amazing content?
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.9)',
                            display: 'block',
                            mb: 1,
                          }}
                        >
                          Click the orange button above to start your personalized content workflow!
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setShowFloatingCTA(false)}
                          sx={{
                            color: 'white',
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            fontSize: '0.75rem',
                            py: 0.5,
                            px: 1,
                            '&:hover': {
                              borderColor: 'white',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            },
                          }}
                        >
                          Got it!
                        </Button>
                      </Box>
                    )}
                  </Box>
                ) : (
                  /* In-Progress/Completed Controls with Enhanced Styling */
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* In-Progress/Completed Status with Lightning Glow */}
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={workflowControls.onResumePlanModal}
                        disabled={workflowControls.isLoading}
                        sx={{
                          position: 'relative',
                          overflow: 'hidden',
                          background: workflowControls.completedTasks === workflowControls.totalTasks 
                            ? 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)'
                            : 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                          color: 'white',
                          minWidth: 'auto',
                          px: 2,
                          border: '2px solid transparent',
                          boxShadow: workflowControls.completedTasks === workflowControls.totalTasks
                            ? '0 8px 25px rgba(76, 175, 80, 0.4), 0 0 0 1px rgba(255,255,255,0.2)'
                            : '0 8px 25px rgba(33, 150, 243, 0.4), 0 0 0 1px rgba(255,255,255,0.2)',
                          '&:hover': {
                            background: workflowControls.completedTasks === workflowControls.totalTasks
                              ? 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)'
                              : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: workflowControls.completedTasks === workflowControls.totalTasks
                              ? '0 12px 35px rgba(76, 175, 80, 0.6), 0 0 0 1px rgba(255,255,255,0.3)'
                              : '0 12px 35px rgba(33, 150, 243, 0.6), 0 0 0 1px rgba(255,255,255,0.3)',
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
                            animation: workflowControls.completedTasks === workflowControls.totalTasks 
                              ? 'none' 
                              : 'shimmer 2.5s infinite',
                            zIndex: 1,
                          },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: -2,
                            left: -2,
                            right: -2,
                            bottom: -2,
                            background: workflowControls.completedTasks === workflowControls.totalTasks
                              ? 'linear-gradient(45deg, #4caf50, #8bc34a, #4caf50, #8bc34a)'
                              : 'linear-gradient(45deg, #2196f3, #64b5f6, #2196f3, #64b5f6)',
                            backgroundSize: '400% 400%',
                            borderRadius: 'inherit',
                            zIndex: -1,
                            animation: 'borderGlow 3s ease-in-out infinite',
                          },
                          '@keyframes shimmer': {
                            '0%': { left: '-100%' },
                            '100%': { left: '100%' },
                          },
                          '@keyframes borderGlow': {
                            '0%, 100%': { backgroundPosition: '0% 50%' },
                            '50%': { backgroundPosition: '100% 50%' },
                          },
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        title={workflowControls.completedTasks === workflowControls.totalTasks 
                          ? '🎉 All tasks completed! Click to review workflow progress.' 
                          : 'Workflow in progress. Click to resume or check current tasks.'}
                      >
                        {workflowControls.completedTasks === workflowControls.totalTasks ? 'Completed' : 'In Progress'}
                      </Button>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          backgroundColor: '#1976d2',
                          color: 'white',
                          borderRadius: '12px',
                          px: 0.75,
                          py: 0.25,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                        }}
                      >
                        {`${workflowControls.completedTasks}/${workflowControls.totalTasks}`}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {statusChips.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {statusChips.map((chip, index) => (
                <Chip 
                  key={index}
                  icon={chip.icon} 
                  label={chip.label} 
                  data-testid={chip.testId}
                  {...(chip.onClick ? { onClick: chip.onClick, clickable: true } : {})}
                  sx={{ 
                    background: `${chip.color}20`,
                    border: `1px solid ${chip.color}40`,
                    color: chip.color,
                    fontWeight: 700,
                    ...(chip.onClick ? { cursor: 'pointer' } : {}),
                  }}
                />
              ))}
            </Box>
          )}
          {rightContent}
          
          <HeaderControls colorMode="dark" />
        </Box>
      </Box>
    </ShimmerHeader>
  );
};

export default DashboardHeader; 