import React from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Alert
} from '@mui/material';
import { useAdStudioStore } from '../../stores/adStudioStore';
import { CampaignGenerator } from './CampaignGenerator';

export const AdStudioDashboard: React.FC = () => {
  const { campaign, error, resetCampaign } = useAdStudioStore();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          AI Ad Studio
        </Typography>
        {campaign && (
          <Button variant="outlined" onClick={resetCampaign}>
            Start New Campaign
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {!campaign ? (
        <CampaignGenerator />
      ) : (
        <Box>
          <Typography variant="h5" gutterBottom>
            Generated Variations ({campaign.platform})
          </Typography>
          
          {campaign.recommended_keywords.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom>Recommended Keywords:</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {campaign.recommended_keywords.map((kw, i) => (
                  <Chip key={i} label={kw} color="primary" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}

          <Grid container spacing={3}>
            {campaign.variations.map((variation, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Chip label={`Variation ${index + 1}`} size="small" />
                      {variation.predicted_ctr && (
                        <Chip 
                          label={`Est. CTR: ${variation.predicted_ctr}%`} 
                          size="small" 
                          color={variation.predicted_ctr > 4 ? "success" : "default"}
                        />
                      )}
                    </Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Headline
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                      {variation.headline}
                    </Typography>
                    
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                      Primary Text
                    </Typography>
                    <Typography variant="body2" paragraph>
                      {variation.primary_text}
                    </Typography>
                    
                    {variation.description && (
                      <>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Description
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {variation.description}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                  <CardActions sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Button variant="contained" fullWidth>
                      {variation.call_to_action}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Container>
  );
};
