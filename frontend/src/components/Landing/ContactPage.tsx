import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Link,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SendIcon from '@mui/icons-material/Send';
import LegalPageLayout from './LegalPageLayout';

const CONTACT_CHANNELS = [
  {
    icon: <HelpOutlineIcon />,
    title: 'Product & support',
    description: 'Questions about features, onboarding, or your account.',
    action: 'info@alwrity.com',
    href: 'mailto:info@alwrity.com?subject=ALwrity%20support%20request',
  },
  {
    icon: <HandshakeIcon />,
    title: 'Partnerships',
    description: 'Integrations, agencies, and enterprise collaboration.',
    action: 'info@alwrity.com',
    href: 'mailto:info@alwrity.com?subject=ALwrity%20partnership%20inquiry',
  },
  {
    icon: <EmailIcon />,
    title: 'General inquiries',
    description: 'Press, feedback, or anything else — we read every message.',
    action: 'info@alwrity.com',
    href: 'mailto:info@alwrity.com',
  },
] as const;

const ContactPage: React.FC = () => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`ALwrity inquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:info@alwrity.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <LegalPageLayout
      title="Contact Us"
      metaDescription="Contact ALwrity for product support, billing questions, and partnership inquiries. Email info@alwrity.com or use the form below."
      canonicalPath="/contact"
    >
      <Typography paragraph>
        We&apos;re a small, open-source team building ALwrity in the open. Reach out — we typically
        respond within 1–2 business days.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ fontSize: '1.25rem', fontWeight: 700, mt: 2, mb: 1.5 }}>
        How can we help?
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CONTACT_CHANNELS.map((channel) => (
          <Grid item xs={12} md={4} key={channel.title}>
            <Card
              sx={{
                height: '100%',
                bgcolor: alpha('#fff', 0.04),
                border: `1px solid ${alpha('#fff', 0.1)}`,
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Stack spacing={1.25}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      color: theme.palette.primary.light,
                    }}
                  >
                    {channel.icon}
                  </Box>
                  <Typography variant="subtitle1" component="h3" fontWeight={700} sx={{ color: '#fff' }}>
                    {channel.title}
                  </Typography>
                  <Typography variant="body2" color={alpha('#fff', 0.75)}>
                    {channel.description}
                  </Typography>
                  <Link href={channel.href} sx={{ color: theme.palette.primary.light, fontWeight: 600, fontSize: '0.9rem' }}>
                    {channel.action}
                  </Link>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" component="h2" sx={{ fontSize: '1.25rem', fontWeight: 700, mt: 1, mb: 1.5 }}>
        Send a message
      </Typography>

      {sent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Your email client should open with your message ready to send.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} aria-label="Contact form">
        <Stack spacing={2.5} maxWidth={520}>
          <TextField
            label="Your name"
            required
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ autoComplete: 'name' }}
          />
          <TextField
            label="Email address"
            type="email"
            required
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ autoComplete: 'email' }}
          />
          <TextField
            label="Message"
            required
            fullWidth
            multiline
            minRows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button type="submit" variant="contained" startIcon={<SendIcon />} sx={{ alignSelf: 'flex-start' }}>
            Send Message
          </Button>
        </Stack>
      </Box>
    </LegalPageLayout>
  );
};

export default ContactPage;
