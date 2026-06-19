import React, { useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LegalPageLayout from './LegalPageLayout';

const ContactPage: React.FC = () => {
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
      metaDescription="Contact ALwrity — reach our team at info@alwrity.com for product, billing, and partnership inquiries."
      canonicalPath="/contact"
    >
      <Typography paragraph>
        Have a question about ALwrity? Send us a message and we will respond at{' '}
        <a href="mailto:info@alwrity.com">info@alwrity.com</a>.
      </Typography>

      {sent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Your email client should open with your message ready to send.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5} maxWidth={520}>
          <TextField label="Your name" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Email address" type="email" required fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Message" required fullWidth multiline minRows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button type="submit" variant="contained" startIcon={<SendIcon />} sx={{ alignSelf: 'flex-start' }}>
            Send Message
          </Button>
        </Stack>
      </Box>
    </LegalPageLayout>
  );
};

export default ContactPage;
