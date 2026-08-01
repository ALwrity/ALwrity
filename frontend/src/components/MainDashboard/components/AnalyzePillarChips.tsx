import React from 'react';
import { Box, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Facebook, 
  LinkedIn, 
  Twitter, 
  Web,
  Analytics,
  Dashboard
} from '@mui/icons-material';
import EnhancedTodayChip from './EnhancedTodayChip';
import { TodayTask } from '../../../types/workflow';

interface AnalyzePillarChipsProps {
  isHovered: boolean;
  pillarColor: string;
}

const AnalyzePillarChips: React.FC<AnalyzePillarChipsProps> = ({ 
  isHovered, 
  pillarColor 
}) => {
  const navigate = useNavigate();

  // Today's tasks for Analyze pillar
  const todayTasks: TodayTask[] = [
    {
      id: "analyze-content-performance",
      pillarId: "analyze",
      title: "Review content performance",
      description: "Analyze last week's content engagement metrics",
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 20,
      actionType: 'navigate' as const,
      actionUrl: '/content-planning',
      icon: Analytics,
      color: "#9C27B0",
      enabled: true,
      action: () => navigate('/content-planning')
    },
    {
      id: "analyze-strategy-alignment",
      pillarId: "analyze",
      title: "Check strategy alignment",
      description: "Review content strategy against performance data",
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 15,
      actionType: 'navigate' as const,
      actionUrl: '/content-planning',
      icon: Dashboard,
      color: "#673AB7",
      enabled: true,
      action: () => navigate('/content-planning')
    },
    {
      id: "analyze-update-dashboard",
      pillarId: "analyze",
      title: "Update analytics dashboard",
      description: "Refresh analytics data for all platforms",
      status: 'pending' as const,
      priority: 'medium' as const,
      estimatedTime: 30,
      actionType: 'navigate' as const,
      actionUrl: '/analytics-dashboard',
      icon: Analytics,
      color: "#3F51B5",
      enabled: false,
      action: () => {}
    }
  ];

  const handlePlanDashboardClick = () => {
    navigate('/content-planning');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      {/* Today Chip - Always visible */}
      <EnhancedTodayChip
        pillarId="analyze"
        pillarTitle="Analyze"
        pillarColor={pillarColor}
        tasks={todayTasks}
        delay={0}
      />

      {/* Progressive disclosure chips */}
      <AnimatePresence>
        {isHovered && (
          <>
            {/* Plan Dashboard Chip */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Chip
                icon={<Dashboard sx={{ fontSize: 16 }} />}
                label="Plan Dashboard"
                onClick={handlePlanDashboardClick}
                sx={{
                  height: 28,
                  minWidth: 120,
                  background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '2px solid #9C27B0',
                  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-2px) scale(1.05)',
                    boxShadow: '0 6px 20px rgba(156, 39, 176, 0.4), 0 0 0 1px rgba(255,255,255,0.2)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </motion.div>

            {/* Disabled Analytics Chips */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Chip
                icon={<LinkedIn sx={{ fontSize: 16 }} />}
                label="LinkedIn Analytics"
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
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Chip
                icon={<Facebook sx={{ fontSize: 16 }} />}
                label="Facebook Analytics"
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
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Chip
                icon={<Twitter sx={{ fontSize: 16 }} />}
                label="Twitter Analytics"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
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
                icon={<Web sx={{ fontSize: 16 }} />}
                label="Website Analytics"
                disabled
                sx={{
                  height: 28,
                  minWidth: 120,
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

export default AnalyzePillarChips;
