import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
  useMediaQuery,
  useTheme
} from '@mui/material';
import Check from '@mui/icons-material/Check';

interface WizardStepperProps {
  activeStep: number;
  completedFrontier: number;
  furthestAccessibleStep: number;
  isMobile: boolean;
  steps: Array<{
    label: string;
    description: string;
    icon: string;
  }>;
  onStepClick: (stepIndex: number) => void;
  progress: number;
}

/** Setup progress ring — single pink arc + white center, with grey track underneath */
const SetupProgressIcon: React.FC<{ progress: number; tooltip: string }> = ({ progress, tooltip }) => {
  const ringThickness = 4.5;

  return (
    <Tooltip
      title={tooltip}
      arrow
      placement="bottom"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: '#FFFFFF',
            color: '#000000',
            fontWeight: 700,
            fontSize: '0.75rem',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
            border: '1px solid #E2E8F0',
            '& .MuiTooltip-arrow': {
              color: '#FFFFFF',
            },
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: { xs: 32, sm: 36, md: 39 }, // reduced by another 10% (36/40/43 * 0.9)
          height: { xs: 32, sm: 36, md: 39 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Grey track circle underneath the pink progress segment */}
        <CircularProgress
          variant="determinate"
          value={100}
          size="100%"
          thickness={ringThickness}
          sx={{
            color: '#E2E8F0', // Sleek soft grey track
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 0,
          }}
        />
        {/* Pink progress arc */}
        <CircularProgress
          variant="determinate"
          value={progress}
          size="100%"
          thickness={ringThickness}
          sx={{
            color: '#EC4899',
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 1,
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
              transition: 'stroke-dashoffset 0.4s ease-in-out',
            },
          }}
        />
        {/* White inner center disc to cover the center - styled to avoid sub-pixel line artifacts */}
        <Box
          sx={{
            position: 'absolute',
            width: `calc(100% - ${ringThickness * 2}px + 0.5px)`,
            height: `calc(100% - ${ringThickness * 2}px + 0.5px)`,
            borderRadius: '50%',
            bgcolor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: '7.5px', sm: '8.5px', md: '9px' },
              fontWeight: 800,
              color: '#000000', // Title/text remains completely black
              lineHeight: 1,
            }}
          >
            {Math.round(progress)}%
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  );
};

interface ChevronBackgroundProps {
  state: 'completed' | 'active' | 'disabled';
  isFirst: boolean;
}

const ChevronBackground: React.FC<ChevronBackgroundProps> = ({ state, isFirst }) => {
  // SVG path coordinates based on isFirst
  // First step has flat left side: M 0,0 L 94,0 L 100,20 L 94,40 L 0,40 Z
  // Subsequent steps have indented left side: M 0,0 L 94,0 L 100,20 L 94,40 L 0,40 L 6,20 Z
  const path = isFirst
    ? 'M 0,0 L 94,0 L 100,20 L 94,40 L 0,40 Z'
    : 'M 0,0 L 94,0 L 100,20 L 94,40 L 0,40 L 6,20 Z';

  let fill = '#F8FAFC';
  let stroke = '#E2E8F0';
  let strokeWidth = '1';
  let filter = '';

  if (state === 'completed') {
    fill = 'url(#completed-grad-step)';
    stroke = '#C084FC'; // Premium soft purple border
    strokeWidth = '1.5';
  } else if (state === 'active') {
    fill = '#FFFFFF';
    stroke = '#E879F9'; // Vibrant young pink/magenta neon border
    strokeWidth = '2';
    filter = 'drop-shadow(0px 0px 5px rgba(232, 121, 249, 0.45))';
  }

  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        filter: filter,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <defs>
        {/* Soft, premium, modern lavender gradient for completed steps */}
        <linearGradient id="completed-grad-step" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FAF5FF" />
          <stop offset="50%" stopColor="#E9D5FF" />
          <stop offset="100%" stopColor="#D8B4FE" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
      {/* Premium Inner Bezel Path for completed steps - provides beautiful 3D glass look */}
      {state === 'completed' && (
        <path
          d={isFirst
            ? 'M 1.5,1.5 L 93.5,1.5 L 98,20 L 93.5,38.5 L 1.5,38.5 Z'
            : 'M 1,1.5 L 93.5,1.5 L 98,20 L 93.5,38.5 L 1,38.5 L 6.5,20 Z'
          }
          fill="none"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Highlighting active step inner border for extra premium contrast */}
      {state === 'active' && (
        <path
          d={isFirst
            ? 'M 1.5,1.5 L 93.5,1.5 L 98,20 L 93.5,38.5 L 1.5,38.5 Z'
            : 'M 1,1.5 L 93.5,1.5 L 98,20 L 93.5,38.5 L 1,38.5 L 6.5,20 Z'
          }
          fill="none"
          stroke="rgba(232, 121, 249, 0.15)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
};

export const WizardStepper: React.FC<WizardStepperProps> = ({
  activeStep,
  completedFrontier,
  furthestAccessibleStep,
  isMobile: propIsMobile,
  steps,
  onStepClick,
  progress
}) => {
  const theme = useTheme();
  // Ensure precise responsive breakpoints matching application standards
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const isOnFinishStep = activeStep === steps.length - 1;
  const setupProgressTooltip =
    isOnFinishStep && progress < 100
      ? 'Setup progress — complete this step to reach 100%'
      : 'ALwrity Setup progress';

  return (
    <Box
      sx={{
        background: '#FFFFFF',
        borderBottom: '1px solid #F1F5F9',
        px: { xs: 0.5, sm: 1 }, // Reduced/removed unnecessary vertical padding as requested
        py: 0.25, // Slimmest padding for zero clutter and maximum vertical space saving
        position: 'relative',
        zIndex: 2,
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.03), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          minWidth: isMobile ? '450px' : 'unset',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Step progression chevrons container (Takes full width, no dividing line or setup progress circle here) */}
        <Box
          sx={{
            display: 'flex',
            flexGrow: 1,
            alignItems: 'stretch',
            gap: 0,
          }}
        >
          {steps.map((step, index) => {
            const isFirst = index === 0;
            const isAccessible = index <= furthestAccessibleStep;
            const isCompleted = index <= completedFrontier;
            const isActive = index === activeStep;
            
            let state: 'completed' | 'active' | 'disabled' = 'disabled';
            if (isActive) state = 'active';
            else if (isCompleted) state = 'completed';

            return (
              <Tooltip key={step.label} title={step.description} arrow placement="bottom">
                <Box
                  onClick={() => {
                    if (isAccessible) {
                      onStepClick(index);
                    }
                  }}
                  sx={{
                    position: 'relative',
                    height: { xs: '40px', sm: '44px', md: '48px' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    // Interlock the chevrons perfectly using negative margins matching depth
                    marginLeft: isFirst ? 0 : { xs: '-8px', sm: '-12px', md: '-14px' },
                    cursor: isAccessible ? 'pointer' : 'default',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: isActive ? 3 : (isCompleted ? 1 : 0),
                    '&:hover': isAccessible ? {
                      transform: 'translateY(-1px) scale(1.025)',
                      zIndex: 10,
                      '& .step-text': {
                        color: isCompleted ? '#6D28D9' : '#1E293B',
                      }
                    } : {},
                  }}
                >
                  {/* Responsive vector chevron background */}
                  <ChevronBackground state={state} isFirst={isFirst} />

                  {/* Content Container */}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: { xs: 0.6, sm: 1 },
                      width: '100%',
                      height: '100%',
                      // Offset content slightly right for indented steps to preserve visual symmetry
                      pl: isFirst ? { xs: 0.8, sm: 1.2 } : { xs: 1.5, sm: 1.8, md: 2 },
                      pr: { xs: 0.8, sm: 1.2 },
                    }}
                  >
                    {/* Step icon — single-layer circles to prevent border overlap */}
                    <Box sx={{ flexShrink: 0, lineHeight: 0 }}>
                      {isCompleted ? (
                        <Box
                          sx={{
                            width: { xs: 22, sm: 26, md: 28 },
                            height: { xs: 22, sm: 26, md: 28 },
                            borderRadius: '50%',
                            background: '#7C3AED',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(124, 58, 237, 0.2)',
                            transition: 'all 0.25s ease',
                          }}
                        >
                          <Check sx={{ fontSize: { xs: 14, sm: 16, md: 18 }, color: '#FFFFFF' }} />
                        </Box>
                      ) : isActive ? (
                        <Box
                          sx={{
                            width: { xs: 22, sm: 26, md: 28 },
                            height: { xs: 22, sm: 26, md: 28 },
                            borderRadius: '50%',
                            border: '2px solid #D946EF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#FFFFFF',
                            boxSizing: 'border-box',
                            transition: 'all 0.25s ease',
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                              fontWeight: 800,
                              color: '#D946EF',
                              lineHeight: 1,
                            }}
                          >
                            {index + 1}
                          </Typography>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            width: { xs: 22, sm: 26, md: 28 },
                            height: { xs: 22, sm: 26, md: 28 },
                            borderRadius: '50%',
                            border: '1.5px solid #CBD5E1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#F8FAFC',
                            boxSizing: 'border-box',
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                              fontWeight: 600,
                              color: '#64748B',
                              lineHeight: 1,
                            }}
                          >
                            {index + 1}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Step Label */}
                    <Typography
                      className="step-text"
                      sx={{
                        fontSize: { xs: '14px', sm: '15px', md: '16px' },
                        fontWeight: 600,
                        color: isActive 
                          ? '#000000' // Solid Black for active step
                          : (isCompleted ? '#7C3AED' : '#475569'), // Purple for completed, dark grey for uncompleted
                        textDecoration: 'none', // Removed underline style at all stages
                        transition: 'all 0.25s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {step.label}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Setup Progress Icon — after Finish step, no divider line */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            pl: { xs: 0.75, sm: 1 },
            mr: { xs: '18px', sm: '24px', md: '26px' }, // Shifting it left so it aligns perfectly with the help and skip gap above
          }}
        >
          <SetupProgressIcon progress={progress} tooltip={setupProgressTooltip} />
        </Box>

      </Box>
    </Box>
  );
};
