import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  alpha,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import BrandMark from './BrandMark';

type NavItem =
  | { label: string; id: string; href?: never; newTab?: never }
  | { label: string; href: string; newTab?: boolean; id?: never };

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', id: 'hero' },
  { label: 'Lifecycle', id: 'lifecycle' },
  { label: 'Features', id: 'features' },
  { label: 'Pricing', href: '/pricing', newTab: true },
];

const NAV_HIDE_DELAY_MS = 3500;
const TOP_REVEAL_ZONE_PX = 72;

const LandingNav: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
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
    const onScroll = () => {
      const y = window.scrollY;
      setElevated(y > 24);

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
    };
  }, [clearHideTimer, revealNav]);

  const navLinkSx = {
    color: 'rgba(255,255,255,0.94)',
    fontWeight: 600,
    fontSize: { xs: '1rem', md: '1.05rem' },
    textDecoration: 'none',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    textShadow: '0 1px 6px rgba(0,0,0,0.45)',
    '&:hover': { color: theme.palette.primary.light },
  };

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavClick = (item: NavItem) => {
    if ('href' in item && item.href) {
      setMobileOpen(false);
      if (item.newTab) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(item.href);
      return;
    }
    if ('id' in item && item.id) {
      if (window.location.pathname !== '/') {
        navigate(`/#${item.id}`);
        return;
      }
      scrollTo(item.id);
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={elevated ? 4 : 0}
        sx={{
          background: elevated
            ? `linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(20,20,30,0.95) 100%)`
            : 'transparent',
          backdropFilter: elevated ? 'blur(12px)' : 'none',
          borderBottom: elevated ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
          boxShadow: elevated ? undefined : 'none',
          transform: navVisible ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, box-shadow 0.3s ease',
          pointerEvents: navVisible ? 'auto' : 'none',
        }}
      >
        <Container maxWidth={false} disableGutters sx={{ px: 0 }}>
          <Toolbar disableGutters sx={{ py: 0.25, position: 'relative', minHeight: 48, px: 0 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{
                position: 'absolute',
                left: { xs: 12, md: 20 },
                top: '50%',
                transform: 'translateY(-50%)',
                textDecoration: 'none',
                zIndex: 2,
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              <BrandMark variant="nav" titleSize="nav" showTagline logoSize={38} />
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

            <IconButton
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { xs: 'flex', md: 'none' },
                ml: 'auto',
                color: '#fff',
              }}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            background: `linear-gradient(180deg, rgba(10,10,20,0.98) 0%, rgba(0,0,0,0.98) 100%)`,
            color: '#fff',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ px: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.label}
              onClick={() => handleNavClick(item)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&:hover': { background: alpha(theme.palette.primary.main, 0.15) },
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
    </>
  );
};

export default LandingNav;
