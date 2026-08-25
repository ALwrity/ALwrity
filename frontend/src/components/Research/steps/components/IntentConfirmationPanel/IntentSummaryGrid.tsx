/**
 * IntentSummaryGrid Component
 * 
 * Quick summary grid showing Purpose, Content Type, Depth, and Queries Count.
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  ResearchIntent,
  ResearchPurpose,
  ContentOutput,
  ResearchDepthLevel,
  PURPOSE_DISPLAY,
  CONTENT_OUTPUT_DISPLAY,
  DEPTH_DISPLAY,
} from '../../../types/intent.types';
import { EditableField } from './EditableField';

interface IntentSummaryGridProps {
  intent: ResearchIntent;
  queriesCount: number;
  onUpdateField: <K extends keyof ResearchIntent>(field: K, value: ResearchIntent[K]) => void;
}

export const IntentSummaryGrid: React.FC<IntentSummaryGridProps> = ({
  intent,
  queriesCount,
  onUpdateField,
}) => {
  return (
    <Grid container spacing={2} mb={2}>
      {/* Purpose */}
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', '&:hover': { borderColor: '#0ea5e9', boxShadow: '0 2px 4px rgba(14, 165, 233, 0.1)' }, transition: 'all 0.2s ease' }}>
          <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Tooltip
              title="The primary goal of your research. This helps ALwrity understand what you're trying to accomplish (e.g., learning, comparing options, making decisions, creating content)."
              arrow
              placement="top"
            >
              <Typography variant="caption" color="#666" fontWeight={500} display="flex" alignItems="center" gap={0.5} mb={0.5} sx={{ cursor: 'help' }}>
                Purpose
                <InfoIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
              </Typography>
            </Tooltip>
            <EditableField
              field="purpose"
              value={intent.purpose}
              displayValue={PURPOSE_DISPLAY[intent.purpose as ResearchPurpose] || intent.purpose}
              options={Object.entries(PURPOSE_DISPLAY).map(([key, label]) => ({ key, label }))}
              onSave={(val) => onUpdateField('purpose', val as ResearchPurpose)}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Content Type */}
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', '&:hover': { borderColor: '#0ea5e9', boxShadow: '0 2px 4px rgba(14, 165, 233, 0.1)' }, transition: 'all 0.2s ease' }}>
          <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Tooltip
              title="The type of content you're creating with this research. This helps ALwrity tailor the research results and format them appropriately (e.g., blog post, report, presentation, video script)."
              arrow
              placement="top"
            >
              <Typography variant="caption" color="#666" fontWeight={500} display="flex" alignItems="center" gap={0.5} mb={0.5} sx={{ cursor: 'help' }}>
                Creating
                <InfoIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
              </Typography>
            </Tooltip>
            <EditableField
              field="content_output"
              value={intent.content_output}
              displayValue={CONTENT_OUTPUT_DISPLAY[intent.content_output as ContentOutput] || intent.content_output}
              options={Object.entries(CONTENT_OUTPUT_DISPLAY).map(([key, label]) => ({ key, label }))}
              onSave={(val) => onUpdateField('content_output', val as ContentOutput)}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Depth */}
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', '&:hover': { borderColor: '#0ea5e9', boxShadow: '0 2px 4px rgba(14, 165, 233, 0.1)' }, transition: 'all 0.2s ease' }}>
          <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Tooltip
              title="How deep and comprehensive you want the research to be. Overview = quick summary, Detailed = thorough analysis, Expert = in-depth with advanced insights and multiple perspectives."
              arrow
              placement="top"
            >
              <Typography variant="caption" color="#666" fontWeight={500} display="flex" alignItems="center" gap={0.5} mb={0.5} sx={{ cursor: 'help' }}>
                Depth
                <InfoIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
              </Typography>
            </Tooltip>
            <EditableField
              field="depth"
              value={intent.depth}
              displayValue={DEPTH_DISPLAY[intent.depth as ResearchDepthLevel] || intent.depth}
              options={Object.entries(DEPTH_DISPLAY).map(([key, label]) => ({ key, label }))}
              onSave={(val) => onUpdateField('depth', val as ResearchDepthLevel)}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Queries Count */}
      <Grid item xs={6} sm={3}>
        <Card variant="outlined" sx={{ height: '100%', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
          <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="#666" fontWeight={500} display="block" mb={0.5}>
              Queries
            </Typography>
            <Typography variant="body2" fontWeight={500} color="#333">
              {queriesCount} targeted
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
