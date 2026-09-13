import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';

export interface HorizontalSubTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface ResearchStepHorizontalSubTabsProps {
  items: HorizontalSubTabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export const ResearchStepHorizontalSubTabs: React.FC<ResearchStepHorizontalSubTabsProps> = ({
  items,
  activeId,
  onChange,
}) => {
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));

  return (
    <Box
      data-testid="research-horizontal-subtabs"
      sx={{
        borderBottom: '1px solid #E2E8F0',
        bgcolor: '#FAFBFC',
        px: { xs: 0.5, md: 1 },
      }}
    >
      <Tabs
        value={activeIndex}
        onChange={(_, idx) => onChange(items[idx].id)}
        variant="fullWidth"
        sx={{
          minHeight: 48,
          '& .MuiTabs-indicator': { bgcolor: '#4F46E5', height: 3, borderRadius: '3px 3px 0 0' },
          '& .MuiTab-root': {
            flex: 1,
            maxWidth: 'none',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: { xs: '0.7rem', sm: '0.8125rem' },
            minHeight: 48,
            color: '#64748B',
            px: { xs: 0.5, sm: 1 },
            '&.Mui-selected': { color: '#1E293B' },
          },
          '& .MuiTab-iconWrapper': { color: 'inherit', mr: { xs: 0.25, sm: 0.5 } },
        }}
      >
        {items.map((item) => (
          <Tab
            key={item.id}
            icon={item.icon as React.ReactElement}
            iconPosition="start"
            label={item.label}
          />
        ))}
      </Tabs>
    </Box>
  );
};
