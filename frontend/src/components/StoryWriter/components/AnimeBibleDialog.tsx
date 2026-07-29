import React, { useState, useCallback } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, IconButton,
  Tabs, Tab, Typography, Chip, alpha, TextField, Button,
  Select, MenuItem, FormControl,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import PaletteIcon from '@mui/icons-material/Palette';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface AnimeBibleDialogProps {
  open: boolean;
  onClose: () => void;
  animeBible: any | null;
  onSave?: (bible: any) => void;
}

const cloneBible = (bible: any): any =>
  bible ? JSON.parse(JSON.stringify(bible)) : null;

/* ─── Tag Input ─── */

const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}> = ({ tags, onChange, placeholder = 'Add tag...' }) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
        {tags.map((tag, i) => (
          <Chip
            key={i}
            label={tag}
            size="small"
            onDelete={() => onChange(tags.filter((_, j) => j !== i))}
            sx={{
              height: 22, fontSize: '0.7rem',
              backgroundColor: alpha('#5D4037', 0.1),
              color: '#5D4037',
              '& .MuiChip-deleteIcon': { fontSize: 14, color: '#8D6E63' },
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <TextField
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.75rem', height: 28, backgroundColor: '#fff',
            },
          }}
        />
        <Button
          size="small"
          onClick={handleAdd}
          disabled={!input.trim()}
          sx={{ minWidth: 'auto', px: 1, fontSize: '0.7rem', color: '#5D4037' }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
};

/* ─── View Mode ─── */

const CastMemberCard: React.FC<{ member: any }> = ({ member }) => (
  <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(141,110,99,0.18)', backgroundColor: '#F7F3E9', mb: 1.5 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2C2416' }}>
      {member.name || member.id}
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
      {member.age_range && (
        <Chip size="small" label={member.age_range} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 500 }} />
      )}
      {member.role && (
        <Chip
          size="small"
          label={member.role}
          sx={{
            height: 20, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize',
            backgroundColor:
              member.role === 'protagonist' ? alpha('#22c55e', 0.15) :
              member.role === 'antagonist' ? alpha('#f97373', 0.15) :
              alpha('#5D4037', 0.1),
            color:
              member.role === 'protagonist' ? '#065f46' :
              member.role === 'antagonist' ? '#7f1d1d' :
              '#5D4037',
          }}
        />
      )}
    </Box>
    {member.look && (
      <Typography variant="body2" sx={{ mt: 1, color: '#4b5563' }}><strong>Look:</strong> {member.look}</Typography>
    )}
    {member.outfit_palette && (
      <Typography variant="body2" sx={{ color: '#4b5563' }}><strong>Outfit:</strong> {member.outfit_palette}</Typography>
    )}
    {member.personality_tags?.length > 0 && (
      <Box sx={{ mt: 0.75, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {member.personality_tags.map((tag: string) => (
          <Chip key={tag} size="small" label={tag} variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem', borderColor: alpha('#5D4037', 0.25), color: '#5D4037' }}
          />
        ))}
      </Box>
    )}
  </Box>
);

const ViewCastTab: React.FC<{ cast: any[] }> = ({ cast }) => {
  if (!cast?.length) return <Typography color="text.secondary">No cast members defined.</Typography>;
  return <>{cast.map((m: any) => <CastMemberCard key={m.id || m.name} member={m} />)}</>;
};

const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
  value ? (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="overline" sx={{ color: '#5D4037', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: '#2C2416', lineHeight: 1.6 }}>{value}</Typography>
    </Box>
  ) : null;

const ViewWorldTab: React.FC<{ world: any }> = ({ world }) => {
  if (!world) return <Typography color="text.secondary">No world information defined.</Typography>;
  return (
    <Box>
      <Field label="Setting" value={world.setting} />
      <Field label="Era" value={world.era} />
      <Field label="Tech / Magic Level" value={world.tech_or_magic_level} />
      {world.core_rules?.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="overline" sx={{ color: '#5D4037', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', mb: 0.5 }}>
            Core Rules
          </Typography>
          <Box component="ul" sx={{ mt: 0, pl: 2, m: 0 }}>
            {world.core_rules.map((rule: string, i: number) => (
              <Typography key={i} component="li" variant="body2" sx={{ color: '#4b5563', mb: 0.5, lineHeight: 1.5 }}>{rule}</Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const ViewVisualTab: React.FC<{ visual: any }> = ({ visual }) => {
  if (!visual) return <Typography color="text.secondary">No visual style defined.</Typography>;
  return (
    <Box>
      <Field label="Style Preset" value={visual.style_preset} />
      <Field label="Camera Style" value={visual.camera_style} />
      <Field label="Color Mood" value={visual.color_mood} />
      <Field label="Lighting" value={visual.lighting} />
      <Field label="Line Style" value={visual.line_style} />
      {visual.extra_tags?.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 2, flexWrap: 'wrap' }}>
          {visual.extra_tags.map((tag: string) => (
            <Chip key={tag} size="small" label={tag} variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem', borderColor: alpha('#5D4037', 0.25), color: '#5D4037' }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ─── Edit Mode ─── */

const EditableField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  select?: boolean;
  options?: { value: string; label: string }[];
}> = ({ label, value, onChange, multiline, select, options }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="overline" sx={{ color: '#5D4037', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', mb: 0.25 }}>
      {label}
    </Typography>
    {select ? (
      <FormControl fullWidth size="small">
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          sx={{
            fontSize: '0.8rem', backgroundColor: '#fff',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#5D4037', 0.2) },
          }}
        >
          {options?.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    ) : (
      <TextField
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline={multiline}
        minRows={multiline ? 2 : 1}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': { fontSize: '0.8rem', backgroundColor: '#fff' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#5D4037', 0.2) },
        }}
      />
    )}
  </Box>
);

const EditCastTab: React.FC<{
  cast: any[];
  onChange: (cast: any[]) => void;
}> = ({ cast, onChange }) => {
  const updateMember = (index: number, field: string, value: any) => {
    const updated = [...cast];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeMember = (index: number) => {
    onChange(cast.filter((_, i) => i !== index));
  };

  const addMember = () => {
    const newMember = {
      id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: '', age_range: '', role: 'support', look: '', outfit_palette: '', personality_tags: [],
    };
    onChange([...cast, newMember]);
  };

  if (!cast?.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography color="text.secondary" sx={{ mb: 1 }}>No cast members defined.</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addMember} variant="outlined">
          Add Character
        </Button>
      </Box>
    );
  }

  return (
    <>
      {cast.map((member, i) => (
        <Box key={member.id || i} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(141,110,99,0.18)', backgroundColor: '#F7F3E9', mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2C2416', fontSize: '0.85rem' }}>
              Character {i + 1}
            </Typography>
            <IconButton size="small" onClick={() => removeMember(i)} sx={{ color: '#f97373' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <EditableField label="ID" value={member.id} onChange={(v) => updateMember(i, 'id', v)} />
          <EditableField label="Name" value={member.name || ''} onChange={(v) => updateMember(i, 'name', v)} />
          <EditableField label="Age Range" value={member.age_range || ''} onChange={(v) => updateMember(i, 'age_range', v)} />
          <EditableField
            label="Role"
            value={member.role || 'support'}
            onChange={(v) => updateMember(i, 'role', v)}
            select
            options={[
              { value: 'protagonist', label: 'Protagonist' },
              { value: 'antagonist', label: 'Antagonist' },
              { value: 'support', label: 'Support' },
            ]}
          />
          <EditableField label="Look" value={member.look || ''} onChange={(v) => updateMember(i, 'look', v)} multiline />
          <EditableField label="Outfit Palette" value={member.outfit_palette || ''} onChange={(v) => updateMember(i, 'outfit_palette', v)} />
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="overline" sx={{ color: '#5D4037', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', mb: 0.25 }}>
              Personality Tags
            </Typography>
            <TagInput
              tags={member.personality_tags || []}
              onChange={(tags) => updateMember(i, 'personality_tags', tags)}
              placeholder="Add personality tag..."
            />
          </Box>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addMember} variant="outlined" sx={{ mt: 0.5 }}>
        Add Character
      </Button>
    </>
  );
};

const EditWorldTab: React.FC<{
  world: any;
  onChange: (world: any) => void;
}> = ({ world, onChange }) => {
  const update = (field: string, value: any) => {
    onChange({ ...world, [field]: value });
  };

  if (!world) return <Typography color="text.secondary">No world information defined.</Typography>;

  return (
    <Box>
      <EditableField label="Setting" value={world.setting || ''} onChange={(v) => update('setting', v)} />
      <EditableField label="Era" value={world.era || ''} onChange={(v) => update('era', v)} />
      <EditableField label="Tech / Magic Level" value={world.tech_or_magic_level || ''} onChange={(v) => update('tech_or_magic_level', v)} />
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="overline" sx={{ color: '#5D4037', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', mb: 0.5 }}>
          Core Rules
        </Typography>
        <TagInput
          tags={world.core_rules || []}
          onChange={(tags) => update('core_rules', tags)}
          placeholder="Add core rule..."
        />
      </Box>
    </Box>
  );
};

const EditVisualTab: React.FC<{
  visual: any;
  onChange: (visual: any) => void;
}> = ({ visual, onChange }) => {
  const update = (field: string, value: any) => {
    onChange({ ...visual, [field]: value });
  };

  if (!visual) return <Typography color="text.secondary">No visual style defined.</Typography>;

  return (
    <Box>
      <EditableField label="Style Preset" value={visual.style_preset || ''} onChange={(v) => update('style_preset', v)} />
      <EditableField label="Camera Style" value={visual.camera_style || ''} onChange={(v) => update('camera_style', v)} />
      <EditableField label="Color Mood" value={visual.color_mood || ''} onChange={(v) => update('color_mood', v)} />
      <EditableField label="Lighting" value={visual.lighting || ''} onChange={(v) => update('lighting', v)} />
      <EditableField label="Line Style" value={visual.line_style || ''} onChange={(v) => update('line_style', v)} />
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="overline" sx={{ color: '#5D4037', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', mb: 0.5 }}>
          Extra Tags
        </Typography>
        <TagInput
          tags={visual.extra_tags || []}
          onChange={(tags) => update('extra_tags', tags)}
          placeholder="Add extra tag..."
        />
      </Box>
    </Box>
  );
};

/* ─── Main Dialog ─── */

export const AnimeBibleDialog: React.FC<AnimeBibleDialogProps> = ({ open, onClose, animeBible, onSave }) => {
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);

  const handleStartEdit = () => {
    setDraft(cloneBible(animeBible));
    setEditing(true);
  };

  const handleSave = () => {
    if (onSave && draft) {
      onSave(draft);
    }
    setEditing(false);
    setDraft(null);
  };

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft(null);
  }, []);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => setTab(newValue);

  React.useEffect(() => {
    if (!open) {
      setEditing(false);
      setDraft(null);
      setTab(0);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={editing ? undefined : onClose}
      disableEscapeKeyDown={editing}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#F7F3E9', borderBottom: '1px solid rgba(141,110,99,0.15)',
          py: 1.5, px: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C2416', fontSize: '1rem' }}>
            Anime Story Bible
          </Typography>
          <Chip
            size="small"
            label={editing ? 'Editing' : 'Read-only'}
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 600,
              backgroundColor: editing ? alpha('#f59e0b', 0.15) : alpha('#5D4037', 0.1),
              color: editing ? '#92400e' : '#5D4037',
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {editing ? (
            <>
              <Button
                size="small"
                onClick={handleCancel}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#8D6E63' }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
                onClick={handleSave}
                sx={{
                  textTransform: 'none', fontSize: '0.75rem',
                  backgroundColor: '#5D4037', color: '#FAF9F6',
                  '&:hover': { backgroundColor: '#3E2723' },
                }}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              {animeBible && (
                <Button
                  size="small"
                  startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                  onClick={handleStartEdit}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#5D4037' }}
                >
                  Edit
                </Button>
              )}
            </>
          )}
          <IconButton size="small" onClick={editing ? handleCancel : onClose} sx={{ color: '#5D4037' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {!animeBible && !editing ? (
        <DialogContent dividers sx={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF9F6' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            No anime story bible is available yet. Generate an outline for an anime story to create one.
          </Typography>
        </DialogContent>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={handleChange}
            variant="fullWidth"
            sx={{
              minHeight: 44, backgroundColor: '#FAF9F6',
              '& .MuiTab-root': {
                minHeight: 44, textTransform: 'none', fontWeight: 600,
                fontSize: '0.85rem', color: '#8D6E63',
                '&.Mui-selected': { color: '#3E2723' },
              },
              '& .MuiTabs-indicator': { backgroundColor: '#5D4037', height: 3 },
            }}
          >
            <Tab icon={<PeopleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Cast" />
            <Tab icon={<PublicIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="World" />
            <Tab icon={<PaletteIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Visual Style" />
          </Tabs>
          <DialogContent dividers sx={{ minHeight: 300, backgroundColor: '#FAF9F6' }}>
            {tab === 0 && (editing
              ? <EditCastTab cast={draft?.main_cast || []} onChange={(cast) => setDraft({ ...draft, main_cast: cast })} />
              : <ViewCastTab cast={animeBible?.main_cast} />
            )}
            {tab === 1 && (editing
              ? <EditWorldTab world={draft?.world || { setting: '', era: '', tech_or_magic_level: '', core_rules: [] }} onChange={(world) => setDraft({ ...draft, world })} />
              : <ViewWorldTab world={animeBible?.world} />
            )}
            {tab === 2 && (editing
              ? <EditVisualTab visual={draft?.visual_style || { style_preset: '', camera_style: '', color_mood: '', lighting: '', line_style: '', extra_tags: [] }} onChange={(visual) => setDraft({ ...draft, visual_style: visual })} />
              : <ViewVisualTab visual={animeBible?.visual_style} />
            )}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};

export default AnimeBibleDialog;
