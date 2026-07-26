import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CopilotKitHealthState {
  isHealthy: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  errorMessage: string | null;
  retryCount: number;
  isAvailable: boolean; // Alias for isHealthy, for clearer semantics
}

interface CopilotKitHealthContextType extends CopilotKitHealthState {
  checkHealth: () => Promise<void>;
  markUnhealthy: (errorMessage?: string) => void;
  markHealthy: () => void;
  resetHealth: () => void;
}

const CopilotKitHealthContext = createContext<CopilotKitHealthContextType | undefined>(undefined);

export const useCopilotKitHealthContext = () => {
  const context = useContext(CopilotKitHealthContext);
  if (!context) {
    throw new Error('useCopilotKitHealthContext must be used within CopilotKitHealthProvider');
  }
  return context;
};

interface CopilotKitHealthProviderProps {
  children: ReactNode;
  initialHealthStatus?: boolean;
}

export const CopilotKitHealthProvider: React.FC<CopilotKitHealthProviderProps> = ({
  children,
  initialHealthStatus = true,
}) => {
  // Persist health status across page reloads to prevent manual form from disappearing
  const getInitialHealthStatus = (): boolean => {
    if (typeof window === 'undefined') return initialHealthStatus;
    try {
      const saved = localStorage.getItem('copilotkit_health_status');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {
      console.warn('[CopilotKitHealthContext] Failed to read persisted health status:', e);
    }
    return initialHealthStatus;
  };

  const [state, setState] = useState<CopilotKitHealthState>({
    isHealthy: getInitialHealthStatus(),
    isChecking: false,
    lastChecked: null,
    errorMessage: null,
    retryCount: 0,
    isAvailable: getInitialHealthStatus(),
  });

  const markHealthy = useCallback(() => {
    setState((prev) => {
      const newState = {
        ...prev,
        isHealthy: true,
        isAvailable: true,
        errorMessage: null,
        retryCount: 0,
        lastChecked: new Date(),
      };
      // Persist health status to localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('copilotkit_health_status', 'true');
        }
      } catch (e) {
        console.warn('[CopilotKitHealthContext] Failed to persist health status:', e);
      }
      return newState;
    });
  }, []);

  const markUnhealthy = useCallback((errorMessage?: string) => {
    setState((prev) => {
      const newState = {
        ...prev,
        isHealthy: false,
        isAvailable: false,
        errorMessage: errorMessage || 'CopilotKit is unavailable',
        lastChecked: new Date(),
        retryCount: prev.retryCount + 1,
      };
      // Persist health status to localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('copilotkit_health_status', 'false');
        }
      } catch (e) {
        console.warn('[CopilotKitHealthContext] Failed to persist health status:', e);
      }
      return newState;
    });
  }, []);

  // Listen for CopilotKit error events from App.tsx
  React.useEffect(() => {
    const handleCopilotKitError = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { errorMessage, isFatal, error } = customEvent.detail || {};
      
      // Always mark as unhealthy for fatal errors (CORS, SSL, 403, etc.)
      if (isFatal) {
        console.warn('[CopilotKitHealthContext] Fatal CopilotKit error detected:', errorMessage);
        markUnhealthy(errorMessage || 'CopilotKit fatal error');
      } else {
        // Check error details for CORS/network errors even if not marked as fatal
        // Safely check error strings to avoid "Cannot read properties of undefined" errors
        const errorMsg = error?.message || '';
        const errorMsgStr = typeof errorMsg === 'string' ? errorMsg.toLowerCase() : String(errorMsg || '').toLowerCase();
        const messageStr = typeof errorMessage === 'string' ? errorMessage.toLowerCase() : String(errorMessage || '').toLowerCase();
        const errorStr = errorMsgStr || messageStr || '';
        
        if (errorStr && (
          errorStr.includes('cors') || 
          errorStr.includes('failed to fetch') || 
          errorStr.includes('networkerror') ||
          errorStr.includes('network') ||
          errorStr.includes('cannot read properties')
        )) {
          console.warn('[CopilotKitHealthContext] CORS/network error detected:', errorMessage);
          markUnhealthy(errorMessage || 'CopilotKit network error');
        } else if (error?.response?.status === 504 || error?.response?.status === 502 || error?.response?.status === 500) {
          // Gateway timeout, bad gateway, or server error - mark as unavailable
          console.warn('[CopilotKitHealthContext] Gateway/server error detected:', errorMessage);
          markUnhealthy(errorMessage || 'CopilotKit gateway error');
        } else if (error?.error?.statusCode === 500 || error?.error?.code === 'UNKNOWN') {
          // Internal CopilotKit errors - mark as unavailable
          console.warn('[CopilotKitHealthContext] CopilotKit internal error detected:', errorMessage);
          markUnhealthy(errorMessage || 'CopilotKit internal error');
        } else {
          // For other transient errors, just log but don't mark as unhealthy immediately
          // Let the health check determine if it's truly down
          console.warn('[CopilotKitHealthContext] Transient CopilotKit error:', errorMessage);
        }
      }
    };

    window.addEventListener('copilotkit-error', handleCopilotKitError as EventListener);
    return () => {
      window.removeEventListener('copilotkit-error', handleCopilotKitError as EventListener);
    };
  }, [markUnhealthy]);

  const checkHealth = useCallback(async () => {
    // CopilotKit is disabled - "Coming Soon" feature, not released.
    // Skip health checks entirely to avoid network errors to api.cloud.copilotkit.ai.
  }, []);
  const resetHealth = useCallback(() => {
    setState({
      isHealthy: initialHealthStatus,
      isChecking: false,
      lastChecked: null,
      errorMessage: null,
      retryCount: 0,
      isAvailable: initialHealthStatus,
    });
  }, [initialHealthStatus]);

  const value: CopilotKitHealthContextType = {
    ...state,
    checkHealth,
    markUnhealthy,
    markHealthy,
    resetHealth,
  };

  return (
    <CopilotKitHealthContext.Provider value={value}>
      {children}
    </CopilotKitHealthContext.Provider>
  );
};

