import React, { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  getPostAuthDestination,
  getStoredFirstName,
  hasSignedInBefore,
} from '../../utils/returningUserStorage';

interface NavAuthButtonProps {
  surface?: 'dark' | 'light';
  fullWidth?: boolean;
  onNavigate?: () => void;
}

const NavAuthButton: React.FC<NavAuthButtonProps> = ({
  surface = 'dark',
  fullWidth = false,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const [, setProfileTick] = useState(0);

  useEffect(() => {
    const refreshProfile = () => setProfileTick((value) => value + 1);
    window.addEventListener('user-authenticated', refreshProfile);
    return () => window.removeEventListener('user-authenticated', refreshProfile);
  }, []);

  const isLight = surface === 'light';
  const storedFirstName = getStoredFirstName();
  const returningUser = hasSignedInBefore();
  const activeFirstName = (isSignedIn ? user?.firstName : storedFirstName)?.trim();
  const showPersonalizedWelcome = Boolean(activeFirstName) && (isSignedIn || returningUser);

  const label = showPersonalizedWelcome ? `👋 Welcome ${activeFirstName}` : '👋 Welcome';

  const handleClick = () => {
    onNavigate?.();

    if (isSignedIn) {
      navigate(getPostAuthDestination());
      return;
    }

    openSignIn({ forceRedirectUrl: getPostAuthDestination() });
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      fullWidth={fullWidth}
      aria-label={showPersonalizedWelcome ? `Welcome back, ${activeFirstName}` : 'Welcome — sign in to ALwrity'}
      sx={{
        textTransform: 'none',
        fontWeight: 700,
        fontSize: { xs: '0.9rem', md: '0.95rem' },
        letterSpacing: '0.01em',
        borderRadius: 2,
        px: { xs: 1.75, md: 2.25 },
        py: 0.75,
        minWidth: { xs: 'auto', md: 148 },
        whiteSpace: 'nowrap',
        color: isLight ? '#1a1a2e' : 'rgba(255,255,255,0.96)',
        border: isLight ? '1px solid rgba(26, 26, 46, 0.12)' : '1px solid rgba(255,255,255,0.28)',
        bgcolor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
        boxShadow: isLight ? '0 1px 6px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.25)',
        '&:hover': {
          bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.14)',
          borderColor: isLight ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255,255,255,0.45)',
        },
      }}
    >
      {label}
    </Button>
  );
};

export default NavAuthButton;
