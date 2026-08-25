import React from 'react';
import { Paper, Chip } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import HubIcon from '@mui/icons-material/Hub';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';

interface EditorSidebarProps {
  sections: any[];
  totalWords: number;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({ sections, totalWords }) => {
  const wordTarget = sections.reduce((s, sec) => s + (sec.outlineData?.targetWords || 500), 0);

  return (
    <div>
      <Paper elevation={0} className="p-5 rounded-xl border border-gray-200/60 bg-white">
        {/* Stats */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sections</span>
            <span className="font-medium text-gray-800">{sections.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Words</span>
            <span className="font-medium text-gray-800">{totalWords.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Target</span>
            <span className="font-medium text-gray-800">{wordTarget.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Reading time</span>
            <span className="font-medium text-gray-800">{Math.max(1, Math.ceil(totalWords / 200))} min</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Research Tools</h4>
          <div className="flex flex-wrap gap-2">
            <Chip
              icon={<BarChartIcon sx={{ fontSize: 14 }} />}
              label="Keywords"
              size="small"
              variant="outlined"
              sx={{
                fontSize: '12px',
                height: 28,
                '&:hover': { borderColor: '#4f46e5', color: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.04)' },
                transition: 'all 0.15s ease',
              }}
            />
            <Chip
              icon={<HubIcon sx={{ fontSize: 14 }} />}
              label="Sources"
              size="small"
              variant="outlined"
              sx={{
                fontSize: '12px',
                height: 28,
                '&:hover': { borderColor: '#4f46e5', color: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.04)' },
                transition: 'all 0.15s ease',
              }}
            />
            <Chip
              icon={<GpsFixedIcon sx={{ fontSize: 14 }} />}
              label="Grounding"
              size="small"
              variant="outlined"
              sx={{
                fontSize: '12px',
                height: 28,
                '&:hover': { borderColor: '#4f46e5', color: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.04)' },
                transition: 'all 0.15s ease',
              }}
            />
          </div>
        </div>

        {/* Section navigation */}
        {sections.length > 0 && (
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">On this page</h4>
            <nav className="space-y-1">
              {sections.map((section, i) => (
                <a
                  key={section.id}
                  href={`#section-${section.id}`}
                  className="block text-sm text-gray-500 hover:text-indigo-600 transition-colors py-1 truncate"
                >
                  <span className="text-xs text-gray-300 mr-2">{i + 1}.</span>
                  {section.title || `Section ${i + 1}`}
                </a>
              ))}
            </nav>
          </div>
        )}
      </Paper>
    </div>
  );
};

export default EditorSidebar;
