import React from 'react';
import { Box, Typography, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import Accessibility from '@mui/icons-material/Accessibility';
import Keyboard from '@mui/icons-material/Keyboard';
import Visibility from '@mui/icons-material/Visibility';
import Hearing from '@mui/icons-material/Hearing';
import TouchApp from '@mui/icons-material/TouchApp';

const AccessibilityGuide: React.FC = () => {
  return (
    <Box sx={{ p: 3, background: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Accessibility />
        Accessibility Features
      </Typography>
      
      <List dense>
        <ListItem>
          <ListItemIcon>
            <Keyboard />
          </ListItemIcon>
          <ListItemText 
            primary="Keyboard Navigation" 
            secondary="Use Tab, Enter, and Arrow keys to navigate"
          />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Visibility />
          </ListItemIcon>
          <ListItemText 
            primary="High Contrast" 
            secondary="All text meets WCAG contrast requirements"
          />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <Hearing />
          </ListItemIcon>
          <ListItemText 
            primary="Screen Reader Support" 
            secondary="ARIA labels and semantic HTML structure"
          />
        </ListItem>
        
        <ListItem>
          <ListItemIcon>
            <TouchApp />
          </ListItemIcon>
          <ListItemText 
            primary="Touch Friendly" 
            secondary="Large touch targets for mobile devices"
          />
        </ListItem>
      </List>
    </Box>
  );
};

export default AccessibilityGuide; 