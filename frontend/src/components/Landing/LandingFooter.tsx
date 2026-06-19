import React from 'react';

import { Link as RouterLink } from 'react-router-dom';

import {

  Box,

  Container,

  Divider,

  Link,

  Stack,

  Typography,

  useTheme,

  alpha,

} from '@mui/material';

import BrandMark from './BrandMark';



const LandingFooter: React.FC = () => {

  const theme = useTheme();

  const year = new Date().getFullYear();



  const linkSx = {

    color: alpha('#fff', 0.75),

    textDecoration: 'none',

    fontSize: '0.9rem',

    '&:hover': { color: theme.palette.primary.light },

  };



  return (

    <Box

      component="footer"

      sx={{

        py: 6,

        background: `linear-gradient(180deg, ${alpha('#0a0a0a', 0.95)} 0%, #000 100%)`,

        borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,

      }}

    >

      <Container maxWidth="lg">

        <Stack

          direction={{ xs: 'column', md: 'row' }}

          justifyContent="space-between"

          alignItems={{ xs: 'flex-start', md: 'center' }}

          spacing={3}

        >

          <Stack spacing={1}>

            <BrandMark showSubtitle showTagline logoSize={40} />

            <Typography variant="caption" color={alpha('#fff', 0.45)}>

              © {year} ALwrity. Open-source &amp; community-driven.

            </Typography>

          </Stack>



          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 3 }} flexWrap="wrap">

            <Link component={RouterLink} to="/privacy" sx={linkSx}>

              Privacy Policy

            </Link>

            <Link component={RouterLink} to="/code-of-conduct" sx={linkSx}>

              Code of Conduct

            </Link>

            <Link component={RouterLink} to="/terms" sx={linkSx}>

              Terms of Service

            </Link>

          </Stack>

        </Stack>



        <Divider sx={{ my: 3, borderColor: alpha('#fff', 0.08) }} />



        <Typography variant="caption" color={alpha('#fff', 0.4)} display="block" textAlign="center">

          © {year} ALwrity. See our{' '}

          <Link component={RouterLink} to="/privacy" sx={{ color: alpha('#fff', 0.55) }}>

            Privacy Policy

          </Link>

          ,{' '}

          <Link component={RouterLink} to="/code-of-conduct" sx={{ color: alpha('#fff', 0.55) }}>

            Code of Conduct

          </Link>

          , and{' '}

          <Link component={RouterLink} to="/terms" sx={{ color: alpha('#fff', 0.55) }}>

            Terms of Service

          </Link>

          . Inquiries:{' '}

          <Link href="mailto:info@alwrity.com" sx={{ color: alpha('#fff', 0.55) }}>

            info@alwrity.com

          </Link>

        </Typography>

      </Container>

    </Box>

  );

};



export default LandingFooter;

