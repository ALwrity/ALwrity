import React from "react";
import { Box, Typography, Chip, Button, Collapse, Link } from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Cancel from "@mui/icons-material/Cancel";
import Help from "@mui/icons-material/Help";

interface SourceDocument {
  title: string;
  url: string;
  text: string;
  published_date?: string;
  author?: string;
  score: number;
}

interface Claim {
  text: string;
  confidence: number;
  assessment: "supported" | "refuted" | "insufficient_information";
  supporting_sources: SourceDocument[];
  refuting_sources: SourceDocument[];
  reasoning?: string;
}

interface FactCheckResultsProps {
  results: {
    success: boolean;
    claims: Claim[];
    overall_confidence: number;
    total_claims: number;
    supported_claims: number;
    refuted_claims: number;
    insufficient_claims: number;
    timestamp: string;
    processing_time_ms?: number;
    error?: string;
  };
  onClose: () => void;
}

const FactCheckResults: React.FC<FactCheckResultsProps> = ({
  results,
  onClose,
}) => {
  const [expandedClaims, setExpandedClaims] = React.useState<Set<number>>(
    new Set(),
  );

  const toggleClaimExpansion = (index: number) => {
    const newExpanded = new Set(expandedClaims);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedClaims(newExpanded);
  };

  const getAssessmentIcon = (assessment: string) => {
    switch (assessment) {
      case "supported":
        return <CheckCircle sx={{ color: "#4caf50", fontSize: 20 }} />;
      case "refuted":
        return <Cancel sx={{ color: "#f44336", fontSize: 20 }} />;
      default:
        return <Help sx={{ color: "#ff9800", fontSize: 20 }} />;
    }
  };

  const getAssessmentColor = (assessment: string) => {
    switch (assessment) {
      case "supported":
        return "#4caf50";
      case "refuted":
        return "#f44336";
      default:
        return "#ff9800";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "#4caf50";
    if (confidence >= 0.6) return "#ff9800";
    return "#f44336";
  };

  if (!results.success) {
    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
        }}
      >
        <Box
          sx={{
            backgroundColor: "white",
            borderRadius: 2,
            padding: 3,
            maxWidth: 500,
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto",
          }}
        >
          <Typography variant="h6" color="error" gutterBottom>
            Fact-Checking Failed
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {results.error ||
              "An error occurred while checking facts. Please try again."}
          </Typography>
          <Button variant="contained" onClick={onClose} fullWidth>
            Close
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <Box
        sx={{
          backgroundColor: "white",
          borderRadius: 2,
          padding: 3,
          maxWidth: 800,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h5" component="h2">
            Fact-Check Results
          </Typography>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </Box>

        {/* Summary */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Fact-Check Summary
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
            <Chip
              label={`Overall Confidence: ${Math.round(results.overall_confidence * 100)}%`}
              color={
                results.overall_confidence >= 0.8
                  ? "success"
                  : results.overall_confidence >= 0.6
                    ? "warning"
                    : "error"
              }
              variant="outlined"
            />
            <Chip
              label={`Total Claims: ${results.total_claims}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`Supported: ${results.supported_claims}`}
              color="success"
              variant="outlined"
            />
            <Chip
              label={`Refuted: ${results.refuted_claims}`}
              color="error"
              variant="outlined"
            />
            <Chip
              label={`Insufficient: ${results.insufficient_claims}`}
              color="warning"
              variant="outlined"
            />
          </Box>

          {/* Key Insights */}
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: "white",
              borderRadius: 1,
              border: "1px solid #e0e0e0",
            }}
          >
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ fontWeight: "bold", color: "#1976d2" }}
            >
              Key Insights:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {results.supported_claims > 0 &&
                `✅ ${results.supported_claims} claim${results.supported_claims > 1 ? "s" : ""} verified with supporting evidence`}
              {results.supported_claims > 0 &&
                results.refuted_claims > 0 &&
                " • "}
              {results.refuted_claims > 0 &&
                `❌ ${results.refuted_claims} claim${results.refuted_claims > 1 ? "s" : ""} contradicted by sources`}
              {results.insufficient_claims > 0 &&
                (results.supported_claims > 0 || results.refuted_claims > 0) &&
                " • "}
              {results.insufficient_claims > 0 &&
                `⚠️ ${results.insufficient_claims} claim${results.insufficient_claims > 1 ? "s" : ""} need more evidence`}
            </Typography>
          </Box>

          {results.processing_time_ms && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              Analysis completed in {results.processing_time_ms}ms using
              AI-powered fact-checking
            </Typography>
          )}
        </Box>

        {/* Claims */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Claims Analysis
          </Typography>
          {results.claims.map((claim, index) => (
            <Box
              key={index}
              sx={{
                border: "1px solid #e0e0e0",
                borderRadius: 1,
                mb: 2,
                overflow: "hidden",
              }}
            >
              {/* Claim Header */}
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => toggleClaimExpansion(index)}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flex: 1,
                  }}
                >
                  {getAssessmentIcon(claim.assessment)}
                  <Typography variant="body1" sx={{ flex: 1 }}>
                    {claim.text}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={`${Math.round(claim.confidence * 100)}%`}
                    size="small"
                    sx={{
                      backgroundColor: getConfidenceColor(claim.confidence),
                      color: "white",
                    }}
                  />
                  <Chip
                    label={claim.assessment.replace("_", " ")}
                    size="small"
                    sx={{
                      backgroundColor: getAssessmentColor(claim.assessment),
                      color: "white",
                    }}
                  />
                  {expandedClaims.has(index) ? <ExpandLess /> : <ExpandMore />}
                </Box>
              </Box>

              {/* Claim Details */}
              <Collapse in={expandedClaims.has(index)}>
                <Box sx={{ p: 2 }}>
                  {/* Reasoning Section */}
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      backgroundColor: "#f8f9fa",
                      borderRadius: 1,
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      sx={{ fontWeight: "bold", color: "#495057" }}
                    >
                      Analysis Reasoning:
                    </Typography>
                    {claim.reasoning ? (
                      <Typography variant="body2" color="text.secondary">
                        {claim.reasoning}
                      </Typography>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: "italic" }}
                      >
                        No detailed reasoning available for this assessment.
                      </Typography>
                    )}
                  </Box>

                  {/* Supporting Sources */}
                  {claim.supporting_sources.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        color="success.main"
                        gutterBottom
                      >
                        Supporting Sources ({claim.supporting_sources.length})
                      </Typography>
                      {claim.supporting_sources.map((source, sourceIndex) => (
                        <Box
                          key={sourceIndex}
                          sx={{
                            p: 1,
                            mb: 1,
                            backgroundColor: "#e8f5e8",
                            borderRadius: 1,
                            border: "1px solid #c8e6c9",
                          }}
                        >
                          <Link
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontWeight: "bold", textDecoration: "none" }}
                          >
                            {source.title}
                          </Link>
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            <strong>Relevance Score:</strong>{" "}
                            {Math.round(source.score * 100)}%
                            {source.author && ` • Author: ${source.author}`}
                            {source.published_date &&
                              ` • Published: ${source.published_date}`}
                          </Typography>
                          {source.text && (
                            <Box sx={{ mt: 1 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontWeight: "bold" }}
                              >
                                Relevant Excerpt:
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  mt: 0.5,
                                  fontStyle: "italic",
                                  backgroundColor: "rgba(0,0,0,0.05)",
                                  p: 1,
                                  borderRadius: 0.5,
                                }}
                              >
                                "{source.text.substring(0, 300)}
                                {source.text.length > 300 ? "..." : ""}"
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Refuting Sources */}
                  {claim.refuting_sources.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        color="error.main"
                        gutterBottom
                      >
                        Refuting Sources ({claim.refuting_sources.length})
                      </Typography>
                      {claim.refuting_sources.map((source, sourceIndex) => (
                        <Box
                          key={sourceIndex}
                          sx={{
                            p: 1,
                            mb: 1,
                            backgroundColor: "#ffebee",
                            borderRadius: 1,
                            border: "1px solid #ffcdd2",
                          }}
                        >
                          <Link
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontWeight: "bold", textDecoration: "none" }}
                          >
                            {source.title}
                          </Link>
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            <strong>Relevance Score:</strong>{" "}
                            {Math.round(source.score * 100)}%
                            {source.author && ` • Author: ${source.author}`}
                            {source.published_date &&
                              ` • Published: ${source.published_date}`}
                          </Typography>
                          {source.text && (
                            <Box sx={{ mt: 1 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontWeight: "bold" }}
                              >
                                Relevant Excerpt:
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  mt: 0.5,
                                  fontStyle: "italic",
                                  backgroundColor: "rgba(0,0,0,0.05)",
                                  p: 1,
                                  borderRadius: 0.5,
                                }}
                              >
                                "{source.text.substring(0, 300)}
                                {source.text.length > 300 ? "..." : ""}"
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* No Sources */}
                  {claim.supporting_sources.length === 0 &&
                    claim.refuting_sources.length === 0 && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: "italic" }}
                      >
                        No sources found for this claim.
                      </Typography>
                    )}
                </Box>
              </Collapse>
            </Box>
          ))}
        </Box>

        {/* Footer */}
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #e0e0e0" }}>
          <Typography variant="caption" color="text.secondary">
            Analysis completed at {new Date(results.timestamp).toLocaleString()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default FactCheckResults;
