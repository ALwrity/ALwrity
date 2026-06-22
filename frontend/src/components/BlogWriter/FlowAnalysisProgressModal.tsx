import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material';

interface FlowAnalysisProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowAnalysisResults: any | null;
  isAnalyzing: boolean;
  onReanalyze: () => void;
  error?: string | null;
}

const flowAnalysisStageDefinitions = [
  {
    id: 'reading',
    label: 'Reading',
    icon: '📖',
    headline: 'Reading your entire blog',
    description: 'We pull together your title, outline, and every section into a single view so the AI can see the full picture — not just one piece.',
    tip: 'Narrative flow can only be judged across the whole piece. A great intro means nothing if section 5 has nothing to do with it.'
  },
  {
    id: 'flow',
    label: 'Flow',
    icon: '🌊',
    headline: 'Scoring how ideas flow from one section to the next',
    description: 'For each pair of adjacent sections we check: do they connect logically? Do transitions feel natural, or jarring? Are ideas introduced then dropped?',
    tip: 'A 1-point lift in flow quality is associated with readers scrolling ~12% further down the page in analytics studies.'
  },
  {
    id: 'consistency',
    label: 'Consistency',
    icon: '🎯',
    headline: 'Checking tone, voice, and terminology',
    description: 'We measure whether your tone (formal, casual, playful) stays steady, whether you use the same terms for the same concepts, and whether your point of view doesn\'t accidentally switch.',
    tip: 'Inconsistent terminology is one of the top reasons readers lose trust in B2B and technical content.'
  },
  {
    id: 'progression',
    label: 'Progression',
    icon: '📈',
    headline: 'Verifying the argument builds logically',
    description: 'We check that each section adds something new and that the whole piece moves toward a conclusion. No filler sections, no circular reasoning.',
    tip: 'Readers rarely notice good progression, but they always notice when a post feels like it\'s going in circles.'
  },
  {
    id: 'report',
    label: 'Report',
    icon: '📊',
    headline: 'Compiling your scorecard and suggestions',
    description: 'We package per-section scores (0–100%), overall scores, top strengths, biggest improvement areas, and concrete suggestions you can act on.',
    tip: 'You don\'t have to hit 100. Posts scoring 70+ on all three axes consistently outperform generic content in user engagement.'
  },
];

export const FlowAnalysisProgressModal: React.FC<FlowAnalysisProgressModalProps> = ({
  isOpen,
  onClose,
  flowAnalysisResults,
  isAnalyzing,
  onReanalyze,
  error,
}) => {
  const [genProgress, setGenProgress] = useState(0);

  // Simulate progress while analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setGenProgress(isOpen && flowAnalysisResults ? 100 : 0);
      return;
    }
    setGenProgress(0);
    const interval = setInterval(() => {
      setGenProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + 1;
      });
    }, 140);
    return () => clearInterval(interval);
  }, [isAnalyzing, isOpen, flowAnalysisResults]);

  const latestStageIndex = useMemo(() => {
    if (genProgress === 0) return -1;
    const index = Math.floor((genProgress / 100) * flowAnalysisStageDefinitions.length);
    return Math.min(index, flowAnalysisStageDefinitions.length - 1);
  }, [genProgress]);

  const stagesWithState = useMemo(() => {
    return flowAnalysisStageDefinitions.map((stage, i) => {
      let state: 'upcoming' | 'active' | 'done' | 'error' = 'upcoming';
      if (error) {
        state = i === latestStageIndex ? 'error' : i < latestStageIndex ? 'done' : 'upcoming';
      } else if (!isAnalyzing && flowAnalysisResults) {
        state = 'done';
      } else if (latestStageIndex === -1) {
        state = i === 0 ? 'active' : 'upcoming';
      } else if (i < latestStageIndex) {
        state = 'done';
      } else if (i === latestStageIndex) {
        state = 'active';
      }
      return { ...stage, state };
    });
  }, [flowAnalysisStageDefinitions, latestStageIndex, isAnalyzing, genProgress, error, flowAnalysisResults]);

  const progressPct = useMemo(() => {
    if (error) return 0;
    if (!isAnalyzing && flowAnalysisResults) return 100;
    const done = stagesWithState.filter(s => s.state === 'done').length;
    const active = stagesWithState.filter(s => s.state === 'active').length;
    if (done === 0 && active === 0) return 0;
    return Math.round(((done + active * 0.5) / flowAnalysisStageDefinitions.length) * 100);
  }, [stagesWithState, error, isAnalyzing, flowAnalysisResults]);

  const stageStateStyle: Record<string, { background: string; border: string; color: string }> = {
    upcoming: { background: '#f1f5f9', border: '#e2e8f0', color: '#94a3b8' },
    active: { background: '#eef2ff', border: '#c7d2fe', color: '#4338ca' },
    done: { background: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
    error: { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#047857';
    if (score >= 60) return '#d97706';
    return '#dc2626';
  };

  const renderProgressView = () => {
    const activeStage = flowAnalysisStageDefinitions[Math.max(0, latestStageIndex)];
    const activeStageState = stagesWithState[Math.max(0, latestStageIndex)];
    return (
      <Box sx={{ p: 4 }}>
        {/* What is Flow Analysis? intro card */}
        <Box sx={{ mb: 3, p: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #c7d2fe' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#3730a3', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 18 }}>💡</span> What is Flow Analysis?
          </Typography>
          <Typography variant="body2" sx={{ color: '#4338ca', lineHeight: 1.55 }}>
            A great blog isn't just correct — it has to <em>flow</em>. Flow Analysis is like having an editor read your post end-to-end and tell you: do ideas connect? Does the tone stay steady? Does each section build on the last? We score your post on three dimensions — Flow, Consistency, and Progression — and tell you exactly what to fix.
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
            <Box sx={{ width: `${progressPct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #6366f1, #4f46e5)', transition: 'width 0.5s ease' }} />
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
            {stagesWithState.filter(s => s.state === 'done').length}/{flowAnalysisStageDefinitions.length} steps
          </Typography>
        </Box>

        {/* Active stage detail card */}
        {activeStage && activeStageState && (
          <Box sx={{ mb: 2.5, p: 2, borderRadius: 2, background: '#ffffff', border: '1px solid #e0e7ff', borderLeft: '4px solid #4f46e5' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Box sx={{ fontSize: 20, lineHeight: 1 }}>{activeStage.icon}</Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', flex: 1 }}>
                {activeStage.headline}
              </Typography>
              {activeStageState.state === 'active' && <CircularProgress size={14} thickness={5} sx={{ color: '#4f46e5' }} />}
              {activeStageState.state === 'done' && <Typography sx={{ fontSize: 14, color: '#047857', fontWeight: 700 }}>✓</Typography>}
            </Box>
            <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55, mb: 1.25 }}>
              {activeStage.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', p: 1.25, borderRadius: 1.5, background: '#fef3c7', border: '1px solid #fde68a' }}>
              <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: '#78350f', flex: 1 }}>
                <strong>Did you know?</strong> {activeStage.tip}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Stage chips (compact stepper) */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {stagesWithState.map(stage => {
            const copy = stageStateStyle[stage.state];
            return (
              <Box key={stage.id} sx={{ flex: 1, py: 1, px: 0.5, borderRadius: 1.5, backgroundColor: copy.background, border: `1px solid ${copy.border}`, textAlign: 'center', transition: 'all 0.3s ease' }}>
                <Box sx={{ fontSize: 18, lineHeight: 1, mb: 0.25 }}>
                  {stage.state === 'active' ? <CircularProgress size={16} thickness={5} sx={{ color: '#4338ca' }} /> : stage.icon}
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: copy.color, display: 'block', fontSize: '0.6rem', lineHeight: 1.2 }}>
                  {stage.state === 'active' ? 'Working…' : stage.state === 'done' ? 'Done' : stage.state === 'error' ? 'Error' : stage.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* What happens next preview */}
        <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', display: 'block', mb: 1 }}>
            What happens next
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>📊</span> You'll get an overall scorecard (Flow / Consistency / Progression)
            </Typography>
            <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>🔍</span> See which sections need the most attention
            </Typography>
            <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>💡</span> Get specific suggestions to improve weak areas
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderResultsView = () => {
    if (!flowAnalysisResults) return null;
    const overallFlow = Math.round((flowAnalysisResults.overall_flow_score || 0) * 100);
    const overallConsistency = Math.round((flowAnalysisResults.overall_consistency_score || 0) * 100);
    const overallProgression = Math.round((flowAnalysisResults.overall_progression_score || 0) * 100);
    const overallCoherence = flowAnalysisResults.overall_coherence_score != null
      ? Math.round(flowAnalysisResults.overall_coherence_score * 100)
      : null;
    const sections = flowAnalysisResults.sections || [];
    const overallSuggestions = flowAnalysisResults.overall_suggestions || [];
    const overallStrengths = flowAnalysisResults.overall_strengths || [];
    const overallImprovementAreas = flowAnalysisResults.overall_improvement_areas || [];
    const transitionAnalysis = flowAnalysisResults.transition_analysis || null;

    return (
      <Box sx={{ p: 3 }}>
        {/* Overall scorecard */}
        <Box sx={{ mb: 3, p: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', border: '1px solid #bbf7d0' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#065f46', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ fontSize: 18, color: '#047857' }} /> Overall Scorecard
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1.5 }}>
            {[
              { label: 'Flow', value: overallFlow, help: 'How smoothly sections connect' },
              { label: 'Consistency', value: overallConsistency, help: 'Tone, voice, terminology' },
              { label: 'Progression', value: overallProgression, help: 'Logical build of ideas' },
              ...(overallCoherence != null ? [{ label: 'Coherence', value: overallCoherence, help: 'Overall readability' }] : []),
            ].map(metric => (
              <Box key={metric.label} sx={{ p: 1.5, borderRadius: 1.5, background: '#ffffff', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  {metric.label}
                </Typography>
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: getScoreColor(metric.value), lineHeight: 1.2, mt: 0.5 }}>
                  {metric.value}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', lineHeight: 1.3, mt: 0.25 }}>
                  {metric.help}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Per-section breakdown */}
        {sections.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 18 }}>🔍</span> Section-by-section breakdown
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sections.map((section: any, idx: number) => {
                const flow = Math.round((section.flow_score || 0) * 100);
                const consistency = Math.round((section.consistency_score || 0) * 100);
                const progression = Math.round((section.progression_score || 0) * 100);
                const lowest = Math.min(flow, consistency, progression);
                const tone = lowest >= 80 ? 'success' : lowest >= 60 ? 'warning' : 'error';
                return (
                  <Box key={section.section_id || idx} sx={{ p: 1.5, borderRadius: 1.5, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idx + 1}. {section.heading || 'Untitled section'}
                      </Typography>
                      <Chip
                        size="small"
                        label={tone === 'success' ? 'Strong' : tone === 'warning' ? 'OK' : 'Needs work'}
                        color={tone}
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, mb: section.suggestions?.length ? 1 : 0 }}>
                      {[
                        { label: 'Flow', value: flow },
                        { label: 'Consistency', value: consistency },
                        { label: 'Progression', value: progression },
                      ].map(m => (
                        <Box key={m.label} sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography sx={{ fontSize: '0.65rem', color: '#64748b', minWidth: 60 }}>{m.label}</Typography>
                          <Box sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                            <Box sx={{ width: `${m.value}%`, height: '100%', background: getScoreColor(m.value), transition: 'width 0.5s ease' }} />
                          </Box>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: getScoreColor(m.value), minWidth: 28, textAlign: 'right' }}>{m.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    {section.suggestions && section.suggestions.length > 0 && (
                      <Box sx={{ p: 1, borderRadius: 1, background: '#f8fafc' }}>
                        {section.suggestions.slice(0, 2).map((s: string, i: number) => (
                          <Typography key={i} sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: i < Math.min(section.suggestions.length, 2) - 1 ? 0.5 : 0 }}>
                            <span style={{ color: '#6366f1' }}>•</span> {s}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Strengths + Improvement areas (side by side) */}
        {(overallStrengths.length > 0 || overallImprovementAreas.length > 0) && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
            {overallStrengths.length > 0 && (
              <Box sx={{ p: 2, borderRadius: 1.5, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#065f46', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}>
                  <CheckCircleIcon sx={{ fontSize: 16 }} /> Top strengths
                </Typography>
                {overallStrengths.slice(0, 3).map((s: string, i: number) => (
                  <Typography key={i} sx={{ fontSize: '0.78rem', color: '#166534', lineHeight: 1.5, mb: 0.5, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <span>✓</span> {s}
                  </Typography>
                ))}
              </Box>
            )}
            {overallImprovementAreas.length > 0 && (
              <Box sx={{ p: 2, borderRadius: 1.5, background: '#fffbeb', border: '1px solid #fde68a' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}>
                  <WarningIcon sx={{ fontSize: 16 }} /> Top improvement areas
                </Typography>
                {overallImprovementAreas.slice(0, 3).map((s: string, i: number) => (
                  <Typography key={i} sx={{ fontSize: '0.78rem', color: '#78350f', lineHeight: 1.5, mb: 0.5, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <span>→</span> {s}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Top suggestions */}
        {overallSuggestions.length > 0 && (
          <Box sx={{ mb: 3, p: 2, borderRadius: 1.5, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#3730a3', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}>
              <LightbulbIcon sx={{ fontSize: 16 }} /> Top suggestions
            </Typography>
            {overallSuggestions.slice(0, 4).map((s: string, i: number) => (
              <Typography key={i} sx={{ fontSize: '0.8rem', color: '#1e1b4b', lineHeight: 1.5, mb: 0.5, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                <Box sx={{ minWidth: 18, height: 18, borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, mt: 0.1 }}>{i + 1}</Box>
                {s}
              </Typography>
            ))}
          </Box>
        )}

        {/* Transition analysis */}
        {transitionAnalysis && transitionAnalysis.overall_transition_quality != null && (
          <Box sx={{ mb: 2, p: 2, borderRadius: 1.5, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}>
              <span style={{ fontSize: 16 }}>🔗</span> Transition quality: <span style={{ color: getScoreColor(Math.round(transitionAnalysis.overall_transition_quality * 100)), marginLeft: 4 }}>{Math.round(transitionAnalysis.overall_transition_quality * 100)}/100</span>
            </Typography>
            {transitionAnalysis.transition_suggestions && transitionAnalysis.transition_suggestions.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {transitionAnalysis.transition_suggestions.slice(0, 2).map((s: string, i: number) => (
                  <Typography key={i} sx={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5, mb: 0.5, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <span>•</span> {s}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={isAnalyzing ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 24 }}>📊</span>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
            Flow Analysis
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {isAnalyzing ? 'Reading and scoring your blog…' : flowAnalysisResults ? 'Scorecard and improvement suggestions' : 'Run a flow check on your blog'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" disabled={isAnalyzing}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error ? (
          <Box sx={{ p: 3 }}>
            <Box sx={{ p: 2, mb: 2, borderRadius: 1.5, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.9rem' }}>Flow analysis failed</Typography>
              <Typography sx={{ fontSize: '0.8rem' }}>{error}</Typography>
            </Box>
          </Box>
        ) : isAnalyzing ? (
          renderProgressView()
        ) : flowAnalysisResults ? (
          renderResultsView()
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
              Click <strong>Run Analysis</strong> to start.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          {!isAnalyzing && flowAnalysisResults && 'Tip: re-run after editing content to update your scores'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={isAnalyzing} color="inherit">
            Close
          </Button>
          {!isAnalyzing && (
            <Button
              onClick={onReanalyze}
              variant="contained"
              startIcon={<RefreshIcon />}
              disabled={isAnalyzing}
              sx={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #4338ca)' }
              }}
            >
              {flowAnalysisResults ? 'Re-analyze' : 'Run Analysis'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default FlowAnalysisProgressModal;
