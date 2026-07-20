import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Container,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  useTheme,
  useMediaQuery,
  alpha,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import BrandMark from './BrandMark';
import NavAuthButton from './NavAuthButton';
import {
  landingPathForSection,
  scrollToLandingSection,
  isLandingMarketingPath,
  isLegalStaticNavPath,
  LANDING_MARKETING_PATH,
  type LandingSectionId,
} from '../../utils/landingNavigation';

type NavItem =
  | { label: string; section: LandingSectionId }
  | { label: string; href: string; newTab?: boolean };

interface LandingNavProps {
  /** Dark = transparent over hero (landing). Light = solid bar for white pages (pricing, etc.). */
  surface?: 'dark' | 'light';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', section: 'hero' },
  { label: 'Lifecycle', section: 'lifecycle' },
  { label: 'Features', section: 'features' },
  { label: 'Pricing', section: 'pricing' },
];

const NAV_HIDE_DELAY_MS = 3500;
const TOP_REVEAL_ZONE_PX = 72;

const LandingNav: React.FC<LandingNavProps> = ({ surface = 'dark' }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isLightSurface = surface === 'light';
  const disableNavAutoHide = isLegalStaticNavPath(location.pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [elevated, setElevated] = useState(false);
  const lastScrollY = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (window.scrollY > 64) {
        setNavVisible(false);
      }
    }, NAV_HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const revealNav = useCallback(
    (autoHide = true) => {
      setNavVisible(true);
      if (autoHide && window.scrollY > 64) {
        scheduleHide();
      } else {
        clearHideTimer();
      }
    },
    [clearHideTimer, scheduleHide]
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--sticky-top-offset', navVisible ? '64px' : '0px');
  }, [navVisible]);

  useEffect(() => {
    if (disableNavAutoHide) {
      setNavVisible(true);
      clearHideTimer();
    }
  }, [disableNavAutoHide, clearHideTimer]);

  useEffect(() => {
    if (disableNavAutoHide) {
      const onScroll = () => {
        const y = window.scrollY;
        setElevated(isLightSurface ? y > 8 : y > 24);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const onScroll = () => {
      const y = window.scrollY;
      setElevated(isLightSurface ? y > 8 : y > 24);

      if (y <= 16) {
        revealNav(false);
        lastScrollY.current = y;
        return;
      }

      if (y < lastScrollY.current - 4) {
        revealNav(true);
      } else if (y > lastScrollY.current + 8) {
        clearHideTimer();
        setNavVisible(false);
      }

      lastScrollY.current = y;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY <= TOP_REVEAL_ZONE_PX) {
        revealNav(true);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
      clearHideTimer();
      document.documentElement.style.removeProperty('--sticky-top-offset');
    };
  }, [clearHideTimer, revealNav, isLightSurface, disableNavAutoHide]);

  const navLinkSx = isLightSurface
    ? {
        color: '#1a1a2e',
        fontWeight: 600,
        fontSize: { xs: '1rem', md: '1.05rem' },
        textDecoration: 'none',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        '&:hover': { color: theme.palette.primary.main },
      }
    : {
        color: 'rgba(255,255,255,0.94)',
        fontWeight: 600,
        fontSize: { xs: '1rem', md: '1.05rem' },
        textDecoration: 'none',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        textShadow: '0 1px 6px rgba(0,0,0,0.45)',
        '&:hover': { color: theme.palette.primary.light },
      };

  const handleNavClick = (item: NavItem) => {
    setMobileOpen(false);

    if ('href' in item) {
      if (item.newTab) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(item.href);
      return;
    }

    const { section } = item;
    if (!isLandingMarketingPath(location.pathname)) {
      navigate(landingPathForSection(section));
      return;
    }

    scrollToLandingSection(section);
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={isLightSurface ? 0 : elevated ? 4 : 0}
        sx={{
          background: isLightSurface
            ? '#FFFFFF'
            : elevated
              ? `linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(20,20,30,0.95) 100%)`
              : 'transparent',
          backdropFilter: isLightSurface ? 'none' : elevated ? 'blur(12px)' : 'none',
          borderBottom: isLightSurface
            ? `1px solid ${alpha('#1a1a2e', 0.08)}`
            : elevated
              ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
              : 'none',
          boxShadow: isLightSurface ? '0 1px 8px rgba(0, 0, 0, 0.06)' : elevated ? undefined : 'none',
          transform: navVisible ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, box-shadow 0.3s ease',
          pointerEvents: navVisible ? 'auto' : 'none',
        }}
      >
        <Container maxWidth={false} disableGutters sx={{ px: 0 }}>
          <Toolbar disableGutters sx={{ py: 0.25, position: 'relative', minHeight: 48, px: 0 }}>
            <Box
              component={RouterLink}
              to={LANDING_MARKETING_PATH}
              className="landing-nav-brand"
              sx={{
                position: 'absolute',
                left: { xs: 12, md: 20 },
                top: '50%',
                transform: 'translateY(-50%)',
                textDecoration: 'none',
                zIndex: 2,
                display: 'flex',
                alignItems: 'flex-start',
                // Desktop: remove global focus ring / link underline lines around logo block
                outline: { md: 'none' },
                '&:hover': {
                  textDecoration: 'none',
                },
                '&:focus': {
                  outline: { xs: undefined, md: 'none' },
                },
                '&:focus-visible': {
                  outline: { xs: undefined, md: 'none' },
                  boxShadow: { md: 'none' },
                },
                '& *:focus': {
                  outline: { md: 'none' },
                },
                '& *:focus-visible': {
                  outline: { md: 'none' },
                },
                '& *': {
                  textDecoration: { md: 'none' },
                },
                '&:hover *': {
                  textDecoration: { md: 'none' },
                },
              }}
            >
              <BrandMark
                variant={isLightSurface ? 'dark' : 'nav'}
                titleSize="nav"
                showTagline
                logoSize={38}
              />
            </Box>

            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                gap: 5.5,
                alignItems: 'center',
              }}
            >
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} component="button" onClick={() => handleNavClick(item)} sx={navLinkSx}>
                  {item.label}
                </Link>
              ))}
            </Box>

            <Box
              sx={{
                position: 'absolute',
                right: { xs: 8, md: 20 },
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                zIndex: 2,
              }}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <NavAuthButton surface={isLightSurface ? 'light' : 'dark'} />
              </Box>
              <IconButton
                aria-label="Open navigation menu"
                onClick={() => setMobileOpen(true)}
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  color: isLightSurface ? '#1a1a2e' : '#fff',
                }}
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            background: isLightSurface
              ? '#FFFFFF'
              : `linear-gradient(180deg, rgba(10,10,20,0.98) 0%, rgba(0,0,0,0.98) 100%)`,
            color: isLightSurface ? '#1a1a2e' : '#fff',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            sx={{ color: isLightSurface ? '#1a1a2e' : '#fff' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <NavAuthButton
            surface={isLightSurface ? 'light' : 'dark'}
            fullWidth
            onNavigate={() => setMobileOpen(false)}
          />
        </Box>
        <List sx={{ px: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.label}
              onClick={() => handleNavClick(item)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&:hover': {
                  background: isLightSurface
                    ? alpha(theme.palette.primary.main, 0.08)
                    : alpha(theme.palette.primary.main, 0.15),
                },
              }}
            >
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '1.05rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {isMobile && !navVisible && (
        <Button
          variant="contained"
          aria-label="Open navigation menu"
          onClick={() => setMobileOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: theme.zIndex.speedDial,
            borderRadius: 999,
            px: 2.25,
            py: 0.85,
            minWidth: 0,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.45)}`,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            '&:hover': {
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.55)}`,
            },
          }}
        >
          Menu
        </Button>
      )}
    </>
  );
};

export default LandingNav;
