import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  Chip,
  alpha,
  CircularProgress,
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

interface EnhancedTopicChoicesModalProps {
  open: boolean;
  onClose: () => void;
  enhancedChoices: string[];
  enhancedRationales: string[];
  onSelectChoice: (index: number, editedChoice: string) => void;
  loading?: boolean;
}

const CHOICE_LABELS = [
  { label: "Professional", color: "#2563eb", description: "Expert-led approach" },
  { label: "Storytelling", color: "#7c3aed", description: "Human interest approach" },
  { label: "Trendy", color: "#dc2626", description: "Contemporary approach" },
];

export const EnhancedTopicChoicesModal: React.FC<EnhancedTopicChoicesModalProps> = ({
  open,
  onClose,
  enhancedChoices,
  enhancedRationales,
  onSelectChoice,
  loading = false,
}) => {
  const [editedChoices, setEditedChoices] = useState<string[]>(() => {
  const safeChoices = Array.isArray(enhancedChoices) ? enhancedChoices : [];
  const result = [];
  for (let i = 0; i < 3; i++) {
    result[i] = (safeChoices[i] && typeof safeChoices[i] === 'string') ? safeChoices[i] : '';
  }
  return result;
});
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    // Ensure editedChoices is always an array of length 3 with proper fallbacks
    const safeChoices = Array.isArray(enhancedChoices) ? enhancedChoices : [];
    const initializedChoices = [];
    
    // Always create exactly 3 elements with safe values
    for (let i = 0; i < 3; i++) {
      initializedChoices[i] = (safeChoices[i] && typeof safeChoices[i] === 'string') ? safeChoices[i] : '';
    }
    
    setEditedChoices(initializedChoices);
    setEditedIndices(new Set());
  }, [enhancedChoices]);

  const handleChoiceEdit = (index: number, newValue: string) => {
    const updatedChoices = [...editedChoices];
    updatedChoices[index] = newValue;
    setEditedChoices(updatedChoices);
    
    // Track which choices have been edited
    const newEditedIndices = new Set(editedIndices);
    if (newValue !== (enhancedChoices[index] || '')) {
      newEditedIndices.add(index);
    } else {
      newEditedIndices.delete(index);
    }
    setEditedIndices(newEditedIndices);
  };

  const handleSelectChoice = (index: number) => {
    onSelectChoice(index, editedChoices[index] || '');
  };

  const handleClose = () => {
    setEditedIndices(new Set());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 3,
          background: "linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
          color: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesomeIcon />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Choose Your Enhanced Topic
          </Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: "#ffffff" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 2 }}>
            <CircularProgress size={48} thickness={5} sx={{ color: "#2563eb" }} />
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: "center" }}>
              Generating enhanced topic options with AI...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              Creating professional, storytelling, and contemporary angles for your topic
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {enhancedChoices.slice(0, 3).map((choice, index) => {
              if (!choice) return null;
              return (
              <Box
                key={index}
                sx={{
                  p: 3,
                  borderRadius: 2.5,
                  border: `2px solid ${alpha(CHOICE_LABELS[index]?.color || '#667eea', 0.2)}`,
                  background: "#ffffff",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: CHOICE_LABELS[index]?.color || '#667eea',
                    boxShadow: `0 4px 12px ${alpha(CHOICE_LABELS[index]?.color || '#667eea', 0.15)}`,
                    transform: "translateY(-2px)",
                  },
                }}
              >
                {/* Choice Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Chip
                    label={CHOICE_LABELS[index]?.label || `Choice ${index + 1}`}
                    size="small"
                    sx={{
                      background: CHOICE_LABELS[index]?.color || '#667eea',
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      height: 28,
                      px: 1,
                    }}
                  />
                  <Typography variant="body2" sx={{ 
                    color: "#64748b", 
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    letterSpacing: "0.025em"
                  }}>
                    {CHOICE_LABELS[index]?.description || 'Enhanced topic option'}
                  </Typography>
                  {editedIndices.has(index) && (
                    <EditIcon sx={{ fontSize: 16, color: "#64748b", ml: 'auto' }} />
                  )}
                </Box>

                {/* Editable Text Area */}
                <TextField
                  multiline
                  rows={4}
                  fullWidth
                  value={editedChoices[index] || ''}
                  onChange={(e) => handleChoiceEdit(index, e.target.value)}
                  variant="outlined"
                  placeholder="Enhanced topic will appear here..."
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: alpha("#ffffff", 0.9),
                      borderRadius: 2,
                      border: "1px solid rgba(148, 163, 184, 0.23)",
                      boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.05)",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        backgroundColor: "#ffffff",
                        borderColor: alpha(CHOICE_LABELS[index]?.color || '#667eea', 0.3),
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 3px rgba(0, 0, 0, 0.05)",
                      },
                      "&.Mui-focused": {
                        backgroundColor: "#ffffff",
                        borderColor: CHOICE_LABELS[index]?.color || '#667eea',
                        boxShadow: `0 0 0 3px ${alpha(CHOICE_LABELS[index]?.color || '#667eea', 0.1)}, 0 4px 12px rgba(0, 0, 0, 0.08)`,
                      },
                    },
                    "& .MuiOutlinedInput-input": {
                      fontSize: "1rem",
                      lineHeight: 1.6,
                      letterSpacing: "0.01em",
                      padding: "16px 14px",
                      color: "#1e293b",
                      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                      fontWeight: 400,
                      "&::placeholder": {
                        color: "#94a3b8",
                        fontStyle: "italic",
                        opacity: 0.8,
                      },
                    },
                    "& .MuiInputBase-multiline": {
                      padding: "0 !important",
                    },
                  }}
                />

                {/* Rationale */}
                {enhancedRationales[index] && (
                  <Box sx={{ 
                    mt: 2.5, 
                    p: 2, 
                    borderRadius: 1.5, 
                    background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)",
                    border: "1px solid rgba(99, 102, 241, 0.1)",
                  }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "#4338ca",
                        fontSize: "0.875rem",
                        mb: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                      }}
                    >
                      <LightbulbIcon sx={{ fontSize: 18, color: "#6366f1" }} />
                      Why this works:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        lineHeight: 1.6,
                        color: "#475569",
                        fontSize: "0.875rem",
                        letterSpacing: "0.005em",
                      }}
                    >
                      {enhancedRationales[index] || 'Enhanced topic option'}
                    </Typography>
                  </Box>
                )}

                {/* Action Button */}
                <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    onClick={() => handleSelectChoice(index)}
                    variant="contained"
                    size="medium"
                    startIcon={<CheckCircleIcon />}
                    disabled={(() => {
    try {
      return !editedChoices[index] || !editedChoices[index].trim();
    } catch (error) {
      console.error('Error in disabled condition:', error, { index, editedChoices });
      return true; // Disable button if there's an error
    }
  })()}
                    sx={{
                      textTransform: "none",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      borderRadius: 2,
                      color: "#ffffff",
                      px: 3,
                      py: 1,
                      border: "1px solid rgba(148, 211, 255, 0.6)",
                      background: "linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255,255,255,0.22)",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        background: "linear-gradient(120deg, #0284c7 0%, #1d4ed8 55%, #1e40af 100%)",
                        boxShadow: "0 6px 20px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                        transform: "translateY(-1px)",
                      },
                      "&:active": {
                        transform: "translateY(0)",
                        boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                      },
                      "&:disabled": {
                        background: "#f1f5f9",
                        color: "#94a3b8",
                        borderColor: "rgba(148, 163, 184, 0.3)",
                        boxShadow: "none",
                        "&:hover": {
                          background: "#f1f5f9",
                          transform: "none",
                        },
                      },
                    }}
                  >
                    Choose This Topic
                  </Button>
                </Box>
              </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: "1px solid rgba(148, 163, 184, 0.2)" }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            borderColor: "rgba(148, 163, 184, 0.4)",
            color: "#64748b",
            "&:hover": {
              borderColor: "#94a3b8",
              backgroundColor: alpha("#64748b", 0.04),
            },
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};
