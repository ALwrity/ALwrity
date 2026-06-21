import React, { useState } from 'react';

import type { LinkedInProfileAnalysisError } from '../../../../api/linkedinSocial';

interface LinkedInProfileDebugStripProps {
  lastCompletedPhase: number | null;
  isProfileComplete: boolean;
  foundationError: LinkedInProfileAnalysisError | null;
  topicError: LinkedInProfileAnalysisError | null;
  intelligenceSource?: string | null;
}

/** Dev/staging only — collapsible pipeline debug footer. */
export const LinkedInProfileDebugStrip: React.FC<LinkedInProfileDebugStripProps> = ({
  lastCompletedPhase,
  isProfileComplete,
  foundationError,
  topicError,
  intelligenceSource,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const activeError = topicError ?? foundationError;

  return (
    <div
      style={{
        marginTop: 16,
        maxWidth: 1200,
        borderRadius: 8,
        border: '1px dashed #cbd5e1',
        backgroundColor: '#f8fafc',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#475569',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#64748b',
        }}
      >
        {expanded ? '▼' : '▶'} Dev debug — pipeline
      </button>
      {expanded && (
        <div style={{ padding: '0 12px 12px', lineHeight: 1.6 }}>
          <div>last_completed_phase: {lastCompletedPhase ?? 'null'}</div>
          <div>is_profile_complete: {String(isProfileComplete)}</div>
          <div>intelligence_source: {intelligenceSource ?? 'null'}</div>
          {activeError && (
            <>
              <div>failed_phase: {activeError.failed_phase}</div>
              <div>error_code: {activeError.error_code}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
