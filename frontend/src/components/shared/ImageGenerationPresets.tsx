/**
 * Preset Configurations for Image Generation Modal
 * 
 * Each use case (YouTube, Podcast, etc.) has its own presets
 * that are optimized for that specific content type.
 */

import React from 'react';
import { ImagePreset, ImageModalTheme, CustomRecommendations, LinkedInModelOption } from './ImageGenerationModal.types';

// ============================================
// YouTube Creator Presets
// ============================================

export const YOUTUBE_PRESETS: ImagePreset[] = [
  {
    key: 'engagingHost',
    title: 'Engaging Host',
    subtitle: 'Dynamic presenter in engaging video environment',
    prompt: 'Professional video host in modern studio, dynamic lighting, engaging facial expression, high energy atmosphere, camera-ready appearance, confident posture, vibrant background elements',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
  {
    key: 'cinematicScene',
    title: 'Cinematic Scene',
    subtitle: 'Dramatic, movie-like atmosphere with cinematic lighting',
    prompt: 'Cinematic video scene, dramatic lighting, professional cinematography, engaging narrative atmosphere, high production value, cinematic depth of field, compelling visual storytelling',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
  {
    key: 'professionalPresenter',
    title: 'Professional Presenter',
    subtitle: 'Corporate-style presentation with clean, polished look',
    prompt: 'Professional corporate presenter, clean business attire, polished appearance, neutral background, professional lighting, trustworthy demeanor, business presentation setting',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
  {
    key: 'casualCreator',
    title: 'Casual Creator',
    subtitle: 'Relaxed, approachable creator for vlogs and tutorials',
    prompt: 'Casual content creator, friendly and approachable, comfortable setting, natural lighting, relaxed posture, authentic personality, everyday environment, genuine smile',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
];

export const YOUTUBE_THEME: ImageModalTheme = {
  dialogBackground: 'rgba(26, 26, 46, 0.95)',
  primaryAccent: '#667eea',
  secondaryAccent: '#10b981',
  warningAccent: '#f59e0b',
};

// ============================================
// Podcast Maker Presets
// ============================================

export const PODCAST_PRESETS: ImagePreset[] = [
  {
    key: 'studioNeutral',
    title: 'Studio Neutral',
    subtitle: 'Clean, well-lit studio, neutral background',
    prompt: 'Professional podcast studio, neutral light grey backdrop, soft key + fill lighting, subtle depth of field, clear microphone framing',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
  {
    key: 'warmBroadcast',
    title: 'Warm Broadcast',
    subtitle: 'Warm tones, friendly and inviting broadcast desk',
    prompt: 'Warm broadcast desk, soft amber lighting, cozy ambience, gentle vignette, inviting expression, polished but approachable look',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
  {
    key: 'techModern',
    title: 'Tech Modern',
    subtitle: 'Crisp, modern look with cool accent lighting',
    prompt: 'Modern tech podcast set, cool accent lights (teal/purple), minimal backdrop, crisp highlights, premium camera look, subtle bokeh',
    style: 'Auto',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
];

export const PODCAST_THEME: ImageModalTheme = {
  dialogBackground: 'rgba(15, 23, 42, 0.95)',
  primaryAccent: '#667eea',
  secondaryAccent: '#10b981',
  warningAccent: '#f59e0b',
};

// ============================================
// Brand Avatar Presets
// ============================================

export const BRAND_AVATAR_PRESETS: ImagePreset[] = [
  {
    key: 'professionalHeadshot',
    title: 'Professional Headshot',
    subtitle: 'Clean, corporate-ready professional portrait',
    prompt: 'Professional business headshot, confident expression, soft studio lighting, neutral background, sharp focus, high resolution, corporate attire, trustworthy demeanor',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
    image: '/assets/examples/professional_headshot.png',
  },
  {
    key: 'creativeMascot',
    title: 'Creative Mascot',
    subtitle: 'Stylized 3D character for brand identity',
    prompt: '3D character mascot, friendly and approachable, vibrant brand colors, soft rendering, pixar-style, expressive features, clean background, memorable design',
    style: 'Fiction',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
    image: '/assets/examples/creative_mascot.png',
  },
  {
    key: 'techVisionary',
    title: 'Tech Visionary',
    subtitle: 'Modern, forward-looking tech aesthetic',
    prompt: 'Modern tech entrepreneur, futuristic lighting, smart casual attire, innovative atmosphere, clean tech background, confident gaze, professional but approachable',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
    image: '/assets/examples/tech_visionary.png',
  },
  {
    key: 'artisticPortrait',
    title: 'Artistic Portrait',
    subtitle: 'Unique, hand-drawn or painted style avatar',
    prompt: 'Digital art portrait, expressive brushstrokes, unique artistic style, vibrant color palette, creative composition, abstract background elements, distinct personality',
    style: 'Fiction',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
    image: '/assets/examples/artistic_portrait.png',
  },
];

export const BRAND_AVATAR_THEME: ImageModalTheme = {
  dialogBackground: 'rgba(20, 20, 30, 0.98)',
  primaryAccent: '#7C3AED', // Violet
  secondaryAccent: '#EC4899', // Pink
  warningAccent: '#F59E0B',
};

// ============================================
// YouTube-specific Recommendations
// ============================================

export const YOUTUBE_RECOMMENDATIONS: CustomRecommendations = {
  style: <>
    <strong>Auto:</strong> Best for most YouTube content, balances professionalism and engagement<br />
    <strong>Fiction:</strong> Great for creative content, gaming, or stylized presentations<br />
    <strong>Realistic:</strong> Ideal for educational, corporate, or professional YouTube channels
  </>,
  speed: <>
    <strong>Turbo:</strong> Use for testing and quick iterations (~$0.02/image)<br />
    <strong>Default:</strong> Best balance for regular YouTube production (~$0.04/image)<br />
    <strong>Quality:</strong> Use for high-stakes, professional content (~$0.08/image)
  </>,
  aspectRatio: <>
    <strong>16:9:</strong> Standard videos (recommended for most content)<br />
    <strong>9:16:</strong> YouTube Shorts and mobile-optimized content<br />
    <strong>1:1:</strong> Thumbnails and square-format promotional content
  </>,
  model: <>
    <strong>Ideogram V3 Turbo:</strong> Best for professional YouTube content with text, logos, or detailed scenes<br />
    <strong>Qwen Image:</strong> Great for fast iterations and general content creation
  </>,
};

// ============================================
// Podcast-specific Recommendations
// ============================================

export const PODCAST_RECOMMENDATIONS: CustomRecommendations = {
  style: <>
    <strong>Auto:</strong> Best for most cases, balances realism and style<br />
    <strong>Fiction:</strong> Great for creative, artistic podcasts with stylized visuals<br />
    <strong>Realistic:</strong> Ideal for professional, corporate, or news-style podcasts
  </>,
  speed: <>
    <strong>Turbo:</strong> Use for quick iterations and testing (~$0.02/image)<br />
    <strong>Default:</strong> Best balance for most production use (~$0.04/image)<br />
    <strong>Quality:</strong> Use for final, high-quality outputs (~$0.08/image)
  </>,
  aspectRatio: <>
    <strong>16:9</strong> is recommended for most podcast videos as it matches standard video player dimensions and provides optimal viewing experience.
  </>,
};

// ============================================
// Brand Avatar-specific Recommendations
// ============================================

// ============================================
// LinkedIn Writer Presets
// ============================================

export const LINKEDIN_PRESETS: ImagePreset[] = [
  {
    key: 'professionalSquare',
    title: 'Professional Square',
    subtitle: 'Clean 1:1 feed image for LinkedIn posts',
    prompt: 'Professional LinkedIn post image, corporate aesthetic, clean composition, mobile-friendly, high contrast text-safe areas, modern business visual, neutral background with subtle brand accents',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
  },
  {
    key: 'landscapeFeed',
    title: 'Landscape Feed',
    subtitle: 'Wide format optimized for LinkedIn feed',
    prompt: 'LinkedIn landscape feed image, professional business context, cinematic wide composition, clear focal point, polished corporate look, optimized for 1.91:1 feed viewing',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '16:9',
  },
  {
    key: 'thoughtLeadership',
    title: 'Thought Leadership',
    subtitle: 'Authoritative visual for executive posts',
    prompt: 'Thought leadership LinkedIn visual, executive presence, minimalist design, data-inspired abstract elements, trustworthy professional tone, editorial quality',
    style: 'Realistic',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
  },
  {
    key: 'industryVisual',
    title: 'Industry Visual',
    subtitle: 'Industry-specific professional imagery',
    prompt: 'Industry-specific LinkedIn professional image, relevant business metaphors, modern workplace aesthetic, engaging but credible, suitable for B2B audience',
    style: 'Auto',
    renderingSpeed: 'Quality',
    aspectRatio: '1:1',
  },
];

export const LINKEDIN_THEME: ImageModalTheme = {
  dialogBackground: 'rgba(10, 30, 60, 0.96)',
  primaryAccent: '#0A66C2',
  secondaryAccent: '#057642',
  warningAccent: '#f59e0b',
};

export const LINKEDIN_RECOMMENDATIONS: CustomRecommendations = {
  style: <>
    <strong>Realistic:</strong> Best for professional LinkedIn posts and corporate content<br />
    <strong>Auto:</strong> Balanced look for general business topics<br />
    <strong>Fiction:</strong> Use sparingly for creative or illustrative posts
  </>,
  speed: <>
    <strong>Quality:</strong> Recommended for final LinkedIn post images<br />
    <strong>Default:</strong> Good balance for iterations<br />
    <strong>Turbo:</strong> Quick previews while refining your prompt
  </>,
  aspectRatio: <>
    <strong>1:1 (Square):</strong> Standard LinkedIn feed post image (recommended)<br />
    <strong>16:9:</strong> Wide landscape — mapped to LinkedIn 1.91:1 feed format<br />
    <strong>3:4:</strong> Portrait orientation for mobile-first posts
  </>,
  model: <>
    <strong>FLUX Kontext Pro:</strong> Best default for professional LinkedIn feed images<br />
    <strong>Ideogram V3 Turbo:</strong> Strong for detailed scenes with text-safe composition<br />
    <strong>Qwen Image:</strong> Fast iterations and conceptual business visuals
  </>,
};

export const LINKEDIN_IMAGE_MODELS: LinkedInModelOption[] = [
  {
    id: 'flux-kontext-pro',
    name: 'FLUX Kontext Pro',
    description: 'Professional feed images • High quality • Recommended default',
    costPerImage: '$0.08',
  },
  {
    id: 'ideogram-v3-turbo',
    name: 'Ideogram V3 Turbo ✨',
    description: 'Detailed scenes • Strong composition • $0.10/image',
    costPerImage: '$0.10',
  },
  {
    id: 'qwen-image',
    name: 'Qwen Image ⚡',
    description: 'Fast generation • Conceptual visuals • $0.05/image',
    costPerImage: '$0.05',
  },
];

export const BRAND_AVATAR_RECOMMENDATIONS: CustomRecommendations = {
  style: <>
    <strong>Realistic:</strong> Best for professional personal brands and executive headshots.<br />
    <strong>Fiction:</strong> Ideal for creative agencies, gaming brands, or friendly mascots.
  </>,
  speed: <>
    <strong>Quality:</strong> Recommended for avatars as they are long-term brand assets.<br />
    <strong>Turbo:</strong> Good for exploring concepts quickly.
  </>,
  aspectRatio: <>
    <strong>1:1 (Square)</strong> is the standard for profile pictures across all social platforms (LinkedIn, Twitter, Instagram).
  </>,
  model: <>
    <strong>Ideogram V3 Turbo:</strong> Superior text rendering and photorealism (Recommended).<br />
    <strong>Qwen Image:</strong> Fast and cost-effective for iterations.
  </>,
};
