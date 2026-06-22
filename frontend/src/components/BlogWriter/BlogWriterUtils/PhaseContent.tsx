import React from 'react';
import ResearchResults from '../ResearchResults';
import EnhancedTitleSelector from '../EnhancedTitleSelector';
import EnhancedOutlineEditor from '../EnhancedOutlineEditor';
import { BlogEditor } from '../WYSIWYG';
import ManualResearchForm from '../ManualResearchForm';
import ManualContentButton from '../ManualContentButton';
import PublishContent from './PublishContent';

interface PhaseContentProps {
  currentPhase: string;
  research: any;
  outline: any[];
  outlineConfirmed: boolean;
  titleOptions: any[];
  selectedTitle?: string | null;
  researchTitles: any[];
  aiGeneratedTitles: any[];
  sourceMappingStats: any;
  groundingInsights: any;
  researchCoverage: any;
  setOutline: (o: any) => void;
  sections: Record<string, string>;
  handleContentUpdate: any;
  handleContentSave: any;
  continuityRefresh: number | null;
  flowAnalysisResults: any;
  outlineGenRef: React.RefObject<any>;
  blogWriterApi: any;
  contentConfirmed: boolean;
  seoAnalysis: any;
  seoMetadata: any;
  onTitleSelect: any;
  onCustomTitle: any;
  sectionImages?: Record<string, string>;
  setSectionImages?: (images: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  copilotKitAvailable?: boolean;
  onResearchComplete?: (research: any) => void;
  onKeywordsChange?: (kw: string) => void;
  blogLengthRef?: React.MutableRefObject<string>;
  startResearchRef?: React.MutableRefObject<((keywords: string, blogLength?: string) => Promise<any>) | null>;
  onOutlineGenerationStart?: (taskId: string) => void;
  onContentGenerationStart?: (taskId: string) => void;
  buildFullMarkdown?: () => string;
  convertMarkdownToHTML?: (md: string) => string;
  onOpenSEOMetadata?: () => void;
  onRunFlowAnalysis?: (options?: { forceRefresh?: boolean }) => Promise<{ success: boolean; error?: string; fromCache?: boolean }>;
  brainstormResult?: import('../../../api/gscBrainstorm').BrainstormResult;
  onBrainstormResult?: (result: import('../../../api/gscBrainstorm').BrainstormResult) => void;
  onResearchWithKeywords?: (keywords: string) => void;
  selectedContentAngle?: string;
  onAngleSelect?: (angle: string) => void;
  selectedCompetitiveAdvantage?: string;
  onCompetitiveAdvantageSelect?: (advantage: string) => void;
  introduction?: string;
  onIntroductionUpdate?: (intro: string) => void;
}

export const PhaseContent: React.FC<PhaseContentProps> = ({
  currentPhase,
  research,
  outline,
  outlineConfirmed,
  titleOptions,
  selectedTitle,
  researchTitles,
  aiGeneratedTitles,
  sourceMappingStats,
  groundingInsights,
  researchCoverage,
  setOutline,
  sections,
  handleContentUpdate,
  handleContentSave,
  continuityRefresh,
  flowAnalysisResults,
  outlineGenRef,
  blogWriterApi,
  contentConfirmed,
  seoAnalysis,
  seoMetadata,
  onTitleSelect,
  onCustomTitle,
  sectionImages,
  setSectionImages,
  copilotKitAvailable = true,
  onResearchComplete,
  onKeywordsChange,
  blogLengthRef,
  startResearchRef,
  onOutlineGenerationStart,
  onContentGenerationStart,
  buildFullMarkdown,
  convertMarkdownToHTML,
  brainstormResult,
  onBrainstormResult,
  onResearchWithKeywords,
  selectedContentAngle,
  onAngleSelect,
  selectedCompetitiveAdvantage,
  onCompetitiveAdvantageSelect,
  introduction,
  onIntroductionUpdate,
  onOpenSEOMetadata,
  onRunFlowAnalysis,
}) => {
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {currentPhase === 'research' && (
          <>
            {research ? (
              <ResearchResults research={research} brainstormResult={brainstormResult} onResearchWithKeywords={onResearchWithKeywords} selectedContentAngle={selectedContentAngle} onAngleSelect={onAngleSelect} selectedCompetitiveAdvantage={selectedCompetitiveAdvantage} onCompetitiveAdvantageSelect={onCompetitiveAdvantageSelect} />
            ) : (
              <>
                {copilotKitAvailable ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h3>Start Your Research</h3>
                    <p>Use the copilot to begin researching your blog topic.</p>
                  </div>
                ) : (
                  <ManualResearchForm
                    onResearchComplete={onResearchComplete}
                    onKeywordsChange={onKeywordsChange}
                    blogLengthRef={blogLengthRef}
                    researchRef={startResearchRef}
                    onBrainstormResult={onBrainstormResult}
                  />
                )}
              </>
            )}
          </>
        )}

        {currentPhase === 'outline' && research && (
          <>
            {outline.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#334155' }}>Creating Your Outline</h3>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                  Your outline is being generated from the research data. 
                  The progress modal shows detailed status — once complete, you can review and refine the sections here.
                </p>
              </div>
            ) : (
              <>
                <EnhancedTitleSelector
                  titleOptions={titleOptions}
                  selectedTitle={selectedTitle || undefined}
                  sections={outline}
                  researchTitles={researchTitles}
                  aiGeneratedTitles={aiGeneratedTitles}
                  onTitleSelect={onTitleSelect}
                  onCustomTitle={onCustomTitle}
                  research={research}
                />
                <EnhancedOutlineEditor 
                  outline={outline} 
                  research={research}
                  sourceMappingStats={sourceMappingStats}
                  groundingInsights={groundingInsights}
                  researchCoverage={researchCoverage}
                  onRefine={(op: any, id: any, payload: any) => blogWriterApi.refineOutline({ outline, operation: op, section_id: id, payload }).then((res: any) => setOutline(res.outline))}
                  sectionImages={sectionImages}
                  setSectionImages={setSectionImages}
                />
              </>
            )}
          </>
        )}

        {currentPhase === 'content' && outline.length > 0 && (
          <>
            {outlineConfirmed ? (
              <BlogEditor
                outline={outline}
                research={research}
                initialTitle={selectedTitle || (typeof window !== 'undefined' ? localStorage.getItem('blog_selected_title') : '') || 'Your Amazing Blog Title'}
                titleOptions={titleOptions}
                researchTitles={researchTitles}
                aiGeneratedTitles={aiGeneratedTitles}
                sections={sections}
                introduction={introduction}
                onContentUpdate={handleContentUpdate}
                onSave={handleContentSave}
                onIntroductionUpdate={onIntroductionUpdate}
                continuityRefresh={continuityRefresh || undefined}
                flowAnalysisResults={flowAnalysisResults}
                sectionImages={sectionImages}
              />
            ) : (
              <>
                {copilotKitAvailable ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h3>Confirm Your Outline</h3>
                    <p>Review and confirm your outline before generating content.</p>
                  </div>
                ) : (
                  <ManualContentButton
                    outline={outline}
                    research={research}
                    blogTitle={selectedTitle || undefined}
                    sections={sections}
                    onGenerationStart={onContentGenerationStart}
                  />
                )}
              </>
            )}
          </>
        )}
        
        {currentPhase === 'seo' && contentConfirmed && outline.length > 0 && outlineConfirmed && (
          <>
            {Object.keys(sections).length > 0 && Object.values(sections).some(content => content && content.trim().length > 0) ? (
              <BlogEditor
                outline={outline}
                research={research}
                initialTitle={selectedTitle || (typeof window !== 'undefined' ? localStorage.getItem('blog_selected_title') : '') || 'Your Amazing Blog Title'}
                titleOptions={titleOptions}
                researchTitles={researchTitles}
                aiGeneratedTitles={aiGeneratedTitles}
                sections={sections}
                introduction={introduction}
                onContentUpdate={handleContentUpdate}
                onSave={handleContentSave}
                onIntroductionUpdate={onIntroductionUpdate}
                continuityRefresh={continuityRefresh || undefined}
                flowAnalysisResults={flowAnalysisResults}
                sectionImages={sectionImages}
              />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Loading Content...</h3>
                <p>Please wait while your content is being optimized.</p>
              </div>
            )}
          </>
        )}

        {/* Fallback for SEO phase if conditions not met */}
        {currentPhase === 'seo' && (!contentConfirmed || outline.length === 0 || !outlineConfirmed) && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h3>Optimize your blog for search engines.</h3>
            <p>Complete the content phase first to enable SEO optimization.</p>
          </div>
        )}

        {currentPhase === 'publish' && buildFullMarkdown && convertMarkdownToHTML && (
          <PublishContent
            buildFullMarkdown={buildFullMarkdown}
            convertMarkdownToHTML={convertMarkdownToHTML}
            seoMetadata={seoMetadata}
            seoAnalysis={seoAnalysis}
            blogTitle={selectedTitle ?? undefined}
            sectionImages={sectionImages}
            onOpenSEOMetadata={onOpenSEOMetadata}
            flowAnalysisResults={flowAnalysisResults}
            onRunFlowAnalysis={onRunFlowAnalysis}
          />
        )}
      </div>
    </div>
  );
};

export default PhaseContent;


