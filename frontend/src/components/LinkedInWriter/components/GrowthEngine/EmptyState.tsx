import React from 'react';
import { colors } from './styles';

interface EmptyStateProps {
  icon?: string;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ icon = '📭', message }) => (
  <div
    style={{
      border: `1px dashed ${colors.dashedBorder}`,
      borderRadius: 10,
      padding: 32,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 1.6,
    }}
  >
    <span style={{ fontSize: 24, marginBottom: 8, display: 'block' }} aria-hidden="true">
      {icon}
    </span>
    {message}
  </div>
));
