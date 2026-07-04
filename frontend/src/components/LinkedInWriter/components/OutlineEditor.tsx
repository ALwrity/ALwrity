import React, { useState } from 'react';
import { LinkedInOutlineSection } from '../../../services/linkedInWriterApi';

interface OutlineEditorProps {
  outline: LinkedInOutlineSection[];
  titleSuggestions: string[];
  onRefine: (op: string, sectionId?: string, payload?: any) => Promise<any>;
  onGenerateArticle: () => void;
  onBack: () => void;
  isGenerating: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  btn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: '#0a66c2',
    color: '#fff',
  },
  btnSecondary: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: '#fff',
    color: '#374151',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  titleSuggestions: {
    marginBottom: '20px',
    padding: '12px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    border: '1px solid #bae6fd',
  },
  titleLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#0369a1',
    marginBottom: '8px',
    display: 'block',
  },
  titleChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  titleChip: {
    padding: '4px 10px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: '1px solid #7dd3fc',
    fontSize: '12px',
    color: '#0369a1',
  },
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    transition: 'box-shadow 0.15s',
  },
  sectionExpanded: {
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionNumber: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  sectionHeadingArea: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeading: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  sectionRenameInput: {
    width: '100%',
    padding: '4px 8px',
    fontSize: '14px',
    fontWeight: 600,
    border: '1px solid #6366f1',
    borderRadius: '4px',
    outline: 'none',
  },
  sectionMeta: {
    fontSize: '11px',
    color: '#9ca3af',
    whiteSpace: 'nowrap',
  },
  sectionTools: {
    display: 'flex',
    gap: '2px',
    flexShrink: 0,
  },
  toolBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '14px',
    lineHeight: 1,
    borderRadius: '4px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
  },
  toolBtnRemove: {
    color: '#ef4444',
  },
  expandIcon: {
    fontSize: '10px',
    color: '#9ca3af',
    flexShrink: 0,
  },
  sectionBody: {
    padding: '0 14px 12px 50px',
  },
  keyPointsLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '4px',
  },
  keyPointsList: {
    margin: 0,
    paddingLeft: '16px',
    fontSize: '13px',
    color: '#4b5563',
    lineHeight: '1.6',
  },
  addSectionForm: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px dashed #d1d5db',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '8px',
  },
  formInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
  },
  formTextarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  addSectionActions: {
    display: 'flex',
    gap: '8px',
  },
  btnSm: {
    padding: '6px 12px',
    fontSize: '12px',
  },
  btnOutline: {
    width: '100%',
    padding: '10px',
    border: '1px dashed #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6b7280',
    transition: 'border-color 0.15s, color 0.15s',
  },
};

export const OutlineEditor: React.FC<OutlineEditorProps> = ({
  outline,
  titleSuggestions,
  onRefine,
  onGenerateArticle,
  onBack,
  isGenerating,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newHeading, setNewHeading] = useState('');
  const [newKeyPoints, setNewKeyPoints] = useState('');

  if (outline.length === 0) {
    return (
      <div style={{ ...styles.container, textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>No outline sections yet. Generate an outline first.</p>
      </div>
    );
  }

  const handleRename = (id: string) => {
    const section = outline.find(s => s.id === id);
    if (section) {
      setEditingId(id);
      setEditValue(section.heading);
    }
  };

  const commitRename = async (id: string) => {
    if (editValue.trim()) {
      await onRefine('rename', id, { heading: editValue.trim() });
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    await onRefine('move', id, { direction });
  };

  const handleRemove = async (id: string) => {
    await onRefine('remove', id);
  };

  const handleAdd = async () => {
    if (newHeading.trim()) {
      await onRefine('add', undefined, {
        heading: newHeading.trim(),
        key_points: newKeyPoints.split('\n').filter(kp => kp.trim()).map(kp => kp.trim()),
      });
      setNewHeading('');
      setNewKeyPoints('');
      setNewSectionOpen(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Article Outline</h3>
        <div style={styles.headerActions}>
          <button
            style={{ ...styles.btnSecondary, ...(isGenerating ? styles.btnDisabled : {}) }}
            onClick={onBack}
            disabled={isGenerating}
          >
            Back
          </button>
          <button
            style={{ ...styles.btnPrimary, ...(isGenerating ? styles.btnDisabled : {}) }}
            onClick={onGenerateArticle}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Article'}
          </button>
        </div>
      </div>

      {titleSuggestions.length > 0 && (
        <div style={styles.titleSuggestions}>
          <span style={styles.titleLabel}>Suggested Titles:</span>
          <div style={styles.titleChips}>
            {titleSuggestions.map((title, i) => (
              <span key={i} style={styles.titleChip}>{title}</span>
            ))}
          </div>
        </div>
      )}

      <div style={styles.sectionList}>
        {outline.map((section, index) => (
          <div
            key={section.id}
            style={{
              ...styles.section,
              ...(expandedId === section.id ? styles.sectionExpanded : {}),
            }}
          >
            <div style={styles.sectionHeader} onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}>
              <span style={styles.sectionNumber}>{index + 1}</span>
              <div style={styles.sectionHeadingArea}>
                {editingId === section.id ? (
                  <input
                    style={styles.sectionRenameInput}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => commitRename(section.id)}
                    onKeyDown={e => e.key === 'Enter' && commitRename(section.id)}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span style={styles.sectionHeading}>{section.heading}</span>
                )}
              </div>
              <div style={styles.sectionMeta}>
                <span>{section.key_points.length} pts</span>
              </div>
              <div style={styles.sectionTools}>
                <button
                  style={styles.toolBtn}
                  onClick={e => { e.stopPropagation(); handleRename(section.id); }}
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  style={styles.toolBtn}
                  onClick={e => { e.stopPropagation(); handleMove(section.id, 'up'); }}
                  disabled={index === 0}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  style={styles.toolBtn}
                  onClick={e => { e.stopPropagation(); handleMove(section.id, 'down'); }}
                  disabled={index === outline.length - 1}
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  style={{ ...styles.toolBtn, ...styles.toolBtnRemove }}
                  onClick={e => { e.stopPropagation(); handleRemove(section.id); }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
              <span style={styles.expandIcon}>{expandedId === section.id ? '▲' : '▼'}</span>
            </div>

            {expandedId === section.id && (
              <div style={styles.sectionBody}>
                {section.key_points.length > 0 && (
                  <div>
                    <div style={styles.keyPointsLabel}>Key Points:</div>
                    <ul style={styles.keyPointsList}>
                      {section.key_points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {newSectionOpen ? (
        <div style={styles.addSectionForm}>
          <input
            style={styles.formInput}
            placeholder="Section heading"
            value={newHeading}
            onChange={e => setNewHeading(e.target.value)}
          />
          <textarea
            style={styles.formTextarea}
            placeholder="Key points (one per line)"
            value={newKeyPoints}
            onChange={e => setNewKeyPoints(e.target.value)}
            rows={3}
          />
          <div style={styles.addSectionActions}>
            <button style={{ ...styles.btnPrimary, ...styles.btnSm }} onClick={handleAdd}>Add</button>
            <button style={{ ...styles.btnSecondary, ...styles.btnSm }} onClick={() => setNewSectionOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          style={styles.btnOutline}
          onClick={() => setNewSectionOpen(true)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
        >
          + Add Section
        </button>
      )}
    </div>
  );
};

export default OutlineEditor;
