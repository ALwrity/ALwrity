import React from 'react';
import { Box, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Facebook, 
  LinkedIn, 
  Twitter, 
  Forum,
  Comment,
  Chat,
  Groups
} from '@mui/icons-material';
import EnhancedTodayChip from './EnhancedTodayChip';
import { TodayTask } from '../../../types/workflow';

interface EngagePillarChipsProps {
  isHovered: boolean;
  pillarColor: string;
}

const EngagePillarChips: React.FC<EngagePillarChipsProps> = ({ 
  isHovered, 
  pillarColor 
}) => {
  const navigate = useNavigate();

  // Today's tasks for Engage pillar
  const todayTasks: TodayTask[] = [
    {
      id: "engage-blog-comment",
      pillarId: "engage",
      title: "Reply to blog comment",
      description: "Received comment on blog 'AI Persona for Content writing'",
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 10,
      actionType: 'navigate' as const,
      actionUrl: '/content-planning',
      icon: Comment,
      color: "#E91E63",
      enabled: true,
      action: () => navigate('/content-planning')
    },
    {
      id: "engage-twitter-mention",
      pillarId: "engage",
      title: "Respond to Twitter mention",
      description: "Reply to Twitter comment from @username",
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 5,
      actionType: 'navigate' as const,
      actionUrl: '/content-planning',
      icon: Twitter,
      color: "#1DA1F2",
      enabled: true,
      action: () => navigate('/content-planning')
    },
    {
      id: "engage-linkedin-post",
      pillarId: "engage",
      title: "Engage with LinkedIn post",
      description: "Respond to comments on latest LinkedIn post",
      status: 'pending' as const,
      priority: 'medium' as const,
      estimatedTime: 15,
      actionType: 'navigate' as const,
      actionUrl: '/linkedin-engagement',
      icon: LinkedIn,
      color: "#0077B5",
      enabled: false,
      action: () => {}
    }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      {/* Today Chip - Always visible */}
      <EnhancedTodayChip
        pillarId="engage"
        pillarTitle="Engage"
        pillarColor={pillarColor}
        tasks={todayTasks}
        delay={0}
      />

      {/* Progressive disclosure chips */}
      <AnimatePresence>
        {isHovered && (
          <>
            {/* Disabled Engagement Chips */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Chip
                icon={<LinkedIn sx={{ fontSize: 16 }} />}
                label="LinkedIn Comments"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
                  background: 'rgba(0, 119, 181, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(0, 119, 181, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Chip
                icon={<Facebook sx={{ fontSize: 16 }} />}
                label="Facebook Comments"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
                  background: 'rgba(24, 119, 242, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(24, 119, 242, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Chip
                icon={<Groups sx={{ fontSize: 16 }} />}
                label="Community Engagement"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
                  background: 'rgba(233, 30, 99, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(233, 30, 99, 0.2)',
                  opacity: 0.6,
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Chip
                icon={<Chat sx={{ fontSize: 16 }} />}
                label="Live Chat Support"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
                  background: 'rgba(76, 175, 80, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(76, 175, 80, 0.2)',
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
                icon={<Forum sx={{ fontSize: 16 }} />}
                label="Forum Discussions"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
                  background: 'rgba(255, 152, 0, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid rgba(255, 152, 0, 0.2)',
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

export default EngagePillarChips;
