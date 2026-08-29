import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Grid,
  Stack,
  Alert,
  CircularProgress,
  Typography,
  Divider,
  Paper,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import ArrowBack from '@mui/icons-material/ArrowBack';
import SmartToy from '@mui/icons-material/SmartToy';
import { TextField, Chip } from '@mui/material';
import { ImageStudioLayout } from '../../ImageStudio/ImageStudioLayout';
import { GlassyCard } from '../../ImageStudio/ui/GlassyCard';
import { SectionHeader } from '../../ImageStudio/ui/SectionHeader';
import { useProductMarketing } from '../../../hooks/useProductMarketing';
import { ProductInfoForm } from './ProductInfoForm';
import { StyleSelector } from './StyleSelector';
import { ProductVariations } from './ProductVariations';
import { ProductImagePreview } from './ProductImagePreview';
import { ProductAssetsGallery } from './ProductAssetsGallery';
import { ProductImageSettingsPreview } from '../ProductImagePreview';
import { useNavigate } from 'react-router-dom';

interface ProductPhotoshootStudioProps {
  onBack?: () => void;
  onComplete?: (images: any[]) => void;
}

export const ProductPhotoshootStudio: React.FC<ProductPhotoshootStudioProps> = ({
  onBack,
  onComplete,
}) => {
  const {
    generateProductImage,
    isGeneratingProductImage,
    generatedProductImage,
    productImageError,
    brandDNA,
    getBrandDNA,
    isLoadingBrandDNA,
    inferRequirements,
    isInferringPrompt,
    inferenceError,
    getPersonalizedDefaults,
  } = useProductMarketing();

  // Product Information
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');

  // Style Settings
  const [environment, setEnvironment] = useState('studio');
  const [backgroundStyle, setBackgroundStyle] = useState('white');
  const [lighting, setLighting] = useState('natural');
  const [style, setStyle] = useState('photorealistic');

  // Variations
  const [productVariant, setProductVariant] = useState('');
  const [angle, setAngle] = useState('');
  const [resolution, setResolution] = useState('1024x1024');
  const [numVariations, setNumVariations] = useState(1);

  // Additional Options
  const [additionalContext, setAdditionalContext] = useState('');
  const [brandColors, setBrandColors] = useState<string[]>([]);

  // Generated Images
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [assetsGalleryRefetch, setAssetsGalleryRefetch] = useState(0);

  // Intelligent Prompt Input
  const [intelligentInput, setIntelligentInput] = useState('');
  const [showIntelligentInput, setShowIntelligentInput] = useState(true);

  // Load brand DNA and personalized defaults on mount
  useEffect(() => {
    if (!brandDNA) {
      getBrandDNA().catch(console.error);
    }
    
    // Load personalized defaults
    getPersonalizedDefaults('product_photoshoot')
      .then((defaults) => {
        if (defaults) {
          // Pre-fill form with personalized defaults
          if (defaults.environment) setEnvironment(defaults.environment);
          if (defaults.background_style) setBackgroundStyle(defaults.background_style);
          if (defaults.lighting) setLighting(defaults.lighting);
          if (defaults.style) setStyle(defaults.style);
          if (defaults.resolution) setResolution(defaults.resolution);
          if (defaults.num_variations) setNumVariations(defaults.num_variations);
          if (defaults.brand_colors && defaults.brand_colors.length > 0) {
            setBrandColors(defaults.brand_colors);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load personalized defaults:', err);
        // Continue without defaults
      });
  }, [brandDNA, getBrandDNA, getPersonalizedDefaults]);

  // Extract brand colors from brand DNA
  useEffect(() => {
    if (brandDNA?.visual_identity?.color_palette) {
      setBrandColors(brandDNA.visual_identity.color_palette);
    }
  }, [brandDNA]);

  const handleGenerate = async () => {
    if (!productName.trim() || !productDescription.trim()) {
      return;
    }

    try {
      const result = await generateProductImage({
        product_name: productName,
        product_description: productDescription,
        environment,
        background_style: backgroundStyle,
        lighting,
        style,
        product_variant: productVariant || undefined,
        angle: angle || undefined,
        resolution,
        num_variations: numVariations,
        brand_colors: brandColors.length > 0 ? brandColors : undefined,
        additional_context: additionalContext || undefined,
      });

      if (result && result.success) {
        // Add to generated images list
        setGeneratedImages((prev) => [...prev, result]);
        // Trigger Asset Library refresh
        setAssetsGalleryRefetch((prev) => prev + 1);
        // Call onComplete callback if provided
        if (onComplete) {
          onComplete([result]);
        }
      }
    } catch (error: any) {
      console.error('Failed to generate product image:', error);
    }
  };

  const handleDownload = (image: any) => {
    if (image.image_url) {
      const link = document.createElement('a');
      link.href = image.image_url;
      link.download = `${productName.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.click();
    }
  };

  const handleSaveToLibrary = (image: any) => {
    // Image is already saved to Asset Library via the API
    // This could trigger a refresh or show a success message
    console.log('Image saved to library:', image.asset_id);
  };

  const handleIntelligentInference = async () => {
    if (!intelligentInput.trim()) {
      return;
    }

    try {
      const config = await inferRequirements(intelligentInput, 'image');
      
      // Pre-fill all fields from inferred configuration
      if (config.product_name) {
        setProductName(config.product_name);
      }
      if (config.product_description) {
        setProductDescription(config.product_description);
      }
      if (config.environment) {
        setEnvironment(config.environment);
      }
      if (config.background_style) {
        setBackgroundStyle(config.background_style);
      }
      if (config.lighting) {
        setLighting(config.lighting);
      }
      if (config.style) {
        setStyle(config.style);
      }
      if (config.angle) {
        setAngle(config.angle);
      }
      if (config.resolution) {
        setResolution(config.resolution);
      }
      if (config.num_variations) {
        setNumVariations(config.num_variations);
      }
      if (config.brand_colors) {
        setBrandColors(config.brand_colors);
      }
      if (config.additional_context) {
        setAdditionalContext(config.additional_context);
      }
      
      // Hide intelligent input after successful inference
      setShowIntelligentInput(false);
    } catch (error: any) {
      console.error('Failed to infer requirements:', error);
    }
  };

  const navigate = useNavigate();

  const canGenerate = productName.trim() && productDescription.trim();

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/campaign-creator');
    }
  };

  return (
    <ImageStudioLayout
      headerProps={{
        title: 'Product Photoshoot Studio',
        subtitle:
          'Generate professional product images for e-commerce listings, marketing materials, and product showcases.',
      }}
    >
      <GlassyCard
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          p: { xs: 3, md: 5 },
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBackNavigation}
          sx={{ mb: 3 }}
          variant="outlined"
        >
          Back to Campaign Creator
        </Button>

        {/* Brand DNA Status */}
        {isLoadingBrandDNA ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : brandDNA ? (
          <Alert severity="success" sx={{ mb: 3 }}>
            Brand DNA loaded: {brandDNA.persona?.persona_name || 'Default Persona'} • Using brand
            colors and style guidelines
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            Complete onboarding to enable personalized product images with your brand DNA.
          </Alert>
        )}

        {/* Intelligent Prompt Input */}
        {showIntelligentInput && (
          <Paper
            sx={{
              p: 3,
              mb: 3,
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
            }}
          >
            <Stack spacing={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <SmartToy sx={{ color: '#c4b5fd' }} />
                <Typography variant="h6" fontWeight={600}>
                  AI Quick Start
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Describe your product in a few words, and AI will automatically fill in all the settings for you.
              </Typography>
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth
                  placeholder="e.g., iPhone case for my store, luxury watch photoshoot, product demo video"
                  value={intelligentInput}
                  onChange={(e) => setIntelligentInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && intelligentInput.trim()) {
                      handleIntelligentInference();
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<SmartToy />}
                  onClick={handleIntelligentInference}
                  disabled={!intelligentInput.trim() || isInferringPrompt}
                >
                  {isInferringPrompt ? 'Analyzing...' : 'Auto-Fill'}
                </Button>
              </Box>
              {inferenceError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {inferenceError}
                </Alert>
              )}
            </Stack>
          </Paper>
        )}

        <Grid container spacing={4}>
          {/* Left Column: Form */}
          <Grid item xs={12} md={5}>
            <Stack spacing={4}>
              {/* Product Information */}
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <ProductInfoForm
                  productName={productName}
                  productDescription={productDescription}
                  onProductNameChange={setProductName}
                  onProductDescriptionChange={setProductDescription}
                />
              </Paper>

              {/* Style Selector */}
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <StyleSelector
                  environment={environment}
                  backgroundStyle={backgroundStyle}
                  lighting={lighting}
                  style={style}
                  onEnvironmentChange={setEnvironment}
                  onBackgroundStyleChange={setBackgroundStyle}
                  onLightingChange={setLighting}
                  onStyleChange={setStyle}
                />
              </Paper>

              {/* Image Settings Preview */}
              {productName && (
                <Paper
                  sx={{
                    p: 3,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <ProductImageSettingsPreview
                    productName={productName}
                    environment={environment}
                    backgroundStyle={backgroundStyle}
                    lighting={lighting}
                    style={style}
                    angle={angle}
                    resolution={resolution}
                  />
                </Paper>
              )}

              {/* Product Variations */}
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <ProductVariations
                  productVariant={productVariant}
                  angle={angle}
                  resolution={resolution}
                  numVariations={numVariations}
                  onProductVariantChange={setProductVariant}
                  onAngleChange={setAngle}
                  onResolutionChange={setResolution}
                  onNumVariationsChange={setNumVariations}
                />
              </Paper>

              {/* Generate Button */}
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<AutoAwesome />}
                onClick={handleGenerate}
                disabled={!canGenerate || isGeneratingProductImage}
                sx={{
                  py: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  },
                }}
              >
                {isGeneratingProductImage ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                    Generating...
                  </>
                ) : (
                  'Generate Product Image'
                )}
              </Button>

              {/* Error Display */}
              {productImageError && (
                <Alert severity="error" onClose={() => {}}>
                  {productImageError}
                </Alert>
              )}
            </Stack>
          </Grid>

          {/* Right Column: Preview & Gallery */}
          <Grid item xs={12} md={7}>
            <Stack spacing={3}>
              {/* Newly Generated Images Preview */}
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  minHeight: 400,
                }}
              >
                <ProductImagePreview
                  generatedImages={generatedImages}
                  isLoading={isGeneratingProductImage}
                  error={productImageError}
                  onDownload={handleDownload}
                  onSaveToLibrary={handleSaveToLibrary}
                  onRegenerate={canGenerate ? handleGenerate : undefined}
                />
              </Paper>

              {/* Asset Library Gallery */}
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <ProductAssetsGallery
                  refreshKey={assetsGalleryRefetch}
                  limit={6}
                  showViewAllButton={true}
                />
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </GlassyCard>
    </ImageStudioLayout>
  );
};

