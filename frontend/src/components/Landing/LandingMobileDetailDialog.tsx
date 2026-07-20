import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import Close from '@mui/icons-material/Close';

export type LandingMobileDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  media?: React.ReactNode;
};

const LandingMobileDetailDialog: React.FC<LandingMobileDetailDialogProps> = ({
  open,
  onClose,
  title,
  description,
  badge,
  icon,
  actionLabel,
  onAction,
  media,
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="body"
      BackdropProps={{
        sx: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          backgroundColor: alpha('#000', 0.62),
        },
      }}
      PaperProps={{
        sx: {
          position: 'relative',
          overflow: 'visible',
          mx: 1.5,
          borderRadius: 3,
          bgcolor: '#121212',
          backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.02)} 100%)`,
          border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: theme.zIndex.modal + 1,
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{
            width: 36,
            height: 36,
            bgcolor: alpha('#fff', 0.14),
            border: `1px solid ${alpha('#fff', 0.35)}`,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
            '&:hover': {
              bgcolor: alpha('#fff', 0.22),
            },
          }}
        >
          <Close sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 2.25, pt: 3.5, position: 'relative', zIndex: 1 }}>
        <Stack spacing={1.5}>
          {media}

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.25)}, ${alpha(theme.palette.secondary.main, 0.25)})`,
                color: theme.palette.primary.main,
                '& .MuiSvgIcon-root': { fontSize: 22 },
              }}
            >
              {icon}
            </Avatar>
            <Chip
              label={badge}
              size="small"
              sx={{
                background: alpha(theme.palette.primary.main, 0.2),
                color: theme.palette.primary.main,
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 24,
                mr: 4,
              }}
            />
          </Stack>

          <Typography variant="h6" component="h3" fontWeight={700} sx={{ color: '#fff', fontSize: '1.05rem' }}>
            {title}
          </Typography>

          <Typography variant="body2" sx={{ color: alpha('#fff', 0.85), lineHeight: 1.55, fontSize: '0.88rem' }}>
            {description}
          </Typography>

          {actionLabel && onAction && (
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                onAction();
                onClose();
              }}
              sx={{
                mt: 0.5,
                py: 1.1,
                textTransform: 'none',
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              }}
            >
              {actionLabel}
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default LandingMobileDetailDialog;
