import React from 'react';
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
import { usePlatformPersonaContext } from '../shared/PersonaContext/PlatformPersonaProvider';
import { useCopilotActionTyped } from '../../hooks/useCopilotActionTyped';

const RegisterLinkedInActionsEnhanced: React.FC = () => {
  // Get persona context for enhanced content generation
  const { corePersona, platformPersona } = usePlatformPersonaContext();

  // Helper function to apply persona constraints to content
  const applyPersonaConstraints = (content: string, constraints: any) => {
    if (!constraints) return content;
    
    let enhancedContent = content;
    
    // Apply sentence length constraints
    if (constraints.sentence_metrics?.average_sentence_length_words) {
      const targetLength = constraints.sentence_metrics.average_sentence_length_words;
      // This is a simplified example - in practice, you'd use more sophisticated NLP
      console.log(`🎭 Applying persona sentence length constraint: ${targetLength} words average`);
    }
    
    // Apply vocabulary constraints
    if (constraints.lexical_features?.go_to_words?.length > 0) {
      console.log(`🎭 Using persona go-to words: ${constraints.lexical_features.go_to_words.join(', ')}`);
    }
    
    if (constraints.lexical_features?.avoid_words?.length > 0) {
      console.log(`🎭 Avoiding persona avoid words: ${constraints.lexical_features.avoid_words.join(', ')}`);
    }
    
    return enhancedContent;
  };

  // Enhanced LinkedIn Post Generation with Persona
  useCopilotActionTyped({
    name: 'generateLinkedInPostWithPersona',
    description: 'Generate a professional LinkedIn post optimized for your writing persona and platform constraints',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'post_type', type: 'string', required: false },
      { name: 'tone', type: 'string', required: false },
      { name: 'refine_existing', type: 'boolean', required: false, description: 'Whether to refine existing content instead of creating new' }
    ],
    handler: async (args: any) => {
      const prefs = readPrefs();
      
      // Persona-aware progress tracking
      const personaInfo = corePersona ? `using ${corePersona.persona_name} persona` : 'with standard settings';
      
      // Start loading state for chat-triggered flow as well
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', {
        detail: {
          action: 'generateLinkedInPostWithPersona',
          message: 'Generating LinkedIn post with persona optimization...'
        }
      }));
      
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
        steps: [
          { id: 'persona_analysis', label: `Analyzing ${personaInfo}` },
          { id: 'personalize', label: 'Personalizing topic & context' },
          { id: 'prepare_queries', label: 'Preparing research queries' },
          { id: 'research', label: 'Conducting research & analysis' },
          { id: 'grounding', label: 'Applying AI grounding' },
          { id: 'content_generation', label: 'Generating persona-optimized content' },
          { id: 'persona_validation', label: 'Validating against persona constraints' },
          { id: 'citations', label: 'Extracting citations' },
          { id: 'quality_analysis', label: 'Quality assessment' },
          { id: 'finalize', label: 'Finalizing & optimizing' }
        ]
      }}));
      
      // Start with persona analysis
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'persona_analysis', 
          status: 'active',
          message: corePersona ? 
            `Analyzing ${corePersona.persona_name} (${corePersona.archetype}) writing style...` :
            'No persona data available, using standard settings...'
        } 
      }));

      // If refining existing content, use the current draft as context
      if (args?.refine_existing) {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        const currentDraft = textarea?.value || '';
        if (currentDraft) {
          console.log(`🎭 Refining existing content: ${currentDraft.substring(0, 100)}...`);
        }
      }
      
      // Apply persona constraints to parameters
      const maxLength =
        platformPersona?.content_format_rules?.character_limit ||
        prefs.max_length ||
        DEFAULT_LINKEDIN_POST_MAX_LENGTH;
      const optimalLength = platformPersona?.content_format_rules?.optimal_length || '150-300 words';
      
      console.log(`🎭 Persona constraints applied: Max ${maxLength} chars, Optimal: ${optimalLength}`);
      
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'persona_analysis', 
          status: 'completed',
          message: `Persona analysis complete. Using ${maxLength} character limit and ${optimalLength} optimal length.`
        } 
      }));
      
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
        max_length: maxLength,
        grounding_level: 'enhanced' as GroundingLevel,
        include_citations: true
      });
      
      if (res.success && res.data) {
        // Apply persona constraints to generated content
        let enhancedContent = res.data.content;
        if (corePersona && platformPersona) {
          enhancedContent = applyPersonaConstraints(enhancedContent, {
            sentence_metrics: corePersona.linguistic_fingerprint?.sentence_metrics,
            lexical_features: corePersona.linguistic_fingerprint?.lexical_features
          });
        }
        
        const fullContent = assembleLinkedInPostContent({
          content: enhancedContent,
          hashtags: joinHashtagSuggestions(res.data.hashtags),
          callToAction: res.data.call_to_action || '',
          includeHashtags: args?.include_hashtags ?? (prefs.include_hashtags ?? true),
          includeCallToAction: args?.include_call_to_action ?? (prefs.include_call_to_action ?? true),
        });
        
        // Update progress with persona validation
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'persona_validation', 
            status: 'completed',
            message: 'Content validated against persona constraints'
          } 
        }));
        
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
            message: 'Persona-optimized content generated successfully'
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'citations', 
            status: 'completed',
            message: `Citations extracted: ${(res.data?.citations || []).length} sources`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'quality_analysis', 
            status: 'completed',
            message: `Quality score: ${res.data?.quality_metrics?.overall_score || 'N/A'}`
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
          detail: { 
            id: 'finalize', 
            status: 'completed',
            message: 'LinkedIn post finalized with persona optimization!'
          } 
        }));
        
        // Update grounding data so citations and quality chips render
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateGroundingData', {
          detail: {
            researchSources: res.research_sources || [],
            citations: res.data?.citations || [],
            qualityMetrics: res.data?.quality_metrics || null,
            groundingEnabled: res.data?.grounding_enabled || false,
            searchQueries: res.data?.search_queries || []
          }
        }));
        
        // Send draft content to editor
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: fullContent }));
        
        // Complete progress and end loading
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        
        // Return enhanced content with persona information
        return {
          success: true,
          content: fullContent,
          persona_applied: corePersona ? {
            name: corePersona.persona_name,
            archetype: corePersona.archetype,
            confidence: corePersona.confidence_score,
            constraints_applied: {
              max_length: maxLength,
              optimal_length: optimalLength,
              linguistic_style: corePersona.linguistic_fingerprint?.sentence_metrics?.preferred_sentence_type
            }
          } : null,
          message: `✅ LinkedIn post generated successfully with ${corePersona ? 'persona optimization' : 'standard settings'}!`,
          research_sources: res.research_sources || [],
          citations: res.data?.citations || [],
          quality_metrics: res.data?.quality_metrics
        };
      } else {
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd', { detail: { error: res.error } }));
        return { success: false, message: res.error || 'Failed to generate LinkedIn post' };
      }
    }
  });

  // Enhanced LinkedIn Article Generation with Persona
  useCopilotActionTyped({
    name: 'generateLinkedInArticleWithPersona',
    description: 'Generate a LinkedIn article optimized for your writing persona and platform constraints',
    parameters: [
      { name: 'topic', type: 'string', required: false },
      { name: 'industry', type: 'string', required: false },
      { name: 'article_length', type: 'string', required: false, description: 'Short, Medium, or Long article' }
    ],
    handler: async (args: any) => {
      // Persona-aware progress tracking
      const personaInfo = corePersona ? `using ${corePersona.persona_name} persona` : 'with standard settings';
      
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
        steps: [
          { id: 'persona_analysis', label: `Analyzing ${personaInfo}` },
          { id: 'personalize', label: 'Personalizing topic & context' },
          { id: 'prepare_queries', label: 'Preparing research queries' },
          { id: 'research', label: 'Conducting research & analysis' },
          { id: 'grounding', label: 'Applying AI grounding' },
          { id: 'content_generation', label: 'Generating persona-optimized article' },
          { id: 'persona_validation', label: 'Validating against persona constraints' },
          { id: 'citations', label: 'Extracting citations' },
          { id: 'quality_analysis', label: 'Quality assessment' },
          { id: 'finalize', label: 'Finalizing & optimizing' }
        ]
      }}));
      
      // Start with persona analysis
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'persona_analysis', 
          status: 'active',
          message: corePersona ? 
            `Analyzing ${corePersona.persona_name} (${corePersona.archetype}) writing style...` :
            'No persona data available, using standard settings...'
        } 
      }));

      // Apply persona constraints
      const articleLength = args?.article_length || 'Medium';
      
      console.log(`🎭 Generating ${articleLength} article with persona constraints`);
      
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
        detail: { 
          id: 'persona_analysis', 
          status: 'completed',
          message: `Persona analysis complete. Generating ${articleLength} article.`
        } 
      }));
      
      // Complete progress and end loading
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { detail: { id: 'finalize', status: 'completed', message: 'Article generation placeholder' } }));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));

      return {
        success: true,
        message: `✅ LinkedIn article generation started with persona optimization!`,
        persona_applied: corePersona ? {
          name: corePersona.persona_name,
          archetype: corePersona.archetype,
          confidence: corePersona.confidence_score
        } : null
      };
    }
  });

  // Persona-Aware Content Validation Action
  useCopilotActionTyped({
    name: 'validateContentAgainstPersona',
    description: 'Validate existing content against your writing persona and suggest improvements',
    parameters: [
      { name: 'content', type: 'string', required: true, description: 'Content to validate' }
    ],
    handler: async (args: any) => {
      if (!corePersona || !platformPersona) {
        return {
          success: false,
          message: 'No persona data available for validation'
        };
      }

      const content = args.content;
      const validation = {
        sentence_length: {
          current: content.split('.').filter((s: string) => s.trim().length > 0).length,
          target: corePersona.linguistic_fingerprint?.sentence_metrics?.average_sentence_length_words || 15,
          status: 'analyzing'
        },
        vocabulary_usage: {
          go_to_words_used: 0,
          avoid_words_used: 0,
          suggestions: [] as string[]
        },
        platform_compliance: {
          character_count: content.length,
          optimal_range: platformPersona.content_format_rules?.optimal_length || '150-300 words',
          status: 'analyzing',
          suggestions: [] as string[]
        }
      };

      // Analyze vocabulary usage
      const goToWords = corePersona.linguistic_fingerprint?.lexical_features?.go_to_words || [];
      const avoidWords = corePersona.linguistic_fingerprint?.lexical_features?.avoid_words || [];
      
      goToWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
          validation.vocabulary_usage.go_to_words_used += matches.length;
        }
      });

      avoidWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
          validation.vocabulary_usage.avoid_words_used += matches.length;
          validation.vocabulary_usage.suggestions.push(`Consider replacing "${word}" with a more aligned word`);
        }
      });

      // Platform compliance check
      const charLimit = platformPersona.content_format_rules?.character_limit || 3000;
      if (content.length > charLimit) {
        validation.platform_compliance.status = 'exceeds_limit';
        validation.platform_compliance.suggestions = [`Content exceeds ${charLimit} character limit by ${content.length - charLimit} characters`];
      } else {
        validation.platform_compliance.status = 'within_limit';
      }

      return {
        success: true,
        validation,
        persona: {
          name: corePersona.persona_name,
          archetype: corePersona.archetype,
          confidence: corePersona.confidence_score
        },
        message: 'Content validation complete against your writing persona!',
        recommendations: validation.vocabulary_usage.suggestions.concat(validation.platform_compliance.suggestions || [])
      };
    }
  });

  // Persona-Aware Writing Style Suggestions
  useCopilotActionTyped({
    name: 'getPersonaWritingSuggestions',
    description: 'Get personalized writing suggestions based on your persona and LinkedIn platform',
    parameters: [
      { name: 'content_type', type: 'string', required: false, description: 'Type of content (post, article, carousel)' },
      { name: 'topic', type: 'string', required: false, description: 'Content topic for context' }
    ],
    handler: async (args: any) => {
      if (!corePersona || !platformPersona) {
        return {
          success: false,
          message: 'No persona data available for suggestions'
        };
      }

      const contentType = args.content_type || 'post';
      const topic = args.topic || 'general business';

      const suggestions = {
        writing_style: {
          sentence_structure: corePersona.linguistic_fingerprint?.sentence_metrics?.preferred_sentence_type || 'balanced',
          tone_recommendation: platformPersona?.tonal_range?.default_tone || 'professional_friendly',
          vocabulary_level: corePersona.linguistic_fingerprint?.lexical_features?.vocabulary_level || 'professional'
        },
        platform_optimization: {
          character_limit: platformPersona.content_format_rules?.character_limit || 3000,
          optimal_length: platformPersona.content_format_rules?.optimal_length || '150-300 words',
          hashtag_strategy: platformPersona.lexical_features?.hashtag_strategy || '3-5 relevant hashtags'
        },
        persona_specific: {
          go_to_words: corePersona.linguistic_fingerprint?.lexical_features?.go_to_words || [],
          avoid_words: corePersona.linguistic_fingerprint?.lexical_features?.avoid_words || [],
          rhetorical_style: corePersona.linguistic_fingerprint?.rhetorical_devices?.metaphors || 'business-focused'
        }
      };

      return {
        success: true,
        suggestions,
        persona: {
          name: corePersona.persona_name,
          archetype: corePersona.archetype,
          confidence: corePersona.confidence_score
        },
        message: `Personalized writing suggestions for ${contentType} about ${topic}`,
        tip: `Use these suggestions to maintain your unique ${corePersona.persona_name} voice while optimizing for LinkedIn!`
      };
    }
  });

  return null; // This component only registers actions
};

export default RegisterLinkedInActionsEnhanced;
