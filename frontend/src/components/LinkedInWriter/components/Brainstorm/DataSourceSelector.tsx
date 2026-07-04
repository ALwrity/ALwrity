import React from 'react';

export interface BrainstormOptions {
  usePersona: boolean;
  includeTrending: boolean;
  remarketContent: boolean;
}

interface DataSourceSelectorProps {
  options: BrainstormOptions;
  onChange: (updated: Partial<BrainstormOptions>) => void;
  connected: boolean;
}

interface CheckboxDef {
  key: keyof BrainstormOptions;
  label: string;
  icon: string;
  tooltip: string;
  requiresConnected: boolean;
  disabledTooltip: string;
}

const CHECKBOXES: CheckboxDef[] = [
  {
    key: 'usePersona',
    label: 'Persona',
    icon: '🎨',
    tooltip: 'Match your writing persona (tone, style, audience)',
    requiresConnected: false,
    disabledTooltip: '',
  },
  {
    key: 'includeTrending',
    label: 'Trending',
    icon: '📈',
    tooltip: 'Surface trending topics from your industry',
    requiresConnected: true,
    disabledTooltip: 'Connect LinkedIn to use trending topics',
  },
  {
    key: 'remarketContent',
    label: 'Remarket',
    icon: '🔄',
    tooltip: 'Repurpose your existing content & saved ideas',
    requiresConnected: false,
    disabledTooltip: '',
  },
];

const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({ options, onChange, connected }) => {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {CHECKBOXES.map((cb) => {
        const disabled = cb.requiresConnected && !connected;
        const checked = options[cb.key];

        return (
          <div
            key={cb.key}
            title={disabled ? cb.disabledTooltip : cb.tooltip}
            onClick={() => { if (disabled) return; onChange({ [cb.key]: !checked }); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px 3px 7px',
              borderRadius: 6,
              background: checked ? '#0a66c2' : '#f3f4f6',
              border: checked ? '1px solid #0a66c2' : '1px solid #e5e7eb',
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.12s ease',
              userSelect: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              color: checked ? '#fff' : '#6b7280',
              boxShadow: checked ? '0 1px 3px rgba(10,102,194,0.2)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (disabled) return;
              if (checked) { e.currentTarget.style.background = '#004182'; return; }
              e.currentTarget.style.background = '#e5e7eb';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              if (disabled) return;
              if (checked) { e.currentTarget.style.background = '#0a66c2'; return; }
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{cb.icon}</span>
            <span>{cb.label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default DataSourceSelector;
