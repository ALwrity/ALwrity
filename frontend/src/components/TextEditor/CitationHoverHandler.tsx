import React, { useEffect, useRef } from 'react';

interface CitationHoverHandlerProps {
  researchSources: any[];
}

const CitationHoverHandler: React.FC<CitationHoverHandlerProps> = ({ researchSources }) => {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Always attempt to attach hover listeners when .liw-cite elements exist,
    // even if researchSources hasn't loaded yet (e.g., page refresh with persisted draft).
    // Tooltip will show a minimal fallback if source data isn't available.

    // Prevent duplicate initialization on re-renders
    if (initializedRef.current) return;
    initializedRef.current = true;

    let currentTooltip: HTMLDivElement | null = null;
    const attachedListeners: Array<{ el: Element; type: string; handler: EventListener }> = [];

    const init = () => {
      try {
        const citations = document.querySelectorAll('.liw-cite');
        if (citations.length === 0) {
          setTimeout(init, 200);
          return;
        }

        citations.forEach((cite) => {
          const onEnter = () => {
            if (currentTooltip) {
              try { currentTooltip.remove(); } catch (_) {}
              currentTooltip = null;
            }
            document.querySelectorAll('.liw-cite-tip').forEach(t => t.remove());

            const idx = cite.getAttribute('data-source-index');
            if (!idx) return;
            const src = researchSources[parseInt(idx, 10) - 1];

            const tip = document.createElement('div');
            tip.className = 'liw-cite-tip';
            Object.assign(tip.style, {
              position: 'fixed',
              zIndex: '99999',
              maxWidth: '420px',
              background: '#fff',
              border: '1px solid #cfe9f7',
              borderRadius: '10px',
              boxShadow: '0 12px 40px rgba(10,102,194,0.18)',
              padding: '12px 14px',
              fontSize: '12px',
              color: '#1f2937'
            });

            if (src) {
              const title = (src.title || 'Untitled').replace(/</g, '&lt;');
              tip.innerHTML = [
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">',
                '<div style="font-weight:700;color:#0a66c2">Source ' + idx + '</div>',
                '<button class="liw-pin" style="border:none;background:#eef6ff;border-radius:8px;padding:4px 8px;cursor:pointer;color:#0a66c2;font-weight:800">📌</button>',
                '</div>',
                '<div style="font-weight:600;margin-bottom:6px;color:#1f2937">' + title + '</div>',
                '<a href="' + (src.url || '#') + '" target="_blank" style="color:#0a66c2;text-decoration:none;margin-bottom:8px;display:block;font-weight:600;">View Source →</a>',
                src.content ? '<div style="margin-bottom:8px;color:#374151;font-size:11px;line-height:1.4;background:#f9fafb;padding:8px;border-radius:6px;border-left:3px solid #0a66c2;">' + src.content + '</div>' : '',
                '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">',
                typeof src.relevance_score === 'number' ? '<span style="background:#eef6ff;border:1px solid #d9ecff;border-radius:999px;padding:4px 8px;font-size:11px;color:#055a8c;font-weight:600">Relevance: ' + Math.round(src.relevance_score * 100) + '%</span>' : '',
                typeof src.credibility_score === 'number' ? '<span style="background:#eef6ff;border:1px solid #d9ecff;border-radius:999px;padding:4px 8px;font-size:11px;color:#055a8c;font-weight:600">Credibility: ' + Math.round(src.credibility_score * 100) + '%</span>' : '',
                typeof src.domain_authority === 'number' ? '<span style="background:#eef6ff;border:1px solid #d9ecff;border-radius:999px;padding:4px 8px;font-size:11px;color:#055a8c;font-weight:600">Authority: ' + Math.round(src.domain_authority * 100) + '%</span>' : '',
                '</div>',
                src.source_type ? '<div style="color:#6b7280;font-size:11px;margin-bottom:4px">Type: <span style="color:#374151;font-weight:600">' + src.source_type.replace('_', ' ') + '</span></div>' : '',
                src.publication_date ? '<div style="color:#6b7280;font-size:11px">Published: <span style="color:#374151;font-weight:600">' + src.publication_date + '</span></div>' : ''
              ].join('');
            } else {
              tip.innerHTML = '<div style="font-weight:700;color:#0a66c2;margin-bottom:4px">Source ' + idx + '</div><div style="color:#64748b;font-size:11px">Source details will load after next generation.</div>';
            }

            document.body.appendChild(tip);
            const rect = cite.getBoundingClientRect();
            tip.style.left = Math.min(rect.left, window.innerWidth - 460) + 'px';
            tip.style.top = (rect.bottom + 8) + 'px';

            const pinBtn = tip.querySelector('.liw-pin');
            if (pinBtn && src) {
              pinBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openOverlay(idx, src);
                try { tip.remove(); } catch (_) {}
                currentTooltip = null;
              });
            }

            currentTooltip = tip;
          };

          const onLeave = () => {
            if (currentTooltip) {
              try { currentTooltip.remove(); } catch (_) {}
              currentTooltip = null;
            }
          };

          cite.addEventListener('mouseenter', onEnter);
          cite.addEventListener('mouseleave', onLeave);
          attachedListeners.push({ el: cite, type: 'mouseenter', handler: onEnter });
          attachedListeners.push({ el: cite, type: 'mouseleave', handler: onLeave });
        });
      } catch (_) {
        // Silently fail
      }
    };

    const openOverlay = (idx: string, src: any) => {
      const existing = document.getElementById('liw-cite-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'liw-cite-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(2px)', zIndex: '100000',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      });

      const modal = document.createElement('div');
      Object.assign(modal.style, {
        width: 'min(720px, 92vw)', maxHeight: '80vh', overflow: 'auto',
        borderRadius: '14px', background: '#fff', border: '1px solid #cfe9f7',
        boxShadow: '0 24px 80px rgba(10,102,194,0.25)', padding: '18px 20px'
      });

      const title = (src.title || 'Untitled').replace(/</g, '&lt;');
      modal.innerHTML = [
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">',
        '<div style="font-size:16px;font-weight:800;color:#0a66c2">Source ' + idx + '</div>',
        '<button id="liw-cite-close" style="border:none;background:#eff6ff;color:#0a66c2;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700">✕ Close</button>',
        '</div>',
        '<div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:8px">' + title + '</div>',
        '<a href="' + (src.url || '#') + '" target="_blank" style="display:inline-block;color:#0a66c2;text-decoration:none;margin-bottom:12px;font-size:14px;font-weight:600;">View Source →</a>',
        src.content ? '<div style="margin-bottom:16px;color:#374151;font-size:14px;line-height:1.6;background:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #0a66c2;">' + src.content + '</div>' : '',
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">',
        typeof src.relevance_score === 'number' ? '<span style="background:#eef6ff;border:1px solid #d9ecff;border-radius:999px;padding:8px 12px;font-size:13px;color:#055a8c;font-weight:600">Relevance: ' + Math.round(src.relevance_score * 100) + '%</span>' : '',
        typeof src.credibility_score === 'number' ? '<span style="background:#eef6ff;border:1px solid #d9ecff;border-radius:999px;padding:8px 12px;font-size:13px;color:#055a8c;font-weight:600">Credibility: ' + Math.round(src.credibility_score * 100) + '%</span>' : '',
        typeof src.domain_authority === 'number' ? '<span style="background:#eef6ff;border:1px solid #d9ecff;border-radius:999px;padding:8px 12px;font-size:13px;color:#055a8c;font-weight:600">Authority: ' + Math.round(src.domain_authority * 100) + '%</span>' : '',
        '</div>',
        '<div style="display:flex;gap:16px;color:#6b7280;font-size:13px;padding-top:12px;border-top:1px solid #e5e7eb">',
        src.source_type ? '<div>Type: <span style="color:#374151;font-weight:600">' + src.source_type.replace('_', ' ') + '</span></div>' : '',
        src.publication_date ? '<div>Published: <span style="color:#374151;font-weight:600">' + src.publication_date + '</span></div>' : '',
        '</div>'
      ].join('');

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const close = () => { try { overlay.remove(); } catch (_) {} };
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.getElementById('liw-cite-close')?.addEventListener('click', close);
      const escHandler = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
      document.addEventListener('keydown', escHandler);
    };

    const timer = setTimeout(init, 500);

    return () => {
      clearTimeout(timer);
      initializedRef.current = false;
      attachedListeners.forEach(({ el, type, handler }) => {
        el.removeEventListener(type, handler);
      });
      document.querySelectorAll('.liw-cite-tip').forEach(t => t.remove());
      const overlay = document.getElementById('liw-cite-overlay');
      if (overlay) overlay.remove();
    };
  }, [researchSources]);

  return null;
};

export default CitationHoverHandler;
