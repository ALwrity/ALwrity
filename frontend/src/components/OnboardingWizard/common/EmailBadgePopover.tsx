import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  Fade,
  Stack,
  Tooltip,
  IconButton,
  Popover
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface EmailBadgePopoverProps {
  email: string;
  onEmailChange: (email: string) => void;
}

export const EmailBadgePopover: React.FC<EmailBadgePopoverProps> = ({ email, onEmailChange }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempEmail, setTempEmail] = useState(email);
  const timeoutRef = useRef<any>(null);

  // Sync tempEmail when email prop changes
  useEffect(() => {
    setTempEmail(email);
  }, [email]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    timeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
      setIsEditing(false); // Reset editing mode when popover closes
    }, 250); // 250ms buffer to allow mouse to move smoothly to/from popover
  };

  const handlePopoverMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handlePopoverMouseLeave = () => {
    handleClose();
  };

  const handleSave = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (tempEmail && tempEmail.includes('@')) {
      onEmailChange(tempEmail);
      setIsEditing(false);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setTempEmail(email);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const open = Boolean(anchorEl);

  // Tooltip configuration mirroring the exact dark-mode popover style (background, shadow, font-size)
  // when hovering over metrics in SEO Audit. Set to a fully solid background to prevent transparency.
  const tooltipProps = {
    componentsProps: {
      tooltip: {
        sx: {
          textAlign: 'center', // Centers the text
          fontSize: '0.75rem', // Default MUI Caption/Tooltip size (matches SEO Audit tooltip size)
          fontWeight: 700,
          p: 1.25,
          borderRadius: 1.5,
          maxWidth: 220, // Forces wrapping into balanced lines
          lineHeight: 1.4,
          display: 'block',
          backgroundColor: '#334155 !important', // Fully solid medium grey background (slate-700, 100% opacity, non-translucent)
          color: '#ffffff !important', // High-contrast crisp white text
          opacity: '1 !important', // Strictly forces solid rendering
          filter: 'none !important',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.25)', // Richer shadow for depth
        }
      }
    }
  };

  return (
    <Box 
      onMouseEnter={handleOpen} 
      onMouseLeave={handleClose}
      sx={{ display: 'inline-flex', alignItems: 'center' }}
    >
      {/* Navbar Badge Chip (UX-Optimized Glassmorphism) */}
      <Chip
        icon={<EmailIcon sx={{ color: 'white !important', fontSize: '1.1rem' }} />}
        label={email || "Add business email"}
        onClick={handleOpen}
        sx={{
          background: 'rgba(255, 255, 255, 0.12)',
          color: 'white',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.22)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 6px 16px rgba(255, 255, 255, 0.18)',
            transform: 'translateY(-1px)',
          },
          fontSize: '0.9rem',
          height: 32,
          cursor: 'pointer',
          borderRadius: '16px',
          px: 0.5,
        }}
      />

      {/* Floating Popover Container (Image 2 Parity) */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          onMouseEnter: handlePopoverMouseEnter,
          onMouseLeave: handlePopoverMouseLeave,
          sx: {
            p: 3,
            width: 610,
            maxWidth: '95vw',
            borderRadius: 3,
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            overflow: 'visible',
            mt: 1.5,
            pointerEvents: 'auto',
          }
        }}
        sx={{
          pointerEvents: 'none', // Allows hover-out to register properly
        }}
      >
        <Box>
          {/* Header Row - Title & Email Display/Edit Box */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 2, mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, fontSize: '1.125rem' }}>
              Your Business Email Address
            </Typography>
            
            {isEditing ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TextField
                  size="small"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="your@business.com"
                  autoFocus
                  sx={{ 
                    width: 210, // Increased width by over 23% to prevent cut-off and improve readability
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'white',
                      fontSize: '0.85rem',
                      height: 32,
                      '& input': {
                        color: '#1e293b !important', // Rich charcoal text color, fully readable and high-contrast
                        fontWeight: 600,
                        padding: '4px 8px',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3b82f6',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#2563eb',
                      }
                    }
                  }}
                />
                <IconButton size="small" onClick={(e) => handleSave(e)} sx={{ color: 'success.main', bgcolor: '#f0fdf4', '&:hover': { bgcolor: '#dcfce7' }, width: 28, height: 32 }}>
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={(e) => handleCancel(e)} sx={{ color: 'error.main', bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' }, width: 28, height: 32 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Box
                onClick={() => setIsEditing(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.75,
                  py: 0.75,
                  borderRadius: 2,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  userSelect: 'none',
                  '&:hover': {
                    backgroundColor: '#f1f5f9',
                    borderColor: '#cbd5e1',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    '& .edit-pencil-icon': {
                      color: '#2563eb',
                      transform: 'scale(1.1)',
                    }
                  }
                }}
              >
                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: '1.05rem' }} />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  {email || "Add business email"}
                </Typography>
                <EditIcon 
                  className="edit-pencil-icon"
                  sx={{ 
                    color: '#94a3b8', 
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease-in-out'
                  }} 
                />
              </Box>
            )}
          </Box>

          <Typography variant="body2" sx={{ color: '#64748b', mb: 2, fontSize: '0.85rem', lineHeight: 1.4 }}>
            Help us send you personalized business insights, daily tasks, and growth opportunities
          </Typography>
          
          {/* Why We Need Your Email header */}
          <Box sx={{ mb: 1.5 }}>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 700, 
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontSize: '0.85rem'
              }}
            >
              Why we need your email
              <Box sx={{ 
                width: 16, 
                height: 16, 
                borderRadius: '50%', 
                backgroundColor: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 'bold'
              }}>
                ?
              </Box>
            </Typography>
            
            {/* Benefits Content - Always Expanded */}
            <Box sx={{ mt: 1.5 }}>
              {/* Single row stack with NO scrollbar, perfectly spaced */}
              <Stack 
                direction="row" 
                spacing={1} 
                flexWrap="nowrap" 
                sx={{ 
                  mb: 2, 
                  width: '100%',
                  overflow: 'visible',
                  justifyContent: 'space-between'
                }}
              >
                {/* placement="top-start" ensures the popup extends rightward inside the container boundaries */}
                <Tooltip title="Get daily AI-generated tasks to review and approve for your business growth" placement="top-start" arrow {...tooltipProps}>
                  <Chip
                    icon={<BusinessIcon sx={{ color: '#2563eb !important', fontSize: '0.9rem !important' }} />}
                    label="Daily Business Tasks"
                    size="small"
                    sx={{
                      backgroundColor: '#f0f9ff',
                      color: '#0c4a6e',
                      border: '1px solid #0ea5e9',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: '#e0f2fe',
                        transform: 'translateY(-1px)',
                      }
                    }}
                  />
                </Tooltip>
                
                <Tooltip title="Receive personalized content strategies and performance insights" placement="top" arrow {...tooltipProps}>
                  <Chip 
                    icon={<TrendingUpIcon sx={{ color: '#16a34a !important', fontSize: '0.9rem !important' }} />}
                    label="Growth Insights"
                    size="small"
                    sx={{
                      backgroundColor: '#f0fdf4',
                      color: '#0c4a6e',
                      border: '1px solid #10b981',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: '#dcfce7',
                        transform: 'translateY(-1px)',
                      }
                    }}
                  />
                </Tooltip>
                
                <Tooltip title="Get notified about new features, resources, and business opportunities" placement="top" arrow {...tooltipProps}>
                  <Chip
                    icon={<NotificationsIcon sx={{ color: '#ea580c !important', fontSize: '0.9rem !important' }} />}
                    label="Feature Updates"
                    size="small"
                    sx={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #f59e0b',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: '#fef3c7',
                        transform: 'translateY(-1px)',
                      }
                    }}
                  />
                </Tooltip>
                
                {/* placement="top-end" ensures the popup extends leftward inside the container boundaries */}
                <Tooltip title="Your email is secure and we never spam - only business-focused content" placement="top-end" arrow {...tooltipProps}>
                  <Chip
                    icon={<SecurityIcon sx={{ color: '#7c3aed !important', fontSize: '0.9rem !important' }} />}
                    label="No Spam Promise"
                    size="small"
                    sx={{
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #9ca3af',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: '#e5e7eb',
                        transform: 'translateY(-1px)',
                      }
                    }}
                  />
                </Tooltip>
              </Stack>

              {/* Side-by-Side Platform & Security Cards (Clean, Basic White/Transparent No-Blue Background with ORIGINAL Full Texts Centered) */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2 }}>
                {/* AI-First, Human-Approved Platform Card */}
                <Box
                  sx={{
                    p: 1.5, // Reduced padding from 2 to 1.5
                    borderRadius: 3,
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75, // Reduced gap from 1 to 0.75
                    transition: 'all 0.2s ease',
                    textAlign: 'center', // Center aligned text
                    alignItems: 'center', // Center items horizontally
                    '&:hover': {
                      borderColor: '#3b82f6',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.05)',
                    }
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
                    <VerifiedIcon sx={{ color: '#3b82f6', fontSize: '1.1rem' }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#1e293b', 
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap' // Strictly keeps title in a single line
                      }}
                    >
                      AI-First, Human-Approved Platform
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.45, fontSize: '0.75rem', textAlign: 'center' }}>
                    We generate tasks and insights, but you stay in control. Your email helps us send you the right opportunities to review and approve for maximum business growth.
                  </Typography>
                </Box>

                {/* Your Data is Secure & Private Card */}
                <Box
                  sx={{
                    p: 1.5, // Reduced padding from 2 to 1.5
                    borderRadius: 3,
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75, // Reduced gap from 1 to 0.75
                    transition: 'all 0.2s ease',
                    textAlign: 'center', // Center aligned text
                    alignItems: 'center', // Center items horizontally
                    '&:hover': {
                      borderColor: '#10b981',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.05)',
                    }
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
                    <SecurityIcon sx={{ color: '#10b981', fontSize: '1.1rem' }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#1e293b', 
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap' // Strictly keeps title in a single line
                      }}
                    >
                      Your Data is Secure & Private
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.45, fontSize: '0.75rem', textAlign: 'center' }}>
                    We use OAuth 2.0 for secure connections. Your credentials are never stored. You can revoke access anytime from your account settings.
                  </Typography>
                </Box>
              </Box>

            </Box>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};
