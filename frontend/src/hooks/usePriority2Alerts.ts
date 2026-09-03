/**
 * Priority 2 Alert System Hook
 * 
 * Integrates Priority 2 features from cost transparency review as alerts:
 * - Dynamic Pricing Display alerts (pricing changes, OSS model recommendations)
 * - Cost Estimation Before Operations alerts (high-cost operation warnings)
 * - Cost threshold alerts (real current usage warnings)
 */

import { useState, useEffect, useCallback } from 'react';
import { billingService } from '../services/billingService';
import { DashboardData } from '../types/billing';
import { showToastNotification } from '../utils/toastNotifications';

export interface Priority2Alert {
  id: string;
  type: 'pricing_change' | 'cost_estimation' | 'cost_trend' | 'oss_recommendation';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface UsePriority2AlertsOptions {
  userId?: string;
  enabled?: boolean;
  checkInterval?: number; // milliseconds
}

interface UsePriority2AlertsReturn {
  alerts: Priority2Alert[];
  isLoading: boolean;
  refreshAlerts: () => Promise<void>;
  dismissAlert: (alertId: string) => void;
}

const ALERT_CHECK_INTERVAL = 60000; // 1 minute default

export const usePriority2Alerts = (
  options: UsePriority2AlertsOptions = {}
): UsePriority2AlertsReturn => {
  const {
    userId,
    enabled = true,
    checkInterval = ALERT_CHECK_INTERVAL
  } = options;

  const [alerts, setAlerts] = useState<Priority2Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const generateAlerts = useCallback((data: DashboardData): Priority2Alert[] => {
    const generatedAlerts: Priority2Alert[] = [];
    const currentUsage = data.total_usage;
    const limits = data.limits;

    if (!currentUsage || !limits) return generatedAlerts;

    // 1. Cost Alerts (based on actual current spending thresholds, not predictive projections)
    const costLimit = limits.limits?.monthly_cost || 0;
    const currentCost = currentUsage.total_cost || 0;
    const costUsagePercentage = costLimit > 0 ? (currentCost / costLimit) * 100 : 0;

    // Actual spending threshold alerts
    if (costUsagePercentage >= 90) {
      generatedAlerts.push({
        id: 'cost-budget-critical',
        type: 'cost_trend',
        severity: 'error',
        title: 'Critical: Approaching Monthly Budget Limit',
        message: `You've used $${currentCost.toFixed(2)} (${costUsagePercentage.toFixed(0)}%) of your $${costLimit.toFixed(2)} monthly budget.`,
        action: {
          label: 'Upgrade Plan',
          onClick: () => {
            window.location.href = '/subscription';
          }
        },
        dismissible: false
      });
    } else if (costUsagePercentage >= 80) {
      generatedAlerts.push({
        id: 'cost-budget-warning',
        type: 'cost_trend',
        severity: 'warning',
        title: 'Budget Usage Warning',
        message: `You've used $${currentCost.toFixed(2)} (${costUsagePercentage.toFixed(0)}%) of your $${costLimit.toFixed(2)} monthly budget.`,
        action: {
          label: 'View Billing',
          onClick: () => {
            window.location.href = '/billing';
          }
        },
        dismissible: true
      });
    }

    // 2. OSS Model Recommendation Alerts (Priority 2: Dynamic Pricing Display)
    // Check if user is using expensive models when cheaper OSS alternatives exist
    const providerBreakdown = currentUsage.provider_breakdown || {};
    // ProviderBreakdown type may not include all providers, so use type assertion for dynamic access
    const stabilityCost = (providerBreakdown as any).stability?.cost || 0;
    const stabilityCalls = (providerBreakdown as any).stability?.calls || 0;
    
    // If using Stability AI for images, recommend OSS alternative
    if (stabilityCalls > 10 && stabilityCost > 0.5) {
      const ossSavings = (stabilityCost * 0.25).toFixed(2); // 25% savings with OSS
      generatedAlerts.push({
        id: 'oss-image-recommendation',
        type: 'oss_recommendation',
        severity: 'info',
        title: '💡 Cost Savings Opportunity',
        message: `You've spent $${stabilityCost.toFixed(2)} on image generation. Switch to Qwen Image OSS model to save ~$${ossSavings} (25% cheaper at $0.03/image vs $0.04/image).`,
        action: {
          label: 'Learn More',
          onClick: () => {
            // Could open a modal or navigate to pricing page
            showToastNotification('OSS models are automatically used as defaults in Basic tier', 'info');
          }
        },
        dismissible: true
      });
    }

    // 3. Cost Estimation Alerts (Priority 2: Cost Estimation Before Operations)
    // These are generated contextually when operations are about to be performed
    // This hook provides the infrastructure, but alerts are triggered by components

    return generatedAlerts;
  }, []);

  const refreshAlerts = useCallback(async () => {
    if (!enabled || !userId) return;

    try {
      setIsLoading(true);
      const data = await billingService.getDashboardData(userId);
      setDashboardData(data);
      
      const newAlerts = generateAlerts(data);
      setAlerts(newAlerts);
      setLastCheck(new Date());

      // Show toast for critical alerts
      const criticalAlerts = newAlerts.filter(a => a.severity === 'error');
      if (criticalAlerts.length > 0) {
        criticalAlerts.forEach(alert => {
          showToastNotification(alert.message, 'error', { duration: 8000 });
        });
      }
    } catch (error) {
      console.error('[Priority2Alerts] Error refreshing alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId, generateAlerts]);

  // Initial load
  useEffect(() => {
    if (enabled && userId) {
      refreshAlerts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId]); // Only run on mount or when enabled/userId changes

  // Periodic refresh
  useEffect(() => {
    if (!enabled || !userId) return;

    const interval = setInterval(() => {
      refreshAlerts();
    }, checkInterval);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, checkInterval]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => {
      if (alert.id === alertId && alert.dismissible) {
        // Store dismissed alert ID in localStorage to prevent re-showing
        const dismissed = JSON.parse(localStorage.getItem('dismissedPriority2Alerts') || '[]');
        dismissed.push(alertId);
        localStorage.setItem('dismissedPriority2Alerts', JSON.stringify(dismissed));
        return false;
      }
      return true;
    }));
  }, []);

  // Filter out dismissed alerts
  useEffect(() => {
    const dismissed = JSON.parse(localStorage.getItem('dismissedPriority2Alerts') || '[]');
    setAlerts(prev => prev.filter(alert => !dismissed.includes(alert.id)));
  }, []);

  return {
    alerts,
    isLoading,
    refreshAlerts,
    dismissAlert
  };
};

/**
 * Hook for generating cost estimation alerts before operations
 * Used by components to show warnings before expensive operations
 */
export const useCostEstimationAlert = () => {
  const showEstimationAlert = useCallback((
    estimatedCost: number,
    operationType: string,
    onProceed: () => void,
    onCancel: () => void
  ) => {
    const costLimit = 45; // Basic tier limit - could be fetched from subscription
    const costPercentage = (estimatedCost / costLimit) * 100;

    if (estimatedCost > 1.0 || costPercentage > 5) {
      // High-cost operation warning
      const severity = costPercentage > 10 ? 'error' : 'warning';
      const message = `This ${operationType} will cost approximately $${estimatedCost.toFixed(4)}. ` +
        `This represents ${costPercentage.toFixed(1)}% of your monthly budget.`;

      showToastNotification(message, severity, {
        duration: 10000
      });
      // Note: Toast doesn't support actions - user can proceed via the operation button
    }
  }, []);

  return { showEstimationAlert };
};
