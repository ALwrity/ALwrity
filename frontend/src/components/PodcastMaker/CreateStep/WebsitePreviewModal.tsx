import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  IconButton,
} from "@mui/material";
import LanguageIcon from '@mui/icons-material/Language';
import AnalyzeIcon from '@mui/icons-material/PsychologyAlt';
import UseTextIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';

const extractRootDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    return hostname;
  } catch {
    return "Website";
  }
};

interface ExtractedData {
  title?: string;
  text?: string;
  summary?: string;
  highlights?: string[];
  url: string;
  image?: string;
  favicon?: string;
  subpages?: Array<{
    id?: string;
    title?: string;
    url?: string;
    summary?: string;
    text?: string;
  }>;
}

interface WebsitePreviewModalProps {
  open: boolean;
  extractedData: ExtractedData | null;
  onClose: () => void;
  onUseTextOnly: () => void;
  onAnalyzeContent: () => void;
  useTextLabel?: string;
  showAnalyzeButton?: boolean;
}

export const WebsitePreviewModal: React.FC<WebsitePreviewModalProps> = ({
  open,
  extractedData,
  onClose,
  onUseTextOnly,
  onAnalyzeContent,
  useTextLabel = "Use Text Only",
  showAnalyzeButton = true,
}) => {
  if (!extractedData) return null;

  const rootDomain = extractRootDomain(extractedData.url);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "#ffffff",
          color: "#1e293b",
          borderRadius: 3,
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.12)",
          maxWidth: "80%",
          width: "80%",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {(extractedData.favicon || extractedData.image) ? (
            <Box
              component="img"
              src={extractedData.favicon || extractedData.image}
              alt={rootDomain}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                objectFit: "contain",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
              }}
            >
              <LanguageIcon sx={{ color: "#ffffff", fontSize: "1.25rem" }} />
            </Box>
          )}
          <Stack>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: "#0f172a",
                fontSize: "1.25rem",
                letterSpacing: "-0.01em",
              }}
            >
              {rootDomain} Content Analysis
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#64748b",
                fontSize: "0.8125rem",
              }}
            >
              Extracted content from your website
            </Typography>
          </Stack>
        </Stack>
        <IconButton 
          onClick={onClose} 
          size="small" 
          sx={{ 
color: "#64748b",
              "&:hover": { 
                backgroundColor: "#f1f5f9",
              },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Title */}
        {extractedData.title && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: "#667eea",
                fontWeight: 700,
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Company / Organization
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: "#1e293b",
                fontWeight: 700,
                fontSize: "1.125rem",
                lineHeight: 1.4,
                mt: 0.5,
              }}
            >
              {extractedData.title}
            </Typography>
          </Box>
        )}

        {/* Summary */}
        {extractedData.summary && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: "#667eea",
                fontWeight: 700,
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              About
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                p: 2,
                backgroundColor: "#f1f5f9",
                borderRadius: 2,
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  color: "#334155",
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  fontWeight: 500,
                }}
              >
                {extractedData.summary.length > 800
                  ? extractedData.summary.substring(0, 800) + "..."
                  : extractedData.summary}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Highlights */}
        {extractedData.highlights && extractedData.highlights.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              sx={{
                color: "#667eea",
                fontWeight: 700,
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Key Highlights
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {extractedData.highlights.slice(0, 6).map((highlight, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    p: 1.5,
                    backgroundColor: "#fffbeb",
                    borderRadius: 1.5,
                    border: "1px solid #fed7aa",
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      mt: 0.625,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#374151",
                      fontSize: "0.875rem",
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    {highlight}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 2.5 }} />

        {/* URL */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              backgroundColor: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LanguageIcon sx={{ color: "#667eea", fontSize: "1rem" }} />
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "#94a3b8",
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Source URL
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#667eea",
                fontSize: "0.8125rem",
                fontWeight: 500,
                wordBreak: "break-all",
              }}
            >
              {extractedData.url}
            </Typography>
          </Box>
        </Box>

        {/* Image / Favicon Display */}
        {(extractedData.image || extractedData.favicon) && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: "#667eea",
                fontWeight: 700,
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Site Image
            </Typography>
            <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 2 }}>
              {extractedData.favicon && (
                <Box
                  component="img"
                  src={extractedData.favicon}
                  alt="Favicon"
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    objectFit: "contain",
                    backgroundColor: "#f8fafc",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              {extractedData.image && (
                <Box
                  component="img"
                  src={extractedData.image}
                  alt="Site"
                  sx={{
                    maxWidth: 120,
                    maxHeight: 60,
                    borderRadius: 1,
                    objectFit: "contain",
                    backgroundColor: "#f8fafc",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Subpages Display */}
        {extractedData.subpages && extractedData.subpages.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: "#667eea",
                fontWeight: 700,
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Subpages ({extractedData.subpages.length})
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {extractedData.subpages.slice(0, 4).map((subpage, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 1.5,
                    backgroundColor: "#f1f5f9",
                    borderRadius: 1.5,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#1e293b",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                    }}
                  >
                    {subpage.title || subpage.url || `Page ${index + 1}`}
                  </Typography>
                  {subpage.summary && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#64748b",
                        fontSize: "0.75rem",
                        mt: 0.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {subpage.summary}
                    </Typography>
                  )}
                  {subpage.url && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#667eea",
                        fontSize: "0.6875rem",
                        mt: 0.5,
                        display: "block",
                      }}
                    >
                      {subpage.url}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2.5,
          borderTop: "1px solid #e2e8f0",
          gap: 1.5,
          backgroundColor: "#f8fafc",
        }}
      >
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            color: "#64748b",
            borderColor: "#cbd5e1",
            px: 2,
            py: 1,
            "&:hover": {
              borderColor: "#94a3b8",
              backgroundColor: "#f1f5f9",
            },
          }}
        >
          Cancel
        </Button>

        {showAnalyzeButton && (
          <Button
            variant="contained"
            startIcon={<AnalyzeIcon sx={{ fontSize: "1rem" }} />}
            onClick={onAnalyzeContent}
            disabled
            sx={{
              textTransform: "none",
              fontWeight: 600,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              opacity: 0.6,
              px: 2,
              py: 1,
              "&:hover": {
                background: "linear-gradient(135deg, #7c8ff0 0%, #8a5cb3 100%)",
              },
            }}
          >
            Analyze Content (Coming Soon)
          </Button>
        )}

        <Button
          variant="contained"
          startIcon={<UseTextIcon sx={{ fontSize: "1rem" }} />}
          onClick={onUseTextOnly}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            px: 2.5,
            py: 1,
            "&:hover": {
              background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
              boxShadow: "0 6px 16px rgba(16, 185, 129, 0.4)",
            },
          }}
        >
          {useTextLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};