import React from 'react';
import { Navigate } from 'react-router-dom';
import { isFeatureEnabled, shouldSkipOnboarding } from '../../utils/demoMode';

interface FeatureRouteProps {
  feature: string;
  children: React.ReactNode;
  /** Where to redirect if feature is disabled (default: /dashboard) */
  redirectTo?: string;
}

/**
 * Route guard that checks if a feature is enabled via ALWRITY_ENABLED_FEATURES.
 * If disabled, redirects to the fallback route and the lazy chunk never loads.
 *
 * Usage:
 *   <Route path="/blog-writer" element={
 *     <ProtectedRoute>
 *       <FeatureRoute feature="blog_writer"><BlogWriter /></FeatureRoute>
 *     </ProtectedRoute>
 *   } />
 */
const FeatureRoute: React.FC<FeatureRouteProps> = ({ 
  feature, 
  children, 
  redirectTo = '/dashboard' 
}) => {
  const isAssetLibraryInFeatureMode = feature === 'asset-library' && shouldSkipOnboarding();

  if (!isFeatureEnabled(feature) && !isAssetLibraryInFeatureMode) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
};

export default FeatureRoute;
