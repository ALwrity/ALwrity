import React from 'react';

// CopilotKit is disabled — not released yet.
// All wrappers pass through children directly.
// Existing useCopilotAction hooks in LinkedInWriter will log a console
// warning but not crash — they gracefully handle missing CopilotKit context.

export const ConditionalCopilotKit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const AuthenticatedCopilotWrapper: React.FC<{
  children: React.ReactNode;
  apiKey: string;
}> = ({ children }) => {
  return <>{children}</>;
};
