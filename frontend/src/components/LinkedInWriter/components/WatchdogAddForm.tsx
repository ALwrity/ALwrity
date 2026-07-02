import React, { useEffect, useRef, useState } from 'react';
import { linkedInWatchdogApi } from '../../../services/linkedInWatchdogApi';

type AddType = 'industry' | 'company' | 'person';

interface WatchdogAddFormProps {
  initialType?: AddType;
  onSave: () => void;
  onCancel: () => void;
}

interface ExaSuggestion {
  id: string;
  title: string;
  url: string;
  text: string;
  industry: string | null;
  position: string | null;
  company: string | null;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 2;
const MAX_SUGGESTIONS = 6;

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

  // ── Exa discovery state ──────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<ExaSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [userTyped, setUserTyped] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const suggestionsSeqRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset suggestion state when switching types — different vertical.
  useEffect(() => {
    setSuggestions([]);
    setSuggestionsError(null);
    setShowSuggestions(false);
    setActiveIndex(-1);
    setUserTyped(false);
  }, [type]);

  // Click outside the suggestion container dismisses the dropdown.
  useEffect(() => {
    if (!showSuggestions) return;
    const onDocClick = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showSuggestions]);

  const extractIndustry = (entry: any): string | null => {
    const entities = Array.isArray(entry?.entities) ? entry.entities : [];
    for (const e of entities) {
      const props = e?.properties || {};
      const v = props.industry || props.industries || props.sector;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  const extractPosition = (entry: any): string | null => {
    const entities = Array.isArray(entry?.entities) ? entry.entities : [];
    for (const e of entities) {
      const props = e?.properties || {};
      const v = props.position || props.title || props.role || props.jobTitle;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  const extractCompany = (entry: any): string | null => {
    const entities = Array.isArray(entry?.entities) ? entry.entities : [];
    for (const e of entities) {
      const props = e?.properties || {};
      const v = props.company || props.employer || props.organization;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  const buildSuggestions = (entries: any[]): ExaSuggestion[] => {
    const out: ExaSuggestion[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const title = String(entry?.title || '').trim();
      const url = String(entry?.url || '').trim();
      if (!title && !url) continue;
      const key = title.toLowerCase() + '|' + url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: key,
        title: title || url,
        url,
        text: String(entry?.text || '').trim(),
        industry: extractIndustry(entry),
        position: extractPosition(entry),
        company: extractCompany(entry),
      });
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
  };

  // Debounced search-as-you-type. Only fires for company / person.
  useEffect(() => {
    if (type !== 'company' && type !== 'person') return;
    if (!userTyped) return;
    const q = name.trim();
    if (q.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const seq = ++suggestionsSeqRef.current;
    debounceRef.current = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      setSuggestionsError(null);
      setShowSuggestions(true);
      setActiveIndex(-1);
      try {
        const res =
          type === 'company'
            ? await linkedInWatchdogApi.discoverCompanies({ query: q, num_results: MAX_SUGGESTIONS })
            : await linkedInWatchdogApi.discoverPeople({ query: q, num_results: MAX_SUGGESTIONS });
        if (seq !== suggestionsSeqRef.current) return; // stale
        if (!res?.success) {
          setSuggestions([]);
          setSuggestionsError('Could not search Exa — try again in a moment.');
          return;
        }
        const built = buildSuggestions(res.results || []);
        setSuggestions(built);
        if (built.length === 0) {
          setSuggestionsError('No matches found. Type the full name manually.');
        }
      } catch (e: any) {
        if (seq !== suggestionsSeqRef.current) return;
        setSuggestions([]);
        // Subscription-limit (429) carries a friendly message.
        const detail = e?.response?.data?.detail;
        const msg =
          (typeof detail === 'object' && detail?.message) ||
          e?.message ||
          'Search failed.';
        setSuggestionsError(msg);
      } finally {
        if (seq === suggestionsSeqRef.current) {
          setSuggestionsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // We intentionally exclude `name` from deps; the debounce reads the
    // latest value through `name` at call time and `userTyped` triggers
    // a fresh effect run on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTyped, type]);

  const applySuggestion = (s: ExaSuggestion) => {
    setName(s.title);
    if (type === 'company') {
      if (s.url) setUrl(s.url);
      if (s.industry) setIndustryTag(s.industry);
    } else if (type === 'person') {
      if (s.position) setTitle(s.position);
      if (s.company) setCompany(s.company);
      // Only set linkedin_url if the suggestion URL is a LinkedIn profile.
      if (s.url && /linkedin\.com\/in\//i.test(s.url)) {
        setLinkedinUrl(s.url);
      }
    }
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

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

  const showSearchEnabled = type === 'company' || type === 'person';
  const dropdownId = `watchdog-add-suggestions-${type}`;

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
        <div ref={containerRef} style={{ position: 'relative' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Name *
            {showSearchEnabled && (
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
                (type to search Exa)
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setUserTyped(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={handleNameKeyDown}
            placeholder={type === 'industry' ? 'e.g. AI in Healthcare' : type === 'company' ? 'e.g. Anthropic' : 'e.g. Dario Amodei'}
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls={dropdownId}
            aria-autocomplete="list"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
          {showSearchEnabled && showSuggestions && (
            <div
              id={dropdownId}
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                maxHeight: 320,
                overflowY: 'auto',
                zIndex: 20,
              }}
            >
              {suggestionsLoading && (
                <div
                  style={{
                    padding: '10px 12px',
                    fontSize: 12,
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      border: '2px solid #0a66c2',
                      borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                    }}
                    aria-hidden
                  />
                  Searching Exa…
                </div>
              )}
              {!suggestionsLoading && suggestionsError && (
                <div
                  style={{
                    padding: '10px 12px',
                    fontSize: 12,
                    color: '#b91c1c',
                  }}
                >
                  {suggestionsError}
                </div>
              )}
              {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                  No matches — type the full name manually.
                </div>
              )}
              {!suggestionsLoading &&
                suggestions.map((s, i) => {
                  const isActive = i === activeIndex;
                  const subtitle =
                    type === 'company'
                      ? [s.industry, s.url && hostnameOf(s.url)]
                          .filter(Boolean)
                          .join(' · ')
                      : [s.position, s.company].filter(Boolean).join(' · ');
                  return (
                    <div
                      key={s.id}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(e) => {
                        // mousedown so the input doesn't lose focus first.
                        e.preventDefault();
                        applySuggestion(s);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      style={{
                        padding: '8px 12px',
                        background: isActive ? '#eff6ff' : '#ffffff',
                        borderBottom:
                          i < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#0f172a',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.title}
                      </div>
                      {subtitle && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {subtitle}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
