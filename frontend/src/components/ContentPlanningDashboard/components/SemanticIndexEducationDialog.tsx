import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

/**
 * Plain-language presentation for one indexed strategy part. Keyed by the
 * canonical kind names from ``STRATEGY_KINDS`` (sif_strategy_source_ids.py),
 * so the dialog always renders the 8 parts in contract order.
 */
export interface IndexedPartPresentation {
  label: string;
  description: string;
}

export const SIF_KIND_PRESENTATION: Record<string, IndexedPartPresentation> = {
  form_summary: {
    label: 'Your strategy questionnaire',
    description: 'Your answers to the strategy questionnaire — 30 fields captured as one searchable note.',
  },
  base_strategy: {
    label: 'Strategy foundation',
    description: 'The core details of your content plan: goals, positioning, and direction.',
  },
  strategic_insights: {
    label: 'Strategic insights',
    description: 'Key findings about your market, audience, and where to focus.',
  },
  competitive_analysis: {
    label: 'Competitive analysis',
    description: 'How you compare with competitors, including the gaps your plan can fill.',
  },
  performance_predictions: {
    label: 'Performance predictions',
    description: 'The results your content plan is expected to deliver.',
  },
  implementation_roadmap: {
    label: 'Implementation roadmap',
    description: 'The ordered steps for putting your plan into action.',
  },
  risk_assessment: {
    label: 'Risk assessment',
    description: 'Risks the AI spotted in the plan and how to handle them.',
  },
  user_persona_digest: {
    label: 'Your audience persona',
    description: 'A distilled profile of your audience and brand voice, from your answers.',
  },
};

const UNKNOWN_PART: IndexedPartPresentation = {
  label: 'Indexed part',
  description: 'This part of your strategy is prepared for AI-powered search.',
};

interface SemanticIndexEducationDialogProps {
  open: boolean;
  onClose: () => void;
  documentKindNames?: string[];
}

/**
 * End-user education for the Semantic Index. Phase 4 copy contract: it may
 * explain what is indexed and how agents WILL use it, but it must not claim
 * agents can query the index today — that lands with agent integration (SIF-G).
 */
const SemanticIndexEducationDialog: React.FC<SemanticIndexEducationDialogProps> = ({
  open,
  onClose,
  documentKindNames,
}) => {
  const parts = documentKindNames && documentKindNames.length > 0
    ? documentKindNames.map(
        (name) => SIF_KIND_PRESENTATION[name] ?? { ...UNKNOWN_PART, label: name },
      )
    : Object.values(SIF_KIND_PRESENTATION);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(102, 126, 234, 0.1)',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
          What is the Semantic Index?
        </Typography>
        <Typography variant="body2" component="div" sx={{ opacity: 0.9, fontWeight: 500 }}>
          How your content strategy becomes searchable knowledge for your AI team
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.7 }}>
          When your content strategy is activated, ALwrity indexes it into a
          searchable knowledge base. Each part below becomes a searchable note
          your AI team can ground its answers in — your real plan, not generic
          advice.
        </Typography>

        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <LightbulbIcon fontSize="small" />
          The 8 indexed parts
        </Typography>
        <List dense sx={{ py: 0 }}>
          {parts.map((part) => (
            <ListItem key={part.label} sx={{ py: 1, px: 0 }} alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: '#667eea' }} />
              </ListItemIcon>
              <ListItemText primary={part.label} secondary={part.description} />
            </ListItem>
          ))}
        </List>

        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <AutoAwesomeIcon fontSize="small" />
          How your AI team uses it
        </Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
          Your strategy agents — like the content strategist and SEO specialist —
          will be able to search these notes to answer from your real plan. That
          connection is the next step and ships in a separate update: the index
          is prepared and verified today; enabling agents to query it comes
          later.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'center' }}>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1.5,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
            },
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SemanticIndexEducationDialog;