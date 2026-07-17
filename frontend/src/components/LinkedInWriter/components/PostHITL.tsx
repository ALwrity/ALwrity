import React from 'react';
import { linkedInWriterApi, LinkedInPostRequest } from '../../../services/linkedInWriterApi';
import { 
  readPrefs, 
  writePrefs, 
  logAssistant, 
  mapPostType, 
  mapTone, 
  mapIndustry,
  mapSearchEngine,
  getPersonalizedPlaceholder,
  VALID_POST_TYPES,
  VALID_TONES,
  VALID_INDUSTRIES,
  VALID_SEARCH_ENGINES
} from '../utils/linkedInWriterUtils';
import {
  assembleLinkedInPostContent,
  DEFAULT_LINKEDIN_POST_MAX_LENGTH,
  joinHashtagSuggestions,
} from '../utils/linkedInPostAssembly';

interface PostHITLProps {
  args: any;
  respond: (data: any) => void;
}

const PostHITL: React.FC<PostHITLProps> = ({ args, respond }) => {
  const prefs = React.useMemo(() => readPrefs(), []);
  const [form, setForm] = React.useState<LinkedInPostRequest>({
    topic: args?.topic || prefs.topic || 'AI transformation in business',
    industry: args?.industry || prefs.industry || 'Technology',
    post_type: args?.post_type || prefs.post_type || 'professional',
    tone: args?.tone || prefs.tone || 'professional',
    target_audience: args?.target_audience || prefs.target_audience || 'Business leaders and professionals',
    key_points: args?.key_points || prefs.key_points || [],
    include_hashtags: args?.include_hashtags ?? (prefs.include_hashtags ?? true),
    include_call_to_action: args?.include_call_to_action ?? (prefs.include_call_to_action ?? true),
    research_enabled: args?.research_enabled ?? (prefs.research_enabled ?? true),
    search_engine: args?.search_engine || prefs.search_engine || 'google',
    max_length: args?.max_length || prefs.max_length || DEFAULT_LINKEDIN_POST_MAX_LENGTH
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Emit loading start event
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', {
        detail: {
          action: 'Generating LinkedIn Post',
          message: `Creating a ${form.post_type} LinkedIn post about "${form.topic}". Please consider your target audience, tone, and any specific requirements you've provided.`
        }
      }));
      
      const payload: LinkedInPostRequest = {
        ...form,
        post_type: mapPostType(form.post_type),
        tone: mapTone(form.tone),
        industry: mapIndustry(form.industry),
        search_engine: mapSearchEngine(form.search_engine)
      };

      // Save user preferences
      writePrefs({
        topic: payload.topic,
        industry: payload.industry,
        post_type: payload.post_type,
        tone: payload.tone,
        target_audience: payload.target_audience,
        key_points: payload.key_points,
        include_hashtags: payload.include_hashtags,
        include_call_to_action: payload.include_call_to_action,
        research_enabled: payload.research_enabled,
        search_engine: payload.search_engine,
        max_length: payload.max_length
      });

      const res = await linkedInWriterApi.generatePost(payload);
      
      if (res.success && res.data) {
        const fullContent = assembleLinkedInPostContent({
          content: res.data.content,
          hashtags: joinHashtagSuggestions(res.data.hashtags),
          callToAction: res.data.call_to_action || '',
          includeHashtags: payload.include_hashtags,
          includeCallToAction: payload.include_call_to_action,
        });
        
        // Emit loading end event
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd', { detail: {} }));
        
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: fullContent }));
        logAssistant(fullContent);
        respond({ success: true, content: fullContent });
      } else {
        const errorMsg = res.error || 'Failed to generate LinkedIn post';
        setError(errorMsg);
        
        // Emit loading end event with error
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd', { 
          detail: { error: errorMsg } 
        }));
        
        respond({ success: false, message: errorMsg });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to generate LinkedIn post';
      setError(msg);
      
      // Emit loading end event with error
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd', { 
        detail: { error: msg } 
      }));
      
      respond({ success: false, message: msg });
      console.error('[LinkedIn Writer] post.generate error', e);
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof LinkedInPostRequest, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const addKeyPoint = () => {
    set('key_points', [...(form.key_points || []), '']);
  };

  const updateKeyPoint = (index: number, value: string) => {
    const newKeyPoints = [...(form.key_points || [])];
    newKeyPoints[index] = value;
    set('key_points', newKeyPoints);
  };

  const removeKeyPoint = (index: number) => {
    const newKeyPoints = [...(form.key_points || [])];
    newKeyPoints.splice(index, 1);
    set('key_points', newKeyPoints);
  };

  return (
    <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 8, border: '1px solid #e9ecef' }}>
      <div style={{ fontWeight: 600, marginBottom: 16, color: '#0a66c2', fontSize: 18 }}>
        Generate LinkedIn Post
      </div>
      
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Topic *
          </label>
          <input
            placeholder={getPersonalizedPlaceholder('post', 'topic', prefs)}
            value={form.topic}
            onChange={e => set('topic', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Industry *
          </label>
          <select
            value={form.industry}
            onChange={e => set('industry', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            {VALID_INDUSTRIES.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Post Type
          </label>
          <select
            value={form.post_type}
            onChange={e => set('post_type', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            {VALID_POST_TYPES.map(type => (
              <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Tone
          </label>
          <select
            value={form.tone}
            onChange={e => set('tone', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            {VALID_TONES.map(tone => (
              <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Target Audience
          </label>
          <input
            placeholder={getPersonalizedPlaceholder('post', 'target_audience', prefs)}
            value={form.target_audience}
            onChange={e => set('target_audience', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Key Points
          </label>
          {(form.key_points || []).map((point, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                placeholder={`Key point ${index + 1}`}
                value={point}
                onChange={e => updateKeyPoint(index, e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
              <button
                onClick={() => removeKeyPoint(index)}
                style={{
                  padding: '8px 12px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addKeyPoint}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Add Key Point
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.include_hashtags}
              onChange={e => set('include_hashtags', e.target.checked)}
            />
            Include Hashtags
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.include_call_to_action}
              onChange={e => set('include_call_to_action', e.target.checked)}
            />
            Include CTA
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.research_enabled}
              onChange={e => set('research_enabled', e.target.checked)}
            />
            Enable Research
          </label>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
              Search Engine
            </label>
            <select
              value={form.search_engine}
              onChange={e => set('search_engine', e.target.value)}
              disabled={!form.research_enabled}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14,
                opacity: form.research_enabled ? 1 : 0.6
              }}
            >
              {VALID_SEARCH_ENGINES.map(engine => (
                <option key={engine} value={engine}>{engine.charAt(0).toUpperCase() + engine.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#333' }}>
            Max Length (characters)
          </label>
          <input
            type="number"
            min="100"
            max="3000"
            value={form.max_length}
            onChange={e =>
              set('max_length', parseInt(e.target.value) || DEFAULT_LINKEDIN_POST_MAX_LENGTH)
            }
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14
            }}
          />
          <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
            Default {DEFAULT_LINKEDIN_POST_MAX_LENGTH} keeps posts near the “see more” soft limit;
            LinkedIn hard max is 3,000. Longer posts are allowed if you raise this.
          </div>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '12px 24px',
          background: loading ? '#6c757d' : '#0a66c2',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 16,
          fontWeight: 500
        }}
      >
        {loading ? 'Generating...' : 'Generate LinkedIn Post'}
      </button>

      {error && (
        <div style={{ 
          marginTop: 12, 
          color: '#dc3545', 
          fontSize: 14, 
          padding: '8px 12px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: 4
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default PostHITL;
