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

interface IndexedPartPresentation {
  label: string;
  description: string;
}

export const CALENDAR_KIND_PRESENTATION: Record<string, IndexedPartPresentation> = {
  calendar_overview: {
    label: 'Calendar overview',
    description: 'The big picture — calendar type, industry, content pillars, and posting rhythm.',
  },
  daily_schedule: {
    label: 'Daily schedule',
    description: 'What is scheduled for each day — topics, platforms, and quality metrics.',
  },
  weekly_themes: {
    label: 'Weekly themes',
    description: 'Strategic groupings of content by week with platform distribution.',
  },
  content_recommendations: {
    label: 'Content recommendations',
    description: 'Actionable recommendations the AI prioritizes for you.',
  },
  performance_predictions: {
    label: 'Performance predictions',
    description: 'The results your calendar is expected to deliver — engagement, reach, conversions.',
  },
  ai_insights: {
    label: 'AI insights',
    description: 'AI-generated strategic insights with recommended actions and confidence.',
  },
  strategy_alignment: {
    label: 'Strategy alignment',
    description: 'How aligned your calendar is with your content strategy and quality score.',
  },
  calendar_events: {
    label: 'Calendar events',
    description: 'Specific events scheduled from your calendar — granular event-level detail.',
  },
};

const UNKNOWN_PART: IndexedPartPresentation = {
  label: 'Indexed part',
  description: 'This part of your calendar is prepared for AI-powered search.',
};

interface CalendarSifEducationDialogProps {
  open: boolean;
  onClose: () => void;
  documentKindNames?: string[];
}

const CalendarSifEducationDialog: React.FC<CalendarSifEducationDialogProps> = ({
  open,
  onClose,
  documentKindNames,
}) => {
  const parts = documentKindNames && documentKindNames.length > 0
    ? documentKindNames.map(
        (name) =>
          CALENDAR_KIND_PRESENTATION[name] ?? {
            // R5.5: unknown kinds render the readable fallback — never the raw id
            label: 'Indexed part',
            description: 'This part of your calendar is prepared for AI-powered search.',
          },
      )
    : Object.values(CALENDAR_KIND_PRESENTATION);

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
          What is the Calendar Semantic Index?
        </Typography>
        <Typography variant="body2" component="div" sx={{ opacity: 0.9, fontWeight: 500 }}>
          How your AI-generated calendar becomes searchable knowledge for your AI team
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.7 }}>
          When your calendar is generated, ALWRity indexes it into a
          searchable knowledge base. Each part below becomes a searchable note
          your AI team can ground its answers in — your real calendar, not generic
          advice.
        </Typography>

        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <LightbulbIcon fontSize="small" />
          {`The ${parts.length} indexed parts`}
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
          Your calendar agents — like the content planner — will be able to search
          these notes to answer from your real calendar. That connection is the
          next step and ships in a separate update: the index is prepared and
          verified today; enabling agents to query it comes later.
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

export default CalendarSifEducationDialog;
