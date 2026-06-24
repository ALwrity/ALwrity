import React, { useState } from 'react';
import { linkedInWatchdogApi } from '../../../services/linkedInWatchdogApi';

type AddType = 'industry' | 'company' | 'person';

interface WatchdogAddFormProps {
  initialType?: AddType;
  onSave: () => void;
  onCancel: () => void;
}

export const WatchdogAddForm: React.FC<WatchdogAddFormProps> = ({
  initialType = 'industry',
  onSave,
  onCancel,
}) => {
  const [type, setType] = useState<AddType>(initialType);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [industryTag, setIndustryTag] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [searchQueries, setSearchQueries] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const queries = searchQueries
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean);

      if (type === 'industry') {
        await linkedInWatchdogApi.createIndustry({ name: name.trim(), search_queries: queries.length ? queries : undefined });
      } else if (type === 'company') {
        await linkedInWatchdogApi.createCompany({
          name: name.trim(),
          url: url.trim() || undefined,
          industry_tag: industryTag.trim() || undefined,
          search_queries: queries.length ? queries : undefined,
        });
      } else {
        await linkedInWatchdogApi.createPerson({
          name: name.trim(),
          title: title.trim() || undefined,
          company: company.trim() || undefined,
          linkedin_url: linkedinUrl.trim() || undefined,
          search_queries: queries.length ? queries : undefined,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Type</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['industry', 'company', 'person'] as AddType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: type === t ? '2px solid #0a66c2' : '1px solid #d1d5db',
                background: type === t ? '#eff6ff' : '#fff',
                color: type === t ? '#0a66c2' : '#374151',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: type === t ? 600 : 400,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Name *</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'industry' ? 'e.g. AI in Healthcare' : type === 'company' ? 'e.g. Anthropic' : 'e.g. Dario Amodei'}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {type === 'company' && (
          <>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Website URL</div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. anthropic.com"
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Industry Tag</div>
              <input
                value={industryTag}
                onChange={(e) => setIndustryTag(e.target.value)}
                placeholder="e.g. AI"
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
          </>
        )}

        {type === 'person' && (
          <>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CEO"
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Company</div>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Anthropic"
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>LinkedIn URL</div>
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="e.g. https://linkedin.com/in/..."
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
          </>
        )}

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Search Queries <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional — one per line)</span>
          </div>
          <textarea
            value={searchQueries}
            onChange={(e) => setSearchQueries(e.target.value)}
            placeholder={type === 'industry'
              ? 'AI healthcare startups\nhealthcare AI regulation 2026'
              : type === 'company'
              ? 'Anthropic news product launches\nAnthropic funding partnerships'
              : 'Dario Amodei interview keynote\nDario Amodei AI safety'
            }
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Leave blank for auto-generated defaults
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: '#fff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          style={{
            padding: '8px 16px',
            background: !name.trim() || saving ? '#93c5fd' : '#0a66c2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: !name.trim() || saving ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {saving ? 'Creating (incl. monitors)...' : 'Add to Watchlist'}
        </button>
      </div>
    </div>
  );
};
