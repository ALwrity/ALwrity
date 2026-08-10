import React from 'react';
import { Navigate } from 'react-router-dom';
import PricingPage from './PricingPage';
import { getPricingRoute, MAIN_PRICING_ROUTE } from '../../utils/demoMode';

/**
 * Entry route for /pricing.
 * Redirects to feature-specific pricing when LinkedIn-only mode is enabled.
 */
const MainPricingRoute: React.FC = () => {
  const pricingRoute = getPricingRoute();

  if (pricingRoute !== MAIN_PRICING_ROUTE) {
    console.log(`MainPricingRoute: Feature mode pricing redirect → ${pricingRoute}`);
    return <Navigate to={pricingRoute} replace />;
  }

  return <PricingPage />;
};

export default MainPricingRoute;
