import React, { useState, useCallback } from 'react';
import { 
  Paper, 
  Chip, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Button
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import BarChartIcon from '@mui/icons-material/BarChart';
import HubIcon from '@mui/icons-material/Hub';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { BlogResearchResponse } from '../../../services/blogWriterApi';

interface ResearchIntegrationProps {
  research: BlogResearchResponse | null;
  content: string;
  onSourceInsert?: (source: any) => void;
  onFactCheck?: (content: string) => void;
}

interface SourceMapping {
  content: string;
  sources: any[];
  confidence: number;
}

const ResearchIntegration: React.FC<ResearchIntegrationProps> = ({
  research,
  content,
  onSourceInsert,
  onFactCheck
}) => {
  const [sourceMapping, setSourceMapping] = useState<SourceMapping[]>([]);
  const [factCheckResults, setFactCheckResults] = useState<any[]>([]);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [showFactCheckDialog, setShowFactCheckDialog] = useState(false);

  // Analyze content for source mapping
  const analyzeSourceMapping = useCallback(() => {
    if (!research || !content) return;

    // Simulate source mapping analysis
    const mapping: SourceMapping[] = [
      {
        content: "AI healthcare market projection",
        sources: research.sources?.slice(0, 2) || [],
        confidence: 0.95
      },
      {
        content: "predictive analytics in healthcare",
        sources: research.sources?.slice(1, 3) || [],
        confidence: 0.88
      }
    ];
    setSourceMapping(mapping);
  }, [research, content]);

  // Perform fact checking
  const performFactCheck = useCallback(() => {
    if (!research || !content) return;

    // Simulate fact checking
    const results = [
      {
        claim: "AI healthcare market is projected to reach $29 billion",
        status: 'verified',
        sources: research.sources?.slice(0, 2) || [],
        confidence: 0.92
      },
      {
        claim: "Predictive analytics can identify at-risk patients",
        status: 'verified',
        sources: research.sources?.slice(1, 3) || [],
        confidence: 0.89
      },
      {
        claim: "AI reduces administrative tasks by 50%",
        status: 'needs_verification',
        sources: [],
        confidence: 0.45
      }
    ];
    setFactCheckResults(results);
  }, [research, content]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="text-green-500" fontSize="small" />;
      case 'needs_verification':
        return <WarningIcon className="text-yellow-500" fontSize="small" />;
      case 'unverified':
        return <WarningIcon className="text-red-500" fontSize="small" />;
      default:
        return <InfoIcon className="text-gray-500" fontSize="small" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'needs_verification':
        return 'warning';
      case 'unverified':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-4">
      {/* Research Status Overview */}
      <Paper elevation={1} className="p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-700">Research Integration</h4>
          <div className="flex items-center gap-2">
            <Chip 
              icon={<LinkIcon />} 
              label={`${research?.sources?.length || 0} sources`} 
              size="small" 
              variant="outlined" 
            />
            <Chip 
              icon={<GpsFixedIcon />} 
              label="Google Search" 
              size="small" 
              variant="outlined" 
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {sourceMapping.length}
            </div>
            <div className="text-xs text-gray-500">Content Mapped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {factCheckResults.filter(r => r.status === 'verified').length}
            </div>
            <div className="text-xs text-gray-500">Facts Verified</div>
          </div>
        </div>
      </Paper>

      {/* Source Mapping */}
      <Paper elevation={1} className="p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-700">Source Mapping</h4>
          <Button
            size="small"
            startIcon={<HubIcon />}
            onClick={analyzeSourceMapping}
            className="!text-indigo-600"
          >
            Analyze
          </Button>
        </div>
        
        {sourceMapping.length > 0 ? (
          <div className="space-y-2">
            {sourceMapping.map((mapping, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">
                    {mapping.content}
                  </div>
                  <div className="text-xs text-gray-500">
                    {mapping.sources.length} sources • {Math.round(mapping.confidence * 100)}% confidence
                  </div>
                </div>
                <Chip 
                  label={`${Math.round(mapping.confidence * 100)}%`} 
                  size="small" 
                  color={mapping.confidence > 0.8 ? 'success' : 'warning'}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <InfoIcon className="text-gray-400 mb-2" />
            <div className="text-sm text-gray-500">No source mapping available</div>
            <div className="text-xs text-gray-400">Click "Analyze" to map content to sources</div>
          </div>
        )}
      </Paper>

      {/* Fact Checking */}
      <Paper elevation={1} className="p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-700">Fact Checking</h4>
          <Button
            size="small"
            startIcon={<CheckCircleIcon />}
            onClick={performFactCheck}
            className="!text-green-600"
          >
            Check Facts
          </Button>
        </div>
        
        {factCheckResults.length > 0 ? (
          <div className="space-y-2">
            {factCheckResults.map((result, index) => (
              <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-md">
                <div className="mt-1">
                  {getStatusIcon(result.status)}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-700 mb-1">
                    {result.claim}
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip 
                      label={result.status.replace('_', ' ')} 
                      size="small" 
                      color={getStatusColor(result.status) as any}
                    />
                    <span className="text-xs text-gray-500">
                      {result.sources.length} sources • {Math.round(result.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircleIcon className="text-gray-400 mb-2" />
            <div className="text-sm text-gray-500">No fact checking results</div>
            <div className="text-xs text-gray-400">Click "Check Facts" to verify claims</div>
          </div>
        )}
      </Paper>

      {/* Research Insights */}
      {research && (
        <Paper elevation={1} className="p-4 rounded-lg">
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Research Insights</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChartIcon fontSize="small" className="text-indigo-500" />
              <span className="text-sm text-gray-600">
                Primary Keywords: {research.keyword_analysis?.primary?.join(', ') || 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <GpsFixedIcon fontSize="small" className="text-green-500" />
              <span className="text-sm text-gray-600">
                Search Intent: {research.keyword_analysis?.search_intent || 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AutoAwesomeIcon fontSize="small" className="text-purple-500" />
              <span className="text-sm text-gray-600">
                Content Angles: {research.suggested_angles?.length || 0} suggested
              </span>
            </div>
          </div>
        </Paper>
      )}

      {/* Source Dialog */}
      <Dialog open={showSourceDialog} onClose={() => setShowSourceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <div className="flex items-center justify-between">
            <span>Research Sources</span>
            <IconButton onClick={() => setShowSourceDialog(false)}>
              <CloseIcon />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent>
          {research?.sources?.map((source, index) => (
            <Paper key={index} elevation={1} className="p-3 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-medium text-sm text-gray-800 mb-1">
                    {source.title || `Source ${index + 1}`}
                  </h5>
                  <p className="text-xs text-gray-600 mb-2">
                    {source.url || source.excerpt || 'No description available'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Chip label="Verified" size="small" color="success" />
                    <Chip label="High Relevance" size="small" variant="outlined" />
                  </div>
                </div>
                <Button
                  size="small"
                  onClick={() => onSourceInsert?.(source)}
                  className="!text-indigo-600"
                >
                  Insert
                </Button>
              </div>
            </Paper>
          ))}
        </DialogContent>
      </Dialog>

      {/* Fact Check Dialog */}
      <Dialog open={showFactCheckDialog} onClose={() => setShowFactCheckDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <div className="flex items-center justify-between">
            <span>Fact Check Results</span>
            <IconButton onClick={() => setShowFactCheckDialog(false)}>
              <CloseIcon />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent>
          {factCheckResults.map((result, index) => (
            <Paper key={index} elevation={1} className="p-3 mb-3">
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <h5 className="font-medium text-sm text-gray-800 mb-1">
                    {result.claim}
                  </h5>
                  <div className="flex items-center gap-2 mb-2">
                    <Chip 
                      label={result.status.replace('_', ' ')} 
                      size="small" 
                      color={getStatusColor(result.status) as any}
                    />
                    <span className="text-xs text-gray-500">
                      {Math.round(result.confidence * 100)}% confidence
                    </span>
                  </div>
                  {result.sources.length > 0 && (
                    <div className="text-xs text-gray-600">
                      Supported by {result.sources.length} sources
                    </div>
                  )}
                </div>
              </div>
            </Paper>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResearchIntegration;
