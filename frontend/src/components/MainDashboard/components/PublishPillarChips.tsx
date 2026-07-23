import React from 'react';
import { Box, Chip, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Facebook, 
  LinkedIn, 
  Twitter, 
  Instagram, 
  YouTube, 
  Article,
  CheckCircle
} from '@mui/icons-material';
import EnhancedTodayChip from './EnhancedTodayChip';
import { TodayTask } from '../../../types/workflow';

interface PublishPillarChipsProps {
  isHovered: boolean;
  pillarColor: string;
}

const PublishPillarChips: React.FC<PublishPillarChipsProps> = ({ 
  isHovered, 
  pillarColor 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Today's tasks for Publish pillar
  const todayTasks: TodayTask[] = [
    {
      id: "publish-facebook-post",
      pillarId: "publish",
      title: "Publish reviewed Facebook post",
      description: "Post 'ALwrity AI Content Generation' on Facebook",
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 10,
      actionType: 'navigate' as const,
      actionUrl: '/facebook-writer',
      icon: Facebook,
      color: "#1877F2",
      enabled: true,
      action: () => navigate('/facebook-writer')
    },
    {
      id: "publish-linkedin-article",
      pillarId: "publish",
      title: "Schedule LinkedIn article",
      description: "Publish 'AI Agents frameworks latest news' on LinkedIn",
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 15,
      actionType: 'navigate' as const,
      actionUrl: '/linkedin-studio',
      icon: LinkedIn,
      color: "#0077B5",
      enabled: true,
      action: () => navigate('/linkedin-studio')
    },
    {
      id: "publish-review-content",
      pillarId: "publish",
      title: "Review pending content",
      description: "Review 3 pending blog posts for website",
      status: 'pending' as const,
      priority: 'medium' as const,
      estimatedTime: 25,
      actionType: 'navigate' as const,
      actionUrl: '/content-review',
      icon: Article,
      color: "#FF6B35",
      enabled: false,
      action: () => {}
    }
  ];

  const handleChipClick = (platform: string) => {
    switch (platform) {
      case 'facebook':
        navigate('/facebook-writer');
        break;
      case 'linkedin':
        navigate('/linkedin-studio');
        break;
      default:
        break;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      {/* Today Chip - Always visible */}
      <EnhancedTodayChip
        pillarId="publish"
        pillarTitle="Publish"
        pillarColor={pillarColor}
        tasks={todayTasks}
        delay={0}
      />

      {/* Progressive disclosure chips */}
      <AnimatePresence>
        {isHovered && (
          <>
            {/* Reviewed Chip */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              style={{ position: 'relative' }}
            >
              <Chip
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label="Reviewed"
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '2px solid #4CAF50',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    transform: 'translateY(-2px) scale(1.05)',
                    boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4), 0 0 0 1px rgba(255,255,255,0.2)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(255, 107, 53, 0.4)',
                  border: '2px solid white',
                }}
              >
                3
              </Box>
            </motion.div>

            {/* Facebook Chip */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Chip
                icon={<Facebook sx={{ fontSize: 16 }} />}
                label="Facebook"
                onClick={() => handleChipClick('facebook')}
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'linear-gradient(135deg, #1877F2 0%, #166FE5 100%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '2px solid #1877F2',
                  boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-2px) scale(1.05)',
                    boxShadow: '0 6px 20px rgba(24, 119, 242, 0.4), 0 0 0 1px rgba(255,255,255,0.2)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </motion.div>

            {/* LinkedIn Chip */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Chip
                icon={<LinkedIn sx={{ fontSize: 16 }} />}
                label="LinkedIn"
                onClick={() => handleChipClick('linkedin')}
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'linear-gradient(135deg, #0077B5 0%, #005885 100%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '2px solid #0077B5',
                  boxShadow: '0 4px 12px rgba(0, 119, 181, 0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-2px) scale(1.05)',
                    boxShadow: '0 6px 20px rgba(0, 119, 181, 0.4), 0 0 0 1px rgba(255,255,255,0.2)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </motion.div>

            {/* Disabled Social Media Chips */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Chip
                icon={<Twitter sx={{ fontSize: 16 }} />}
                label="Twitter"
                disabled
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'rgba(29, 161, 242, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(29, 161, 242, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <Chip
                icon={<Instagram sx={{ fontSize: 16 }} />}
                label="Instagram"
                disabled
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'rgba(225, 48, 108, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(225, 48, 108, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <Chip
                icon={<YouTube sx={{ fontSize: 16 }} />}
                label="YouTube"
                disabled
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'rgba(255, 0, 0, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(255, 0, 0, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.7 }}
            >
              <Chip
                icon={<Article sx={{ fontSize: 16 }} />}
                label="Wix/WordPress"
                disabled
                sx={{
                  height: 28,
                  minWidth: 100,
                  background: 'rgba(255, 107, 53, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(255, 107, 53, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Ellipsis indicator when not hovered */}
      {!isHovered && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '1.2rem',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        >
          ⋯
        </Box>
      )}
    </Box>
  );
};

export default PublishPillarChips;
