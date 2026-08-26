import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, IconButton, Checkbox, FormControlLabel, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import type { DiffPreviewData, DiffSegment } from '../../../utils/getSectionDiffs';

interface DiffPreviewModalProps {
  isOpen: boolean;
  diffData: DiffPreviewData | null;
  onAccept: () => void;
  onReject: () => void;
  onAcceptSelected?: (selectedSectionIds: Record<string, boolean>, acceptIntroduction: boolean) => void;
  loading?: boolean;
}

function renderDiffSegments(segments: DiffSegment[]): React.ReactNode {
  return segments.map((seg, i) => {
    if (seg.added) {
      return (
        <Box
          component="span"
          key={i}
          sx={{
            bgcolor: '#dcfce7',
            color: '#166534',
            px: 0.5,
            borderRadius: '3px',
            fontWeight: 600,
          }}
        >
          {seg.value}
        </Box>
      );
    }
    if (seg.removed) {
      return (
        <Box
          component="span"
          key={i}
          sx={{
            bgcolor: '#fee2e2',
            color: '#991b1b',
            px: 0.5,
            borderRadius: '3px',
            textDecoration: 'line-through',
            textDecorationColor: '#dc2626',
          }}
        >
          {seg.value}
        </Box>
      );
    }
    return <span key={i}>{seg.value}</span>;
  });
}

export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isOpen,
  diffData,
  onAccept,
  onReject,
  onAcceptSelected,
  loading = false,
}) => {
  // Per-section selection state — default: select all changed sections
  const [sectionSelection, setSectionSelection] = useState<Record<string, boolean>>({});
  const [acceptIntroduction, setAcceptIntroduction] = useState(true);

  // Initialize defaults when diffData changes
  React.useEffect(() => {
    if (!diffData) return;
    const initial: Record<string, boolean> = {};
    diffData.sectionDiffs.forEach(s => {
      initial[s.id] = s.changed;
    });
    setSectionSelection(initial);
    setAcceptIntroduction(diffData.introductionChanged);
  }, [diffData]);

  if (!diffData) return null;

  const hasAnyChange = diffData.introductionChanged || diffData.sectionDiffs.some(s => s.changed);
  const selectedCount = Object.values(sectionSelection).filter(Boolean).length;
  const hasAnySelected = selectedCount > 0 || acceptIntroduction;

  const toggleSection = (id: string) => {
    setSectionSelection(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAcceptSelected = () => {
    if (onAcceptSelected) {
      onAcceptSelected(sectionSelection, acceptIntroduction);
    } else {
      onAccept();
    }
  };

  const allSelected = diffData.sectionDiffs.every(s => sectionSelection[s.id]);
  const toggleAll = () => {
    const newVal = !allSelected;
    const updated: Record<string, boolean> = {};
    diffData.sectionDiffs.forEach(s => {
      updated[s.id] = newVal;
    });
    setSectionSelection(updated);
  };

  return (
    <Dialog open={isOpen} maxWidth="lg" fullWidth fullScreen>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'white',
          borderBottom: '2px solid #e2e8f0',
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            SEO Recommendations — Review Changes
          </Typography>
          <IconButton onClick={onReject} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <Box sx={{ px: 3, pb: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={<CheckIcon />}
            label={`${diffData.sectionDiffs.filter(s => s.changed).length} section(s) changed`}
            color="warning"
            size="small"
            variant="outlined"
          />
          <Chip
            label={`${selectedCount} of ${diffData.sectionDiffs.length} selected`}
            color={selectedCount > 0 ? 'primary' : 'default'}
            size="small"
            variant="outlined"
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', fontSize: '0.75rem', color: '#166534' }}>
              <Box sx={{ width: 14, height: 14, bgcolor: '#dcfce7', border: '1px solid #86efac', borderRadius: '2px' }} />
              <span>Added</span>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', fontSize: '0.75rem', color: '#991b1b' }}>
              <Box sx={{ width: 14, height: 14, bgcolor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '2px' }} />
              <span>Removed</span>
            </Box>
          </Box>
        </Box>
      </Box>

      <DialogContent sx={{ py: 3, bgcolor: '#f8fafc' }}>
        {!hasAnyChange && (
          <Typography sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
            No changes detected between original and recommended content.
          </Typography>
        )}

        {/* Introduction — toggle */}
        {diffData.introductionChanged && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Checkbox
                checked={acceptIntroduction}
                onChange={() => setAcceptIntroduction(!acceptIntroduction)}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: acceptIntroduction ? '#475569' : '#94a3b8' }}>
                Introduction
              </Typography>
            </Box>
            <Box sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5, fontFamily: 'Georgia, serif', fontSize: '1rem', lineHeight: 1.8, color: '#1e293b' }}>
              {renderDiffSegments(diffData.introductionDiff!)}
            </Box>
          </Box>
        )}

        {/* Select / Deselect All */}
        {diffData.sectionDiffs.some(s => s.changed) && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" variant="text" onClick={toggleAll} sx={{ textTransform: 'none', fontSize: '0.8rem', minWidth: 'auto', p: 0 }}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </Box>
        )}

        {/* Per-section diffs with checkbox */}
        {diffData.sectionDiffs.map((section, idx) => {
          if (!section.changed) return null;
          const isSelected = sectionSelection[section.id] ?? true;
          return (
            <Box key={section.id || idx} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleSection(section.id)}
                  size="small"
                  sx={{ p: 0, mr: 1 }}
                />
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: isSelected ? '#475569' : '#94a3b8' }}>
                  {section.heading}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5, fontFamily: 'Georgia, serif', fontSize: '1rem', lineHeight: 1.8, color: '#1e293b', opacity: isSelected ? 1 : 0.5 }}>
                {renderDiffSegments(section.segments)}
              </Box>
            </Box>
          );
        })}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', bgcolor: 'white', justifyContent: 'space-between' }}>
        <Button
          onClick={onReject}
          disabled={loading}
          variant="outlined"
          color="error"
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Reject All Changes
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={onAccept}
            disabled={loading}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Accept All
          </Button>
          <Button
            onClick={handleAcceptSelected}
            disabled={loading || !hasAnySelected}
            variant="contained"
            color="primary"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Accept Selected ({selectedCount + (acceptIntroduction && diffData.introductionChanged ? 1 : 0)})
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default DiffPreviewModal;