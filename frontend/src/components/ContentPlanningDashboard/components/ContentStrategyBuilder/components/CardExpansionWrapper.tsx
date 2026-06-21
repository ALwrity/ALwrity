import React, { useState, useEffect } from 'react';
import { Box, Paper } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface CardExpansionWrapperProps {
  children: React.ReactNode;
  isExpanded?: boolean;
  onExpand?: (expanded: boolean) => void;
  gridSize?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
}

const CardExpansionWrapper: React.FC<CardExpansionWrapperProps> = ({
  children,
  isExpanded = false,
  onExpand,
  gridSize = { xs: 12, sm: 12, md: 6, lg: 4 }
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpandedState, setIsExpandedState] = useState(false);

  useEffect(() => {
    console.log('🎯 CardExpansionWrapper mounted');
  }, []);

  const handleMouseEnter = () => {
    console.log('🖱️ Mouse entered card');
    setIsHovered(true);
    setIsExpandedState(true);
    onExpand?.(true);
  };

  const handleMouseLeave = () => {
    console.log('🖱️ Mouse left card');
    setIsHovered(false);
    setIsExpandedState(false);
    onExpand?.(false);
  };

  const handleClick = () => {
    console.log('🖱️ Card clicked');
  };

  const isExpandedFinal = isExpanded || isExpandedState;
  
  console.log('🎯 Card expansion state:', { isExpandedFinal, isHovered, isExpandedState });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        gridColumn: isExpandedFinal ? '1 / -1' : 'auto',
        transition: 'grid-column 0.3s ease',
        zIndex: isExpandedFinal ? 10 : 1,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <motion.div
        animate={{
          scale: isExpandedFinal ? 1.02 : 1,
          boxShadow: isExpandedFinal 
            ? '0 8px 32px rgba(0, 0, 0, 0.15)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        style={{
          height: '100%',
          width: '100%',
        }}
      >
        <Paper
          sx={{
            p: isExpandedFinal ? 3 : 2,
            height: '100%',
            width: '100%',
            borderRadius: 2,
            background: isExpandedFinal 
              ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
              : 'background.paper',
            border: isExpandedFinal ? '3px solid' : '1px solid',
            borderColor: isExpandedFinal ? 'primary.main' : 'divider',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              borderColor: 'primary.main',
            },
            '&::before': isExpandedFinal ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              zIndex: 1,
             } : {},
           }}
        >
          {/* Hover Hint - Only show when not expanded */}
          <AnimatePresence>
            {!isExpandedFinal && isHovered && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(25, 118, 210, 0.9)',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  zIndex: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  pointerEvents: 'none',
                }}
              >
                <ExpandMoreIcon sx={{ fontSize: '0.8rem' }} />
                Expand
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isExpandedFinal && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(25, 118, 210, 0.1)',
                  borderRadius: '8px 8px 0 0',
                  padding: '8px 16px',
                  fontSize: '0.75rem',
                  color: 'primary.main',
                  fontWeight: 500,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '1rem' }}>✨</span>
                Expanded for better readability
              </motion.div>
            )}
          </AnimatePresence>
          
          <Box sx={{ 
            position: 'relative',
            zIndex: 3,
            mt: isExpandedFinal ? 3 : 0,
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {children}
          </Box>
        </Paper>
      </motion.div>
    </div>
  );
};

export default CardExpansionWrapper;
