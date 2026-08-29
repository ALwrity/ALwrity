/**
 * SmartResearchInfo Component
 * 
 * Tooltip/modal explaining what Smart Research does and why it's useful.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import BrainIcon from '@mui/icons-material/Psychology';
import CheckIcon from '@mui/icons-material/CheckCircle';
import TrendIcon from '@mui/icons-material/TrendingUp';
import QuoteIcon from '@mui/icons-material/FormatQuote';
import StatsIcon from '@mui/icons-material/BarChart';
import CaseStudyIcon from '@mui/icons-material/School';
import CloseIcon from '@mui/icons-material/Close';

interface SmartResearchInfoProps {
  variant?: 'tooltip' | 'button' | 'icon';
}

export const SmartResearchInfo: React.FC<SmartResearchInfoProps> = ({ variant = 'icon' }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const tooltipContent = (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        🧠 Smart Research
      </Typography>
      <Typography variant="body2">
        AI understands what you want to accomplish and finds exactly what you need:
        statistics, expert quotes, case studies, trends, and more — all organized
        by deliverable type instead of generic search results.
      </Typography>
    </Box>
  );

  if (variant === 'tooltip') {
    return (
      <>
        <Tooltip title={tooltipContent} arrow placement="top">
          <IconButton size="small" onClick={handleOpen} sx={{ ml: 1 }}>
            <InfoIcon fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <BrainIcon color="primary" />
              <Typography variant="h6">What is Smart Research?</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {tooltipContent}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Got it</Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Tooltip title="Learn about Smart Research" arrow>
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            ml: 0.5,
            color: 'primary.main',
            '&:hover': { bgcolor: 'primary.light', color: 'white' },
          }}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <BrainIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h5" fontWeight={600}>
                🧠 Smart Research
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" paragraph>
            Traditional research gives you links to sift through. Smart Research understands
            what you want to accomplish and delivers exactly what you need — organized and ready to use.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom fontWeight={600}>
            How it works:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <BrainIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="1. AI Analyzes Your Intent"
                secondary="Understands what you want to accomplish, what questions need answering, and what deliverables you expect"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <TrendIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="2. Generates Targeted Queries"
                secondary="Creates multiple focused queries, each targeting a specific deliverable (statistics, quotes, case studies, etc.)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="3. Extracts Exactly What You Need"
                secondary="Analyzes results through the lens of your intent, extracting statistics, expert quotes, case studies, trends, and more"
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom fontWeight={600}>
            What you'll get:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            <Chip icon={<StatsIcon />} label="Statistics with Citations" color="primary" variant="outlined" />
            <Chip icon={<QuoteIcon />} label="Expert Quotes" color="primary" variant="outlined" />
            <Chip icon={<CaseStudyIcon />} label="Case Studies" color="primary" variant="outlined" />
            <Chip icon={<TrendIcon />} label="Trends Analysis" color="primary" variant="outlined" />
            <Chip label="Best Practices" color="primary" variant="outlined" />
            <Chip label="Comparisons" color="primary" variant="outlined" />
            <Chip label="Step-by-Step Guides" color="primary" variant="outlined" />
            <Chip label="Pros & Cons" color="primary" variant="outlined" />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom fontWeight={600}>
            Benefits:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="No more sifting through generic search results" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Get exactly what you need, organized by deliverable type" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save time with AI-powered extraction and analysis" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Content-ready outputs: statistics, quotes, case studies, trends" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="contained" color="primary">
            Got it!
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SmartResearchInfo;
