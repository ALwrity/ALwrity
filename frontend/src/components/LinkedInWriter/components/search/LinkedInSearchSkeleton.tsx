import React from 'react';

interface LinkedInSearchSkeletonProps {
  rows?: number;
}

const SkeletonRow: React.FC = () => (
  <div
    style={{
      padding: '16px 0',
      borderBottom: '1px solid rgba(10, 102, 194, 0.08)',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'linear-gradient(90deg, #e8f4fc 25%, #d4ebfa 50%, #e8f4fc 75%)',
        backgroundSize: '200% 100%',
        animation: 'linkedinSearchShimmer 1.4s ease infinite',
        flexShrink: 0,
      }}
    />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          height: 14,
          width: '40%',
          borderRadius: 4,
          background: 'linear-gradient(90deg, #e8f4fc 25%, #d4ebfa 50%, #e8f4fc 75%)',
          backgroundSize: '200% 100%',
          animation: 'linkedinSearchShimmer 1.4s ease infinite',
        }}
      />
      <div
        style={{
          height: 12,
          width: '75%',
          borderRadius: 4,
          background: 'linear-gradient(90deg, #e8f4fc 25%, #d4ebfa 50%, #e8f4fc 75%)',
          backgroundSize: '200% 100%',
          animation: 'linkedinSearchShimmer 1.4s ease infinite',
        }}
      />
      <div
        style={{
          height: 12,
          width: '55%',
          borderRadius: 4,
          background: 'linear-gradient(90deg, #e8f4fc 25%, #d4ebfa 50%, #e8f4fc 75%)',
          backgroundSize: '200% 100%',
          animation: 'linkedinSearchShimmer 1.4s ease infinite',
        }}
      />
    </div>
  </div>
);

export const LinkedInSearchSkeleton: React.FC<LinkedInSearchSkeletonProps> = ({ rows = 4 }) => {
  return (
    <>
      <style>
        {`
          @keyframes linkedinSearchShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      <div aria-busy="true" aria-label="Loading search results">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </>
  );
};
