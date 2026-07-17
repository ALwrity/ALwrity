import React from 'react';
import { showToastNotification } from '../../utils/toastNotifications';
import { linkedInWriterApi, GroundingLevel } from '../../services/linkedInWriterApi';
import {
  mapPostType,
  mapTone,
  mapIndustry,
  mapSearchEngine,
  readPrefs
} from './utils/linkedInWriterUtils';
import {
  assembleLinkedInPostContent,
  DEFAULT_LINKEDIN_POST_MAX_LENGTH,
  joinHashtagSuggestions,
} from './utils/linkedInPostAssembly';
import { apiClient } from '../../api/client';
import { useCopilotActionTyped } from '../../hooks/useCopilotActionTyped';

const RegisterLinkedInActions: React.FC = () => {
  // LinkedIn Image Generation Actions
  useCopilotActionTyped({
    name: 'generateLinkedInImagePrompts',
    description: 'Generate three AI-optimized image prompts for LinkedIn content',
    parameters: [
      { name: 'content_type', type: 'string', required: true, description: 'Type of LinkedIn content (post, article, carousel, video_script)' },
      { name: 'topic', type: 'string', required: true, description: 'Main topic of the content' },
      { name: 'industry', type: 'string', required: true, description: 'Industry context' },
      { name: 'content', type: 'string', required: true, description: 'The actual content text' }
    ],
    handler: async (args: any) => {
      try {
        const response = await apiClient.post('/api/linkedin/generate-image-prompts', {
          content_type: args.content_type,
          topic: args.topic,
          industry: args.industry,
          content: args.content
        });

        const result = response.data;
        return { 
          success: true, 
          prompts: result,
          message: `Generated ${result.length} professional image prompts for your LinkedIn content. Choose one to generate the actual image.`
        };
      } catch (error) {
        console.error('Error generating image prompts:', error);
        return { 
          success: false, 
          error: 'Failed to generate image prompts. Please try again.' 
        };
      }
    }
  });

  useCopilotActionTyped({
    name: 'generateLinkedInImage',
    description: 'Generate LinkedIn-optimized image from selected prompt',
    parameters: [
      { name: 'prompt', type: 'string', required: true, description: 'The image generation prompt' },
      { name: 'content_context', type: 'object', required: true, description: 'Content context including topic, industry, content_type, and style', attributes: [
        { name: 'topic', type: 'string', required: true, description: 'Content topic' },
        { name: 'industry', type: 'string', required: true, description: 'Content industry' },
        { name: 'content_type', type: 'string', required: true, description: 'Type of content (post, article, carousel)' },
        { name: 'style', type: 'string', required: true, description: 'Writing style/tone' }
      ] },
      { name: 'aspect_ratio', type: 'string', required: false, description: 'Image aspect ratio (default: 1:1)' }
    ],
    handler: async (args: any) => {
      try {
        const response = await apiClient.post('/api/linkedin/generate-image', {
          prompt: args.prompt,
          content_context: args.content_context,
          aspect_ratio: args.aspect_ratio || '1:1'
        });

        const result = response.data;
        if (result.success) {
          return { 
            success: true, 
            image_url: result.image_url,
            image_id: result.image_id,
            message: `✅ LinkedIn image generated successfully! Your professional image is ready to use.`
          };
        } else {
          return { 
            success: false, 
            error: result.error || 'Image generation failed' 
          };
        }
      } catch (error) {
        console.error('Error generating image:', error);
        return { 
          success: false, 
          error: 'Failed to generate image. Please try again.' 
        };
      }
    }
  });

  // LinkedIn Image Editing Action
  useCopilotActionTyped({
    name: 'editLinkedInImage',
    description: 'Edit an existing LinkedIn image using natural language (change style, background, colors, etc.). Requires an image_id from a previously generated LinkedIn image.',
    parameters: [
      { name: 'image_id', type: 'string', required: true, description: 'ID of the previously generated LinkedIn image to edit' },
      { name: 'prompt', type: 'string', required: true, description: 'Natural language description of desired edits (e.g., "Make the background blue", "Add more professional look")' },
      { name: 'content_context', type: 'object', required: true, description: 'Content context including topic, industry, content_type', attributes: [
        { name: 'topic', type: 'string', required: true, description: 'Content topic' },
        { name: 'industry', type: 'string', required: true, description: 'Content industry' },
        { name: 'content_type', type: 'string', required: true, description: 'Type of content (post, article, carousel)' },
      ] },
    ],
    handler: async (args: any) => {
      try {
        const response = await apiClient.post('/api/linkedin/edit-image', {
          image_id: args.image_id,
          prompt: args.prompt,
          content_context: args.content_context,
        });

        const result = response.data;
        if (result.success) {
          return { 
            success: true, 
            image_data: result.image_data,
            image_id: result.image_id,
            image_url: result.image_url,
            message: result.image_id
              ? `✅ LinkedIn image edited successfully! Your edited image (ID: ${result.image_id}) is ready to use.`
              : `✅ LinkedIn image edited successfully! The image is ready to use in your content.`
          };
        } else {
          return { 
            success: false, 
            error: result.error || 'Image editing failed' 
          };
        }
      } catch (error) {
        console.error('Error editing image:', error);
        return { 
          success: false, 
          error: 'Failed to edit image. Please try again.' 
        };
      }
    }
  });

  // LinkedIn Post Generation
  useCopilotActionTyped({
    name: 'generateLinkedInPost',
    description: 'Generate a professional LinkedIn post with industry insights and engagement optimization',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'post_type', type: 'string', required: false },
      { name: 'tone', type: 'string', required: false },
      { name: 'refine_existing', type: 'boolean', required: false, description: 'Whether to refine existing content instead of creating new' }
    ],
    handler: async (args: any) => {
      const prefs = readPrefs();
      
      // Start loading state
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', { 
        detail: { 
          action: 'generateLinkedInPost', 
          message: 'Generating LinkedIn post with persona optimization...' 
        } 
      }));
      
      // Emit progress init
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
        steps: [
          { id: 'personalize', label: 'Personalizing topic & context' },
          { id: 'prepare_queries', label: 'Preparing research queries' },
          { id: 'research', label: 'Conducting research & analysis' },
          { id: 'grounding', label: 'Applying AI grounding' },
          { id: 'content_generation', label: 'Generating content' },
          { id: 'citations', label: 'Extracting citations' },
          { id: 'quality_analysis', label: 'Quality assessment' },
          { id: 'finalize', label: 'Finalizing & optimizing' }
        ]
      }}));
      
      // Start detailed progress tracking
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'personalize', 
          status: 'active',
          message: 'Analyzing topic, industry context, and target audience...'
        } 
      }));
      
      const res = await linkedInWriterApi.generatePost({
        topic: args?.topic || prefs.topic || 'AI transformation in business',
        industry: mapIndustry(args?.industry || prefs.industry),
        post_type: mapPostType(args?.post_type || prefs.post_type),
        tone: mapTone(args?.tone || prefs.tone),
        target_audience: args?.target_audience || prefs.target_audience || 'Business leaders and professionals',
        key_points: args?.key_points || prefs.key_points || [],
        include_hashtags: args?.include_hashtags ?? (prefs.include_hashtags ?? true),
        include_call_to_action: args?.include_call_to_action ?? (prefs.include_call_to_action ?? true),
        research_enabled: args?.research_enabled ?? (prefs.research_enabled ?? true),
        search_engine: mapSearchEngine(args?.search_engine || prefs.search_engine),
        max_length: args?.max_length || prefs.max_length || DEFAULT_LINKEDIN_POST_MAX_LENGTH,
        grounding_level: 'enhanced' as GroundingLevel,
        include_citations: true
      });
      
      if (res.success && res.data) {
        // Update progress with detailed information
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'personalize', 
            status: 'completed',
            message: 'Topic personalized successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'prepare_queries', 
            status: 'completed',
            message: `Prepared ${(res.data?.search_queries || []).length} research queries`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'research', 
            status: 'completed',
            message: `Research completed with ${(res.research_sources || []).length} sources`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'grounding', 
            status: 'completed',
            message: 'AI grounding applied successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'content_generation', 
            status: 'completed',
            message: 'Content generated with industry insights'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'citations', 
            status: 'completed',
            message: `Extracted ${(res.data?.citations || []).length} citations`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'quality_analysis', 
            status: 'completed',
            message: 'Quality assessment completed'
          } 
        }));
        
        const fullContent = assembleLinkedInPostContent({
          content: res.data.content,
          hashtags: joinHashtagSuggestions(res.data.hashtags),
          callToAction: res.data.call_to_action || '',
          includeHashtags: args?.include_hashtags ?? (prefs.include_hashtags ?? true),
          includeCallToAction: args?.include_call_to_action ?? (prefs.include_call_to_action ?? true),
        });
        
        // Debug: Log the full response structure
        console.log('[LinkedIn Writer] Full API response:', res);
        console.log('[LinkedIn Writer] Research sources:', res.research_sources);
        console.log('[LinkedIn Writer] Citations:', res.data?.citations);
        console.log('[LinkedIn Writer] Quality metrics:', res.data?.quality_metrics);
        console.log('[LinkedIn Writer] Grounding enabled:', res.data?.grounding_enabled);
        
        // Update grounding data
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateGroundingData', { 
          detail: {
            researchSources: res.research_sources || [],
            citations: res.data?.citations || [],
            qualityMetrics: res.data?.quality_metrics || null,
            groundingEnabled: res.data?.grounding_enabled || false,
            searchQueries: res.data?.search_queries || []
          }
        }));
        
        // Debug: Log the content being sent
        console.log('[LinkedIn Writer] Sending draft update:', fullContent?.substring(0, 100) + '...');
        console.log('[LinkedIn Writer] Full content length:', fullContent?.length);
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: fullContent }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'finalize', 
            status: 'completed',
            message: 'Content finalized and optimized'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        
        // End loading state
        console.log('[LinkedIn Writer] Ending loading state...');
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        
        // Return recommendations message that CopilotKit can render
        const recommendations = res.data?.quality_metrics?.recommendations || [];
        if (recommendations.length > 0) {
          // Create a markdown-formatted message with recommendations
          const recommendationsMarkdown = recommendations.map((rec, index) => 
            `${index + 1}. **${rec}**`
          ).join('\n\n');
          
          // Return a message that CopilotKit can render with image generation suggestion
          return { 
            success: true, 
            message: `✅ LinkedIn post generated successfully! Your content is now displayed in the preview.\n\n**🎯 AI Content Improvement Recommendations:**\n\n${recommendationsMarkdown}\n\n**🖼️ Enhance Your Post with AI-Generated Images:**\n\nNow that your content is ready, you can make it even more engaging with professional LinkedIn-optimized images! Here are your options:\n\n• **Professional Style**: Clean, corporate aesthetics perfect for business audiences\n• **Creative Style**: Eye-catching visuals that boost social media engagement\n• **Industry-Specific**: Tailored imagery for your ${mapIndustry(args?.industry || prefs.industry)} industry\n\n*To generate images, simply ask: "Generate images for my LinkedIn post" or "Create professional images for this content"*\n\n*To get specific improvement guidance for any recommendation, type: "Help me improve [specific recommendation]"*`
          };
        } else {
          // Return a message with image generation suggestion even without recommendations
          return { 
            success: true, 
            message: `✅ LinkedIn post generated successfully! Your content is now displayed in the preview.\n\n**🖼️ Enhance Your Post with AI-Generated Images:**\n\nNow that your content is ready, you can make it even more engaging with professional LinkedIn-optimized images! Here are your options:\n\n• **Professional Style**: Clean, corporate aesthetics perfect for business audiences\n• **Creative Style**: Eye-catching visuals that boost social media engagement\n• **Industry-Specific**: Tailored imagery for your ${mapIndustry(args?.industry || prefs.industry)} industry\n\n*To generate images, simply ask: "Generate images for my LinkedIn post" or "Create professional images for this content"*`
          };
        }
      }
      // End loading state on error
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, message: res.error || 'Failed to generate LinkedIn post' };
    }
  });

  // LinkedIn Article Generation
  useCopilotActionTyped({
    name: 'generateLinkedInArticle',
    description: 'Generate a comprehensive LinkedIn article with thought leadership content',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'tone', type: 'string', required: false },
      { name: 'word_count', type: 'number', required: false }
    ],
    handler: async (args: any) => {
      const prefs = readPrefs();
      
      // Start loading state
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', { 
        detail: { 
          action: 'generateLinkedInArticle', 
          message: 'Generating LinkedIn article with persona optimization...' 
        } 
      }));
      
      // Emit progress init for article
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
        steps: [
          { id: 'personalize', label: 'Personalizing topic & context' },
          { id: 'prepare_queries', label: 'Preparing research queries' },
          { id: 'research', label: 'Conducting research & analysis' },
          { id: 'grounding', label: 'Applying AI grounding' },
          { id: 'content_generation', label: 'Generating article content' },
          { id: 'citations', label: 'Extracting citations' },
          { id: 'quality_analysis', label: 'Quality assessment' },
          { id: 'finalize', label: 'Finalizing & optimizing' }
        ]
      }}));
      
      // Start detailed progress tracking
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'personalize', 
          status: 'active',
          message: 'Analyzing topic, industry context, and target audience...'
        } 
      }));
      
      const res = await linkedInWriterApi.generateArticle({
        topic: args?.topic || prefs.topic || 'Digital transformation strategies',
        industry: mapIndustry(args?.industry || prefs.industry),
        tone: mapTone(args?.tone || prefs.tone),
        target_audience: args?.target_audience || prefs.target_audience || 'Industry professionals and executives',
        key_sections: args?.key_sections || prefs.key_sections || [],
        include_images: args?.include_images ?? (prefs.include_images ?? true),
        seo_optimization: args?.seo_optimization ?? (prefs.seo_optimization ?? true),
        research_enabled: args?.research_enabled ?? (prefs.research_enabled ?? true),
        search_engine: mapSearchEngine(args?.search_engine || prefs.search_engine),
        word_count: args?.word_count || prefs.word_count || 1500,
        grounding_level: 'enhanced' as GroundingLevel,
        include_citations: true
      });
      
      if (res.success && res.data) {
        // Update progress with detailed information
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'personalize', 
            status: 'completed',
            message: 'Topic personalized successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'prepare_queries', 
            status: 'completed',
            message: `Prepared ${(res.data?.search_queries || []).length} research queries`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'research', 
            status: 'completed',
            message: `Research completed with ${(res.research_sources || []).length} sources`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'grounding', 
            status: 'completed',
            message: 'AI grounding applied successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'content_generation', 
            status: 'completed',
            message: 'Article content generated with industry insights'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'citations', 
            status: 'completed',
            message: `Extracted ${(res.data?.citations || []).length} citations`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'quality_analysis', 
            status: 'completed',
            message: 'Quality assessment completed'
          } 
        }));
        
        const content = `# ${res.data.title}\n\n${res.data.content}`;
        
        // Debug: Log the full response structure
        console.log('[LinkedIn Writer] Full API response:', res);
        console.log('[LinkedIn Writer] Research sources:', res.research_sources);
        console.log('[LinkedIn Writer] Citations:', res.data?.citations);
        console.log('[LinkedIn Writer] Quality metrics:', res.data?.quality_metrics);
        console.log('[LinkedIn Writer] Grounding enabled:', res.data?.grounding_enabled);
        
        // Update grounding data
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateGroundingData', { 
          detail: {
            researchSources: res.research_sources || [],
            citations: res.data?.citations || [],
            qualityMetrics: res.data?.quality_metrics || null,
            groundingEnabled: res.data?.grounding_enabled || false,
            searchQueries: res.data?.search_queries || []
          }
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'finalize', 
            status: 'completed',
            message: 'Article finalized and optimized'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        
        // End loading state
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        
        // Return recommendations message that CopilotKit can render
        const recommendations = res.data?.quality_metrics?.recommendations || [];
        if (recommendations.length > 0) {
          // Create a markdown-formatted message with recommendations
          const recommendationsMarkdown = recommendations.map((rec, index) => 
            `${index + 1}. **${rec}**`
          ).join('\n\n');
          
          // Return a message that CopilotKit can render with image generation suggestion
          return { 
            success: true, 
            message: `✅ LinkedIn article generated successfully! Your content is now displayed in the preview.\n\n**🎯 AI Content Improvement Recommendations:**\n\n${recommendationsMarkdown}\n\n**🖼️ Enhance Your Article with AI-Generated Images:**\n\nNow that your article is ready, you can make it even more engaging with professional LinkedIn-optimized images! Here are your options:\n\n• **Professional Style**: Clean, corporate aesthetics perfect for business audiences\n• **Creative Style**: Eye-catching visuals that boost social media engagement\n• **Industry-Specific**: Tailored imagery for your ${mapIndustry(args?.industry || prefs.industry)} industry\n\n*To generate images, simply ask: "Generate images for my LinkedIn article" or "Create professional images for this content"*\n\n*To get specific improvement guidance for any recommendation, type: "Help me improve [specific recommendation]"*`
          };
        } else {
          // Return a message with image generation suggestion even without recommendations
          return { 
            success: true, 
            message: `✅ LinkedIn article generated successfully! Your content is now displayed in the preview.\n\n**🖼️ Enhance Your Article with AI-Generated Images:**\n\nNow that your article is ready, you can make it even more engaging with professional LinkedIn-optimized images! Here are your options:\n\n• **Professional Style**: Clean, corporate aesthetics perfect for business audiences\n• **Creative Style**: Eye-catching visuals that boost social media engagement\n• **Industry-Specific**: Tailored imagery for your ${mapIndustry(args?.industry || prefs.industry)} industry\n\n*To generate images, simply ask: "Generate images for my LinkedIn article" or "Create professional images for this content"*`
          };
        }
      }
      // End loading state on error
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, message: res.error || 'Failed to generate LinkedIn article' };
    }
  });

  // LinkedIn Carousel Generation
  useCopilotActionTyped({
    name: 'generateLinkedInCarousel',
    description: 'Generate a LinkedIn carousel with multiple slides for visual content',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'number_of_slides', type: 'number', required: false }
    ],
    handler: async (args: any) => {
      const prefs = readPrefs();
      
      // Emit progress init for carousel
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
        steps: [
          { id: 'personalize', label: 'Personalizing topic & context' },
          { id: 'prepare_queries', label: 'Preparing research queries' },
          { id: 'research', label: 'Conducting research & analysis' },
          { id: 'grounding', label: 'Applying AI grounding' },
          { id: 'content_generation', label: 'Generating carousel slides' },
          { id: 'citations', label: 'Extracting citations' },
          { id: 'quality_analysis', label: 'Quality assessment' },
          { id: 'finalize', label: 'Finalizing & optimizing' }
        ]
      }}));
      
      // Start detailed progress tracking
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'personalize', 
          status: 'active',
          message: 'Analyzing topic, industry context, and target audience...'
        } 
      }));
      
      const res = await linkedInWriterApi.generateCarousel({
        topic: args?.topic || prefs.topic || 'Professional development tips',
        industry: mapIndustry(args?.industry || prefs.industry),
        number_of_slides: args?.number_of_slides || prefs.number_of_slides || 8,
        tone: mapTone(args?.tone || prefs.tone),
        target_audience: args?.target_audience || prefs.target_audience || 'Professionals seeking growth',
        key_takeaways: args?.key_takeaways || prefs.key_takeaways || [],
        include_cover_slide: args?.include_cover_slide ?? (prefs.include_cover_slide ?? true),
        include_cta_slide: args?.include_cta_slide ?? (prefs.include_cta_slide ?? true),
        visual_style: args?.visual_style || prefs.visual_style || 'modern'
      });
      
      if (res.success && res.data) {
        // Update progress with detailed information
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'personalize', 
            status: 'completed',
            message: 'Topic personalized successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'prepare_queries', 
            status: 'completed',
            message: `Prepared research queries for carousel`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'research', 
            status: 'completed',
            message: `Research completed for carousel content`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'grounding', 
            status: 'completed',
            message: 'AI grounding applied successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'content_generation', 
            status: 'completed',
            message: `Generated ${res.data.slides?.length || 0} carousel slides`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'citations', 
            status: 'completed',
            message: 'Citations extracted for carousel'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'quality_analysis', 
            status: 'completed',
            message: 'Quality assessment completed'
          } 
        }));
        
        let content = `# ${res.data.title}\n\n`;
        res.data.slides.forEach((slide, index) => {
          content += `## Slide ${index + 1}: ${slide.title}\n\n${slide.content}\n\n`;
        });
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'finalize', 
            status: 'completed',
            message: 'Carousel finalized and optimized'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        
        return { success: true, content };
      }
      
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, message: res.error || 'Failed to generate LinkedIn carousel' };
    }
  });

  // LinkedIn Video Script Generation
  useCopilotActionTyped({
    name: 'generateLinkedInVideoScript',
    description: 'Generate a LinkedIn video script with hook, content, and captions',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'video_length', type: 'number', required: false }
    ],
    handler: async (args: any) => {
      const prefs = readPrefs();
      
      // Emit progress init for video script
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
        steps: [
          { id: 'personalize', label: 'Personalizing topic & context' },
          { id: 'prepare_queries', label: 'Preparing research queries' },
          { id: 'research', label: 'Conducting research & analysis' },
          { id: 'grounding', label: 'Applying AI grounding' },
          { id: 'content_generation', label: 'Generating video script' },
          { id: 'citations', label: 'Extracting citations' },
          { id: 'quality_analysis', label: 'Quality assessment' },
          { id: 'finalize', label: 'Finalizing & optimizing' }
        ]
      }}));
      
      // Start detailed progress tracking
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'personalize', 
          status: 'active',
          message: 'Analyzing topic, industry context, and target audience...'
        } 
      }));
      
      const res = await linkedInWriterApi.generateVideoScript({
        topic: args?.topic || prefs.topic || 'Professional networking tips',
        industry: mapIndustry(args?.industry || prefs.industry),
        video_length: args?.video_length || prefs.video_length || 60,
        tone: mapTone(args?.tone || prefs.tone),
        target_audience: args?.target_audience || prefs.target_audience || 'Professional networkers',
        key_messages: args?.key_messages || prefs.key_messages || [],
        include_hook: args?.include_hook ?? (prefs.include_hook ?? true),
        include_captions: args?.include_captions ?? (prefs.include_captions ?? true)
      });
      
      if (res.success && res.data) {
        // Update progress with detailed information
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'personalize', 
            status: 'completed',
            message: 'Topic personalized successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'prepare_queries', 
            status: 'completed',
            message: `Prepared research queries for video script`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'research', 
            status: 'completed',
            message: `Research completed for video content`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'grounding', 
            status: 'completed',
            message: 'AI grounding applied successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'content_generation', 
            status: 'completed',
            message: `Generated video script with ${res.data.main_content?.length || 0} scenes`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'citations', 
            status: 'completed',
            message: 'Citations extracted for video script'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'quality_analysis', 
            status: 'completed',
            message: 'Quality assessment completed'
          } 
        }));
        
        let content = `# Video Script: ${args?.topic || 'Professional Content'}\n\n`;
        content += `## Hook\n${res.data.hook}\n\n`;
        content += `## Main Content\n`;
        res.data.main_content.forEach((scene, index) => {
          content += `### Scene ${index + 1} (${scene.duration || '30s'})\n${scene.content}\n\n`;
        });
        content += `## Conclusion\n${res.data.conclusion}\n\n`;
        content += `## Video Description\n${res.data.video_description}\n\n`;
        
        if (res.data.captions) {
          content += `## Captions\n${res.data.captions.join('\n')}\n\n`;
        }
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'finalize', 
            status: 'completed',
            message: 'Video script finalized and optimized'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        
        return { success: true, content };
      }
      
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, message: res.error || 'Failed to generate LinkedIn video script' };
    }
  });

  // Content Improvement Action
  useCopilotActionTyped({
    name: 'improveContent',
    description: 'Improve specific aspects of LinkedIn content based on AI recommendations',
    parameters: [
      { name: 'recommendation', type: 'string', required: true },
      { name: 'current_content', type: 'string', required: false },
      { name: 'improvement_type', type: 'string', required: false }
    ],
    handler: async (args: any) => {
      const { recommendation } = args;
      
      // Analyze the recommendation and provide specific improvement guidance
      let improvementGuidance = '';
      let actionItems = [];
      let examples = [];
      
      if (recommendation.toLowerCase().includes('factual accuracy') || recommendation.toLowerCase().includes('accuracy')) {
        improvementGuidance = 'To improve factual accuracy, consider:';
        actionItems = [
          'Add specific data points and statistics',
          'Include recent research findings',
          'Cite authoritative sources',
          'Verify all claims against reliable sources'
        ];
        examples = [
          'Instead of "AI is growing rapidly", use "AI market grew 37% in 2023 according to Gartner"',
          'Replace "many companies" with "73% of Fortune 500 companies"',
          'Add source: "According to a 2024 McKinsey report..."'
        ];
      } else if (recommendation.toLowerCase().includes('professional tone') || recommendation.toLowerCase().includes('tone')) {
        improvementGuidance = 'To enhance professional tone, consider:';
        actionItems = [
          'Use industry-specific terminology',
          'Maintain consistent formality level',
          'Avoid casual language and slang',
          'Structure content with clear headings'
        ];
        examples = [
          'Instead of "cool new features", use "innovative capabilities"',
          'Replace "huge impact" with "significant impact"',
          'Use "Furthermore" instead of "Also"'
        ];
      } else if (recommendation.toLowerCase().includes('citation') || recommendation.toLowerCase().includes('sources')) {
        improvementGuidance = 'To improve citation coverage, consider:';
        actionItems = [
          'Add inline citations for factual claims',
          'Include source references for statistics',
          'Link to relevant research or reports',
          'Provide source list at the end'
        ];
        examples = [
          'Add [1] after statistics: "The market grew 25% [1]"',
          'Include source links: "According to [Harvard Business Review](link)..."',
          'Create a numbered source list at the bottom'
        ];
      } else if (recommendation.toLowerCase().includes('industry relevance') || recommendation.toLowerCase().includes('relevance')) {
        improvementGuidance = 'To increase industry relevance, consider:';
        actionItems = [
          'Use industry-specific examples',
          'Reference current industry trends',
          'Include relevant case studies',
          'Address industry-specific challenges'
        ];
        examples = [
          'Add industry-specific metrics: "In healthcare, this translates to..."',
          'Reference current trends: "With the rise of telemedicine..."',
          'Use industry jargon appropriately: "EMR integration" vs "electronic records"'
        ];
      } else {
        improvementGuidance = 'To address this recommendation, consider:';
        actionItems = [
          'Review the content for clarity',
          'Ensure consistency in messaging',
          'Check for grammatical accuracy',
          'Verify alignment with target audience'
        ];
        examples = [
          'Break long sentences into shorter ones',
          'Use consistent terminology throughout',
          'Check subject-verb agreement',
          'Ensure content matches audience expertise level'
        ];
      }
      
      const actionItemsMarkdown = actionItems.map((item, index) => 
        `${index + 1}. ${item}`
      ).join('\n');
      
      const examplesMarkdown = examples.map((example, index) => 
        `**Example ${index + 1}:** ${example}`
      ).join('\n\n');
      
      return {
        success: true,
        message: `**🔧 Content Improvement Guide for: "${recommendation}"**\n\n${improvementGuidance}\n\n${actionItemsMarkdown}\n\n**💡 Practical Examples:**\n\n${examplesMarkdown}\n\n*Would you like me to help you implement any of these improvements to your content?*`
      };
    }
  });

  // Natural Language Content Improvement Action
  useCopilotActionTyped({
    name: 'helpWithContentImprovement',
    description: 'Help users improve their LinkedIn content based on natural language requests',
    parameters: [
      { name: 'user_request', type: 'string', required: true }
    ],
    handler: async (args: any) => {
      const { user_request } = args;
      const request = user_request.toLowerCase();
      
      // Handle various ways users might ask for help
      if (request.includes('help me improve') || request.includes('how to improve') || request.includes('improve')) {
        // Extract the specific aspect they want to improve
        let aspect = 'content quality';
        if (request.includes('tone')) aspect = 'professional tone';
        else if (request.includes('accuracy') || request.includes('factual')) aspect = 'factual accuracy';
        else if (request.includes('citation') || request.includes('source')) aspect = 'citation coverage';
        else if (request.includes('relevance') || request.includes('industry')) aspect = 'industry relevance';
        else if (request.includes('grammar') || request.includes('language')) aspect = 'language quality';
        
        return {
          success: true,
          message: `I'd be happy to help you improve your ${aspect}! Let me provide specific guidance and examples.\n\n*Please use the "improveContent" action with the specific recommendation you'd like to address, or let me know what aspect you'd like to focus on.*`
        };
      }
      
      if (request.includes('recommendation') || request.includes('suggestion')) {
        return {
          success: true,
          message: `I can see you have several AI-generated recommendations for improving your content! Here's how to get specific help:\n\n**To get detailed improvement guidance:**\n• Type: "Help me improve [specific recommendation]"\n• Example: "Help me improve the professional tone"\n• Or: "How can I improve factual accuracy?"\n\n*Which specific recommendation would you like me to help you with?*`
        };
      }
      
      // Default response
      return {
        success: true,
        message: `I'm here to help you improve your LinkedIn content! You can:\n\n**1. Get specific improvement guidance:**\n• "Help me improve [specific recommendation]"\n• "How to improve professional tone?"\n• "Improve factual accuracy"\n\n**2. Ask general questions:**\n• "What are the best practices for LinkedIn posts?"\n• "How can I make my content more engaging?"\n\n*What would you like to improve today?*`
      };
    }
  });

  // LinkedIn Comment Response Generation
  useCopilotActionTyped({
    name: 'generateLinkedInCommentResponse',
    description: 'Generate a professional response to a LinkedIn comment',
    parameters: [
      { name: 'original_post', type: 'string', required: false },
      { name: 'comment', type: 'string', required: false },
      { name: 'response_type', type: 'string', required: false }
    ],
    handler: async (args: any) => {
      const prefs = readPrefs();
      const res = await linkedInWriterApi.generateCommentResponse({
        original_post: args?.original_post || prefs.original_post || 'Sample LinkedIn post content',
        comment: args?.comment || prefs.comment || 'Sample comment to respond to',
        response_type: args?.response_type || prefs.response_type || 'professional',
        tone: mapTone(args?.tone || prefs.tone),
        include_question: args?.include_question ?? (prefs.include_question ?? false),
        brand_voice: args?.brand_voice || prefs.brand_voice
      });
      
      if (res.success && res.response) {
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: res.response }));
        return { success: true, content: res.response };
      }
      return { success: false, message: res.error || 'Failed to generate LinkedIn comment response' };
    }
  });

  // LinkedIn Profile Optimization (Coming Soon)
  useCopilotActionTyped({
    name: 'optimizeLinkedInProfile',
    description: 'Optimize LinkedIn profile sections for better professional visibility',
    parameters: [
      { name: 'current_headline', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'experience_level', type: 'string', required: false }
    ],
    handler: async () => {
      showToastNotification('LinkedIn Profile Optimization is coming soon! Stay tuned for this feature.', 'info');
      return { success: false, message: 'Feature coming soon' };
    }
  });

  // LinkedIn Poll Generation (Coming Soon)
  useCopilotActionTyped({
    name: 'generateLinkedInPoll',
    description: 'Generate an engaging LinkedIn poll with professional questions',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'poll_type', type: 'string', required: false }
    ],
    handler: async () => {
      showToastNotification('LinkedIn Poll Generation is coming soon! Stay tuned for this feature.', 'info');
      return { success: false, message: 'Feature coming soon' };
    }
  });

  // LinkedIn Company Update Generation (Coming Soon)
  useCopilotActionTyped({
    name: 'generateLinkedInCompanyUpdate',
    description: 'Generate a professional company update for LinkedIn',
    parameters: [
      { name: 'company_name', type: 'string', required: false },
      { name: 'update_type', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false }
    ],
    handler: async () => {
      showToastNotification('LinkedIn Company Update Generation is coming soon! Stay tuned for this feature.', 'info');
      return { success: false, message: 'Feature coming soon' };
    }
  });

  return null;
};

export default RegisterLinkedInActions;
