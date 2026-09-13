import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Box,
  Typography,
  Tabs,
  Tab
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import { useLocation, useNavigate } from 'react-router-dom';

// Import components
import ContentStrategyBuilder from '../components/ContentStrategyBuilder';
import CalendarGenerationWizard from '../components/CalendarGenerationWizard';
import { CalendarGenerationModal } from '../components/CalendarGenerationModal';
import { longRunningApiClient } from '../../../api/client';

// Import hooks and services
import { useStrategyCalendarContext } from '../../../contexts/StrategyCalendarContext';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
import { buildStrategyDigest } from '../../../services/strategyCalendarMapper';
import { buildGeneratedCalendarView } from '../../../services/calendarGenerationViewMapper';

// Import types
import { type CalendarConfig } from '../components/CalendarWizardSteps/types';

// Translate Wizard CalendarConfig to Modal CalendarConfig
const wizardConfigToModalConfig = (
  config: CalendarConfig | null,
  userId: string,
  strategyId: string
): {
  userId: string;
  strategyId: string;
  calendarType: 'monthly' | 'quarterly' | 'yearly';
  platforms: string[];
  duration: number;
  postingFrequency: 'daily' | 'weekly' | 'biweekly';
} => {
  const calendarType = config?.calendarType === 'weekly' ? 'monthly'
    : config?.calendarType === 'quarterly' ? 'quarterly'
    : 'monthly';

  const postingFrequency = config?.postingFrequency
    ? config.postingFrequency >= 7 ? 'daily'
      : config.postingFrequency >= 3 ? 'biweekly'
      : 'weekly'
    : 'weekly';

  return {
    userId,
    strategyId,
    calendarType,
    platforms: config?.priorityPlatforms || [],
    duration: config?.calendarDuration || 30,
    postingFrequency,
  };
};

// TabPanel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`create-tabpanel-${index}`}
      aria-labelledby={`create-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const CreateTab: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCalendarConfig, setCurrentCalendarConfig] = useState<CalendarConfig | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  const navigate = useNavigate();
  const location = useLocation();
  const { state: { strategyContext }, isFromStrategyActivation } = useStrategyCalendarContext();
  const setGeneratedCalendar = useContentPlanningStore((s) => s.setGeneratedCalendar);
  const [userData] = useState<any>({});
  // Resolve the active Clerk user so calendar generation carries
  // the correct tenant id (the previous `user_id: 1` was a
  // multi-tenant collision across concurrent users).
  const { user } = useUser();

  // Handle navigation from strategy activation
  useEffect(() => {
    const fromStrategyActivation = isFromStrategyActivation();
    const isFromStrategy = fromStrategyActivation || 
      (location.state as any)?.fromStrategyActivation ||
      (location.state as any)?.strategyContext;

    console.log('🔍 CreateTab: Navigation state check:', {
      fromStrategyActivation,
      windowLocationState: location.state || 'N/A',
      isFromStrategy
    });
    
    if (isFromStrategy) {
      console.log('🎯 CreateTab: Switching to Calendar Wizard tab (index 1)');
      setTabValue(1); // Switch to Calendar Wizard tab
    }
  }, [isFromStrategyActivation, strategyContext?.activationStatus, location.state]);

  // Also check on mount for immediate navigation state
  useEffect(() => {
    const checkNavigationState = () => {
      const locationState = location.state as any;
      console.log('🔍 CreateTab: Initial navigation state check:', locationState);
      
      if (locationState?.fromStrategyActivation || locationState?.strategyContext) {
        console.log('🎯 CreateTab: Found navigation state, switching to Calendar Wizard tab (index 1)');
        setTabValue(1);
      }
    };
    
    // Check immediately
    checkNavigationState();
    
    // Also check after a short delay to ensure context is loaded
    const timer = setTimeout(checkNavigationState, 100);
    return () => clearTimeout(timer);
  }, [location.state]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleGenerateCalendar = useCallback(async (calendarConfig: CalendarConfig) => {
    try {
      console.log('🎯 handleGenerateCalendar called with config:', calendarConfig);
      
      // OPEN MODAL IMMEDIATELY - Don't wait for backend response
      console.log('🎯 Opening modal immediately');
      setCurrentCalendarConfig(calendarConfig);
      setIsModalOpen(true);
      
      // Transform calendarConfig to match backend CalendarGenerationRequest format
      // QA-6: ship a compact strategy digest so content scheduling inherits the
      // confirmed strategy (pillars, formats, frequency, brand voice, timing).
      const strategyDigest = strategyContext?.strategyData
        ? buildStrategyDigest(strategyContext.strategyData)
        : {};
      const requestData = {
        user_id: user?.id ?? null,
        strategy_id: strategyContext?.strategyId ? parseInt(strategyContext.strategyId) : undefined,
        calendar_type: calendarConfig.calendarType || 'monthly',
        industry: userData?.industry || 'technology',
        business_size: 'sme',
        force_refresh: false,
        ...(Object.keys(strategyDigest).length > 0 && { strategy_digest: strategyDigest })
      };
      
      console.log('🎯 Starting calendar generation request:', requestData);
      
      // Call the new start endpoint to get session ID with retry logic
      let startResponse;
      const maxRetries = 3;
      
      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
          const response = await longRunningApiClient.post('/api/content-planning/calendar-generation/start', requestData);
          startResponse = { ok: true, data: response.data };
          break; // Success, exit retry loop
        } catch (error: any) {
          console.warn(`⚠️ Attempt ${retryCount + 1} failed with error:`, error);
          // Phase 1: auth/ownership failures are not retryable.
          const startStatus = error?.response?.status;
          if (startStatus === 401 || startStatus === 403 || startStatus === 404) {
            startResponse = { ok: false, data: error?.response?.data ?? null };
            break;
          }
          if (retryCount < maxRetries - 1) {
            // Wait before retry (exponential backoff)
            const delay = 1000 * (retryCount + 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            startResponse = { ok: false, data: null };
          }
        }
      }
      
      if (!startResponse || !startResponse.ok) {
        throw new Error(`Failed to start calendar generation after ${maxRetries} attempts`);
      }
      
      const startData = startResponse.data;
      const sessionId = startData.session_id;
      
      console.log('🎯 Backend response received, session ID:', sessionId);
      console.log('🎯 Session status:', startData.status);
      
      // Update modal with the real session ID
      console.log('🎯 Updating modal with real session ID');
      setSessionId(sessionId);
      
      console.log('🎯 Modal updated with session ID - polling should start immediately');
      
    } catch (error) {
      console.error('Error starting calendar generation:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to start calendar generation';
      console.error('❌ Calendar generation failed:', errorMessage);
      
      // Show error to user and close modal
      alert(`Failed to start calendar generation: ${errorMessage}`);
      setIsModalOpen(false);
      setCurrentCalendarConfig(null);
      setSessionId('');
    } finally {
      // Cleanup complete
    }
  }, [userData, strategyContext]);

  const handleModalComplete = useCallback((results: any) => {
    console.log('🎉 Calendar generation completed:', results);
    setIsModalOpen(false);
    setCurrentCalendarConfig(null);
    setSessionId('');

    const qualityScores = results?.qualityScores || {};
    const calendar = buildGeneratedCalendarView(results?.calendar || {}, {
      userId: 0,
      strategyId: strategyContext?.strategyId ? parseInt(strategyContext.strategyId) : undefined,
      calendarType: currentCalendarConfig?.calendarType || 'monthly',
      industry: userData?.industry || 'technology',
      businessSize: 'sme'
    });

    setGeneratedCalendar({
      ...calendar,
      ai_confidence: qualityScores?.overall || calendar.ai_confidence,
      quality_indicators: {
        ...(calendar.quality_indicators || {}),
        ...qualityScores
      }
    });

    navigate('/content-planning', { state: { activeTab: 1 } });
  }, [currentCalendarConfig, strategyContext, userData, setGeneratedCalendar, navigate]);

  const handleModalError = useCallback((error: string) => {
    console.error('❌ Calendar generation error:', error);
    setIsModalOpen(false);
    setCurrentCalendarConfig(null);
    setSessionId('');
    
    // TODO: Handle error display (could show a toast notification)
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setCurrentCalendarConfig(null);
    setSessionId('');
  }, []);



  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create
      </Typography>
      


      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="create tabs">
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AutoAwesomeIcon sx={{ mr: 1 }} />
                Enhanced Strategy Builder
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ mr: 1 }} />
                Calendar Wizard
              </Box>
            } 
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <ContentStrategyBuilder />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <CalendarGenerationWizard
          userData={userData}
          onGenerateCalendar={handleGenerateCalendar}
          strategyContext={strategyContext}
          fromStrategyActivation={isFromStrategyActivation()}
        />
      </TabPanel>

      {/* Calendar Generation Modal */}
      <CalendarGenerationModal
        open={isModalOpen}
        onClose={handleModalClose}
        sessionId={sessionId}
        initialConfig={wizardConfigToModalConfig(
          currentCalendarConfig,
          userData?.id?.toString() || '1',
          strategyContext?.strategyId || ''
        )}
        onComplete={handleModalComplete}
        onError={handleModalError}
      />
    </Box>
  );
};

export default CreateTab; 