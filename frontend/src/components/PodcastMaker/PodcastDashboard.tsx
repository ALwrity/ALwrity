import React, { useState, useCallback, useEffect, useMemo } from "react";
import { shouldSkipOnboarding } from '../../utils/demoMode';
import { Box, Paper, Stack, Alert, Divider, CircularProgress, alpha, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";
import { usePodcastProjectState } from "../../hooks/usePodcastProjectState";
import { PodcastCostEst } from "./types";
import { CreateModal } from "./CreateModal";
import { AnalysisPanel } from "./AnalysisPanel";
import { ScriptEditor } from "./ScriptEditor";
import { RenderQueue } from "./RenderQueue";
import { RecentEpisodesPreview } from "./RecentEpisodesPreview";
import { ProjectList } from "./ProjectList";
import { PreflightBlockDialog } from "./PreflightBlockDialog";
import {
  Header,
  EstimateCard,
  QuerySelection,
  ResearchSummary,
  RegenerationFeedbackModal,
  usePodcastWorkflow,
  DEFAULT_KNOBS,
  getStepLabel,
} from "./PodcastDashboard/index";
import { ScriptGenerationProgressView } from "./PodcastDashboard/ScriptGenerationProgressView";

const PodcastDashboard: React.FC = () => {
  useEffect(() => {
    try {
      const skip = shouldSkipOnboarding();
      // Skip onboarding in podcast-only mode
    } catch (e) {
      console.warn('PodcastDashboard entry: gating log error', e);
    }
  }, []);
  const projectState = usePodcastProjectState();
  const [showProjectList, setShowProjectList] = useState(false);
  const {
    project,
    analysis,
    queries,
    selectedQueries,
    research,
    rawResearch,
    estimate,
    scriptData,
    renderJobs,
    knobs: knobsState,
    researchProvider,
    showScriptEditor,
    showRenderQueue,
    currentStep,
    bible,
    setScriptData,
    setBible,
    setShowScriptEditor,
    setShowRenderQueue,
    setResearchProvider,
    updateRenderJob,
    resetState,
    loadProjectFromDb,
    setCurrentStep,
  } = projectState;

  const workflow = usePodcastWorkflow({
    projectState,
    onError: (msg: string) => {
      // Error handling is done through workflow's own announcement system
      console.error("Workflow error:", msg);
    },
  });

  const [showRegenModal, setShowRegenModal] = useState(false);
  const headerCostEst = useMemo<PodcastCostEst | null>(() => {
    const defaultBreakdown: PodcastCostEst["breakdown"] = [
      { phase: "Analyze", cost: 0 },
      { phase: "Gather", cost: 0 },
      { phase: "Write", cost: 0 },
      { phase: "Produce", cost: 0 },
    ];

    if (!estimate && !research?.costEst) {
      return null;
    }

    const breakdownMap = new Map(defaultBreakdown.map((item) => [item.phase, item.cost]));

    if (research?.costEst?.breakdown?.length) {
      research.costEst.breakdown.forEach((item) => {
        breakdownMap.set(item.phase, Number(item.cost) || 0);
      });
    }

    if (estimate) {
      const analyzeCost = breakdownMap.get("Analyze") || 0;
      const gatherCost = breakdownMap.get("Gather") || 0;
      const writeCost = breakdownMap.get("Write") || 0;
      const produceCost = breakdownMap.get("Produce") || 0;
      if (analyzeCost === 0 && estimate.analysisCost > 0) {
        breakdownMap.set("Analyze", estimate.analysisCost);
      }
      if (gatherCost === 0 && estimate.researchCost > 0) {
        breakdownMap.set("Gather", estimate.researchCost);
      }
      if (writeCost === 0 && estimate.scriptCost > 0) {
        breakdownMap.set("Write", estimate.scriptCost);
      }
      if (produceCost === 0) {
        breakdownMap.set("Produce", estimate.ttsCost + estimate.voiceCloneCost + estimate.avatarCost + estimate.videoCost);
      }
    }

    const breakdown: PodcastCostEst["breakdown"] = defaultBreakdown.map((item) => ({
      phase: item.phase,
      cost: breakdownMap.get(item.phase) || 0,
    }));
    const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

    return {
      total,
      breakdown,
      currency: "USD",
      last_updated: research?.costEst?.last_updated || new Date().toISOString(),
    };
  }, [estimate, research?.costEst]);

  const handleSelectProject = useCallback(async (projectId: string) => {
    try {
      await loadProjectFromDb(projectId);
      setShowProjectList(false);
    } catch (error) {
      const errorMsg = `Failed to load project: ${error instanceof Error ? error.message : "Unknown error"}`;
      // Use workflow's setAnnouncement - workflow is stable from hook
      workflow.setAnnouncement(errorMsg);
    }
  }, [loadProjectFromDb, workflow]);

  const handleNewEpisode = useCallback(() => {
    resetState();
    setShowProjectList(false);
  }, [resetState]);

  if (showProjectList) {
    return <ProjectList onSelectProject={handleSelectProject} onBack={() => setShowProjectList(false)} onNewEpisode={handleNewEpisode} />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#f8fafc",
        p: { xs: 1, md: 4 },
        overflow: "hidden",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 1400,
          mx: "auto",
          borderRadius: 3,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          p: { xs: 2, md: 4 },
        }}
      >
        <Stack spacing={3}>
          {/* Header */}
          <Header 
              onShowProjects={() => setShowProjectList(true)} 
              onNewEpisode={handleNewEpisode}
              activeStep={workflow.activeStep}
              completedSteps={[
                ...(analysis ? [0] : []),
                ...(research ? [1] : []),
                ...(scriptData ? [2] : []),
                ...(renderJobs.some(j => j.status === "completed") ? [3] : []),
              ]}
              costEst={headerCostEst}
              onStepClick={(step) => {
                // Handle step clicks - could navigate to different views
              }}
            />

          <Divider sx={{ borderColor: "rgba(0,0,0,0.08)" }} />

          {/* Progress stepper is in Header - keeping UI clean */}

          {/* Resume Alert */}
          {workflow.showResumeAlert && project && (
            <Alert
              severity="success"
              onClose={() => workflow.setShowResumeAlert(false)}
              sx={{
                background: "#d1fae5",
                border: "1px solid #a7f3d0",
                "& .MuiAlert-icon": { color: "#10b981" },
              }}
            >
              <Box component="span" sx={{ fontSize: "0.875rem" }}>
                <strong>Project Restored:</strong> Resuming from {getStepLabel(currentStep)} step. Your progress has been saved.
              </Box>
            </Alert>
          )}

          {/* Announcements */}
          {workflow.announcement && (
            <Alert
              severity={workflow.announcementSeverity || "info"}
              onClose={() => workflow.setAnnouncement("")}
              sx={{
                background: workflow.announcementSeverity === "error" ? "#fef2f2" : workflow.announcementSeverity === "success" ? "#f0fdf4" : "#dbeafe",
                border: `1px solid ${workflow.announcementSeverity === "error" ? "#fecaca" : workflow.announcementSeverity === "success" ? "#bbf7d0" : "#bfdbfe"}`,
                "& .MuiAlert-icon": { color: workflow.announcementSeverity === "error" ? "#ef4444" : workflow.announcementSeverity === "success" ? "#22c55e" : "#3b82f6" },
              }}
            >
              {workflow.announcement}
            </Alert>
          )}

          {/* Podcast Bible - now in AnalysisPanel header */}
          
          {(workflow.isAnalyzing || workflow.isResearching || workflow.isGeneratingScript) && (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1.5 }}>
              <CircularProgress size={20} sx={{ color: "#667eea" }} />
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                {workflow.isAnalyzing ? "Analyzing your idea with AI..." : workflow.isGeneratingScript ? "Generating script with AI..." : "Running research... This may take a moment."}
              </Typography>
            </Stack>
          )}

          {/* Create Modal */}
          {!project && (
            <>
              <CreateModal
                open
                onCreate={workflow.handleCreate}
                defaultKnobs={DEFAULT_KNOBS}
                isSubmitting={workflow.isAnalyzing}
                announcement={workflow.announcement}
              />
              <RecentEpisodesPreview onSelectEpisode={() => {}} />
            </>
          )}

          {/* Main Content */}
          <Stack spacing={3}>
            {analysis && (currentStep === 'analysis' || (currentStep === 'research' && !research)) && !showScriptEditor && !showRenderQueue && (
              <AnalysisPanel
                analysis={analysis}
                estimate={estimate}
                idea={project?.idea}
                duration={project?.duration}
                speakers={project?.speakers}
                voiceName={estimate?.voiceName}
                podcastMode={project?.podcastMode}
                avatarUrl={project?.presenterReferenceUrl || project?.avatarUrl}
                avatarPrompt={project?.avatarPrompt}
                bible={bible}
                onRegenerate={() => setShowRegenModal(true)}
                onUpdateAnalysis={(updated) => projectState.setAnalysis(updated)}
                onUpdateBible={(updated) => setBible(updated)}
              />
            )}

            {/* Main content area */}
            {queries.length > 0 && currentStep === 'research' && !research && !showScriptEditor && !showRenderQueue && (
              <QuerySelection
                queries={queries}
                selectedQueries={selectedQueries}
                researchProvider={researchProvider}
                isResearching={workflow.isResearching}
                onToggleQuery={workflow.toggleQuery}
                onProviderChange={setResearchProvider}
                onRunResearch={workflow.handleRunResearch}
                onRegenerateQueries={workflow.handleRegenerateQueries}
                onUpdateQuery={workflow.handleUpdateQuery}
                onDeleteQuery={workflow.handleDeleteQuery}
                analysis={analysis}
                idea={project?.idea || ""}
              />
            )}

            {research && (currentStep === 'research' || currentStep === 'script') && !showScriptEditor && !showRenderQueue && (
              <ResearchSummary
                research={research}
                canGenerateScript={workflow.canGenerateScript}
                onGenerateScript={workflow.handleGenerateScript}
                isGeneratingScript={workflow.isGeneratingScript}
              />
            )}

            {showScriptEditor && project && research && rawResearch && (
              <ScriptEditor
                projectId={project.id}
                idea={project.idea}
                research={research}
                rawResearch={rawResearch}
                knobs={knobsState}
                speakers={project.speakers}
                durationMinutes={project.duration}
                podcastMode={project?.podcastMode || "video_only"}
                script={scriptData}
                analysis={analysis}
                outline={analysis?.suggestedOutlines?.[0]}
                onScriptChange={(s) => setScriptData(s)}
                onBackToResearch={() => setShowScriptEditor(false)}
                onProceedToRendering={(s) => workflow.handleProceedToRendering(s)}
                onError={(msg) => workflow.setAnnouncement(msg)}
                avatarUrl={project?.avatarUrl}
              />
            )}

            {showScriptEditor && (!research || !rawResearch) && (
              <Alert severity="warning" sx={{ background: alpha("#f59e0b", 0.1), border: "1px solid rgba(245,158,11,0.3)" }}>
                Complete a research run before opening the script editor.
              </Alert>
            )}

            {showRenderQueue && project && scriptData && (
              <RenderQueue
                projectId={project.id}
                script={scriptData}
                knobs={knobsState}
                jobs={renderJobs}
                bible={bible}
                budgetCap={projectState.budgetCap}
                avatarImageUrl={null}
                analysis={analysis} // Pass analysis context
                onUpdateJob={updateRenderJob}
                onUpdateScript={(updatedScript) => setScriptData(updatedScript)}
                onBack={() => {
                  setShowRenderQueue(false);
                  setShowScriptEditor(true);
                }}
                onError={(msg) => workflow.setAnnouncement(msg)}
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Preflight Block Dialog */}
      <PreflightBlockDialog
        open={workflow.showPreflightDialog}
        onClose={() => {
          workflow.setShowPreflightDialog(false);
          workflow.setPreflightResponse(null);
        }}
        response={workflow.preflightResponse}
        operationName={workflow.preflightOperationName}
      />

      {/* Regeneration Feedback Modal */}
      <RegenerationFeedbackModal
        open={showRegenModal}
        onClose={() => setShowRegenModal(false)}
        onConfirm={async (feedback) => {
          setShowRegenModal(false);
          await workflow.handleRegenerate(feedback);
        }}
        isSubmitting={workflow.isAnalyzing}
      />

      {/* Duplicate Project Dialog */}
      <Dialog
        open={workflow.showDuplicateDialog}
        onClose={() => workflow.setShowDuplicateDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            border: "1px solid rgba(167, 139, 250, 0.3)",
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: "#fff", display: "flex", alignItems: "center", gap: 1 }}>
          Duplicate Project Found
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.8)" }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
            A project with a similar idea already exists. You can edit the existing project or create a new one (which will overwrite the previous).
          </Alert>
          <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
            <strong style={{ color: "#fff" }}>Existing project idea:</strong>
            <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
              {workflow.duplicateProjectInfo.idea}
            </p>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              workflow.setShowDuplicateDialog(false);
              // Load existing project
              loadProjectFromDb(workflow.duplicateProjectInfo.projectId);
            }}
            sx={{ color: "#a78bfa" }}
          >
            Edit Existing
          </Button>
          <Button 
            onClick={() => workflow.setShowDuplicateDialog(false)}
            variant="contained"
            sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}
          >
            Create New (Overwrite)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Script Generation Progress Modal */}
      <Dialog
        open={workflow.showScriptGenModal}
        disableEscapeKeyDown={workflow.isGeneratingScript}
        onClose={(event, reason) => {
          // Only allow closing if NOT generating and generation hasn't started
          if (!workflow.isGeneratingScript && !workflow.scriptGenStarted) {
            workflow.setShowScriptGenModal(false);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: "#fff", display: "flex", alignItems: "center", gap: 1, fontSize: "1.25rem" }}>
          {workflow.isGeneratingScript ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} sx={{ color: "#34d399" }} />
              Generating Your Script
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              Script Complete
            </Box>
          )}
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.8)" }}>
          <ScriptGenerationProgressView
            currentMessage={workflow.announcement}
            progressIndex={workflow.scriptGenProgressIndex}
            idea={projectState.project?.idea}
            analysis={projectState.analysis}
            research={projectState.research}
            sourceCount={projectState.research?.sourceCount}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          {workflow.isGeneratingScript ? (
            <Button 
              onClick={() => workflow.setShowScriptGenModal(false)}
              disabled={workflow.isGeneratingScript}
              sx={{ color: "rgba(255,255,255,0.6)" }}
            >
              Cancel
            </Button>
          ) : (
            <Button 
              onClick={() => workflow.setShowScriptGenModal(false)}
              variant="contained"
              sx={{ bgcolor: "#34d399", "&:hover": { bgcolor: "#10b981" } }}
            >
              Continue to Editor
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PodcastDashboard;
