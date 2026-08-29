import React, { useCallback } from "react";
import { Stack, Typography, Chip, Divider, Box, alpha, Paper, CircularProgress, Tooltip } from "@mui/material";
import InsightsIcon from '@mui/icons-material/Insights';
import SearchIcon from '@mui/icons-material/Search';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ArticleIcon from '@mui/icons-material/Article';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Research, ResearchInsight, Fact } from "../types";
import { GlassyCard, glassyCardSx, PrimaryButton } from "../ui";
import { FactCard } from "../FactCard";
import { TextToSpeechButton } from "../../shared/TextToSpeechButton";

interface ResearchSummaryProps {
  research: Research;
  canGenerateScript: boolean;
  onGenerateScript: () => void;
  isGeneratingScript?: boolean;
}

export const ResearchSummary: React.FC<ResearchSummaryProps> = ({
  research,
  canGenerateScript,
  onGenerateScript,
  isGeneratingScript = false,
}) => {
  const getSourceFact = (idx: number): Fact | undefined => {
    const factCards = research.factCards || [];
    return factCards.find(f => f.id === `source-${idx}`);
  };

  // Strip markdown for text-to-speech
  const stripMarkdown = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Code
      .replace(/^\s*[-*+]\s+/gm, '') // List items
      .replace(/^\s*\d+\.\s+/gm, '') // Numbered list
      .replace(/\n{2,}/g, '. ') // Multiple newlines to periods
      .replace(/\n/g, ' ') // Single newlines to spaces
      .trim();
  };

  // Simple markdown-to-HTML converter
  const renderMarkdown = useCallback((text: string) => {
    if (!text) return null;
    return text
      .split('\n')
      .filter(line => line.trim() !== '') // Remove empty lines
      .map((line, i) => {
        // Handle bold
        let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Handle lists
        if (processedLine.trim().startsWith('- ') || processedLine.trim().startsWith('* ')) {
          return <li key={i} dangerouslySetInnerHTML={{ __html: processedLine.trim().substring(2) }} style={{ marginBottom: '4px', fontSize: '0.9rem' }} />;
        }
        // Handle headers - make them smaller
        if (processedLine.startsWith('### ')) {
          return <Typography key={i} variant="subtitle2" fontWeight={700} sx={{ mt: 1.5, mb: 0.5, color: '#1e293b' }}>{processedLine.substring(4)}</Typography>;
        }
        if (processedLine.startsWith('## ')) {
          return <Typography key={i} variant="subtitle1" fontWeight={700} sx={{ mt: 1.5, mb: 0.5, color: '#0f172a' }}>{processedLine.substring(3)}</Typography>;
        }
        // Paragraphs - compact spacing
        return processedLine.trim() ? <p key={i} dangerouslySetInnerHTML={{ __html: processedLine }} style={{ margin: '4px 0', fontSize: '0.9rem' }} /> : null;
      });
  }, []);

  return (
    <GlassyCard sx={glassyCardSx}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1, color: "#0f172a", fontWeight: 700 }}>
              <InsightsIcon />
              Research Summary
            </Typography>

            {/* Research Metadata - Moved alongside title */}
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              {research.searchQueries && research.searchQueries.length > 0 && (
                <Chip
                  icon={<SearchIcon sx={{ fontSize: "1rem !important" }} />}
                  label={`${research.searchQueries.length} search${research.searchQueries.length > 1 ? "es" : ""}`}
                  size="small"
                  sx={{
                    background: alpha("#667eea", 0.1),
                    color: "#667eea",
                    fontWeight: 600,
                    border: "1px solid rgba(102, 126, 234, 0.2)",
                  }}
                />
              )}
              {research.searchType && (
                <Chip
                  label={`${research.searchType.charAt(0).toUpperCase() + research.searchType.slice(1)} search`}
                  size="small"
                  sx={{
                    background: alpha("#10b981", 0.1),
                    color: "#059669",
                    fontWeight: 600,
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                  }}
                />
              )}
              {research.sourceCount !== undefined && (
                <Chip
                  label={`${research.sourceCount} source${research.sourceCount !== 1 ? "s" : ""}`}
                  size="small"
                  sx={{
                    background: alpha("#6366f1", 0.1),
                    color: "#4f46e5",
                    fontWeight: 600,
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                  }}
                />
              )}
            </Stack>
          </Stack>

          <PrimaryButton
            onClick={onGenerateScript}
            disabled={!canGenerateScript || isGeneratingScript}
            startIcon={isGeneratingScript ? <CircularProgress size={18} color="inherit" /> : <EditNoteIcon />}
            endIcon={isGeneratingScript ? undefined : <ArrowForwardIcon />}
            tooltip={!canGenerateScript ? "Complete research to generate script" : "Generate AI-powered script from research"}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1rem",
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: "none",
              boxShadow: "0 4px 14px rgba(102, 126, 234, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                boxShadow: "0 6px 20px rgba(102, 126, 234, 0.5)",
              },
              "&:disabled": {
                background: "#94a3b8",
                boxShadow: "none",
              }
            }}
          >
            {isGeneratingScript ? "Generating Script..." : "Generate Script to Continue"}
          </PrimaryButton>
        </Stack>

        <Box sx={{ width: "100%" }}>
          {/* Main Summary */}
          {research.summary && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                background: "#f8fafc",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: "#64748b", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 1 }}>
                <AutoAwesomeIcon fontSize="small" sx={{ color: "#667eea", fontSize: "1rem" }} />
                Executive Summary
                <Box sx={{ ml: 'auto' }}>
                  <TextToSpeechButton text={stripMarkdown(research.summary)} size="small" showSettings />
                </Box>
              </Typography>
              <Box sx={{ 
                lineHeight: 1.6,
                fontSize: "0.9rem",
                color: "#334155",
                "& p": { m: 0, mb: 1 },
                "& ul": { m: 0, mb: 1, pl: 2.5 },
                "& li": { mb: 0.5 },
                "& strong": { color: "#0f172a", fontWeight: 600 }
              }}>
                {renderMarkdown(research.summary)}
              </Box>
            </Paper>
          )}

          {/* Deep Insights */}
          {(research.keyInsights && research.keyInsights.length > 0) ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <ArticleIcon sx={{ color: "#667eea" }} />
                Deep Insights
              </Typography>
              <Stack spacing={2.5}>
                {research.keyInsights.map((insight: ResearchInsight, idx: number) => (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 2.5,
                      background: "#ffffff",
                      border: "1px solid rgba(0,0,0,0.06)",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
                      borderRadius: 2,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5, width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ color: "#0f172a", fontWeight: 700, flex: 1 }}>
                        {insight.title}
                      </Typography>
                      <TextToSpeechButton text={stripMarkdown(insight.content)} size="small" />
                      {insight.source_indices && insight.source_indices.length > 0 && (
                        <Stack direction="row" spacing={0.5}>
                          {insight.source_indices.map(sIdx => {
                            const source = research.sources?.[sIdx - 1];
                            const fact = getSourceFact(sIdx);
                            return (
                              <Tooltip 
                                key={sIdx}
                                title={
                                  <Box sx={{ p: 0.5 }}>
                                    {fact ? (
                                      <Box>
                                        <Typography variant="caption" display="block" fontWeight={700} sx={{ color: '#A5B4FC', mb: 0.5 }}>
                                          Source S{sIdx}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic', mb: 1, lineHeight: 1.4 }}>
                                          "{fact.quote}"
                                        </Typography>
                                        {fact.author && (
                                          <Typography variant="caption" sx={{ color: '#A5B4FC' }}>
                                            {fact.author}
                                          </Typography>
                                        )}
                                      </Box>
                                    ) : source ? (
                                      <Box>
                                        <Typography variant="caption" display="block" fontWeight={700} sx={{ color: '#A5B4FC', mb: 0.5 }}>
                                          Source S{sIdx}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>
                                          {source.title}
                                        </Typography>
                                      </Box>
                                    ) : (
                                      <Typography variant="body2" sx={{ color: '#A5B4FC' }}>No source details</Typography>
                                    )}
                                  </Box>
                                }
                                placement="right"
                                arrow
                                followCursor
                              >
                                <Chip 
                                  label={`S${sIdx}`} 
                                  size="small" 
                                  variant="outlined"
                                  component="a"
                                  href={source?.url || undefined}
                                  target={source?.url ? "_blank" : undefined}
                                  rel={source?.url ? "noopener noreferrer" : undefined}
                                  sx={{ 
                                    height: 18, 
                                    fontSize: '0.65rem', 
                                    fontWeight: 700,
                                    borderColor: alpha("#667eea", 0.3),
                                    color: "#667eea",
                                    bgcolor: alpha("#667eea", 0.05),
                                    cursor: source?.url ? 'pointer' : 'default',
                                    textDecoration: 'none',
                                  }} 
                                />
                              </Tooltip>
                            );
                          })}
                        </Stack>
                      )}
                    </Stack>
                    <Box sx={{ 
                      color: "#475569", 
                      lineHeight: 1.7, 
                      fontSize: "0.9rem",
                      "& p": { m: 0, mb: 1.5 },
                      "& ul": { m: 0, mb: 1.5, pl: 2 }
                    }}>
                      {renderMarkdown(insight.content)}
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ) : (
             /* Fallback if keyInsights is missing but we have summary paragraphs */
             research.summary && research.summary.length > 500 && !research.keyInsights && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                  <ArticleIcon sx={{ color: "#667eea" }} />
                  Additional Insights
                </Typography>
                <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      background: "#ffffff",
                      border: "1px solid rgba(0,0,0,0.06)",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
                      borderRadius: 2,
                    }}
                  >
                     <Box sx={{ 
                      color: "#475569", 
                      lineHeight: 1.7, 
                      fontSize: "0.9rem",
                    }}>
                      {/* Render parts of summary that might contain insights if structured data is missing */}
                      {renderMarkdown(research.summary.split('\n\n').slice(1).join('\n\n'))}
                    </Box>
                </Paper>
              </Box>
             )
          )}

{/* Expert Quotes */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5, color: "#0f172a", fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              Expert Quotes
              <Tooltip title="Expert quotes extracted from research sources - factual statements from industry experts, studies, or authoritative sources that add credibility to your podcast content." placement="right">
                <HelpOutlineIcon sx={{ fontSize: 18, color: "#94A3B8", cursor: 'pointer' }} />
              </Tooltip>
            </Typography>
            {research.expertQuotes && research.expertQuotes.length > 0 ? (
              <Stack spacing={1.5}>
                {research.expertQuotes.slice(0, 4).map((quote, idx) => {
                  const sourceUrl = research.sources?.[quote.source_index - 1]?.url;
                  return (
                    <Paper key={`${quote.source_index}-${idx}`} elevation={0} sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                      border: '1px solid rgba(139, 92, 246, 0.15)'
                    }}>
                      <Typography variant="body2" sx={{ color: "#1E1B4B", lineHeight: 1.65, fontStyle: 'italic', fontWeight: 500 }}>
                        "{quote.quote}"
                      </Typography>
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip 
                          title={
                            <Box sx={{ p: 0.5 }}>
                              {(() => {
                                const source = research.sources?.[quote.source_index - 1];
                                const fact = getSourceFact(quote.source_index);
                                if (fact) {
                                  return (
                                    <Box>
                                      <Typography variant="caption" display="block" fontWeight={700} sx={{ color: '#C4B5FD', mb: 0.5 }}>
                                        Source S{quote.source_index}
                                      </Typography>
                                      <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic', mb: 1, lineHeight: 1.4 }}>
                                        "{fact.quote}"
                                      </Typography>
                                      {fact.author && (
                                        <Typography variant="caption" sx={{ color: '#A78BFA' }}>
                                          {fact.author}
                                        </Typography>
                                      )}
                                    </Box>
                                  );
                                }
                                if (source) {
                                  return (
                                    <Box>
                                      <Typography variant="caption" display="block" fontWeight={700} sx={{ color: '#C4B5FD', mb: 0.5 }}>
                                        Source S{quote.source_index}
                                      </Typography>
                                      <Typography variant="body2" fontWeight={600} sx={{ color: '#fff', mb: 0.5 }}>
                                        {source.title}
                                      </Typography>
                                    </Box>
                                  );
                                }
                                return <Typography variant="body2" sx={{ color: '#A78BFA' }}>No source details</Typography>;
                              })()}
                            </Box>
                          }
                          placement="right"
                          arrow
                          followCursor
                        >
                          <Chip 
                            label={`Source S${quote.source_index}`}
                            size="small"
                            component="a"
                            href={sourceUrl || undefined}
                            target={sourceUrl ? "_blank" : undefined}
                            rel={sourceUrl ? "noopener noreferrer" : undefined}
                            sx={{
                              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              cursor: sourceUrl ? 'pointer' : 'default',
                              textDecoration: 'none',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                              },
                            }}
                          />
                        </Tooltip>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                No expert quotes extracted yet.
              </Typography>
            )}
          </Box>

          {/* Listener CTAs */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5, color: "#0f172a", fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              Listener CTAs
              <Tooltip title="Call-to-action suggestions for your listeners - what action should they take after listening to your podcast (e.g., visit a website, subscribe, download resources)." placement="right">
                <HelpOutlineIcon sx={{ fontSize: 18, color: "#94A3B8", cursor: 'pointer' }} />
              </Tooltip>
            </Typography>
            {research.listenerCta && research.listenerCta.length > 0 ? (
              <Stack spacing={1.5}>
                {research.listenerCta.slice(0, 4).map((cta, idx) => (
                  <Paper key={`cta-${idx}`} elevation={0} sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                  }}>
                    <Typography variant="body2" sx={{ color: "#064E3B", lineHeight: 1.65, fontWeight: 500 }}>
                      {cta}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                No listener CTAs suggested yet.
              </Typography>
            )}
          </Box>

          {/* Mapped Angles */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5, color: "#0f172a", fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              Mapped Angles
              <Tooltip title="Content angles derived from research - specific topics or viewpoints mapped to your target audience's interests and pain points to create engaging episodes." placement="right">
                <HelpOutlineIcon sx={{ fontSize: 18, color: "#94A3B8", cursor: 'pointer' }} />
              </Tooltip>
            </Typography>
            {research.mappedAngles && research.mappedAngles.length > 0 ? (
              <Stack spacing={1.5}>
                {research.mappedAngles.slice(0, 4).map((angle, idx) => (
                  <Paper key={`angle-${idx}`} elevation={0} sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
                    border: '1px solid rgba(14, 165, 233, 0.15)'
                  }}>
                    <Typography variant="subtitle2" sx={{ color: "#0C4A6E", fontWeight: 700, mb: 0.5 }}>
                      {angle.title || `Angle ${idx + 1}`}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#075985", lineHeight: 1.65 }}>
                      {angle.why || "No rationale provided."}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                No mapped angles available yet.
              </Typography>
            )}
</Box>

          {/* Search Queries Used */}
          {research.searchQueries && research.searchQueries.length > 0 && (
            <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid rgba(0,0,0,0.04)" }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: "#64748b", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Search Queries Used
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {research.searchQueries.map((query, idx) => (
                  <Chip
                    key={idx}
                    label={query}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: "rgba(102, 126, 234, 0.15)",
                      color: "#94a3b8",
                      background: alpha("#f8fafc", 0.3),
                      fontSize: "0.7rem",
                      borderRadius: 1,
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {research.factCards.length > 0 && (
          <>
            <Divider sx={{ borderColor: "rgba(0,0,0,0.08)" }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ color: "#0f172a", fontWeight: 600 }}>
                Research Sources & Facts ({research.factCards.length})
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.75rem" }}>
                Click to expand • Hover to see source
              </Typography>
            </Stack>
            <Box 
              sx={{ 
                display: "grid", 
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" }, 
                gap: 1.5,
                width: "100%",
                overflow: "hidden",
              }}
            >
              {research.factCards.map((fact) => (
                <FactCard key={fact.id} fact={fact} />
              ))}
            </Box>
          </>
        )}
      </Stack>
    </GlassyCard>
  );
};
