import React, { useState, useEffect, useCallback, useRef } from 'react';
import { linkedInWatchdogApi, type WatchdogUpdate, type WatchdogIndustry, type WatchdogCompany, type WatchdogPerson, type MonitorStatus } from '../../../services/linkedInWatchdogApi';
import { WatchdogPersistenceManager } from '../utils/watchdogPersistence';
import { WatchdogUpdateCard } from './WatchdogUpdateCard';
import { WatchdogAddForm } from './WatchdogAddForm';
import { ConfirmDialog } from './ConfirmDialog';
import { getLinkedInProfile } from '../../../api/linkedinSocial';

type Tab = 'industry' | 'company' | 'person';

interface WatchdogDashboardProps {
  onClose: () => void;
  onGeneratePost: (topic: string, context: string) => void;
  onUnreadChanged: (count: number) => void;
}

const RESPONSIVE_STYLES_ID = 'alwrity-watchdog-responsive';

function injectResponsiveStyles() {
  if (document.getElementById(RESPONSIVE_STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = RESPONSIVE_STYLES_ID;
  style.textContent = `
    @media (max-width: 600px) {
      .watchdog-modal { max-width: 100vw !important; max-height: 100vh !important; border-radius: 0 !important; width: 100% !important; }
      .watchdog-header { padding: 12px 14px !important; }
      .watchdog-header-title { font-size: 14px !important; }
      .watchdog-content { padding: 10px !important; }
      .watchdog-tab { font-size: 12px !important; padding: 10px 8px !important; }
      .watchdog-monitored-label { font-size: 10px !important; }
    }
    @keyframes alwrityLoadingShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .watchdog-skeleton {
      animation: watchdogSkeletonPulse 1.5s ease-in-out infinite;
    }
    @keyframes watchdogSkeletonPulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

const persistence = WatchdogPersistenceManager.getInstance();

const tabLabels: Record<Tab, string> = {
  industry: 'Industry News',
  company: 'Companies',
  person: 'People',
};

export const WatchdogDashboard: React.FC<WatchdogDashboardProps> = ({
  onClose,
  onGeneratePost,
  onUnreadChanged,
}) => {
  const [tab, setTab] = useState<Tab>('industry');
  const [industries, setIndustries] = useState<WatchdogIndustry[]>([]);
  const [companies, setCompanies] = useState<WatchdogCompany[]>([]);
  const [people, setPeople] = useState<WatchdogPerson[]>([]);
  const [updates, setUpdates] = useState<WatchdogUpdate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);
  const [monitors, setMonitors] = useState<MonitorStatus[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>(persistence.loadLastRefresh() || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ category: string; id: string; name: string } | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const prevUnreadRef = useRef(0);
  const isFirstAutoRefresh = useRef(true);

  const loadFromLocal = useCallback(() => {
    const saved = persistence.loadAll();
    setIndustries(saved.industries);
    setCompanies(saved.companies);
    setPeople(saved.people);
    setUpdates(saved.updates);
  }, []);

  const fetchFromApi = useCallback(async () => {
    try {
      const [allRes, updatesRes, monitorRes] = await Promise.all([
        linkedInWatchdogApi.getAll(),
        linkedInWatchdogApi.getUpdates(),
        linkedInWatchdogApi.getMonitorStatus().catch(() => null),
      ]);
      if (allRes.success) {
        setIndustries(allRes.industries);
        setCompanies(allRes.companies);
        setPeople(allRes.people);
        persistence.saveIndustries(allRes.industries);
        persistence.saveCompanies(allRes.companies);
        persistence.savePeople(allRes.people);
      }
      if (updatesRes.success) {
        setUpdates(updatesRes.updates);
        persistence.saveUpdates(updatesRes.updates);
        onUnreadChanged(updatesRes.unread_count);
      }
      if (monitorRes?.success) {
        setMonitors(monitorRes.monitors);
      }
    } catch {
      // localStorage data already loaded; API is best-effort
    } finally {
      setLoading(false);
    }
  }, [onUnreadChanged]);

  useEffect(() => {
    injectResponsiveStyles();
    loadFromLocal();
    fetchFromApi();
  }, [loadFromLocal, fetchFromApi]);

  // Auto-refresh while dashboard is open
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const updatesRes = await linkedInWatchdogApi.getUpdates();
        if (!updatesRes.success) return;
        const newUnread = updatesRes.unread_count;
        if (!isFirstAutoRefresh.current && newUnread > prevUnreadRef.current) {
          const delta = newUnread - prevUnreadRef.current;
          setToastMessage(`${delta} new update${delta > 1 ? 's' : ''} available`);
        }
        isFirstAutoRefresh.current = false;
        prevUnreadRef.current = newUnread;
        setUpdates(updatesRes.updates);
        persistence.saveUpdates(updatesRes.updates);
        onUnreadChanged(newUnread);
        const now = new Date().toISOString();
        setLastRefresh(now);
        persistence.saveLastRefresh(now);
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [onUnreadChanged]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleSyncMonitors = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await linkedInWatchdogApi.syncMonitors();
      if (res.success) {
        const monitorRes = await linkedInWatchdogApi.getMonitorStatus();
        if (monitorRes.success) setMonitors(monitorRes.monitors);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleTriggerMonitors = async () => {
    setTriggering(true);
    setError(null);
    try {
      await linkedInWatchdogApi.triggerMonitors();
      const monitorRes = await linkedInWatchdogApi.getMonitorStatus();
      if (monitorRes.success) setMonitors(monitorRes.monitors);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  };

  const getMonitorCount = (category: string, refId: string): { active: number; total: number } => {
    const cat = monitors.filter((m) => m.category === category && m.reference_id === refId);
    return { active: cat.filter((m) => m.status === 'active').length, total: cat.length };
  };

  const hasMonitors = monitors.some((m) => m.status === 'active');
  const totalActiveMonitors = monitors.filter((m) => m.status === 'active').length;

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const refreshRes = await linkedInWatchdogApi.refresh();
      if (refreshRes.success) {
        const updatesRes = await linkedInWatchdogApi.getUpdates();
        if (updatesRes.success) {
          setUpdates(updatesRes.updates);
          persistence.saveUpdates(updatesRes.updates);
          persistence.saveLastRefresh(new Date().toISOString());
          onUnreadChanged(updatesRes.unread_count);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await linkedInWatchdogApi.markUpdateRead(id);
    } catch { /* ignore */ }
    const updated = updates.map((u) => (u.id === id ? { ...u, is_read: true } : u));
    setUpdates(updated);
    persistence.saveUpdates(updated);
    onUnreadChanged(updated.filter((u) => !u.is_read).length);
  };

  const handleDeleteItem = (category: string, id: string, name: string) => {
    setConfirmDelete({ category, id, name });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { category, id } = confirmDelete;
    setDeletingItemId(id);
    setError(null);
    try {
      if (category === 'industry') await linkedInWatchdogApi.deleteIndustry(id);
      else if (category === 'company') await linkedInWatchdogApi.deleteCompany(id);
      else if (category === 'person') await linkedInWatchdogApi.deletePerson(id);
      setConfirmDelete(null);
      await fetchFromApi();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Delete failed');
      setConfirmDelete(null);
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchFromApi();
  };

  const handleGeneratePost = (update: WatchdogUpdate) => {
    onGeneratePost(
      update.title,
      `Topic: ${update.title}\nSummary: ${update.summary}\nSource: ${update.url}`
    );
    onClose();
  };

  const handlePersonalize = async () => {
    setPersonalizing(true);
    setError(null);
    try {
      const profileRes = await getLinkedInProfile();
      const industry = (profileRes.profile_context as any)?.industry
        || (profileRes.ai_profile_intelligence as any)?.industry
        || '';
      const company = (profileRes.profile as any)?.company || '';
      const name = (profileRes.profile as any)?.name || '';
      const headline = (profileRes.profile as any)?.headline || '';

      let added = 0;
      if (industry) {
        await linkedInWatchdogApi.createIndustry({ name: industry });
        added++;
      }
      if (company) {
        await linkedInWatchdogApi.createCompany({ name: company });
        added++;
      }
      if (added > 0) {
        await fetchFromApi();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not load profile. Connect LinkedIn first.');
    } finally {
      setPersonalizing(false);
    }
  };

  const handleSaved = () => {
    setShowAddForm(false);
    fetchFromApi();
  };

  const filteredUpdates = updates.filter((u) => u.category === tab);
  const watchedItems: (WatchdogIndustry | WatchdogCompany | WatchdogPerson)[] =
    tab === 'industry' ? industries : tab === 'company' ? companies : people;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="watchdog-modal" style={{
        background: '#fff',
        width: 800,
        maxWidth: '94vw',
        maxHeight: '90vh',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div className="watchdog-header" style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0a66c2 0%, #0056b3 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Industry Watchdog</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastRefresh && (
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: '6px 14px',
                background: refreshing ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Toast notification ── */}
        {toastMessage && (
          <div style={{
            padding: '8px 16px',
            background: '#ecfdf5',
            color: '#065f46',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #a7f3d0',
          }}>
            <span>📬 {toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="watchdog-tab-bar" style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          {(Object.entries(tabLabels) as [Tab, string][]).map(([key, label]) => {
            const count = updates.filter((u) => u.category === key && !u.is_read).length;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: tab === key ? '#fff' : 'transparent',
                  color: tab === key ? '#0a66c2' : '#6b7280',
                  border: 'none',
                  borderBottom: tab === key ? '2px solid #0a66c2' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: tab === key ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, position: 'relative' }}>
          {/* Thin loading bar when cached data is visible */}
          {loading && (watchedItems.length > 0 || filteredUpdates.length > 0) && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, #0a66c2 0%, #60a5fa 50%, #0a66c2 100%)',
              backgroundSize: '200% 100%',
              animation: 'alwrityLoadingShimmer 1.5s ease-in-out infinite',
              zIndex: 1,
            }} />
          )}

          {error && (
            <div style={{
              marginBottom: 12, padding: '10px 12px', background: '#fef2f2',
              color: '#dc2626', borderRadius: 6, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>{error}</span>
              <button
                onClick={handleRetry}
                style={{
                  padding: '4px 10px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Monitor status bar ── */}
        {monitors.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            marginBottom: 12,
            background: '#f0f7ff',
            borderRadius: 8,
            border: '1px solid #dbeafe',
            fontSize: 12,
            color: '#1e40af',
          }}>
            <span style={{ fontWeight: 600 }}>📡 Monitors</span>
            <span>{totalActiveMonitors} active</span>
            {!hasMonitors && (
              <span style={{ color: '#b45309' }}>— Click "Sync Monitors" to create</span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={handleSyncMonitors}
                disabled={syncing}
                style={{
                  padding: '4px 10px',
                  background: syncing ? '#dbeafe' : '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: 5,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {syncing ? 'Syncing...' : 'Sync Monitors'}
              </button>
              <button
                onClick={handleTriggerMonitors}
                disabled={triggering || !hasMonitors}
                style={{
                  padding: '4px 10px',
                  background: triggering || !hasMonitors ? '#f3f4f6' : '#ecfdf5',
                  color: triggering || !hasMonitors ? '#9ca3af' : '#059669',
                  border: `1px solid ${triggering || !hasMonitors ? '#e5e7eb' : '#a7f3d0'}`,
                  borderRadius: 5,
                  cursor: triggering || !hasMonitors ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {triggering ? 'Triggering...' : 'Run Now'}
              </button>
            </div>
          </div>
        )}

        {loading && watchedItems.length === 0 && filteredUpdates.length === 0 ? (
            /* ── Skeleton loader (first load, no cache) ── */
            <div style={{ padding: '20px 0' }}>
              <div className="watchdog-skeleton" style={{ height: 14, width: '40%', marginBottom: 16, borderRadius: 4, background: '#e5e7eb' }} />
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 4 }}>
                  <div className="watchdog-skeleton" style={{ width: 8, height: 8, borderRadius: 4, background: '#e5e7eb', flexShrink: 0 }} />
                  <div className="watchdog-skeleton" style={{ height: 12, flex: 1, borderRadius: 4, background: '#e5e7eb' }} />
                  <div className="watchdog-skeleton" style={{ width: 60, height: 10, borderRadius: 4, background: '#e5e7eb' }} />
                </div>
              ))}
              <div style={{ height: 1, background: '#f3f4f6', margin: '16px 0' }} />
              <div className="watchdog-skeleton" style={{ height: 14, width: '30%', marginBottom: 12, borderRadius: 4, background: '#e5e7eb' }} />
              {[1, 2].map((i) => (
                <div key={i} style={{ padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 10 }}>
                  <div className="watchdog-skeleton" style={{ height: 12, width: '25%', marginBottom: 8, borderRadius: 4, background: '#e5e7eb' }} />
                  <div className="watchdog-skeleton" style={{ height: 14, width: '70%', marginBottom: 6, borderRadius: 4, background: '#e5e7eb' }} />
                  <div className="watchdog-skeleton" style={{ height: 12, width: '50%', marginBottom: 8, borderRadius: 4, background: '#e5e7eb' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <div className="watchdog-skeleton" style={{ width: 70, height: 28, borderRadius: 6, background: '#e5e7eb' }} />
                    <div className="watchdog-skeleton" style={{ width: 100, height: 28, borderRadius: 6, background: '#e5e7eb' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : showAddForm ? (
            <WatchdogAddForm
              initialType={tab}
              onSave={handleSaved}
              onCancel={() => setShowAddForm(false)}
            />
          ) : watchedItems.length === 0 && filteredUpdates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
                No {tabLabels[tab].toLowerCase()} watched yet
              </div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>
                Add industries, companies, or people to monitor and get notified about the latest news.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{
                    padding: '10px 20px',
                    background: '#0a66c2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  + Add {tab === 'industry' ? 'Industry' : tab === 'company' ? 'Company' : 'Person'}
                </button>
                <button
                  onClick={handlePersonalize}
                  disabled={personalizing}
                  style={{
                    padding: '10px 20px',
                    background: personalizing ? '#e5e7eb' : '#fff',
                    color: personalizing ? '#9ca3af' : '#0a66c2',
                    border: '1px solid #0a66c2',
                    borderRadius: 8,
                    cursor: personalizing ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {personalizing ? 'Loading...' : 'Personalize from LinkedIn Profile'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{
                    padding: '6px 14px',
                    background: '#0a66c2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  + Add {tab === 'industry' ? 'Industry' : tab === 'company' ? 'Company' : 'Person'}
                </button>
              </div>

              {/* ── Watched items list ── */}
              {watchedItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div className="watchdog-monitored-label" style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Monitored {tabLabels[tab].toLowerCase()} ({watchedItems.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {watchedItems.map((item) => {
                      const m = getMonitorCount(tab, item.id);
                      const isDeleting = deletingItemId === item.id;
                      const isHovered = hoveredItemId === item.id;
                      return (
                        <div
                          key={item.id}
                          onMouseEnter={() => setHoveredItemId(item.id)}
                          onMouseLeave={() => setHoveredItemId(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            background: isDeleting ? '#fef2f2' : isHovered ? '#f3f4f6' : '#f9fafb',
                            borderRadius: 6,
                            fontSize: 12,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <span style={{
                            width: 8, height: 8, borderRadius: 4,
                            background: m.active > 0 ? '#22c55e' : '#d1d5db',
                            flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: 500, color: isDeleting ? '#dc2626' : '#374151', flex: 1 }}>
                            {(item as any).name || ''}
                          </span>
                          {isHovered && !isDeleting ? (
                            <button
                              onClick={() => handleDeleteItem(tab, item.id, (item as any).name || '')}
                              style={{
                                padding: '2px 8px',
                                background: 'transparent',
                                color: '#ef4444',
                                border: '1px solid #fca5a5',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                                lineHeight: '20px',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              Delete
                            </button>
                          ) : !isDeleting && (
                            <span style={{ color: '#9ca3af', fontSize: 11 }}>
                              {m.active > 0 ? `${m.active} active` : 'no monitor'}
                            </span>
                          )}
                          {isDeleting && (
                            <span style={{ color: '#dc2626', fontSize: 11, fontStyle: 'italic' }}>
                              deleting...
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredUpdates.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: 13 }}>
                    No recent updates. Click "Refresh" to check for new content.
                  </div>
                )}
                {filteredUpdates.map((update) => (
                  <WatchdogUpdateCard
                    key={update.id}
                    update={update}
                    onMarkRead={handleMarkRead}
                    onGeneratePost={handleGeneratePost}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {/* ── Confirm delete dialog ── */}
        <ConfirmDialog
          open={!!confirmDelete}
          title={`Remove ${confirmDelete?.category || ''}`}
          message={`Are you sure you want to remove "${confirmDelete?.name || ''}"? This will also delete its Exa Monitors and all associated updates.`}
          confirmLabel="Delete"
          destructive
          loading={!!deletingItemId}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setConfirmDelete(null); setDeletingItemId(null); }}
        />
      </div>
    </div>
  );
};
