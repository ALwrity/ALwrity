import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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

const LandingNav: React.FC = () => {
  const theme = useTheme();
  const [elevated, setElevated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinkSx = {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: 600,
    fontSize: { xs: '1rem', md: '1.05rem' },
    textDecoration: 'none',
    cursor: 'pointer',
    letterSpacing: '0.02em',
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
      } else {
        window.location.href = item.href;
      }
      return;
    }
    if ('id' in item && item.id) {
      scrollTo(item.id);
    }
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={elevated ? 4 : 0}
        sx={{
          background: elevated
            ? `linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(20,20,30,0.95) 100%)`
            : 'transparent',
          backdropFilter: elevated ? 'blur(12px)' : 'none',
          borderBottom: elevated ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
          transition: 'background 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <Container maxWidth="lg" disableGutters sx={{ px: { xs: 1.5, md: 2 } }}>
          <Toolbar disableGutters sx={{ py: 0.25, position: 'relative', minHeight: 48 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{ textDecoration: 'none', zIndex: 2, ml: { xs: 0, md: -0.5 }, mt: -0.25 }}
            >
              <BrandMark variant="nav" titleSize="nav" showTagline logoSize={36} />
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
              sx={{ display: { xs: 'flex', md: 'none' }, ml: 'auto', color: '#fff' }}
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
