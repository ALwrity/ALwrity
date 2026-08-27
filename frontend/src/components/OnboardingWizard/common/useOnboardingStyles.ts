import { useTheme, alpha } from '@mui/material/styles';

export const useOnboardingStyles = () => {
  const theme = useTheme();

  const styles = {
    // Layout styles
    container: {
      maxWidth: '100%', // Use full width for maximum data display
      width: '100%',
      mx: 0, // Remove auto margins to use full width
      px: { xs: 1.5, md: 2 }, // Responsive padding for better mobile spacing
      py: { xs: 1.5, md: 2 }, // Add responsive vertical padding
    },
    
    // Header styles
    header: {
      textAlign: 'center',
      mb: 4,
    },
    
    headerIcon: {
      fontSize: 64,
      color: 'primary.main',
      mb: 2,
    },
    
    headerIconContainer: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        opacity: 0.3,
        zIndex: -1,
      }
    },
    
    headerTitle: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    
    headerSubtitle: {
      color: 'text.secondary',
      lineHeight: 1.6,
      maxWidth: 600,
      mx: 'auto',
    },
    
    // Card styles
    card: {
      elevation: 2,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      borderRadius: 3,
      '&:hover': {
        elevation: 4,
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
      },
    },
    
    cardContent: {
      p: 3,
    },
    
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 2,
    },
    
    cardTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
    },
    
    cardIconContainer: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Button styles
    primaryButton: {
      borderRadius: 2,
      textTransform: 'none' as const,
      fontWeight: 600,
      px: 4,
      py: 1.5,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
      '&:hover': {
        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
      },
      '&:disabled': {
        background: 'rgba(0,0,0,0.1)',
        color: 'rgba(0,0,0,0.4)',
        boxShadow: 'none',
        transform: 'none',
      },
    },
    
    secondaryButton: {
      borderRadius: 2,
      textTransform: 'none' as const,
      fontWeight: 600,
      borderColor: 'rgba(0,0,0,0.2)',
      color: 'text.primary',
      '&:hover': {
        borderColor: 'rgba(0,0,0,0.4)',
        background: 'rgba(0,0,0,0.04)',
      },
      '&:disabled': {
        borderColor: 'rgba(0,0,0,0.1)',
        color: 'rgba(0,0,0,0.3)',
      }
    },
    
    textButton: {
      textTransform: 'none' as const,
      fontWeight: 600,
    },
    
    // Form styles
    textField: {
      '& .MuiOutlinedInput-root': {
        borderRadius: 2,
      },
      '& .MuiInputBase-input': {
        padding: '12px 16px',
      },
    },
    
    // Alert styles
    alert: {
      borderRadius: 2,
      '& .MuiAlert-icon': {
        fontSize: 20,
      },
    },
    
    // Paper styles
    infoPaper: {
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: 2,
    },
    
    warningPaper: {
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      borderRadius: 2,
    },
    
    successPaper: {
      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: 2,
    },
    
    // Progress styles
    progressBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.08)',
      '& .MuiLinearProgress-bar': {
        borderRadius: 4,
        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
      }
    },
    
    // Chip styles
    chip: {
      fontWeight: 600,
      borderRadius: 1,
    },
    
    // Divider styles
    divider: {
      my: 2,
      opacity: 0.6,
    },
    
    // Link styles
    link: {
      fontWeight: 600,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    
    // Animation styles
    fadeIn: {
      animation: 'fadeIn 0.5s ease-in-out',
    },
    
    slideUp: {
      animation: 'slideUp 0.3s ease-out',
    },
    
    // Responsive styles
    responsiveContainer: {
      maxWidth: { xs: '100%', md: 800 },
      mx: 'auto',
      px: { xs: 2, md: 3 },
    },
    
    // Spacing utilities
    sectionSpacing: {
      mb: 4,
    },
    
    cardSpacing: {
      gap: 3,
    },
    
    buttonSpacing: {
      gap: 2,
    },

    // Analysis step styles
    analysisContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      width: '100%',
      maxWidth: '100%',  // Use full width for maximum data display
      mx: 0, // Remove auto margins to use full width
      px: { xs: 1.5, md: 2 }, // Responsive padding for better mobile spacing
      py: { xs: 1.5, md: 2 }, // Add responsive vertical padding
    },

    analysisHeaderCard: {
      mb: 3,
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.08) 100%)'
        : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius: 3,
      boxShadow: theme.palette.mode === 'dark'
        ? '0 8px 32px rgba(0, 0, 0, 0.4)'
        : '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: theme.palette.mode === 'dark'
        ? `1px solid rgba(255, 255, 255, 0.1)`
        : `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
      overflow: 'hidden',
    },

    analysisCardContent: {
      p: { xs: 2, md: 3 },
    },

    analysisHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      mb: 2,
    },

    analysisHeaderIcon: {
      fontSize: 28,
      color: theme.palette.success.main,
    },

    analysisHeaderTitle: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
      color: theme.palette.mode === 'dark' ? '#ffffff' : '#1a202c', // High contrast dark text
      fontSize: '1.5rem',
    },

    analysisHeaderSubtitle: {
      color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#4a5568', // High contrast secondary text
      fontSize: '0.95rem',
      lineHeight: 1.5,
      mt: 0.5,
    },

    analysisSection: {
      mb: 2.5,
    },

    analysisSectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      fontWeight: 700,
      color: theme.palette.mode === 'dark' ? '#ffffff' : '#1a202c', // High contrast dark text
      fontSize: '1.25rem',
      mb: 2,
      pb: 1.5,
      borderBottom: `3px solid ${theme.palette.mode === 'dark' 
        ? alpha(theme.palette.primary.main, 0.4)
        : alpha(theme.palette.primary.main, 0.25)}`, // More prominent border
      '& .MuiSvgIcon-root': {
        fontSize: '1.5rem',
        color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
      }
    },

    analysisSubheader: {
      fontWeight: 600,
      mb: 0.5,
      color: theme.palette.text.secondary,
      fontSize: '0.9rem',
    },

    analysisDivider: {
      my: 2,
      opacity: 0.6,
    },

    analysisParagraph: {
      lineHeight: 1.6,
      fontSize: '0.95rem',
      color: theme.palette.text.primary,
    },

    analysisGradientPaperPrimary: {
      p: { xs: 2, md: 2.5 },
      borderRadius: 2,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: '0 12px 28px rgba(118, 75, 162, 0.4)',
      border: '1px solid rgba(118, 75, 162, 0.4)',
      backdropFilter: 'blur(10px)',
    },

    analysisGradientPaperWarning: {
      p: { xs: 2, md: 2.5 },
      borderRadius: 2,
      background: 'linear-gradient(135deg, #ff9800 0%, #ff5722 100%)',
      color: 'white',
      boxShadow: '0 12px 28px rgba(255, 87, 34, 0.4)',
      border: '1px solid rgba(255, 152, 0, 0.4)',
      backdropFilter: 'blur(10px)',
    },

    analysisGradientPaperSuccess: {
      p: { xs: 2, md: 2.5 },
      borderRadius: 2,
      background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
      color: 'white',
      boxShadow: '0 12px 28px rgba(76, 175, 80, 0.4)',
      border: '1px solid rgba(67, 160, 71, 0.4)',
      backdropFilter: 'blur(10px)',
    },

    analysisGradientPaperInfo: {
      p: { xs: 2, md: 2.5 },
      borderRadius: 2,
      background: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
      color: 'white',
      boxShadow: '0 12px 28px rgba(33, 150, 243, 0.4)',
      border: '1px solid rgba(33, 203, 243, 0.4)',
      backdropFilter: 'blur(10px)',
    },

    analysisGradientPaperAccent: {
      p: { xs: 2, md: 2.5 },
      borderRadius: 2,
      background: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)',
      color: 'white',
      boxShadow: '0 12px 28px rgba(156, 39, 176, 0.4)',
      border: '1px solid rgba(103, 58, 183, 0.4)',
      backdropFilter: 'blur(10px)',
    },

    analysisAccentPaperError: {
      p: { xs: 2, md: 2.5 },
      mb: 2,
      borderRadius: 2,
      borderLeft: `4px solid ${theme.palette.error.main}`,
      background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.08) 100%)',
      border: `1px solid rgba(244, 67, 54, 0.2)`,
      backdropFilter: 'blur(10px)',
    },

    analysisAccentPaperSuccess: {
      p: { xs: 2, md: 2.5 },
      mb: 2,
      borderRadius: 2,
      borderLeft: `4px solid ${theme.palette.success.main}`,
      background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.08) 100%)',
      border: `1px solid rgba(76, 175, 80, 0.2)`,
      backdropFilter: 'blur(10px)',
    },

    analysisAccentPaperInfo: {
      p: { xs: 2, md: 2.5 },
      mb: 2,
      borderRadius: 2,
      borderLeft: `4px solid ${theme.palette.info.main}`,
      background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15) 0%, rgba(33, 150, 243, 0.08) 100%)',
      border: `1px solid rgba(33, 150, 243, 0.2)`,
      backdropFilter: 'blur(10px)',
    },

    analysisAccentIconError: {
      color: theme.palette.error.main,
    },

    analysisAccentIconSuccess: {
      color: theme.palette.success.main,
    },

    analysisAccentIconInfo: {
      color: theme.palette.info.main,
    },

    analysisList: {
      pl: 2,
      m: 0,
      listStyle: 'disc',
      '& li': {
        marginBottom: 1,
      },
    },

    analysisListItem: {
      lineHeight: 1.6,
    },

    analysisLabel: {
      fontWeight: 600,
      opacity: 0.85,
    },

    analysisValue: {
      fontWeight: 500,
    },

    analysisInfoBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 0.5,
      borderRadius: 999,
      background: alpha(theme.palette.primary.light, 0.15),
      color: theme.palette.primary.main,
      fontSize: '0.875rem',
      fontWeight: 600,
    },

    analysisCheckboxContainer: {
      p: { xs: 2.5, md: 3 },
      background: alpha(theme.palette.primary.light, 0.2),
      borderRadius: 2,
      border: `2px solid ${alpha(theme.palette.primary.main, 0.28)}`,
      mb: 3,
    },

    analysisSuccessAlert: {
      borderRadius: 2,
      mb: 0,
    },

    analysisAlertText: {
      fontWeight: 500,
    },
  };

  return styles;
}; 