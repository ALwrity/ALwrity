import React, { useState, useRef, useCallback } from 'react';
import { Popper, Paper } from '@mui/material';

interface ResumeDraftRailChipProps {
  draft: string;
  onResumeDraft?: () => void;
  onClear?: () => void;
}

export const ResumeDraftRailChip: React.FC<ResumeDraftRailChipProps> = ({
  draft,
  onResumeDraft,
  onClear,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = useCallback((el: HTMLElement) => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    setAnchorEl(el);
  }, []);

  const handleClose = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => setAnchorEl(null), 180);
  }, []);

  if (!draft) return null;

  const preview =
    draft
      .split('\n')[0]
      .replace(/^#\s*/, '')
      .substring(0, 80) || 'Untitled draft';

  return (
    <div
      className="linkedin-resume-draft-chip"
      onMouseEnter={(e) => handleOpen(e.currentTarget)}
      onMouseLeave={handleClose}
    >
      <span className="linkedin-resume-draft-chip-dot" />
      <span className="linkedin-resume-draft-chip-label">Resume</span>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="left"
        style={{ zIndex: 1300 }}
        modifiers={[
          { name: 'offset', options: { offset: [0, 12] } },
          { name: 'flip', enabled: false },
        ]}
      >
        <Paper
          onMouseEnter={() => {
            if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
            setAnchorEl(anchorEl);
          }}
          onMouseLeave={handleClose}
          sx={{
            p: 2,
            minWidth: 220,
            maxWidth: 260,
            borderRadius: 2,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: '#c2410c',
              fontWeight: 700,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Resume Draft
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: '#334155',
              lineHeight: 1.4,
              marginBottom: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {preview}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onResumeDraft}
              style={{
                flex: 1,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#0a66c2',
                color: '#fff',
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Continue editing →
            </button>
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#64748b',
                fontWeight: 500,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Discard
            </button>
          </div>
        </Paper>
      </Popper>
    </div>
  );
};
