import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  Fade,
  Stack,
  Tooltip,
  Alert,
  IconButton,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Email as EmailIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface EmailSectionProps {
  email: string;
  onEmailChange: (email: string) => void;
  emailDigestOptIn?: boolean;
  onEmailDigestOptInChange?: (optIn: boolean) => void;
  userTimezone?: string;
  onUserTimezoneChange?: (tz: string) => void;
}

const EmailSection: React.FC<EmailSectionProps> = ({ 
  email, 
  onEmailChange,
  emailDigestOptIn = false,
  onEmailDigestOptInChange,
  userTimezone = 'UTC',
  onUserTimezoneChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempEmail, setTempEmail] = useState(email);
  const [showBenefits, setShowBenefits] = useState<boolean>(false);
  const [localOptIn, setLocalOptIn] = useState(emailDigestOptIn);

  useEffect(() => {
    setTempEmail(email);
  }, [email]);

  useEffect(() => {
    setLocalOptIn(emailDigestOptIn);
  }, [emailDigestOptIn]);

  useEffect(() => {
    if (!userTimezone || userTimezone === 'UTC') {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && onUserTimezoneChange) {
          onUserTimezoneChange(tz);
        }
      } catch (e) {
        console.warn('Could not capture timezone:', e);
      }
    }
  }, [userTimezone, onUserTimezoneChange]);

  const handleSave = () => {
    if (tempEmail && tempEmail.includes('@')) {
      onEmailChange(tempEmail);
      if (onEmailDigestOptInChange) {
        onEmailDigestOptInChange(localOptIn);
      }
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempEmail(email);
    setLocalOptIn(emailDigestOptIn);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleOptInChange = (checked: boolean) => {
    setLocalOptIn(checked);
    if (onEmailDigestOptInChange) {
      onEmailDigestOptInChange(checked);
    }
  };

  return (
    <Fade in timeout={400} mountOnEnter unmountOnExit>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            📧 Your Business Email Address
          </Typography>
          
          {isEditing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="your@business.com"
                autoFocus
                sx={{ 
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                  }
                }}
              />
              <IconButton size="small" onClick={handleSave} sx={{ color: 'success.main', bgcolor: '#f0fdf4', '&:hover': { bgcolor: '#dcfce7' } }}>
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleCancel} sx={{ color: 'error.main', bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Tooltip title="Click to edit email">
              <Chip
                icon={<EmailIcon sx={{ color: 'white !important' }} />}
                label={email || "Add business email"}
                onClick={() => setIsEditing(true)}
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  fontWeight: 500,
                  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    boxShadow: '0 6px 8px -1px rgba(59, 130, 246, 0.6)',
                  },
                  fontSize: '0.95rem',
                  height: 32,
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              />
            </Tooltip>
          )}
        </Box>

        <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
          Help us send you personalized business insights, daily tasks, and growth opportunities
        </Typography>
        
        <Box 
          sx={{ 
            mt: 2,
            cursor: 'pointer',
            '&:hover': {
              '& .benefits-trigger': {
                color: '#3b82f6',
              }
            }
          }}
          onMouseEnter={() => setShowBenefits(true)}
          onMouseLeave={() => setShowBenefits(false)}
        >
          <Typography 
            variant="subtitle2" 
            className="benefits-trigger"
            sx={{ 
              fontWeight: 600, 
              color: '#64748b',
              transition: 'color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            Why we need your email:
            <Box sx={{ 
              width: 16, 
              height: 16, 
              borderRadius: '50%', 
              backgroundColor: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#64748b'
            }}>
              ?
            </Box>
          </Typography>
          
          <Fade in={showBenefits} timeout={300} mountOnEnter unmountOnExit>
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Tooltip title="Get daily AI-generated tasks to review and approve for your business growth" placement="top">
                  <Chip
                    icon={<BusinessIcon />}
                    label="Daily Business Tasks"
                    size="small"
                    sx={{
                      backgroundColor: '#f0f9ff',
                      color: '#0c4a6e',
                      border: '1px solid #0ea5e9',
                      '&:hover': {
                        backgroundColor: '#e0f2fe',
                      }
                    }}
                  />
                </Tooltip>
                
                <Tooltip title="Receive personalized content strategies and performance insights" placement="top">
                  <Chip 
                    icon={<TrendingUpIcon />}
                    label="Growth Insights"
                    size="small"
                    sx={{
                      backgroundColor: '#f0fdf4',
                      color: '#0c4a6e',
                      border: '1px solid #10b981',
                      '&:hover': {
                        backgroundColor: '#dcfce7',
                      }
                    }}
                  />
                </Tooltip>
                
                <Tooltip title="Get notified about new features, resources, and business opportunities" placement="top">
                  <Chip
                    icon={<NotificationsIcon />}
                    label="Feature Updates"
                    size="small"
                    sx={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #f59e0b',
                      '&:hover': {
                        backgroundColor: '#fef3c7',
                      }
                    }}
                  />
                </Tooltip>
                
                <Tooltip title="Your email is secure and we never spam - only business-focused content" placement="top">
                  <Chip
                    icon={<SecurityIcon />}
                    label="No Spam Promise"
                    size="small"
                    sx={{
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #9ca3af',
                      '&:hover': {
                        backgroundColor: '#e5e7eb',
                      }
                    }}
                  />
                </Tooltip>
              </Stack>
              
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 2,
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #0ea5e9',
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    color: '#0ea5e9'
                  }
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <VerifiedIcon sx={{ color: '#0ea5e9' }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0c4a6e' }}>
                      AI-First, Human-Approved Platform
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#0c4a6e', mt: 0.5 }}>
                      We generate tasks and insights, but you stay in control. Your email helps us send you 
                      the right opportunities to review and approve for maximum business growth.
                    </Typography>
                  </Box>
                </Stack>
              </Alert>
              
              <Alert 
                severity="info" 
                sx={{ 
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #0ea5e9',
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    color: '#0ea5e9'
                  }
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <SecurityIcon sx={{ color: '#0ea5e9' }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0c4a6e' }}>
                      Your Data is Secure & Private
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#0c4a6e', mt: 0.5 }}>
                      We use OAuth 2.0 for secure connections. Your credentials are never stored. 
                      You can revoke access anytime from your account settings.
                    </Typography>
                  </Box>
                </Stack>
              </Alert>
            </Box>
          </Fade>
        </Box>

        {/* Email Digest Opt-in Checkbox */}
        <Box sx={{ mt: 3, p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, border: '1px solid #86efac' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={localOptIn}
                onChange={(e) => handleOptInChange(e.target.checked)}
                sx={{ color: '#16a34a', '&.Mui-checked': { color: '#16a34a' } }}
              />
            }
            label={
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#166534' }}>
                  Send me a daily AI agent team summary
                </Typography>
                <Typography variant="caption" sx={{ color: '#15803d' }}>
                  Get a personalized daily plan with tasks, progress, and insights for your business growth. 
                  We never send marketing emails — only your own AI-generated tasks.
                </Typography>
              </Box>
            }
          />
          {localOptIn && userTimezone && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#15803d' }}>
              We'll send at 9:00 AM your time ({userTimezone})
            </Typography>
          )}
        </Box>
      </Box>
    </Fade>
  );
};

export default EmailSection;
