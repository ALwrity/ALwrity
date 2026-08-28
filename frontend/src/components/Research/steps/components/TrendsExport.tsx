/**
 * TrendsExport Component
 * 
 * Provides export functionality for Google Trends data.
 * Supports CSV export and image export (chart screenshot).
 */

import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import { GoogleTrendsData, TrendAnalysis } from '../../types/intent.types';

interface TrendsExportProps {
  trendsData: GoogleTrendsData;
  aiTrends?: TrendAnalysis[];
  keywords: string[];
}

export const TrendsExport: React.FC<TrendsExportProps> = ({
  trendsData,
  aiTrends = [],
  keywords,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Export to CSV
  const exportToCSV = () => {
    setExporting(true);
    try {
      // Prepare CSV data
      const csvRows: string[] = [];

      // Header
      csvRows.push('Google Trends Data Export');
      csvRows.push(`Keywords: ${keywords.join(', ')}`);
      csvRows.push(`Timeframe: ${trendsData.timeframe}`);
      csvRows.push(`Region: ${trendsData.geo}`);
      csvRows.push(`Exported: ${new Date().toISOString()}`);
      csvRows.push('');

      // Interest Over Time
      if (trendsData.interest_over_time.length > 0) {
        csvRows.push('Interest Over Time');
        const headers = ['Date', ...keywords];
        csvRows.push(headers.join(','));

        trendsData.interest_over_time.forEach((point: any) => {
          const dateKey = Object.keys(point).find(k => 
            k.toLowerCase().includes('date') || k === 'date'
          );
          const date = dateKey ? point[dateKey] : '';
          const values = keywords.map(keyword => {
            const valueKey = Object.keys(point).find(k => {
              const val = point[k];
              return typeof val === 'number' && val !== null && val !== undefined && k !== 'isPartial';
            });
            return valueKey ? point[valueKey] : '';
          });
          csvRows.push([date, ...values].join(','));
        });
        csvRows.push('');
      }

      // Interest by Region
      if (trendsData.interest_by_region.length > 0) {
        csvRows.push('Interest by Region');
        csvRows.push('Region,Interest');

        trendsData.interest_by_region.forEach((region: any) => {
          const geoKey = Object.keys(region).find(k => k.includes('geo') || k.includes('name'));
          const regionName = region.geoName || (geoKey ? region[geoKey] : null) || 'Unknown';
          const value = Object.values(region).find(v => typeof v === 'number' && v !== null) as number || 0;
          csvRows.push(`${regionName},${value}`);
        });
        csvRows.push('');
      }

      // Related Topics
      if (trendsData.related_topics.top.length > 0 || trendsData.related_topics.rising.length > 0) {
        csvRows.push('Related Topics');
        csvRows.push('Type,Topic,Value');

        trendsData.related_topics.top.forEach((topic: any) => {
          const topicTitle = topic.topic_title || topic.title || topic[Object.keys(topic)[0]] || 'Unknown';
          const value = topic.value || '';
          csvRows.push(`Top,${topicTitle},${value}`);
        });

        trendsData.related_topics.rising.forEach((topic: any) => {
          const topicTitle = topic.topic_title || topic.title || topic[Object.keys(topic)[0]] || 'Unknown';
          const value = topic.value || '';
          csvRows.push(`Rising,${topicTitle},${value}`);
        });
        csvRows.push('');
      }

      // Related Queries
      if (trendsData.related_queries.top.length > 0 || trendsData.related_queries.rising.length > 0) {
        csvRows.push('Related Queries');
        csvRows.push('Type,Query');

        trendsData.related_queries.top.forEach((query: any) => {
          const queryText = query.query || query[Object.keys(query)[0]] || 'Unknown';
          csvRows.push(`Top,${queryText}`);
        });

        trendsData.related_queries.rising.forEach((query: any) => {
          const queryText = query.query || query[Object.keys(query)[0]] || 'Unknown';
          csvRows.push(`Rising,${queryText}`);
        });
        csvRows.push('');
      }

      // AI-Extracted Trends
      if (aiTrends.length > 0) {
        csvRows.push('AI-Extracted Trends');
        csvRows.push('Trend,Direction,Impact,Timeline,Interest Score');

        aiTrends.forEach(trend => {
          csvRows.push([
            trend.trend,
            trend.direction,
            trend.impact || '',
            trend.timeline || '',
            trend.interest_score ? Math.round(trend.interest_score).toString() : '',
          ].join(','));
        });
      }

      // Create and download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `google-trends-${keywords.join('-')}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
      handleClose();
    }
  };

  // Export chart as image (requires html2canvas)
  const exportChartAsImage = async () => {
    setExporting(true);
    try {
      // Dynamically import html2canvas if available
      let html2canvas: ((element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>);
      try {
        // Dynamic import - html2canvas may not be installed, we handle this gracefully
        const html2canvasModule = await import('html2canvas');
        html2canvas = html2canvasModule.default as (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
      } catch (importError) {
        alert('Image export requires html2canvas package. Please install it: npm install html2canvas');
        setExporting(false);
        handleClose();
        return;
      }
      
      const chartElement = document.querySelector('[data-trends-chart]');
      if (!chartElement) {
        alert('Chart not found. Please ensure the chart is visible.');
        setExporting(false);
        handleClose();
        return;
      }

      const canvas = await html2canvas(chartElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          alert('Failed to generate image.');
          return;
        }

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `trends-chart-${keywords.join('-')}-${new Date().toISOString().split('T')[0]}.png`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error exporting image:', error);
      // If html2canvas is not installed, show helpful message
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        alert('Image export requires html2canvas package. Please install it: npm install html2canvas');
      } else {
        alert('Failed to export image. Please try again.');
      }
    } finally {
      setExporting(false);
      handleClose();
    }
  };

  return (
    <Box>
      <Tooltip title="Export trends data">
        <Button
          size="small"
          variant="outlined"
          startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
          onClick={handleClick}
          disabled={exporting}
          sx={{
            borderColor: '#e5e7eb',
            color: '#374151',
            '&:hover': {
              borderColor: '#0ea5e9',
              backgroundColor: '#f0f9ff',
            },
          }}
        >
          Export
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={exportToCSV} disabled={exporting}>
          <ListItemIcon>
            <TableChartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as CSV</ListItemText>
        </MenuItem>
        <MenuItem onClick={exportChartAsImage} disabled={exporting}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Chart as Image</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};
