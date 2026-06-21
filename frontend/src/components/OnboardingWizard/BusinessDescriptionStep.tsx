import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Box, Button, TextField, Typography, Card, CardContent, CircularProgress, Alert, MenuItem, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { businessInfoApi, BusinessInfo } from '../../api/businessInfo';
import { onboardingCache } from '../../services/onboardingCache';

interface BusinessDescriptionStepProps {
  onBack: () => void;
  onContinue: (businessData?: BusinessInfo) => void;
}

interface WebsiteIntakeForm {
  business_name: string;
  business_summary: string;
  template_type: 'blog' | 'profile' | 'shop' | 'dont_know';
  geo_scope: 'global' | 'local' | 'hyper_local' | 'dont_know';
  primary_offerings: string;
  target_audience: string;
  audience_type: 'B2B' | 'B2C' | 'Both' | 'dont_know';
  brand_tone: string;
  brand_adjectives: string;
  avoid_terms: string;
  competitor_urls: string;
  contact_email: string;
  contact_phone: string;
  contact_location: string;
  product_asset_mode: 'upload' | 'generate' | 'dont_know';
  product_asset_urls: string;
  product_asset_ids: string;
}

const templateOptions = [
  { value: 'dont_know', label: "Don't know yet" },
  { value: 'blog', label: 'Blog / Creator site' },
  { value: 'profile', label: 'Profile / Services' },
  { value: 'shop', label: 'Shop / Products' }
];

const geoScopeOptions = [
  { value: 'dont_know', label: "Don't know yet" },
  { value: 'global', label: 'Global' },
  { value: 'local', label: 'Local' },
  { value: 'hyper_local', label: 'Hyper-local' }
];

const audienceTypeOptions = [
  { value: 'dont_know', label: "Don't know yet" },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C' },
  { value: 'Both', label: 'Both' }
];

const productAssetOptions = [
  { value: 'dont_know', label: "Don't know yet" },
  { value: 'upload', label: 'Upload product images' },
  { value: 'generate', label: 'Generate with AI (Product Marketing Studio)' }
];

const BusinessDescriptionStep: React.FC<BusinessDescriptionStepProps> = ({ onBack, onContinue }) => {
  const [intakeForm, setIntakeForm] = useState<WebsiteIntakeForm>({
    business_name: '',
    business_summary: '',
    template_type: 'dont_know',
    geo_scope: 'dont_know',
    primary_offerings: '',
    target_audience: '',
    audience_type: 'dont_know',
    brand_tone: 'Don\'t know yet',
    brand_adjectives: '',
    avoid_terms: '',
    competitor_urls: '',
    contact_email: '',
    contact_phone: '',
    contact_location: '',
    product_asset_mode: 'dont_know',
    product_asset_urls: '',
    product_asset_ids: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // const [showExamples, setShowExamples] = useState(false);
  // Resolve the active Clerk user so the business info write carries
  // the correct tenant id (the previous `const userId = 1;` was a
  // multi-tenant collision).
  const { user } = useUser();

  useEffect(() => {
    console.log('🔄 BusinessDescriptionStep mounted. Loading cached data...');
    const cachedData = onboardingCache.getStepData(2)?.businessInfo;
    const cachedIntake = onboardingCache.getStepData(2)?.websiteIntake;
    if (cachedData) {
      console.log('✅ Loaded cached business info:', cachedData);
    } else {
      console.log('ℹ️ No cached business info found.');
    }
    if (cachedIntake) {
      setIntakeForm(cachedIntake);
      console.log('✅ Loaded cached website intake:', cachedIntake);
    }
  }, []);

  const handleIntakeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setIntakeForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAndContinue = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const derivedBusinessInfo: BusinessInfo = {
      business_description: intakeForm.business_summary || 'No description provided',
      industry: intakeForm.template_type === 'dont_know' ? '' : intakeForm.template_type,
      target_audience: intakeForm.target_audience,
      business_goals: intakeForm.primary_offerings,
    };
    console.log('🚀 Attempting to save business info:', derivedBusinessInfo);

    try {
      const dataToSave = { ...derivedBusinessInfo, user_id: user?.id ? Number(user.id) : undefined };

      const response = await businessInfoApi.saveBusinessInfo(dataToSave);
      console.log('✅ Business info saved to DB:', response);
      setSuccess('Business information saved successfully!');

      // Also save to cache for consistency with other steps
      onboardingCache.saveStepData(2, { businessInfo: response, websiteIntake: intakeForm, hasWebsite: false });
      console.log('✅ Business info saved to cache.');

      setTimeout(() => {
        onContinue(response);
      }, 1500); // Give user time to see success message
    } catch (err) {
      console.error('❌ Error saving business info:', err);
      setError('Failed to save business information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Create your AI-generated website
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Share a few details (even 3-4 lines is enough). If you are unsure, choose “Don't know yet” and we’ll fill the gaps with AI.
      </Typography>

      <Card sx={{ 
        p: 3, 
        mb: 3,
        bgcolor: '#FFFFFF',
        color: '#0B1220',
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        borderRadius: '16px'
      }}>
        <CardContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon fontSize="inherit" />}>{success}</Alert>}

          <TextField
            label="Business Name"
            name="business_name"
            value={intakeForm.business_name}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="e.g., Maple Street Homestays"
            disabled={loading}
          />
          <TextField
            label="Describe what you do (3-4 lines)"
            name="business_summary"
            value={intakeForm.business_summary}
            onChange={handleIntakeChange}
            fullWidth
            multiline
            rows={4}
            margin="normal"
            required
            helperText={`${intakeForm.business_summary.length}/1000 characters`}
            inputProps={{ maxLength: 1000 }}
            disabled={loading}
          />
          <TextField
            label="Website template"
            name="template_type"
            value={intakeForm.template_type}
            onChange={handleIntakeChange}
            select
            fullWidth
            margin="normal"
            disabled={loading}
          >
            {templateOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Audience scope"
            name="geo_scope"
            value={intakeForm.geo_scope}
            onChange={handleIntakeChange}
            select
            fullWidth
            margin="normal"
            disabled={loading}
          >
            {geoScopeOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Primary offerings (comma separated)"
            name="primary_offerings"
            value={intakeForm.primary_offerings}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="e.g., Short stays, airport pickup, local tours"
            disabled={loading}
          />
          <TextField
            label="Target audience"
            name="target_audience"
            value={intakeForm.target_audience}
            onChange={handleIntakeChange}
            fullWidth
            multiline
            rows={2}
            margin="normal"
            placeholder="e.g., Families visiting Pune for weddings"
            disabled={loading}
          />
          <TextField
            label="Audience type"
            name="audience_type"
            value={intakeForm.audience_type}
            onChange={handleIntakeChange}
            select
            fullWidth
            margin="normal"
            disabled={loading}
          >
            {audienceTypeOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Brand tone"
            name="brand_tone"
            value={intakeForm.brand_tone}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="Friendly, premium, minimal"
            disabled={loading}
          />
          <TextField
            label="Brand adjectives (comma separated)"
            name="brand_adjectives"
            value={intakeForm.brand_adjectives}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="e.g., cozy, reliable, modern"
            disabled={loading}
          />
          <TextField
            label="Avoid words or styles"
            name="avoid_terms"
            value={intakeForm.avoid_terms}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="e.g., pushy sales language"
            disabled={loading}
          />
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Contact details (we’ll use your account email if left blank)
          </Typography>
          <TextField
            label="Contact email"
            name="contact_email"
            value={intakeForm.contact_email}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="name@business.com"
            disabled={loading}
          />
          <TextField
            label="Contact phone"
            name="contact_phone"
            value={intakeForm.contact_phone}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="+91 90000 00000"
            disabled={loading}
          />
          <TextField
            label="Location"
            name="contact_location"
            value={intakeForm.contact_location}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="City, Region"
            disabled={loading}
          />
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Optional: competitor URLs (1-3)
          </Typography>
          <TextField
            label="Competitor URLs (comma separated)"
            name="competitor_urls"
            value={intakeForm.competitor_urls}
            onChange={handleIntakeChange}
            fullWidth
            margin="normal"
            placeholder="https://competitor1.com, https://competitor2.com"
            disabled={loading}
          />
          {intakeForm.template_type === 'shop' && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Product images
              </Typography>
              <TextField
                label="Product images"
                name="product_asset_mode"
                value={intakeForm.product_asset_mode}
                onChange={handleIntakeChange}
                select
                fullWidth
                margin="normal"
                disabled={loading}
              >
                {productAssetOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                color="secondary"
                href="/campaign-creator"
                sx={{ mt: 1 }}
                disabled={loading}
              >
                Open Product Marketing Studio
              </Button>
              <TextField
                label="Product image URLs (comma separated)"
                name="product_asset_urls"
                value={intakeForm.product_asset_urls}
                onChange={handleIntakeChange}
                fullWidth
                multiline
                rows={2}
                margin="normal"
                placeholder="https://cdn.example.com/product-1.jpg, https://cdn.example.com/product-2.jpg"
                disabled={loading}
              />
              <TextField
                label="Product asset IDs (comma separated)"
                name="product_asset_ids"
                value={intakeForm.product_asset_ids}
                onChange={handleIntakeChange}
                fullWidth
                margin="normal"
                placeholder="asset_123, asset_456"
                disabled={loading}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onBack}
          startIcon={<ArrowBackIcon />}
          disabled={loading}
          sx={{ color: 'text.secondary', borderColor: 'text.disabled' }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveAndContinue}
          endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          disabled={loading || !intakeForm.business_summary}
        >
          {loading ? 'Saving...' : 'Save & Continue'}
        </Button>
      </Box>

    </Box>
  );
};

export default BusinessDescriptionStep;
