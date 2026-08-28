import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { apiClient } from '../../api/client';

interface EmailPreferences {
  email: string;
  email_digest_opt_in: boolean;
  timezone: string;
}

interface EmailPreferencesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (prefs: EmailPreferences) => void;
}

export const EmailPreferencesModal: React.FC<EmailPreferencesModalProps> = ({ open, onClose, onSaved }) => {
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(true);
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get('/api/onboarding/email-preferences');
      const data = resp.data as EmailPreferences;
      setEmail(data.email || '');
      setTimezone(data.timezone || 'UTC');
      setOptIn(data.email_digest_opt_in !== false);
    } catch (err) {
      setError('Could not load email preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadPreferences();
    }
  }, [open, loadPreferences]);

  const emailValid = email.trim().length > 0 && email.includes('@');

  const handleSave = async () => {
    if (!emailValid) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await apiClient.put('/api/onboarding/email-preferences', {
        email: email.trim(),
        email_digest_opt_in: optIn,
        timezone,
      });
      onSaved?.(resp.data as EmailPreferences);
      onClose();
    } catch (err) {
      setError('Could not save email preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 700 }}>
        <EmailIcon sx={{ color: '#2563eb' }} />
        Email Preferences
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#1e293b', fontWeight: 600, mb: 0.75 }}>
                Business email address
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@business.com"
                error={!emailValid && email.length > 0}
                helperText={!emailValid && email.length > 0 ? 'Enter a valid business email' : 'Used for your daily AI agent team summary.'}
              />
            </Box>

            <Box sx={{ p: 2, backgroundColor: optIn ? '#f0fdf4' : '#f8fafc', borderRadius: 2, border: `1px solid ${optIn ? '#86efac' : '#e2e8f0'}` }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={optIn}
                    onChange={(e) => setOptIn(e.target.checked)}
                    sx={{ color: '#16a34a', '&.Mui-checked': { color: '#16a34a' } }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: optIn ? '#166534' : '#334155' }}>
                      Send me a daily AI agent team summary
                    </Typography>
                    <Typography variant="caption" sx={{ color: optIn ? '#15803d' : '#64748b' }}>
                      Get a personalized daily plan with tasks, progress, and insights for your business growth.
                    </Typography>
                  </Box>
                }
              />
              {optIn && timezone && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#15803d' }}>
                  <NotificationsActiveIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.5 }} />
                  We'll send at 9:00 AM your time ({timezone})
                </Typography>
              )}
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: '#64748b' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || loading || !emailValid}
          sx={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
            textTransform: 'none',
            '&:hover': { background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' },
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmailPreferencesModal;