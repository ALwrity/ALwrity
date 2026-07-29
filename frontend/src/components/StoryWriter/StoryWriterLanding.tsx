import React, { useState } from 'react';
import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ImageIcon from '@mui/icons-material/Image';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { useNavigate } from 'react-router-dom';
import { OptimizedVideo } from '../ImageStudio/dashboard/utils/OptimizedVideo';
import { motion, AnimatePresence } from 'framer-motion';
import { leftPageVariants, rightPageVariants } from './Phases/StoryOutlineParts/pageVariants';

interface StoryWriterLandingProps {
  onStart: () => void;
  onSelectPath?: (
    mode: 'marketing' | 'pure',
    template:
      | 'product_story'
      | 'brand_manifesto'
      | 'founder_story'
      | 'customer_story'
      | 'short_fiction'
      | 'long_fiction'
      | 'anime_fiction'
      | 'experimental_fiction'
      | null
  ) => void;
}

const featureHighlights = [
  {
    title: 'AI Story Blueprint',
    description: 'Persona, setting, tone, and premise woven together automatically.',
    detail: 'Start with cohesive outlines tailored to your audience and genre.',
    icon: <MenuBookIcon sx={{ fontSize: 32, color: '#8D5524' }} />,
  },
  {
    title: 'Cinematic Illustrations',
    description: 'Scene-by-scene image prompts and gallery-ready renders.',
    detail: 'Control aspect ratios, providers, and models for every chapter.',
    icon: <ImageIcon sx={{ fontSize: 32, color: '#B25D3E' }} />,
  },
  {
    title: 'Voice-Ready Narration',
    description: 'Generate lifelike audio in multiple languages and speeds.',
    detail: 'Perfect for bedtime stories, podcasts, or accessibility-ready scripts.',
    icon: <VolumeUpIcon sx={{ fontSize: 32, color: '#7A4C9F' }} />,
  },
  {
    title: 'Story Video Composer',
    description: 'Blend scenes, audio, and transitions into immersive videos.',
    detail: 'Fine-tune FPS, transitions, and pacing for a studio polish.',
    icon: <VideoLibraryIcon sx={{ fontSize: 32, color: '#2E7D83' }} />,
  },
];

const MotionBox = motion.create(Box);

export const StoryWriterLanding: React.FC<StoryWriterLandingProps> = ({ onStart, onSelectPath }) => {
  type NonFictionTemplate = 'product_story' | 'brand_manifesto' | 'founder_story' | 'customer_story';
  type FictionTemplate = 'short_fiction' | 'long_fiction' | 'anime_fiction' | 'experimental_fiction';
  type TemplateDetailKey = NonFictionTemplate | FictionTemplate | null;

  const navigate = useNavigate();
  const [detailTemplate, setDetailTemplate] = useState<TemplateDetailKey>(null);

  const isDetailView = detailTemplate !== null;

  const isNonFictionDetail = (key: TemplateDetailKey): key is NonFictionTemplate =>
    key === 'product_story' || key === 'brand_manifesto' || key === 'founder_story' || key === 'customer_story';

  const isFictionDetail = (key: TemplateDetailKey): key is FictionTemplate =>
    key === 'short_fiction' || key === 'long_fiction' || key === 'anime_fiction' || key === 'experimental_fiction';

  return (
    <Box sx={{ py: 6 }}>
      <GlobalStyles
        styles={{
          '.storywriter-landing-shadow': {
            boxShadow: '0 36px 80px rgba(45, 30, 15, 0.25)',
          },
        }}
      />

      <Box sx={{ mb: 5, display: 'flex', justifyContent: 'center' }}>
        <Box
          className="storywriter-landing-shadow"
          sx={{
            position: 'relative',
            width: { xs: '100%', lg: '90vw' },
            maxWidth: 1400,
            borderRadius: '24px',
            overflow: 'hidden',
            background: 'linear-gradient(120deg, #fff9ef 0%, #f5e1c7 45%, #fff9ef 100%)',
            border: '1px solid rgba(120, 90, 60, 0.28)',
            transform: 'perspective(2200px) rotateX(2deg)',
            boxShadow: '0 36px 80px rgba(45, 30, 15, 0.35)',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: '-10px -24px 28px',
              background:
                'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 75% 82%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 46%)',
              filter: 'blur(20px)',
              zIndex: -2,
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              width: '2px',
              background: 'linear-gradient(180deg, rgba(120, 90, 60, 0.5) 0%, rgba(120, 90, 60, 0.08) 100%)',
              transform: 'translateX(-50%)',
              zIndex: 2,
            }}
          />

          <AnimatePresence initial={false} custom={1}>
            <MotionBox
              key={detailTemplate || 'overview'}
              custom={1}
              variants={{
                enter: () => ({ opacity: 0 }),
                center: { opacity: 1 },
                exit: () => ({ opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                width: '100%',
                height: '100%',
              }}
            >
              <MotionBox
                custom={1}
                variants={leftPageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                sx={{
                  flex: 1,
                  p: { xs: 4, md: 6 },
                  pr: { xs: 4, md: 7 },
                  borderRight: { md: '1px solid rgba(120, 90, 60, 0.18)' },
                  background: 'linear-gradient(100deg, rgba(255,255,255,0.85) 0%, rgba(242,226,204,0.95) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: 'inset -18px 0 30px rgba(160, 120, 90, 0.18)',
                }}
              >
                {!isDetailView || isNonFictionDetail(detailTemplate) ? (
                  <>
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#7a5335', fontWeight: 600 }}>
                      Non-Fiction
                    </Typography>
                    <Typography variant="h4" sx={{ fontFamily: `'Playfair Display', serif`, color: '#2C2416', mb: 2 }}>
                      {detailTemplate === 'brand_manifesto'
                        ? 'Write your brand manifesto as a story'
                        : detailTemplate === 'founder_story'
                          ? 'Tell your founder story with narrative depth'
                          : detailTemplate === 'customer_story'
                            ? 'Turn customer wins into case-study stories'
                            : 'Turn your brand and product into a story campaign'}
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#3f3224', lineHeight: 1.8 }}>
                      {detailTemplate
                        ? detailTemplate === 'product_story'
                          ? 'Weave your product features, benefits, and proof points into a narrative that audiences remember.'
                          : detailTemplate === 'brand_manifesto'
                            ? 'Articulate what you stand for, the change you want to see, and invite your audience into that story.'
                            : detailTemplate === 'founder_story'
                              ? 'Share the journey, struggles, and insights that led to creating your product or company.'
                              : 'Showcase real customers, their problems, and the transformation your product enabled.'
                        : 'Begin with a book-inspired canvas. Alwrity assembles personas, settings, tones, and campaign story beats so you can focus on the narrative, not forms.'}
                    </Typography>

                    {!detailTemplate && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 3 }}>
                        {[
                          { label: 'Product Story', template: 'product_story' as NonFictionTemplate },
                          { label: 'Brand Manifesto', template: 'brand_manifesto' as NonFictionTemplate },
                          { label: 'Founder Story', template: 'founder_story' as NonFictionTemplate },
                          { label: 'Customer Story', template: 'customer_story' as NonFictionTemplate },
                        ].map(({ label, template }) => (
                          <Box
                            key={template}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.1,
                              borderRadius: 3,
                              border: '1px solid rgba(68, 64, 60, 0.38)',
                              bgcolor: 'rgba(255,255,255,0.92)',
                              cursor: 'pointer',
                              boxShadow: '0 3px 0 rgba(68,64,60,0.25)',
                              transition: 'transform 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease',
                              '&:hover': {
                                transform: 'translateY(-1px) rotate(-0.3deg)',
                                boxShadow: '0 5px 0 rgba(68,64,60,0.35)',
                                bgcolor: 'rgba(255,252,245,0.98)',
                              },
                              '&:hover .know-more-btn': {
                                opacity: 1,
                                transform: 'translateY(0)',
                              },
                            }}
                            onClick={() => {
                              if (onSelectPath) onSelectPath('marketing', template);
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '4px',
                                  border: '2px solid #3f3224',
                                  position: 'relative',
                                  background:
                                    'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(248,244,235,0.9) 100%)',
                                  boxShadow: '0 2px 0 rgba(63,50,36,0.45)',
                                  transform: 'rotate(-4deg)',
                                  mr: 0.5,
                                  '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    inset: '3px 4px 4px 4px',
                                    borderLeft: '2px solid #3f3224',
                                    borderBottom: '2px solid #3f3224',
                                    transform: 'rotate(-28deg)',
                                    opacity: 1,
                                  },
                                }}
                              />
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#3f3224',
                                  fontWeight: 600,
                                  fontFamily: `'Playfair Display', serif`,
                                }}
                              >
                                {label}
                              </Typography>
                              <Box
                                sx={{
                                  flex: 1,
                                  borderBottom: '1px solid rgba(63, 50, 36, 0.6)',
                                  ml: 1,
                                  mr: 2,
                                  transform: 'skewX(-7deg)',
                                  opacity: 0.9,
                                }}
                              />
                            </Box>
                            <Box
                              className="know-more-btn"
                              sx={{
                                fontSize: 11,
                                textTransform: 'none',
                                color: '#7a5335',
                                px: 1.5,
                                py: 0.4,
                                borderRadius: '999px',
                                border: '1px dashed rgba(122,83,53,0.7)',
                                backgroundColor: 'rgba(255, 248, 240, 0.95)',
                                boxShadow: '0 1px 0 rgba(122,83,53,0.3)',
                                opacity: 0,
                                transform: 'translateY(4px)',
                                transition: 'opacity 0.12s ease, transform 0.12s ease',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailTemplate(template);
                              }}
                            >
                              Know more
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}

                    <Box
                      sx={{
                        mt: 4,
                        pt: 2,
                        borderTop: '1px dashed rgba(120, 90, 60, 0.5)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          color: '#8b5a2b',
                          fontWeight: 600,
                        }}
                      >
                        Notes
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 1 }}>
                        {(!detailTemplate || detailTemplate === 'product_story') && [
                          'Product launch or feature stories grounded in your real context',
                          'Scene-by-scene descriptions ready for blogs, landing pages, and videos',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'brand_manifesto' && [
                          'Clarify mission, beliefs, and promises in narrative form',
                          'Create a reusable manifesto that powers campaigns and website copy',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'founder_story' && [
                          'Highlight pivotal moments that shaped the product',
                          'Humanize your brand for decks, about pages, and podcasts',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'customer_story' && [
                          'Narrative case studies structured as before/after transformations',
                          'Adaptable arcs for blog posts, sales decks, and videos',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                            • {item}
                          </Typography>
                        ))}
                        {!detailTemplate && [
                          'Product, brand, and customer stories grounded in your real context',
                          'Guided tone, POV, rating, and length controls for campaigns',
                          'Scene-by-scene descriptions ready for blogs, videos, and podcasts',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                            • {item}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#7a5335', fontWeight: 600 }}>
                      Story Type
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{ fontFamily: `'Playfair Display', serif`, color: '#2C2416', mb: 2, maxWidth: 520 }}
                    >
                      Choose a fiction template on the right to see how it behaves
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#3f3224', lineHeight: 1.8 }}>
                      When you click a template on the right page, both pages update with how that mode works, where to
                      use it, and example prompts you can try.
                    </Typography>
                  </>
                )}
              </MotionBox>

              <MotionBox
                custom={1}
                variants={rightPageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                sx={{
                  flex: 1,
                  p: { xs: 4, md: 6 },
                  background: 'linear-gradient(260deg, rgba(255,255,255,0.9) 0%, rgba(243,226,206,0.95) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {isDetailView && isFictionDetail(detailTemplate) && (
                  <>
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#7a5335', fontWeight: 600 }}>
                      Fiction Template
                    </Typography>
                    <Typography variant="h4" sx={{ fontFamily: `'Playfair Display', serif`, color: '#2C2416', mb: 2 }}>
                      {detailTemplate === 'anime_fiction'
                        ? 'Anime fiction: visual, dramatic story worlds'
                        : detailTemplate === 'short_fiction'
                          ? 'Short fiction: complete arcs in one sitting'
                          : detailTemplate === 'long_fiction'
                            ? 'Long fiction: chapters and evolving arcs'
                            : 'Experimental fiction: break the usual patterns'}
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#3f3224', lineHeight: 1.8, mb: 3 }}>
                      {detailTemplate === 'anime_fiction'
                        ? 'Combine scene-wise images, narration, and cinematic pacing to create anime-inspired story videos and scripts.'
                        : detailTemplate === 'short_fiction'
                          ? 'Perfect for newsletter shorts, bedtime stories, or snackable IP that can later expand into campaigns.'
                          : detailTemplate === 'long_fiction'
                            ? 'Plan multi-chapter narratives with recurring characters, locations, and themes.'
                            : 'Explore unusual structures, mixed formats, and playful styles that do not fit typical genres.'}
                    </Typography>

                    <Box
                      sx={{
                        mt: 2.5,
                        pt: 2,
                        borderTop: '1px dashed rgba(120, 90, 60, 0.4)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          letterSpacing: 2.5,
                          textTransform: 'uppercase',
                          color: '#7c4a1f',
                          fontWeight: 600,
                        }}
                      >
                        Notes
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 1 }}>
                        {detailTemplate === 'anime_fiction' && [
                          'Design scenes with anime-style visual prompts and pacing',
                          'Use narration and music to match emotional beats',
                          'Export outlines to Video Studio for advanced anime-style videos',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#4b3320' }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'short_fiction' && [
                          'Generate tightly scoped stories with clear beginnings and endings',
                          'Reuse the same world across multiple shorts and channels',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#4b3320' }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'long_fiction' && [
                          'Structure chapters, arcs, and recurring motifs',
                          'Turn long-form IP into a sequence of videos or podcasts',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#4b3320' }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'experimental_fiction' && [
                          'Blend formats: letters, logs, transcripts, inner monologues',
                          'Prototype unusual concept stories quickly before committing to full production',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#4b3320' }}>
                            • {item}
                          </Typography>
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" sx={{ color: '#2C2416', mb: 1 }}>
                        See demos and example prompts:
                      </Typography>
                      {detailTemplate === 'anime_fiction' && [
                        '“Storyboard 8 anime-style shots for a hero vs. rival training arc I can send to Video Studio.”',
                        '“Give me key visual prompts for Image Studio to match each anime scene in this outline.”',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'short_fiction' && [
                        '“Outline three self-contained short stories set in the same world for newsletter issues.”',
                        '“Turn this short story into a 45-second narrated video concept for Video Studio.”',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'long_fiction' && [
                        '“Plan a 6-episode arc for this story, with one strong cliffhanger per episode.”',
                        '“List hero, villain, and location prompts I can reuse in Image Studio across the series.”',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'experimental_fiction' && [
                        '“Design an experimental story that alternates chat logs, diary pages, and internal narration.”',
                        '“Suggest three unusual thumbnail concepts for Image Studio that fit this experimental format.”',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'experimental_fiction' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" sx={{ color: '#7a5335', fontWeight: 600, mb: 0.5 }}>
                            Image example from Brand Avatar presets
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.5,
                              display: 'flex',
                              gap: 1.5,
                              alignItems: 'center',
                            }}
                          >
                            <Box
                              component="img"
                              src="/assets/examples/artistic_portrait.png"
                              alt="Artistic portrait avatar example"
                              loading="lazy"
                              sx={{
                                width: 72,
                                height: 72,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                boxShadow: '0 6px 14px rgba(15,23,42,0.25)',
                                border: '1px solid rgba(15, 23, 42, 0.22)',
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#5D4037' }}>
                              Use experimental stories with artistic avatars like this to create unusual thumbnails,
                              cover art, or in-book character sketches.
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {detailTemplate === 'anime_fiction' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" sx={{ color: '#7a5335', fontWeight: 600, mb: 0.5 }}>
                            Example from Product Video Studio
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.5,
                              borderRadius: 2,
                              overflow: 'hidden',
                              border: '1px solid rgba(15, 23, 42, 0.18)',
                              maxWidth: 260,
                              boxShadow: '0 6px 14px rgba(15,23,42,0.25)',
                            }}
                          >
                            <OptimizedVideo
                              src="/videos/text-video-voiceover.mp4"
                              alt="Anime-style motion example"
                              controls={false}
                              muted
                              loop
                              preload="metadata"
                              sx={{
                                height: 140,
                                borderRadius: 2,
                              }}
                            />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </>
                )}

                {isDetailView && isNonFictionDetail(detailTemplate) && (
                  <>
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#7a5335', fontWeight: 600 }}>
                      Campaign Ideas
                    </Typography>
                    <Typography variant="h5" sx={{ fontFamily: `'Playfair Display', serif`, color: '#2C2416', mb: 2 }}>
                      How this template can show up across your channels
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                      {detailTemplate === 'product_story' && [
                        'Launch emails, landing pages, and feature explainer videos',
                        'Sequenced social posts that follow a single product arc',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'brand_manifesto' && [
                        'Homepage hero copy and about pages',
                        'Investor decks and brand announcement posts',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'founder_story' && [
                        'Podcast-style scripts and keynote outlines',
                        'Behind-the-scenes videos and newsletter essays',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                          • {item}
                        </Typography>
                      ))}
                      {detailTemplate === 'customer_story' && [
                        'Narrative case-study blogs and sales deck stories',
                        'Short clips highlighting quotes and turning points',
                      ].map((item) => (
                        <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                          • {item}
                        </Typography>
                      ))}
                    </Box>
                    <Box
                      sx={{
                        mt: 3,
                        pt: 2,
                        borderTop: '1px dashed rgba(120, 90, 60, 0.4)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          letterSpacing: 2.5,
                          textTransform: 'uppercase',
                          color: '#7c4a1f',
                          fontWeight: 600,
                        }}
                      >
                        Notes
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#4b3320', mt: 1 }}>
                        Use this template as the backbone of a campaign, then reuse its beats in Story Studio’s outline,
                        Image Studio visuals, and Product Video Studio demos.
                      </Typography>
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ color: '#2C2416', mb: 0.5 }}>
                          See demos and example prompts:
                        </Typography>
                        {detailTemplate === 'product_story' && [
                          '“Write a launch story for my product that finishes with a clear CTA to watch a demo video.”',
                          '“Turn this outline into a 30-second product demo script suitable for Product Video Studio.”',
                          '“Suggest three hero image prompts for Image Studio that match the opening scene.”',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'brand_manifesto' && [
                          '“Draft a three-part brand manifesto that we can reuse on homepage, deck, and launch video.”',
                          '“Condense this manifesto into a 45-second narration script for Product Video Studio.”',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'founder_story' && [
                          '“Outline a podcast episode where the founder tells this story in three acts.”',
                          '“Propose three thumbnail image prompts in Image Studio capturing the founder’s turning point.”',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'customer_story' && [
                          '“Write a narrative case study with before/after metrics that fits a landing page section.”',
                          '“Create a 60-second testimonial video script based on this customer story.”',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037', mb: 0.5 }}>
                            • {item}
                          </Typography>
                        ))}
                        {detailTemplate === 'brand_manifesto' && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" sx={{ color: '#7a5335', fontWeight: 600, mb: 0.5 }}>
                              Image example from Brand Avatar presets
                            </Typography>
                            <Box
                              sx={{
                                mt: 0.5,
                                display: 'flex',
                                gap: 1.5,
                                alignItems: 'center',
                              }}
                            >
                              <Box
                                component="img"
                                src="/assets/examples/tech_visionary.png"
                                alt="Tech visionary brand avatar example"
                                loading="lazy"
                                sx={{
                                  width: 72,
                                  height: 72,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  boxShadow: '0 6px 14px rgba(15,23,42,0.25)',
                                  border: '1px solid rgba(15, 23, 42, 0.22)',
                                }}
                              />
                              <Typography variant="caption" sx={{ color: '#5D4037' }}>
                                Reuse this kind of “tech visionary” avatar from Image Studio when you turn your manifesto
                                into homepage heroes, decks, and launch visuals.
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        {detailTemplate === 'founder_story' && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" sx={{ color: '#7a5335', fontWeight: 600, mb: 0.5 }}>
                              Image example from Brand Avatar presets
                            </Typography>
                            <Box
                              sx={{
                                mt: 0.5,
                                display: 'flex',
                                gap: 1.5,
                                alignItems: 'center',
                              }}
                            >
                              <Box
                                component="img"
                                src="/assets/examples/professional_headshot.png"
                                alt="Professional headshot brand avatar example"
                                loading="lazy"
                                sx={{
                                  width: 72,
                                  height: 72,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  boxShadow: '0 6px 14px rgba(15,23,42,0.25)',
                                  border: '1px solid rgba(15, 23, 42, 0.22)',
                                }}
                              />
                              <Typography variant="caption" sx={{ color: '#5D4037' }}>
                                A professional headshot like this works well for founder story landing pages, podcast
                                cover art, and keynote thumbnails.
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        {detailTemplate === 'product_story' && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" sx={{ color: '#7a5335', fontWeight: 600, mb: 0.5 }}>
                              Example from Product Video Studio
                            </Typography>
                            <Box
                              sx={{
                                mt: 0.5,
                                display: 'flex',
                                gap: 1.5,
                                alignItems: 'center',
                              }}
                            >
                              <Box
                                sx={{
                                  borderRadius: 2,
                                  overflow: 'hidden',
                                  border: '1px solid rgba(15, 23, 42, 0.18)',
                                  width: 160,
                                  boxShadow: '0 6px 14px rgba(15,23,42,0.2)',
                                  flexShrink: 0,
                                }}
                              >
                                <OptimizedVideo
                                  src="/videos/text-video-voiceover.mp4"
                                  alt="Product demo video example"
                                  controls={false}
                                  muted
                                  loop
                                  preload="metadata"
                                  sx={{
                                    height: 100,
                                    borderRadius: 2,
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ color: '#3f3224', fontWeight: 600 }}>
                                  Product demo clip
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#5D4037' }}>
                                  The same WAN 2.5 Text-to-Video setup used in Product Video Studio, ideal for feature
                                  highlights and launch stories.
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </>
                )}

                {!isDetailView && (
                  <>
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#7a5335', fontWeight: 600 }}>
                      Fiction
                    </Typography>
                    <Typography variant="h4" sx={{ fontFamily: `'Playfair Display', serif`, color: '#2C2416', mb: 2 }}>
                      Illustrations, narration, and video for your fictional worlds
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#3f3224', lineHeight: 1.8 }}>
                      Every scene can bloom into art, audio, and cinematic video. Choose the kind of fiction you want to
                      explore and let AI help you build it.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 3 }}>
                      {[
                        { label: 'Short Fiction', key: 'short_fiction' as FictionTemplate },
                        { label: 'Long Fiction', key: 'long_fiction' as FictionTemplate },
                        { label: 'Anime Fiction', key: 'anime_fiction' as FictionTemplate },
                        { label: 'Experimental', key: 'experimental_fiction' as FictionTemplate },
                      ].map(({ label, key }) => (
                        <Box
                          key={key}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.1,
                            borderRadius: 3,
                            border: '1px solid rgba(68, 64, 60, 0.38)',
                            bgcolor: 'rgba(255,255,255,0.92)',
                            cursor: 'pointer',
                            boxShadow: '0 3px 0 rgba(68,64,60,0.25)',
                            transition: 'transform 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease',
                            '&:hover': {
                              transform: 'translateY(-1px) rotate(0.3deg)',
                              boxShadow: '0 5px 0 rgba(68,64,60,0.35)',
                              bgcolor: 'rgba(255,252,245,0.98)',
                            },
                            '&:hover .know-more-btn': {
                              opacity: 1,
                              transform: 'translateY(0)',
                            },
                          }}
                          onClick={() => {
                            if (onSelectPath) onSelectPath('pure', key);
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '4px',
                                border: '2px solid #3f3224',
                                position: 'relative',
                                background:
                                  'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(248,244,235,0.9) 100%)',
                                boxShadow: '0 2px 0 rgba(63,50,36,0.45)',
                                transform: 'rotate(3deg)',
                                mr: 0.5,
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  inset: '3px 4px 4px 4px',
                                  borderLeft: '2px solid #3f3224',
                                  borderBottom: '2px solid #3f3224',
                                  transform: 'rotate(-24deg)',
                                  opacity: 1,
                                },
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#3f3224',
                                fontWeight: 600,
                                fontFamily: `'Playfair Display', serif`,
                              }}
                            >
                              {label}
                            </Typography>
                            <Box
                              sx={{
                                flex: 1,
                                borderBottom: '1px solid rgba(63, 50, 36, 0.6)',
                                ml: 1,
                                mr: 2,
                                transform: 'skewX(-5deg)',
                                opacity: 0.9,
                              }}
                            />
                          </Box>
                          <Box
                            className="know-more-btn"
                            sx={{
                              fontSize: 11,
                              textTransform: 'none',
                              color: '#7a5335',
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '999px',
                              border: '1px dashed rgba(122,83,53,0.7)',
                              backgroundColor: 'rgba(255, 248, 240, 0.95)',
                              boxShadow: '0 1px 0 rgba(122,83,53,0.3)',
                              opacity: 0,
                              transform: 'translateY(4px)',
                              transition: 'opacity 0.12s ease, transform 0.12s ease',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailTemplate(key);
                            }}
                          >
                            Know more
                          </Box>
                        </Box>
                      ))}
                    </Box>

                    <Box
                      sx={{
                        mt: 4,
                        pt: 2,
                        borderTop: '1px dashed rgba(120, 90, 60, 0.5)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          color: '#8b5a2b',
                          fontWeight: 600,
                        }}
                      >
                        Notes
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 1 }}>
                        {[
                          'Short and long-form stories, from cozy to epic',
                          'Anime-inspired and experimental narrative styles',
                          'Scene-by-scene control over visuals, voices, and pacing',
                        ].map((item) => (
                          <Typography key={item} variant="body2" sx={{ color: '#5D4037' }}>
                            • {item}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  </>
                )}
              </MotionBox>
            </MotionBox>
          </AnimatePresence>

          {isDetailView && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: { xs: 20, md: 48 },
                width: 56,
                height: 72,
                background: 'linear-gradient(180deg, #fb923c 0%, #fed7aa 100%)',
                borderRadius: '6px 6px 10px 10px',
                boxShadow: '0 8px 14px rgba(0,0,0,0.3)',
                border: '1px solid rgba(124, 45, 18, 0.75)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 3,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid #b45309',
                },
              }}
              onClick={() => setDetailTemplate(null)}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#1f2937',
                  fontWeight: 700,
                  textAlign: 'center',
                  px: 0.5,
                  pb: 0.6,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: 0.9,
                }}
              >
                Back
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<AutoAwesomeIcon />}
          onClick={onStart}
          sx={{
            mb: 1,
            px: 5,
            py: 1.8,
            borderRadius: '999px',
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #7F5AF0 0%, #2CB67D 100%)',
            boxShadow: '0 16px 32px rgba(127, 90, 240, 0.35)',
            '&:hover': {
              background: 'linear-gradient(135deg, #6c4cd4 0%, #24a26f 100%)',
              boxShadow: '0 18px 36px rgba(127, 90, 240, 0.4)',
            },
          }}
        >
          Let’s ALwrity Your Story Journey
        </Button>
        <Box sx={{ mt: 1.5 }}>
          <Button
            variant="text"
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={() => navigate('/story-projects')}
            sx={{
              textTransform: 'none',
              color: '#8D6E63',
              fontWeight: 500,
              fontSize: '0.85rem',
              '&:hover': { color: '#5D4037', backgroundColor: 'transparent' },
            }}
          >
            Browse My Saved Projects
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: '#5D4037', mt: 1 }}>
          Tap once to open the book. Inputs appear after AI drafts your campaign-ready foundation.
        </Typography>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1611', mb: 2 }}>
        Everything Story Studio helps you create
      </Typography>
      <Grid container spacing={2}>
        {featureHighlights.map((feature) => (
          <Grid item xs={12} sm={6} md={3} key={feature.title}>
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                p: 3,
                background: 'linear-gradient(180deg, #fff8ef 0%, #f8efe2 100%)',
                borderRadius: 3,
                border: '1px solid rgba(138, 85, 36, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {feature.icon}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2C2416' }}>
                  {feature.title}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#5D4037' }}>
                {feature.description}
              </Typography>
              <Typography variant="caption" sx={{ color: '#7A5A3C' }}>
                {feature.detail}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default StoryWriterLanding;
