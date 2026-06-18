import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Info as InfoIcon,
  Palette as PaletteIcon,
  Speed as SpeedIcon,
  Language as LanguageIcon,
  TrendingUp as TrendingUpIcon,
  Business as BusinessIcon,
  Psychology as PsychologyIcon,
  Group as GroupIcon,
  Explore as ExploreIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';

interface WritingStyle {
  tone?: string;
  voice?: string;
  complexity?: string;
  engagement_level?: string;
  brand_personality?: string;
  formality_level?: string;
  emotional_appeal?: string;
}

interface TargetAudience {
  expertise_level?: string;
  geographic_focus?: string;
}

interface ContentType {
  primary_type?: string;
}

interface KeyInsightsGridProps {
  writing_style?: WritingStyle;
  target_audience?: TargetAudience;
  content_type?: ContentType;
}

interface InsightRow {
  category: string;
  label: string;
  value: string;
  tooltip: string;
  icon: React.ReactNode;
}

const rows = (ws?: WritingStyle, ta?: TargetAudience, ct?: ContentType): InsightRow[] => {
  const r: InsightRow[] = [];
  if (ws?.tone) r.push({ category: 'Content Style', label: 'Writing Tone', value: ws.tone, tooltip: 'The emotional quality and attitude of the writing — how it makes readers feel and the mood it creates.', icon: <PaletteIcon color="primary" /> });
  if (ws?.complexity) r.push({ category: 'Content Style', label: 'Content Complexity', value: ws.complexity, tooltip: 'How sophisticated or simple the content is. Moderate complexity balances depth with accessibility.', icon: <SpeedIcon color="secondary" /> });
  if (ws?.voice) r.push({ category: 'Content Style', label: 'Writing Voice', value: ws.voice, tooltip: 'The unique personality and style of the writing — what makes it distinctive and recognizable.', icon: <LanguageIcon color="info" /> });
  if (ws?.engagement_level) r.push({ category: 'Content Style', label: 'Engagement Level', value: ws.engagement_level, tooltip: 'How well the content captures and maintains reader attention throughout the piece.', icon: <TrendingUpIcon color="success" /> });
  if (ws?.brand_personality) r.push({ category: 'Content Style', label: 'Brand Personality', value: ws.brand_personality, tooltip: 'The human characteristics and traits associated with the brand, like friendly, professional, or innovative.', icon: <BusinessIcon color="warning" /> });
  if (ws?.formality_level) r.push({ category: 'Content Style', label: 'Formality Level', value: ws.formality_level, tooltip: 'How formal or casual the writing style is. Semi-formal strikes a balance between professional and approachable.', icon: <PsychologyIcon color="primary" /> });
  if (ws?.emotional_appeal) r.push({ category: 'Content Style', label: 'Emotional Appeal', value: ws.emotional_appeal, tooltip: 'How the content connects with readers\' emotions — what feelings it aims to evoke.', icon: <PaletteIcon color="secondary" /> });
  if (ta?.expertise_level) r.push({ category: 'Audience', label: 'Target Audience', value: ta.expertise_level, tooltip: 'The skill level and experience of the intended readers — from beginners to experts in the subject matter.', icon: <GroupIcon color="info" /> });
  if (ta?.geographic_focus?.trim()) r.push({ category: 'Audience', label: 'Geographic Focus', value: ta.geographic_focus, tooltip: 'The geographical regions or areas the content is primarily intended for — local, national, or global reach.', icon: <ExploreIcon color="secondary" /> });
  if (ct?.primary_type) r.push({ category: 'Content Type', label: 'Primary Type', value: ct.primary_type, tooltip: 'The main category or format of content being created — blog posts, tutorials, product descriptions, etc.', icon: <ArticleIcon color="warning" /> });
  return r;
};

const categoryColors: Record<string, string> = {
  'Content Style': '#f1f5f9',
  'Audience': '#f1f5f9',
  'Content Type': '#f1f5f9',
};

const chipColors: Record<string, 'primary' | 'secondary' | 'info' | 'success' | 'warning'> = {
  'Writing Tone': 'primary',
  'Content Complexity': 'secondary',
  'Writing Voice': 'info',
  'Engagement Level': 'success',
  'Brand Personality': 'warning',
  'Formality Level': 'primary',
  'Emotional Appeal': 'secondary',
  'Target Audience': 'info',
  'Geographic Focus': 'secondary',
  'Primary Type': 'warning',
};

const KeyInsightsGrid: React.FC<KeyInsightsGridProps> = ({
  writing_style,
  target_audience,
  content_type
}) => {
  const data = rows(writing_style, target_audience, content_type);
  if (data.length === 0) return null;

  const groupedRows = data.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {} as Record<string, InsightRow[]>);

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, mb: 2.5 }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: '#f8fafc' }}>
            <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '25%' }}>Metric</TableCell>
            <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '35%' }}>Analysis Result</TableCell>
            <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '40%' }}>Description</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(groupedRows).map(([category, categoryRows]) => (
            <React.Fragment key={category}>
              <TableRow sx={{ backgroundColor: categoryColors[category] || '#f1f5f9' }}>
                <TableCell colSpan={3} sx={{ fontWeight: 700, color: '#475569', py: 1 }}>
                  {category}
                </TableCell>
              </TableRow>
              {categoryRows.map((row) => (
                <TableRow
                  key={row.label}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { backgroundColor: '#f9f9f9' } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {row.icon}
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2d3748' }}>
                        {row.label}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.value}
                      size="small"
                      color={chipColors[row.label] || 'default'}
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={row.tooltip} arrow placement="top">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                        <InfoIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          What is this?
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default KeyInsightsGrid;
