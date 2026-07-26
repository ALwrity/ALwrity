import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotKitHealthProvider } from '../../contexts/CopilotKitHealthContext';
import CopilotKitDegradedBanner from '../shared/CopilotKitDegradedBanner';
import ErrorBoundary from '../shared/ErrorBoundary';

interface ConditionalCopilotKitProps {
  children: React.ReactNode;
}

export const ConditionalCopilotKit: React.FC<ConditionalCopilotKitProps> = ({ children }) => {
  return <>{children}</>;
};

interface AuthenticatedCopilotWrapperProps {
  children: React.ReactNode;
  apiKey: string;
}

export const AuthenticatedCopilotWrapper: React.FC<AuthenticatedCopilotWrapperProps> = ({ children, apiKey }) => {
  const { isSignedIn } = useAuth();
  const location = useLocation();
  
  // Only fully exclude CopilotKit when user is not signed in or on onboarding
  // Feature-limited mode (blog_writer, etc.) still needs CopilotKit providers
  // because BlogWriter uses useCopilotAction and useCopilotKitHealth hooks
  const shouldExcludeCopilotKit = !isSignedIn || location.pathname.startsWith('/onboarding');
  
  if (shouldExcludeCopilotKit) {
    return <>{children}</>;
  }

  const hasKey = apiKey && apiKey.trim();

  if (hasKey) {
    const handleCopilotKitError = (e: any) => {
      console.error("CopilotKit Error:", e);
      
      const errorMessage = e?.error?.message || e?.message || 'CopilotKit error occurred';
      const errorType = errorMessage.toLowerCase();
      
      const isFatalError = 
        errorType.includes('cors') ||
        errorType.includes('ssl') ||
        errorType.includes('certificate') ||
        errorType.includes('403') ||
        errorType.includes('forbidden') ||
        errorType.includes('ERR_CERT_COMMON_NAME_INVALID');
      
      window.dispatchEvent(new CustomEvent('copilotkit-error', {
        detail: {
          error: e,
          errorMessage,
          isFatal: isFatalError,
        }
      }));
    };

    return (
      <CopilotKitHealthProvider initialHealthStatus={true}>
        <CopilotKitDegradedBanner />
        <ErrorBoundary 
          context="CopilotKit" 
          showDetails={process.env.NODE_ENV === 'development'}
          fallback={
            <div style={{ padding: 24, textAlign: 'center' }}>
              <h6 style={{ color: '#ed6c02', marginBottom: 8 }}>Chat Unavailable</h6>
              <p style={{ color: '#9e9e9e', fontSize: 14 }}>
                CopilotKit encountered an error. The app continues to work with manual controls.
              </p>
            </div>
          }
        >
          <CopilotKit 
            publicApiKey={apiKey}
            showDevConsole={false}
            onError={handleCopilotKitError}
          >
            {children}
          </CopilotKit>
        </ErrorBoundary>
      </CopilotKitHealthProvider>
    );
  }

  // CopilotKit is disabled ΓÇö no API key configured. Don't wrap in any
  // CopilotKit providers (avoids health checks hitting api.cloud.copilotkit.ai).
  return <>{children}</>;
};
