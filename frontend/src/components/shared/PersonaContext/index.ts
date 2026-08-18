/**
 * Persona Context Index
 * Central export point for all persona context components and hooks
 */

export { 
  PlatformPersonaProvider, 
  PlatformPersonaContext,
  usePlatformPersonaContext 
} from './PlatformPersonaProvider';

// PersonaTestComponent removed - functionality integrated into main components

// Re-export types for convenience
export type { 
  PlatformType,
  CorePersona,
  PlatformPersona 
} from '../../../types/PlatformPersonaTypes';
