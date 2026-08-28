import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/CheckCircle';
import TrendIcon from '@mui/icons-material/TrendingUp';
import InfoIcon from '@mui/icons-material/Info';
import AIIcon from '@mui/icons-material/AutoAwesome';
import { TrendsConfig } from '../../../types/intent.types';

interface TrendsKnowMoreModalProps {
  open: boolean;
  onClose: () => void;
  trendsConfig: TrendsConfig;
}

export const TrendsKnowMoreModal: React.FC<TrendsKnowMoreModalProps> = ({
  open,
  onClose,
  trendsConfig,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 2,
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <TrendIcon sx={{ color: '#10b981', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={700} color="#166534">
              Google Trends Analysis
            </Typography>
            <Typography variant="caption" color="#166534" sx={{ opacity: 0.8 }}>
              Understanding search interest and market trends
            </Typography>
          </Box>
        </Box>
        <Button
          onClick={onClose}
          sx={{
            minWidth: 'auto',
            p: 0.5,
            color: '#64748b',
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' },
          }}
        >
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* What is Google Trends? */}
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} color="#0c4a6e" gutterBottom>
            What is Google Trends?
          </Typography>
          <Typography variant="body2" color="#475569" paragraph>
            Google Trends is a free tool that shows how often specific search terms are entered into Google's search engine 
            relative to the total search volume. It provides insights into search interest over time, regional popularity, 
            and related topics/queries.
          </Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: '#f0f9ff',
              borderRadius: 1,
              border: '1px solid #bae6fd',
            }}
          >
            <Box display="flex" alignItems="start" gap={1}>
              <InfoIcon sx={{ color: '#0ea5e9', fontSize: 20, mt: 0.5 }} />
              <Box>
                <Typography variant="caption" fontWeight={600} color="#0c4a6e" display="block" gutterBottom>
                  Real-World Example
                </Typography>
                <Typography variant="caption" color="#0369a1">
                  If you're researching "AI content generation", Google Trends shows you when interest peaked, which regions 
                  show the most interest, and what related topics people are searching for. This helps you understand market 
                  timing and content opportunities.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* What Happens in the Backend? */}
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} color="#0c4a6e" gutterBottom>
            What Happens in the Backend?
          </Typography>
          <List dense>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0ea5e9',
                  }}
                >
                  1
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="API Request"
                secondary="ALwrity sends your keywords to Google Trends API with the specified timeframe and region"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: '#1e293b' }}
                secondaryTypographyProps={{ variant: 'caption', color: '#64748b' }}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0ea5e9',
                  }}
                >
                  2
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="Data Retrieval"
                secondary="Google Trends returns interest over time, regional distribution, related topics, and related queries"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: '#1e293b' }}
                secondaryTypographyProps={{ variant: 'caption', color: '#64748b' }}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0ea5e9',
                  }}
                >
                  3
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="AI Analysis"
                secondary="ALwrity's AI analyzes the trends data to identify patterns, opportunities, and optimal timing for content publication"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: '#1e293b' }}
                secondaryTypographyProps={{ variant: 'caption', color: '#64748b' }}
              />
            </ListItem>
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0ea5e9',
                  }}
                >
                  4
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="Integration"
                secondary="Trends insights are integrated into your research results, providing context for content timing, regional targeting, and topic expansion"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: '#1e293b' }}
                secondaryTypographyProps={{ variant: 'caption', color: '#64748b' }}
              />
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Why is it Important? */}
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} color="#0c4a6e" gutterBottom>
            Why is Google Trends Important?
          </Typography>
          <Box
            sx={{
              p: 2,
              backgroundColor: '#fef3c7',
              borderRadius: 1,
              border: '1px solid #fde68a',
            }}
          >
            <Typography variant="body2" color="#92400e" fontWeight={600} gutterBottom>
              🎯 Strategic Benefits:
            </Typography>
            <List dense sx={{ mt: 1 }}>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Timing Optimization"
                  secondary="Publish content when search interest is highest for maximum visibility"
                  primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: '#92400e' }}
                  secondaryTypographyProps={{ variant: 'caption', color: '#78350f' }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Regional Targeting"
                  secondary="Understand which regions show the most interest to tailor content accordingly"
                  primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: '#92400e' }}
                  secondaryTypographyProps={{ variant: 'caption', color: '#78350f' }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Content Expansion"
                  secondary="Discover related topics and queries to expand your content strategy"
                  primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: '#92400e' }}
                  secondaryTypographyProps={{ variant: 'caption', color: '#78350f' }}
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Market Intelligence"
                  secondary="Gain insights into market trends, emerging topics, and competitor interest"
                  primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: '#92400e' }}
                  secondaryTypographyProps={{ variant: 'caption', color: '#78350f' }}
                />
              </ListItem>
            </List>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* What Trends Will Uncover */}
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <AIIcon sx={{ color: '#0ea5e9', fontSize: 24 }} />
            <Typography variant="subtitle1" fontWeight={700} color="#0c4a6e">
              What Trends Will Uncover
            </Typography>
          </Box>
          {trendsConfig.expected_insights.length > 0 ? (
            <List dense sx={{ backgroundColor: '#f9fafb', borderRadius: 1, p: 1 }}>
              {trendsConfig.expected_insights.map((insight, idx) => (
                <ListItem key={idx} sx={{ py: 0.75, px: 1 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <CheckIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={insight}
                    primaryTypographyProps={{ variant: 'body2', color: '#374151', fontWeight: 500 }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="#64748b" sx={{ fontStyle: 'italic' }}>
              No specific insights configured for this research.
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: '#10b981',
            '&:hover': { backgroundColor: '#059669' },
            fontWeight: 600,
          }}
        >
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
};
