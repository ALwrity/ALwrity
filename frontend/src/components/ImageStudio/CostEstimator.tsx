import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  alpha,
  Divider,
} from '@mui/material';
import AttachMoney from '@mui/icons-material/AttachMoney';
import Info from '@mui/icons-material/Info';
import { motion } from 'framer-motion';

const MotionPaper = motion.create(Paper);

interface CostEstimate {
  provider: string;
  model?: string;
  operation: string;
  num_images: number;
  cost_per_image: number;
  total_cost: number;
  currency: string;
  estimated: boolean;
}

interface CostEstimatorProps {
  estimate: CostEstimate;
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({ estimate }) => {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: estimate.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get cost level (low, medium, high)
  const getCostLevel = () => {
    if (estimate.total_cost === 0) return { label: 'Free', color: '#10b981' };
    if (estimate.total_cost < 0.50) return { label: 'Low Cost', color: '#10b981' };
    if (estimate.total_cost < 2.00) return { label: 'Medium Cost', color: '#f59e0b' };
    return { label: 'Premium Cost', color: '#8b5cf6' };
  };

  const costLevel = getCostLevel();

  return (
    <MotionPaper
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      elevation={0}
      sx={{
        background: `linear-gradient(135deg, ${alpha(costLevel.color, 0.05)}, ${alpha(costLevel.color, 0.02)})`,
        border: `1px solid ${alpha(costLevel.color, 0.2)}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                background: `linear-gradient(135deg, ${costLevel.color}, ${alpha(costLevel.color, 0.7)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <AttachMoney sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Cost Estimate
              </Typography>
              {estimate.estimated && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                  Estimated pricing
                </Typography>
              )}
            </Box>
          </Stack>
          
          <Chip
            label={costLevel.label}
            size="small"
            sx={{
              background: costLevel.color,
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
            }}
          />
        </Box>

        <Divider />

        {/* Cost Breakdown */}
        <Stack spacing={1.5}>
          {/* Per Image Cost */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
              Cost per image
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
              {formatCurrency(estimate.cost_per_image)}
            </Typography>
          </Box>

          {/* Number of Images */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
              Number of images
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
              ×{estimate.num_images}
            </Typography>
          </Box>

          {/* Provider */}
          {estimate.provider && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
                Provider
              </Typography>
              <Chip
                label={estimate.provider}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  background: alpha('#667eea', 0.1),
                  color: '#667eea',
                }}
              />
            </Box>
          )}

          <Divider />

          {/* Total Cost */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              Total Cost
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: costLevel.color,
              }}
            >
              {formatCurrency(estimate.total_cost)}
            </Typography>
          </Box>
        </Stack>

        {/* Info Note */}
        <Box
          sx={{
            background: alpha('#667eea', 0.05),
            borderRadius: 1,
            p: 1.5,
            display: 'flex',
            gap: 1,
          }}
        >
          <Info sx={{ fontSize: 16, color: '#667eea', flexShrink: 0, mt: 0.2 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
            Costs are estimated and may vary. You will only be charged for successfully generated images. Failed generations are not billed.
          </Typography>
        </Box>
      </Stack>
    </MotionPaper>
  );
};

