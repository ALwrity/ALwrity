import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  alpha,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import MicIcon from '@mui/icons-material/Mic';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { podcastApi } from "../../services/podcastApi";
import { GlassyCard, glassyCardSx, PrimaryButton, SecondaryButton } from "./ui";

interface Project {
  id: number;
  project_id: string;
  idea: string;
  duration: number;
  speakers: number;
  current_step: string | null;
  status: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
  onBack?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, onBack }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await podcastApi.listProjects({
        order_by: "updated_at",
        limit: 50,
      });
      setProjects(response.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await podcastApi.deleteProject(projectToDelete);
      await loadProjects();
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  const handleToggleFavorite = async (projectId: string, currentFavorite: boolean) => {
    try {
      await podcastApi.toggleFavorite(projectId);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update favorite");
    }
  };

  const getStepLabel = (step: string | null) => {
    switch (step) {
      case "analysis":
        return "Analysis";
      case "research":
        return "Research";
      case "script":
        return "Script";
      case "render":
        return "Rendering";
      default:
        return "Draft";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "info";
      case "draft":
        return "default";
      default:
        return "default";
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.idea.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.project_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        p: { xs: 2, md: 4 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 1400,
          mx: "auto",
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.08)",
          background: alpha("#0f172a", 0.7),
          backdropFilter: "blur(25px)",
          p: { xs: 3, md: 4 },
        }}
      >
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography
                variant="h3"
                sx={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 800,
                  mb: 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <MicIcon fontSize="large" />
                My Podcast Projects
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Resume your work or start a new episode
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <SecondaryButton onClick={onBack || (() => navigate(-1))} startIcon={<ArrowBackIcon />}>
                Back
              </SecondaryButton>
              <SecondaryButton onClick={loadProjects} startIcon={<RefreshIcon />} disabled={loading}>
                Refresh
              </SecondaryButton>
              <PrimaryButton onClick={() => navigate("/podcast-maker")} startIcon={<PlayArrowIcon />}>
                New Episode
              </PrimaryButton>
            </Stack>
          </Stack>

          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "rgba(255,255,255,0.5)", mr: 1 }} />,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "white",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
              },
            }}
          />

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Loading */}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Projects List */}
          {!loading && filteredProjects.length === 0 && (
            <GlassyCard sx={glassyCardSx}>
              <Stack spacing={2} alignItems="center" sx={{ p: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  {searchQuery ? "No projects match your search" : "No projects yet"}
                </Typography>
                <PrimaryButton onClick={() => navigate("/podcast-maker")} startIcon={<PlayArrowIcon />}>
                  Create Your First Episode
                </PrimaryButton>
              </Stack>
            </GlassyCard>
          )}

          {!loading && filteredProjects.length > 0 && (
            <Stack spacing={2}>
              {filteredProjects.map((project) => (
                <GlassyCard
                  key={project.project_id}
                  sx={{
                    ...glassyCardSx,
                    cursor: "pointer",
                    "&:hover": {
                      borderColor: "rgba(102,126,234,0.4)",
                      transform: "translateY(-2px)",
                    },
                    transition: "all 0.2s",
                  }}
                  onClick={() => onSelectProject(project.project_id)}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1} onClick={() => onSelectProject(project.project_id)} sx={{ cursor: "pointer" }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {project.idea.length > 100 ? `${project.idea.substring(0, 100)}...` : project.idea}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip
                            label={getStepLabel(project.current_step)}
                            size="small"
                            color={getStatusColor(project.status)}
                            sx={{ background: alpha("#667eea", 0.2), color: "#a78bfa" }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {project.speakers} {project.speakers === 1 ? "speaker" : "speakers"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {project.duration} min
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Updated {new Date(project.updated_at).toLocaleDateString()}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit project">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProject(project.project_id);
                            }}
                            sx={{ color: "#a78bfa" }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={project.is_favorite ? "Remove from favorites" : "Add to favorites"}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(project.project_id, project.is_favorite);
                            }}
                            sx={{ color: project.is_favorite ? "#fbbf24" : "#a78bfa" }}
                          >
                            {project.is_favorite ? <StarIcon /> : <StarBorderIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete project">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(project.project_id);
                              setDeleteDialogOpen(true);
                            }}
                            sx={{ color: "#ef4444" }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Stack>
                </GlassyCard>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setProjectToDelete(null);
        }}
        PaperProps={{
          sx: {
            background: alpha("#0f172a", 0.95),
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
          },
        }}
      >
        <DialogTitle sx={{ color: "white" }}>Delete Project?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <SecondaryButton onClick={() => {
            setDeleteDialogOpen(false);
            setProjectToDelete(null);
          }}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleDelete} startIcon={<DeleteIcon />}>
            Delete
          </PrimaryButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

