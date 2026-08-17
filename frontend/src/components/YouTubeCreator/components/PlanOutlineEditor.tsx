/**
 * Editable content outline with add/remove and drag-to-reorder.
 */

import React, { useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlanDetailsCard } from "./PlanDetailsCard";
import { inputSx } from "../styles";
import {
  createOutlineItemId,
  isDurationOffTarget,
  normalizeDuration,
  sumOutlineDurations,
  type OutlineItem,
} from "../utils/planOutlineHelpers";

export type { OutlineItem };

export interface PlanOutlineEditorProps {
  items: OutlineItem[];
  targetSeconds?: number;
  maxSections?: number;
  disabled?: boolean;
  onChange: (items: OutlineItem[]) => void;
}

interface SortableOutlineRowProps {
  item: OutlineItem;
  canDelete: boolean;
  onChangeItem: (id: string, updates: Partial<OutlineItem>) => void;
  onDelete: (id: string) => void;
}

const SortableOutlineRow: React.FC<SortableOutlineRowProps> = ({
  item,
  canDelete,
  onChangeItem,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "flex-start",
        p: 1.25,
        border: "1px solid #e5e7eb",
        borderRadius: 1.5,
        bgcolor: isDragging ? "#f9fafb" : "#fff",
        opacity: isDragging ? 0.7 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <IconButton
        size="small"
        aria-label="Reorder section"
        sx={{ cursor: "grab", mt: 0.5, touchAction: "none" }}
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon fontSize="small" />
      </IconButton>
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <TextField
          size="small"
          label="Section"
          value={item.section}
          onChange={(e) => onChangeItem(item.id, { section: e.target.value })}
          inputProps={{ "aria-label": `Section name ${item.id}` }}
          sx={inputSx}
        />
        <TextField
          size="small"
          label="Description"
          value={item.description}
          multiline
          minRows={2}
          onChange={(e) => onChangeItem(item.id, { description: e.target.value })}
          inputProps={{ "aria-label": `Section description ${item.id}` }}
          sx={inputSx}
        />
      </Stack>
      <TextField
        size="small"
        type="number"
        label="Seconds"
        value={item.duration_estimate}
        onChange={(e) =>
          onChangeItem(item.id, { duration_estimate: normalizeDuration(e.target.value) })
        }
        inputProps={{ min: 1, "aria-label": `Section duration ${item.id}` }}
        sx={{ ...inputSx, width: 96 }}
      />
      <IconButton
        size="small"
        aria-label="Delete section"
        disabled={!canDelete}
        onClick={() => onDelete(item.id)}
        sx={{ mt: 0.5 }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export const PlanOutlineEditor: React.FC<PlanOutlineEditorProps> = ({
  items,
  targetSeconds,
  maxSections = 10,
  disabled = false,
  onChange,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const totalSeconds = sumOutlineDurations(items);
  const showWarning = isDurationOffTarget(totalSeconds, targetSeconds);
  const canAdd = items.length < maxSections;

  const emit = useCallback(
    (next: OutlineItem[], action?: string) => {
      try {
        onChange(next);
        if (action) {
          console.info(`[PlanOutlineEditor] ${action}`, { count: next.length });
        }
      } catch (error) {
        console.error("[PlanOutlineEditor] Failed to update outline", {
          action: action || "update",
          count: next.length,
          error,
        });
      }
    },
    [onChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        console.warn("[PlanOutlineEditor] Reorder skipped: missing item ids");
        return;
      }
      emit(arrayMove(items, oldIndex, newIndex), "Reordered sections");
    },
    [emit, items],
  );

  const handleChangeItem = (id: string, updates: Partial<OutlineItem>) => {
    emit(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleDelete = (id: string) => {
    if (items.length <= 1) return;
    emit(items.filter((item) => item.id !== id), "Removed section");
  };

  const handleAdd = () => {
    if (!canAdd) return;
    emit(
      [
        ...items,
        {
          id: createOutlineItemId(),
          section: "",
          description: "",
          duration_estimate: 10,
        },
      ],
      "Added section",
    );
  };

  if (disabled) {
    return null;
  }

  return (
    <PlanDetailsCard title="Content Outline">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <Stack spacing={1.25}>
            {items.map((item) => (
              <SortableOutlineRow
                key={item.id}
                item={item}
                canDelete={items.length > 1}
                onChangeItem={handleChangeItem}
                onDelete={handleDelete}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5 }}>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!canAdd}
          sx={{ textTransform: "none" }}
        >
          Add section
        </Button>
        <Typography variant="caption" sx={{ color: "#6b7280" }}>
          Total {totalSeconds}s{targetSeconds ? ` / target ${targetSeconds}s` : ""}
        </Typography>
      </Box>

      {showWarning && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Outline duration is more than 20% away from the target. You can still save.
        </Alert>
      )}
    </PlanDetailsCard>
  );
};
