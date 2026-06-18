import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Link,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Language as GlobeIcon,
  CheckCircle as CheckIcon,
  Cancel as CrossIcon,
  GitHub as GitHubIcon,
  LinkedIn as LinkedInIcon,
  YouTube as YouTubeIcon,
  Twitter as TwitterIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Image as ImageIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import SectionHeader from './SectionHeader';

interface CrawlResultSectionsProps {
  crawlResult: any;
}

const platformIcons: Record<string, React.ReactNode> = {
  github: <GitHubIcon />,
  linkedin: <LinkedInIcon />,
  youtube: <YouTubeIcon />,
  twitter: <TwitterIcon />,
  facebook: <FacebookIcon />,
  instagram: <InstagramIcon />,
};

const platformColors: Record<string, string> = {
  github: '#333',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
};

const resolveSocialUrl = (platform: string, value: any): string | null => {
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.includes('.')) return `https://${value}`;
  }
  if (value) return `https://${platform}.com`;
  return null;
};

const CrawlResultSections: React.FC<CrawlResultSectionsProps> = ({ crawlResult }) => {
  if (!crawlResult) return null;

  const { domain_info, social_media, brand_info } = crawlResult;

  return (
    <Box sx={{ mt: 4 }}>
      {/* Domain Info */}
      {domain_info && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader
            title="Domain Information"
            icon={<GlobeIcon />}
            tooltip="Key attributes and features detected on your website domain."
          />
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E5E7EB', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a202c' }}>
                {domain_info.domain || domain_info.domain_name}
              </Typography>
              <Chip
                icon={domain_info.is_blog ? <CheckIcon /> : <CrossIcon />}
                label={domain_info.is_blog ? 'Blog' : 'Not a Blog'}
                size="small"
                color={domain_info.is_blog ? 'success' : 'default'}
                variant="outlined"
              />
              <Chip
                icon={domain_info.is_ecommerce ? <CheckIcon /> : <CrossIcon />}
                label={domain_info.is_ecommerce ? 'E-commerce' : 'Not E-commerce'}
                size="small"
                color={domain_info.is_ecommerce ? 'success' : 'default'}
                variant="outlined"
              />
              <Chip
                icon={domain_info.is_corporate ? <CheckIcon /> : <CrossIcon />}
                label={domain_info.is_corporate ? 'Corporate' : 'Not Corporate'}
                size="small"
                color={domain_info.is_corporate ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                  Pages Discovered
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={domain_info.has_about_page ? 'About Page ✓' : 'About Page ✗'} size="small" variant="outlined" color={domain_info.has_about_page ? 'success' : 'default'} />
                  <Chip label={domain_info.has_contact_page ? 'Contact Page ✓' : 'Contact Page ✗'} size="small" variant="outlined" color={domain_info.has_contact_page ? 'success' : 'default'} />
                  <Chip label={domain_info.has_blog_section ? 'Blog Section ✓' : 'Blog Section ✗'} size="small" variant="outlined" color={domain_info.has_blog_section ? 'success' : 'default'} />
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Social Media */}
      {social_media && (() => {
        const platforms = Object.entries(social_media).filter(([key]) => key !== 'site_name');
        const siteName = social_media.site_name;
        if (platforms.length === 0 && !siteName) return null;
        return (
          <Box sx={{ mb: 4 }}>
            <SectionHeader
              title={siteName ? `${siteName} — Social Media` : 'Social Media'}
              icon={<InfoIcon />}
              tooltip="Social media profiles and platforms associated with this website."
            />
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E5E7EB', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {platforms.map(([platform, value]) => {
                  const url = resolveSocialUrl(platform, value);
                  if (!url) return null;
                  const icon = platformIcons[platform] || <GlobeIcon />;
                  const color = platformColors[platform] || '#666';
                  return (
                    <Tooltip key={platform} title={`${platform.charAt(0).toUpperCase() + platform.slice(1)}`} arrow>
                      <IconButton
                        component={Link}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color,
                          bgcolor: `${color}11`,
                          width: 44,
                          height: 44,
                          '&:hover': { bgcolor: `${color}22`, transform: 'scale(1.1)' },
                          transition: 'all 0.2s ease',
                          borderRadius: '10px',
                        }}
                      >
                        {icon}
                      </IconButton>
                    </Tooltip>
                  );
                })}
              </Box>
            </Paper>
          </Box>
        );
      })()}

      {/* Brand Info */}
      {brand_info && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader
            title="Brand Information"
            icon={<BusinessIcon />}
            tooltip="Company name, logos, and contact details extracted from the website."
          />
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E5E7EB', borderRadius: 2 }}>
            {brand_info.company_name && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500 }}>
                  Company Name
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a202c' }}>
                  {brand_info.company_name}
                </Typography>
              </Box>
            )}

            {brand_info.logo_alt && brand_info.logo_alt.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                  Logo References
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {brand_info.logo_alt.map((alt: string, i: number) => (
                    <Chip key={i} icon={<ImageIcon />} label={alt} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
                  ))}
                </Box>
              </Box>
            )}

            {brand_info.contact_info && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                  Contact Information
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {brand_info.contact_info.email && brand_info.contact_info.email.filter(Boolean).length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ color: '#374151' }}>
                        {brand_info.contact_info.email.filter(Boolean).join(', ')}
                      </Typography>
                    </Box>
                  )}
                  {brand_info.contact_info.phone && brand_info.contact_info.phone.filter(Boolean).length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ color: '#374151' }}>
                        {brand_info.contact_info.phone.filter(Boolean).join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default CrawlResultSections;
