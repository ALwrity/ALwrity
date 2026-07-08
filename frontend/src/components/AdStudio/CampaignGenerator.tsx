import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  CircularProgress
} from '@mui/material';
import { useAdStudioStore } from '../../stores/adStudioStore';
import { AdCampaignRequest } from '../../api/adStudioApi';

export const CampaignGenerator: React.FC = () => {
  const { generateCampaign, isLoading } = useAdStudioStore();
  const [formData, setFormData] = useState<AdCampaignRequest>({
    product_name: '',
    product_description: '',
    target_audience: '',
    platform: 'meta',
    tone: 'persuasive',
    num_variations: 3
  });

  const handleChange = (field: keyof AdCampaignRequest) => (e: any) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateCampaign(formData);
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Create New Ad Campaign
      </Typography>
      
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Product Name"
          margin="normal"
          required
          value={formData.product_name}
          onChange={handleChange('product_name')}
        />
        
        <TextField
          fullWidth
          label="Product Description"
          margin="normal"
          multiline
          rows={3}
          required
          value={formData.product_description}
          onChange={handleChange('product_description')}
        />
        
        <TextField
          fullWidth
          label="Target Audience"
          margin="normal"
          required
          placeholder="e.g., Marketing Professionals, Students"
          value={formData.target_audience}
          onChange={handleChange('target_audience')}
        />
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Platform</InputLabel>
          <Select
            value={formData.platform}
            label="Platform"
            onChange={handleChange('platform')}
          >
            <MenuItem value="meta">Meta Ads (Facebook/Instagram)</MenuItem>
            <MenuItem value="google">Google Search Ads</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Tone</InputLabel>
          <Select
            value={formData.tone}
            label="Tone"
            onChange={handleChange('tone')}
          >
            <MenuItem value="persuasive">Persuasive</MenuItem>
            <MenuItem value="funny">Funny</MenuItem>
            <MenuItem value="professional">Professional</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            size="large"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isLoading ? 'Generating...' : 'Generate Campaign'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};
