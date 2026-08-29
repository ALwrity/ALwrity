import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Tooltip
} from '@mui/material';
import { motion } from 'framer-motion';
import TodayIcon from '@mui/icons-material/Today';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { TodayTask } from '../../../types/workflow';
import EnhancedTodayModal from './EnhancedTodayModal';

interface EnhancedTodayChipProps {
  pillarId: string;
  pillarTitle: string;
  pillarColor: string;
  tasks: TodayTask[];
  delay?: number;
}


// Enhanced Today Chip Component
const EnhancedTodayChip: React.FC<EnhancedTodayChipProps> = ({
  pillarId,
  pillarTitle,
  pillarColor,
  tasks,
  delay = 0
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [userManuallyClosed, setUserManuallyClosed] = useState(false);
  const { currentWorkflow } = useWorkflowStore();

  // Prefer live workflow tasks (to reflect updated statuses), fallback to props
  const liveTasks = currentWorkflow?.tasks && Array.isArray(currentWorkflow.tasks) && currentWorkflow.tasks.length > 0
    ? currentWorkflow.tasks
    : tasks;

  // Get pillar-specific progress
  const pillarTasks = liveTasks.filter(task => task.pillarId === pillarId);
  const completedPillarTasks = pillarTasks.filter(task => task.status === 'completed' || task.status === 'skipped').length;
  const pillarProgress = pillarTasks.length > 0 ? (completedPillarTasks / pillarTasks.length) * 100 : 0;
  const isPillarComplete = pillarTasks.length > 0 && completedPillarTasks === pillarTasks.length;

  // Auto-shake animation (only when pillar is not complete)
  useEffect(() => {
    if (isPillarComplete) {
      setShouldShake(false); // Stop any ongoing animation
      return; // Don't animate if pillar is complete
    }
    
    const interval = setInterval(() => {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 600);
    }, 8000 + delay * 1000);

    return () => clearInterval(interval);
  }, [delay, isPillarComplete, liveTasks]);

  // Auto-open Plan pillar modal when workflow starts (only if user hasn't manually closed it AND tasks are incomplete)
  useEffect(() => {
    if (pillarId === 'plan' && 
        currentWorkflow?.workflowStatus === 'in_progress' && 
        !modalOpen && 
        !userManuallyClosed &&
        !isPillarComplete) { // Only auto-open if Plan pillar tasks are not complete
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setModalOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentWorkflow?.workflowStatus, pillarId, modalOpen, userManuallyClosed, isPillarComplete]);

  const handleClick = () => {
    setModalOpen(true);
    setUserManuallyClosed(false); // Reset the flag when user manually opens
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    if (pillarId === 'plan') {
      setUserManuallyClosed(true); // Mark that user manually closed the Plan modal
    }
  };

  return (
    <>
      <motion.div
        animate={shouldShake && !isPillarComplete ? { x: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.6 }}
      >
        <Tooltip title={`🎯 Today's ${pillarTitle} Tasks - Click to View!`} arrow>
          <Box
            onClick={handleClick}
            data-pillar-id={pillarId}
            sx={{
              position: 'relative',
              cursor: 'pointer',
              '&:hover': {
                transform: 'translateY(-2px) scale(1.05)',
                '&::before': {
                  opacity: 1,
                  transform: 'translateX(0)'
                }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(45deg, transparent 30%, ${pillarColor}20 50%, transparent 70%)`,
                opacity: 0,
                transform: 'translateX(-100%)',
                transition: 'all 0.6s ease',
                borderRadius: 'inherit',
                zIndex: 1
              }
            }}
          >
            <Chip
              icon={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TodayIcon sx={{ 
                    fontSize: 16, 
                    '@keyframes rotate': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' }
                    },
                    animation: 'rotate 3s linear infinite'
                  }} />
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    ⚡
                  </motion.span>
                </Box>
              }
              label="Today"
              sx={{
                height: 32,
                minWidth: 110,
                background: `linear-gradient(135deg, ${pillarColor} 0%, ${pillarColor}CC 100%)`,
                color: 'white',
                fontWeight: 700,
                fontSize: '0.75rem',
                border: `2px solid ${pillarColor}`,
                boxShadow: `
                  0 4px 12px ${pillarColor}40,
                  0 0 0 1px rgba(255,255,255,0.1),
                  inset 0 1px 0 rgba(255,255,255,0.2)
                `,
                backdropFilter: 'blur(25px)',
                position: 'relative',
                zIndex: 1, // Lower z-index to not cover the large tick
                '&:hover': {
                  boxShadow: `
                    0 6px 20px ${pillarColor}60,
                    0 0 0 1px rgba(255,255,255,0.2),
                    inset 0 1px 0 rgba(255,255,255,0.3)
                  `,
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  bottom: -2,
                  background: `linear-gradient(45deg, ${pillarColor}, transparent, ${pillarColor})`,
                  borderRadius: 'inherit',
                  zIndex: -1,
                  '@keyframes attention-ring': {
                    '0%, 100%': { opacity: 0, transform: 'scale(1)' },
                    '50%': { opacity: 0.3, transform: 'scale(1.1)' }
                  },
                  animation: 'attention-ring 2s ease-in-out infinite'
                }
              }}
            />
            
            {/* Progress indicator */}
            {pillarProgress > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: pillarProgress === 100 ? '#4CAF50' : pillarColor,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  border: '2px solid white'
                }}
              >
                {pillarProgress === 100 ? '✓' : Math.round(pillarProgress)}
              </Box>
            )}
          </Box>
        </Tooltip>
      </motion.div>

      {/* Enhanced Modal */}
      <EnhancedTodayModal
        open={modalOpen}
        onClose={handleCloseModal}
        pillarId={pillarId}
        pillarTitle={pillarTitle}
        pillarColor={pillarColor}
        tasks={liveTasks}
        onPreventAutoReopen={() => setUserManuallyClosed(true)}
      />

    </>
  );
};

export default EnhancedTodayChip;
