import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SendIcon from '@mui/icons-material/Send';
import LegalPageLayout from './LegalPageLayout';
import ContactJsonLd from './ContactJsonLd';
import { submitContactForm } from '../../api/contactApi';

const CONTACT_CHANNELS = [
  {
    icon: <HelpOutlineIcon />,
    title: 'Product and support',
    description: 'Questions about features, onboarding, or your account.',
    action: 'info@alwrity.com',
    href: 'mailto:info@alwrity.com?subject=ALwrity%20support%20request',
    subjectHint: "Put 'Support' in your subject line.",
  },
  {
    icon: <HandshakeIcon />,
    title: 'Partnerships',
    description: 'Integrations, agencies, and enterprise collaboration.',
    action: 'info@alwrity.com',
    href: 'mailto:info@alwrity.com?subject=ALwrity%20partnership%20inquiry',
    subjectHint: "Put 'Partnership' in your subject line.",
  },
  {
    icon: <EmailIcon />,
    title: 'General inquiries',
    description: 'Press, feedback, or anything else — we read every message.',
    action: 'info@alwrity.com',
    href: 'mailto:info@alwrity.com',
    subjectHint: 'Any subject line is fine — we read every message.',
  },
] as const;

const SUCCESS_MESSAGE = "Message sent — we'll reply within 5 business days.";
const FORM_HELPER_TEXT =
  "Fill in the form below and we'll send your message to our team. We'll reply within 5 business days.";
const MESSAGE_HINT_ID = 'contact-message-hint';

type FieldErrors = {
  name: string;
  email: string;
  message: string;
};

const EMPTY_FIELD_ERRORS: FieldErrors = { name: '', email: '', message: '' };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Light-surface inputs: visible border + dark typed text (global theme is dark-mode). */
const contactFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#FFFFFF',
    borderRadius: 2,
    '& fieldset': {
      borderColor: '#CBD5E1',
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: '#94A3B8',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#6366f1',
      borderWidth: '2px',
    },
    '&.Mui-disabled fieldset': {
      borderColor: '#E2E8F0',
    },
  },
  '& .MuiInputBase-input': {
    color: '#111827',
    WebkitTextFillColor: '#111827',
    fontSize: '1rem',
  },
  '& .MuiInputLabel-root': {
    color: '#475569',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#6366f1',
  },
  '& .MuiFormHelperText-root': {
    color: '#64748b',
    mt: 0.75,
  },
  '& .MuiFormHelperText-root.Mui-error': {
    color: '#dc2626',
  },
};

function validateFields(name: string, email: string, message: string): FieldErrors {
  const errors: FieldErrors = { ...EMPTY_FIELD_ERRORS };
  if (!name.trim()) {
    errors.name = 'Please enter your name.';
  }
  if (!email.trim() || !emailPattern.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!message.trim()) {
    errors.message = 'Please enter your message.';
  }
  return errors;
}

const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const errors = validateFields(name, email, message);
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.message) {
      return;
    }

    setSubmitting(true);

    try {
      await submitContactForm({ name: name.trim(), email: email.trim(), message: message.trim() });
      setSent(true);
      setSubmitError(null);
      setFieldErrors(EMPTY_FIELD_ERRORS);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: unknown) {
      setSent(false);
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'We could not send your message. Please email info@alwrity.com directly.';
      setSubmitError(typeof detail === 'string' ? detail : 'We could not send your message. Please email info@alwrity.com directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalPageLayout
      title="Contact & Support"
      metaDescription="Contact ALwrity for product support, billing questions, and partnership inquiries. Email info@alwrity.com or use the form below."
      canonicalPath="/contact"
      showLastUpdated={false}
      surface="light"
      ogImage="og-alwrity-contact.png"
      ogImageAlt="Contact ALwrity — support and partnerships"
    >
      <ContactJsonLd />

      {/* Intro */}
      <Box sx={{ mb: { xs: 4, md: 5 } }}>
        <Typography paragraph sx={{ color: '#374151', mb: 2.5, lineHeight: 1.75 }}>
          We&apos;re a small, open-source team building ALwrity in the open. Reach out for product support,
          billing help, or partnerships — we typically respond within 5 business days.
        </Typography>

        <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.7, pl: { xs: 0, sm: 2 }, borderLeft: { xs: 'none', sm: '3px solid #E5E7EB' } }}>
          <Box component="span" fontWeight={700} sx={{ color: '#1a1a2e', display: 'block', mb: 0.75 }}>
            Billing and subscriptions
          </Box>
          For plan changes, invoices, or refunds, email{' '}
          <Link href="mailto:info@alwrity.com?subject=ALwrity%20billing%20question" sx={{ color: '#6366f1' }}>
            info@alwrity.com
          </Link>{' '}
          with subject line{' '}
          <Box component="span" fontWeight={600}>
            Billing — [your account email]
          </Box>
          , or review plans on our{' '}
          <Link component={RouterLink} to="/pricing" sx={{ color: '#6366f1' }}>
            Pricing
          </Link>{' '}
          page first.
        </Typography>
      </Box>

      {/* Contact channels */}
      <Box sx={{ mb: { xs: 5, md: 6 } }}>
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontSize: '1.25rem', fontWeight: 700, mb: { xs: 2, md: 2.5 }, color: '#1a1a2e' }}
        >
          How can we help?
        </Typography>

        <Grid container spacing={{ xs: 2.5, md: 3 }}>
          {CONTACT_CHANNELS.map((channel) => (
            <Grid item xs={12} md={4} key={channel.title}>
              <Card
                component="a"
                href={channel.href}
                sx={{
                  display: 'block',
                  height: '100%',
                  textDecoration: 'none',
                  color: 'inherit',
                  bgcolor: '#F8FAFC',
                  border: '1px solid #E5E7EB',
                  borderRadius: 2,
                  cursor: 'pointer',
                  boxShadow: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    borderColor: '#6366f1',
                    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.12)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3 }, '&:last-child': { pb: { xs: 2.5, md: 3 } } }}>
                  <Stack spacing={1.75}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(99, 102, 241, 0.12)',
                        color: '#6366f1',
                      }}
                    >
                      {channel.icon}
                    </Box>
                    <Typography variant="subtitle1" component="h3" fontWeight={700} sx={{ color: '#1a1a2e' }}>
                      {channel.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.65 }}>
                      {channel.description}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6366f1', fontWeight: 600, fontSize: '0.9rem', pt: 0.5 }}>
                      {channel.action}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', lineHeight: 1.55, pt: 0.25 }}>
                      {channel.subjectHint}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Contact form */}
      <Box
        sx={{
          pt: { xs: 1, md: 2 },
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1.5, color: '#1a1a2e' }}
        >
          Send a message
        </Typography>

        <Typography variant="body2" sx={{ color: '#64748b', mb: 3, lineHeight: 1.7, maxWidth: 560 }}>
          {FORM_HELPER_TEXT}
        </Typography>

        {sent && (
          <Alert severity="success" sx={{ mb: 3, maxWidth: 520 }}>
            {SUCCESS_MESSAGE}
          </Alert>
        )}

        {submitError && (
          <Alert severity="error" sx={{ mb: 3, maxWidth: 520 }}>
            {submitError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} aria-label="Contact form" noValidate>
          <Stack spacing={3.5} maxWidth={520}>
            <TextField
              label="Your name"
              required
              fullWidth
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
              }}
              disabled={submitting}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name}
              sx={contactFieldSx}
              inputProps={{ autoComplete: 'name', maxLength: 200 }}
            />
            <TextField
              label="Email address"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              disabled={submitting}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
              sx={contactFieldSx}
              inputProps={{ autoComplete: 'email', maxLength: 320 }}
            />
            <TextField
              label="Message"
              required
              fullWidth
              multiline
              minRows={5}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (fieldErrors.message) setFieldErrors((prev) => ({ ...prev, message: '' }));
              }}
              disabled={submitting}
              error={!!fieldErrors.message}
              helperText={fieldErrors.message || 'Maximum 1,500 characters.'}
              sx={contactFieldSx}
              inputProps={{
                autoComplete: 'off',
                maxLength: 1500,
                'aria-describedby': MESSAGE_HINT_ID,
              }}
              FormHelperTextProps={{ id: MESSAGE_HINT_ID }}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              disabled={submitting}
              sx={{ alignSelf: 'flex-start', mt: 0.5, px: 3, py: 1.25, bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
            >
              {submitting ? 'Sending…' : 'Send message'}
            </Button>
          </Stack>
        </Box>
      </Box>    </LegalPageLayout>
  );
};

export default ContactPage;
