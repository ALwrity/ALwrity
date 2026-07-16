/** FrameGallery — Draggable/reorderable frame list with previews.
 *
 * Uses @dnd-kit/core + @dnd-kit/sortable for drag-to-reorder.
 * Each frame shows a thumbnail, dimension label, and remove button.
 *
 * Zero ALwrity dependencies.
 */

import React, { useCallback } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Tooltip,
} from '@mui/material';
import { Delete as DeleteIcon, DragHandle as DragIcon } from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Frame } from './types';

interface FrameGalleryProps {
  frames: Frame[];
  onReorder: (frames: Frame[]) => void;
  onRemove: (id: string) => void;
}

// ── Sortable item ────────────────────────────────────────────────────────────

interface SortableFrameProps {
  frame: Frame;
  index: number;
  onRemove: (id: string) => void;
}

const SortableFrame: React.FC<SortableFrameProps> = ({ frame, index, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: frame.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1,
        mb: 1,
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
      }}
    >
      {/* Drag handle */}
      <IconButton
        size="small"
        sx={{ cursor: 'grab', touchAction: 'none' }}
        {...attributes}
        {...listeners}
      >
        <DragIcon fontSize="small" />
      </IconButton>

      {/* Thumbnail */}
      <Box
        component="img"
        src={frame.thumbnail}
        alt={`Frame ${index + 1}`}
        sx={{
          width: 80,
          height: 56,
          objectFit: 'cover',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      />

      {/* Info */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} noWrap>
          Frame {index + 1}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {frame.width} × {frame.height}
        </Typography>
      </Box>

      {/* Remove */}
      <Tooltip title="Remove frame">
        <IconButton
          size="small"
          color="error"
          onClick={() => onRemove(frame.id)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

// ── Gallery ──────────────────────────────────────────────────────────────────

export const FrameGallery: React.FC<FrameGalleryProps> = ({
  frames,
  onReorder,
  onRemove,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = frames.findIndex((f) => f.id === active.id);
      const newIndex = frames.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...frames];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onReorder(reordered);
    },
    [frames, onReorder],
  );

  if (frames.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No frames yet. Go to the Capture tab to add some.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Arrange Frames
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag to reorder. First frame = start of animation.
        {frames.length > 1 && (
          <> Last frame gets extra freeze time.</>
        )}
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={frames.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          {frames.map((frame, index) => (
            <SortableFrame
              key={frame.id}
              frame={frame}
              index={index}
              onRemove={onRemove}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {frames.length} frame{frames.length !== 1 ? 's' : ''}
      </Typography>
    </Box>
  );
};
