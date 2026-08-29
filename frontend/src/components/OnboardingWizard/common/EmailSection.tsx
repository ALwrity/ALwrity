import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Fade,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

interface EmailSectionProps {
  emailDigestOptIn?: boolean;
  onEmailDigestOptInChange?: (optIn: boolean) => void;
  userTimezone?: string;
  onUserTimezoneChange?: (tz: string) => void;
}

const EmailSection: React.FC<EmailSectionProps> = ({
  emailDigestOptIn = true,
  onEmailDigestOptInChange,
  userTimezone = 'UTC',
  onUserTimezoneChange,
}) => {
  const [localOptIn, setLocalOptIn] = useState(emailDigestOptIn);
  const [hidden, setHidden] = useState(false);

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

  const handleOptInChange = (checked: boolean) => {
    setLocalOptIn(checked);
    setHidden(true);
    if (onEmailDigestOptInChange) {
      onEmailDigestOptInChange(checked);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <Fade in timeout={400}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
          📧 Daily Email Summary
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
          Your business email is managed in the user menu (top right) — you can update it anytime.
        </Typography>

        <Box sx={{ p: 2.5, backgroundColor: '#f0fdf4', borderRadius: 2, border: '1px solid #86efac' }}>
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
              <NotificationsActiveIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.5 }} />
              We'll send at 9:00 AM your time ({userTimezone})
            </Typography>
          )}
        </Box>
      </Box>
    </Fade>
  );
};

export default EmailSection;