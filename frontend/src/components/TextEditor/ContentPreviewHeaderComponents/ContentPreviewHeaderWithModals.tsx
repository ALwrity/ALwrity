import React, { useState, useEffect } from 'react';
import MainContentPreviewHeader from './MainContentPreviewHeader';
import { type LinkedInPreviewMode } from '../../LinkedInWriter/components/LinkedInPreviewModeToggle';

interface ContentPreviewHeaderProps {
  researchSources?: any[];
  citations?: any[];
  searchQueries?: string[];
  qualityMetrics?: any;
  draft: string;
  previewMode?: LinkedInPreviewMode;
  onPreviewModeChange?: (mode: LinkedInPreviewMode) => void;
  assistantOn?: boolean;
  onAssistantToggle?: (enabled: boolean) => void;
  topic?: string;
  platform?: string;
}

// Research Sources Modal Component
const ResearchSourcesModal: React.FC<{ sources: any[]; isOpen: boolean; onClose: () => void }> = ({ sources, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#0a66c2', fontSize: '18px', fontWeight: '600' }}>
            Research Sources ({sources.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {sources && Array.isArray(sources) ? sources.map((source, idx) => (
            <div key={idx} style={{
              marginBottom: '16px',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              borderLeft: '4px solid #0a66c2'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#0a66c2' }}>
                {source.title || 'Untitled Source'}
              </div>
              <div style={{ color: '#666', marginBottom: '12px', lineHeight: '1.5' }}>
                {source.content || 'No description available'}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {source.relevance_score && (
                  <span style={{
                    backgroundColor: '#eef6ff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0a66c2'
                  }}>
                    Relevance: {Math.round(source.relevance_score * 100)}%
                  </span>
                )}
                {source.credibility_score && (
                  <span style={{
                    backgroundColor: '#eef6ff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0a66c2'
                  }}>
                    Credibility: {Math.round(source.credibility_score * 100)}%
                  </span>
                )}
                {source.domain_authority && (
                  <span style={{
                    backgroundColor: '#eef6ff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0a66c2'
                  }}>
                    Authority: {Math.round(source.domain_authority * 100)}%
                  </span>
                )}
              </div>
            </div>
          )) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No research sources available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Citations Modal Component
const CitationsModal: React.FC<{ citations: any[]; isOpen: boolean; onClose: () => void }> = ({ citations, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#0a66c2', fontSize: '18px', fontWeight: '600' }}>
            Citations ({citations.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {citations && Array.isArray(citations) ? citations.map((citation, idx) => (
            <div key={idx} style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              borderLeft: '3px solid #f59e0b'
            }}>
              <div style={{ fontWeight: '600', color: '#0a66c2', marginBottom: '4px' }}>
                Citation {idx + 1}
              </div>
              <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>
                Type: {citation.type || 'inline'}
              </div>
              {citation.reference && (
                <div style={{ color: '#666', fontSize: '12px' }}>
                  Reference: {citation.reference}
                </div>
              )}
            </div>
          )) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No citations available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Search Queries Modal Component
const SearchQueriesModal: React.FC<{ queries: string[]; isOpen: boolean; onClose: () => void }> = ({ queries, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#0a66c2', fontSize: '18px', fontWeight: '600' }}>
            Search Queries Used ({queries.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {queries && Array.isArray(queries) ? queries.map((query, idx) => (
            <div key={idx} style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              borderLeft: '3px solid #8b5cf6'
            }}>
              <div style={{ fontWeight: '600', color: '#7c3aed', marginBottom: '6px' }}>
                Query {idx + 1}
              </div>
              <div style={{ color: '#374151', fontSize: '13px', lineHeight: '1.4' }}>
                {query}
              </div>
            </div>
          )) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No search queries available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced ContentPreviewHeader with Modal State
const ContentPreviewHeaderWithModals: React.FC<ContentPreviewHeaderProps> = (props) => {
  const [showResearchSourcesModal, setShowResearchSourcesModal] = useState(false);
  const [showCitationsModal, setShowCitationsModal] = useState(false);
  const [showSearchQueriesModal, setShowSearchQueriesModal] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  useEffect(() => {
    const handleShowResearchSourcesModal = (event: CustomEvent) => {
      try {
        const dataType = event.detail;
        let data: any[] = [];
        
        if (dataType === 'sources') {
          data = props.researchSources || [];
        }
        
        setModalData(Array.isArray(data) ? data : []);
        setShowResearchSourcesModal(true);
      } catch (error) {
        console.error('Error handling research sources modal:', error);
        setModalData([]);
        setShowResearchSourcesModal(true);
      }
    };

    const handleShowCitationsModal = (event: CustomEvent) => {
      try {
        const dataType = event.detail;
        let data: any[] = [];
        
        if (dataType === 'citations') {
          data = props.citations || [];
        }
        
        setModalData(Array.isArray(data) ? data : []);
        setShowCitationsModal(true);
      } catch (error) {
        console.error('Error handling citations modal:', error);
        setModalData([]);
        setShowCitationsModal(true);
      }
    };

    const handleShowSearchQueriesModal = (event: CustomEvent) => {
      try {
        const dataType = event.detail;
        let data: any[] = [];
        
        if (dataType === 'queries') {
          data = props.searchQueries || [];
        }
        
        setModalData(Array.isArray(data) ? data : []);
        setShowSearchQueriesModal(true);
      } catch (error) {
        console.error('Error handling search queries modal:', error);
        setModalData([]);
        setShowSearchQueriesModal(true);
      }
    };

    window.addEventListener('showResearchSourcesModal', handleShowResearchSourcesModal as EventListener);
    window.addEventListener('showCitationsModal', handleShowCitationsModal as EventListener);
    window.addEventListener('showSearchQueriesModal', handleShowSearchQueriesModal as EventListener);

    return () => {
      window.removeEventListener('showResearchSourcesModal', handleShowResearchSourcesModal as EventListener);
      window.removeEventListener('showCitationsModal', handleShowCitationsModal as EventListener);
      window.removeEventListener('showSearchQueriesModal', handleShowSearchQueriesModal as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <MainContentPreviewHeader {...props} />
      <ResearchSourcesModal
        sources={modalData || []}
        isOpen={showResearchSourcesModal}
        onClose={() => setShowResearchSourcesModal(false)}
      />
      <CitationsModal
        citations={modalData || []}
        isOpen={showCitationsModal}
        onClose={() => setShowCitationsModal(false)}
      />
      <SearchQueriesModal
        queries={modalData || []}
        isOpen={showSearchQueriesModal}
        onClose={() => setShowSearchQueriesModal(false)}
      />
    </>
  );
};

export default ContentPreviewHeaderWithModals;
