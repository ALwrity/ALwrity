import { useState, useEffect, useRef } from 'react';

interface UseWebsiteStepEffectsProps {
  initialData: any;
  linkedinConnected: boolean;
  user: any;
  propEmail?: string;
  website: string;
  analysis: any;
  onValidationChange?: (isValid: boolean) => void;
}

export function useWebsiteStepEffects({
  initialData,
  linkedinConnected,
  user,
  propEmail,
  website,
  analysis,
  onValidationChange,
}: UseWebsiteStepEffectsProps) {
  const [linkedinProfile, setLinkedinProfile] = useState<any>(null);
  const [email, setEmail] = useState<string>('');

  // Fetch LinkedIn profile summary when connected or from initialData
  useEffect(() => {
    if (initialData?.linkedin_profile) {
      setLinkedinProfile(initialData.linkedin_profile);
      return;
    }
    if (!linkedinConnected) return;
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { apiClient: client } = await import('../../../../api/client');
        const resp = await client.get('/api/linkedin-social/profile/summary');
        if (!cancelled && resp.data?.analyzed) {
          setLinkedinProfile(resp.data);
        }
      } catch (e) {
        console.debug('LinkedIn profile summary not yet available');
      }
    };
    const timer = setTimeout(fetchProfile, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [linkedinConnected, initialData?.linkedin_profile]);

  // Get user email from Clerk
  useEffect(() => {
    if (user && !propEmail) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      const firstEmail = user.emailAddresses?.[0]?.emailAddress;
      const resolvedEmail = primaryEmail || firstEmail || '';
      if (resolvedEmail) setEmail(resolvedEmail);
    }
  }, [user, propEmail]);

  // Sync email from parent prop when it changes
  useEffect(() => {
    if (propEmail !== undefined && propEmail !== '') {
      setEmail(propEmail);
    }
  }, [propEmail]);

  // Notify parent when validation state changes (guard against infinite loops)
  const prevValidRef = useRef<boolean | null>(null);
  useEffect(() => {
    const hasWebsiteAnalysis = !!(website.trim() && analysis);
    const isValid = hasWebsiteAnalysis || linkedinConnected;
    if (isValid !== prevValidRef.current && onValidationChange) {
      prevValidRef.current = isValid;
      onValidationChange(isValid);
    }
  }, [website, analysis, linkedinConnected, onValidationChange]);

  return {
    linkedinProfile,
    setLinkedinProfile,
    email,
    setEmail,
  };
}
