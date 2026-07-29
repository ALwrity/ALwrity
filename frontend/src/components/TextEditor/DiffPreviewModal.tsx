import React from 'react';
import { diffMarkup } from '../LinkedInWriter/utils/contentFormatters';

interface DiffPreviewModalProps {
  isPreviewing: boolean;
  pendingEdit: { src: string; target: string } | null;
  livePreviewHtml: string;
  onConfirmChanges: () => void;
  onDiscardChanges: () => void;
}

const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isPreviewing,
  pendingEdit,
  livePreviewHtml,
  onConfirmChanges,
  onDiscardChanges
}) => {
  if (!isPreviewing || !pendingEdit) return null;

  return (
    <div style={{
      margin: '24px',
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <strong style={{ color: '#0a66c2' }}>Preview Changes</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onConfirmChanges}
            style={{
              padding: '6px 12px',
              background: '#0a66c2',
              color: '#fff',
              border: '1px solid #0a66c2',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Confirm Changes
          </button>
          <button
            onClick={onDiscardChanges}
            style={{
              padding: '6px 12px',
              background: '#fff',
              color: '#444',
              border: '1px solid #ddd',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Discard
          </button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div
          className="liw-diff-preview"
          style={{
            fontFamily: 'inherit',
            fontSize: 15,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            color: '#0f172a',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 16,
          }}
          dangerouslySetInnerHTML={{ __html: livePreviewHtml || diffMarkup(pendingEdit.src, pendingEdit.target) }}
        />
        <style>{`
          .liw-diff-preview {
            color: #0f172a !important;
          }
          .liw-diff-preview .liw-add {
            background: #bbf7d0;
            color: #14532d;
            font-style: normal;
            font-weight: 600;
            border-radius: 2px;
            padding: 0 2px;
          }
          .liw-diff-preview .liw-del {
            background: #fecaca;
            color: #7f1d1d;
            text-decoration: line-through;
            opacity: 1;
            border-radius: 2px;
            padding: 0 2px;
          }
          .liw-diff-preview .liw-more {
            color: #475569;
            font-weight: 500;
          }
        `}</style>
      </div>
    </div>
  );
};

export default DiffPreviewModal;
