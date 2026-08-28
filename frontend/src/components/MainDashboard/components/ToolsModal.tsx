import React from 'react';
import {
  Box,
  Modal,
  Typography,
  IconButton,
  Grid,
  // Stack,
  // Chip,
  // Divider
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ToolCard from '../../shared/ToolCard';
import { Tool } from '../../shared/types';
import { getToolsForCategory } from '../../shared/utils';

interface ToolsModalProps {
  open: boolean;
  onClose: () => void;
  categoryName?: string;
  category?: any;
  searchQuery?: string;
  searchResults?: Tool[];
  onToolClick: (tool: Tool) => void;
  favorites: string[];
  onToggleFavorite: (toolName: string) => void;
}

const ToolsModal: React.FC<ToolsModalProps> = ({
  open,
  onClose,
  categoryName,
  category,
  searchQuery,
  searchResults,
  onToolClick,
  favorites,
  onToggleFavorite
}) => {
  const isSearchMode = !!searchQuery;
  
  // Handle different modes: search, all tools, or specific category
  let tools: Tool[] = [];
  if (isSearchMode) {
    tools = searchResults || [];
  } else if (categoryName === null) {
    // All Tools mode - get tools from all categories
    const allTools: Tool[] = [];
    if (category && typeof category === 'object') {
      // category is the entire toolCategories object
      Object.values(category).forEach((cat: any) => {
        if (cat && typeof cat === 'object') {
          // Check if this is a valid category with tools or subCategories
          if ('tools' in cat || 'subCategories' in cat) {
            const categoryTools = getToolsForCategory(cat, null);
            if (categoryTools && Array.isArray(categoryTools)) {
              allTools.push(...categoryTools);
            }
          }
        }
      });
    }
    tools = allTools;
  } else {
    // Specific category mode
    const categoryTools = getToolsForCategory(category || null, null);
    tools = categoryTools && Array.isArray(categoryTools) ? categoryTools : [];
  }
  
  // Ensure tools is always an array
  if (!Array.isArray(tools)) {
    tools = [];
  }
  
  const title = isSearchMode ? `Search Results for "${searchQuery}"` : categoryName || 'All Tools';
  const subtitle = isSearchMode ? `${tools.length} tools found` : `${tools.length} tools available`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        p: 1,
        mt: 2
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Box
          sx={{
            width: '98%',
            maxWidth: 'none',
            height: '95vh',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(16,24,39,0.98) 0%, rgba(26,33,56,0.98) 100%)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 2,
            boxShadow: '0 32px 100px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 3,
              borderBottom: '1px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isSearchMode ? (
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 28 }} />
              ) : categoryName === null ? (
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 28 }} />
              ) : (
                category?.icon && (
                  <Box sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 28 }}>
                    {category.icon}
                  </Box>
                )
              )}
              <Box>
                <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 800 }}>
                  {title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {subtitle}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={onClose}
              sx={{
                color: 'rgba(255,255,255,0.8)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Content */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 3
            }}
          >
            {tools.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 8,
                  textAlign: 'center'
                }}
              >
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                  {isSearchMode ? 'No tools found' : 'No tools available'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  {isSearchMode 
                    ? 'Try adjusting your search terms or browse categories'
                    : 'This category is currently empty'
                  }
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2.5}>
                <AnimatePresence>
                  {tools.map((tool: Tool, index: number) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={tool.name}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        style={{ height: '100%' }}
                      >
                        <ToolCard
                          tool={tool}
                          onToolClick={onToolClick}
                          isFavorite={favorites.includes(tool.name)}
                          onToggleFavorite={onToggleFavorite}
                        />
                      </motion.div>
                    </Grid>
                  ))}
                </AnimatePresence>
              </Grid>
            )}
          </Box>
        </Box>
      </motion.div>
    </Modal>
  );
};

export default ToolsModal;
