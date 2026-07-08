"""
Database models for SEO analysis data storage
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float, Boolean, ForeignKey, func
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Dict, Any, List

Base = declarative_base()

class SEOActionType(Base):
    """Catalog of supported SEO action types (17 actions)."""
    __tablename__ = 'seo_action_types'

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False)  # e.g., analyze_page_speed
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True)  # content, technical, performance, etc.
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SEOActionType(code='{self.code}', category='{self.category}')>"

class SEOAnalysisSession(Base):
    """Anchor session for a set of SEO actions and summary."""
    __tablename__ = 'seo_analysis_sessions'

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False, index=True)
    triggered_by_user_id = Column(String(64), nullable=True)
    trigger_source = Column(String(32), nullable=True)  # manual, schedule, action_followup, system
    input_context = Column(JSON, nullable=True)
    status = Column(String(20), default='success')  # queued, running, success, failed, cancelled
    started_at = Column(DateTime, default=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    summary = Column(Text, nullable=True)
    overall_score = Column(Integer, nullable=True)
    health_label = Column(String(50), nullable=True)
    metrics = Column(JSON, nullable=True)
    issues_overview = Column(JSON, nullable=True)

    # Relationships
    action_runs = relationship("SEOActionRun", back_populates="session", cascade="all, delete-orphan")
    analyses = relationship("SEOAnalysis", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SEOAnalysisSession(url='{self.url}', status='{self.status}')>"

class SEOActionRun(Base):
    """Each execution of a specific action (one of the 17)."""
    __tablename__ = 'seo_action_runs'

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('seo_analysis_sessions.id'), nullable=False)
    action_type_id = Column(Integer, ForeignKey('seo_action_types.id'), nullable=False)
    triggered_by_user_id = Column(String(64), nullable=True)
    input_params = Column(JSON, nullable=True)
    status = Column(String(20), default='success')
    started_at = Column(DateTime, default=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    result_summary = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)
    diagnostics = Column(JSON, nullable=True)

    # Relationships
    session = relationship("SEOAnalysisSession", back_populates="action_runs")
    action_type = relationship("SEOActionType")

    def __repr__(self):
        return f"<SEOActionRun(action_type_id={self.action_type_id}, status='{self.status}')>"

class SEOActionRunLink(Base):
    """Graph relations between action runs for narrative linkage."""
    __tablename__ = 'seo_action_run_links'

    id = Column(Integer, primary_key=True, index=True)
    from_action_run_id = Column(Integer, ForeignKey('seo_action_runs.id'), nullable=False)
    to_action_run_id = Column(Integer, ForeignKey('seo_action_runs.id'), nullable=False)
    relation = Column(String(50), nullable=False)  # followup_of, supports, caused_by
    created_at = Column(DateTime, default=func.now())

    def __repr__(self):
        return f"<SEOActionRunLink(relation='{self.relation}')>"

class SEOAnalysis(Base):
    """Main SEO analysis record"""
    __tablename__ = 'seo_analyses'
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False, index=True)
    overall_score = Column(Integer, nullable=False)
    health_status = Column(String(50), nullable=False)  # excellent, good, needs_improvement, poor, error
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    analysis_data = Column(JSON, nullable=True)  # Store complete analysis data
    session_id = Column(Integer, ForeignKey('seo_analysis_sessions.id'), nullable=True)
    
    # Relationships
    critical_issues = relationship("SEOIssue", back_populates="analysis", cascade="all, delete-orphan")
    warnings = relationship("SEOWarning", back_populates="analysis", cascade="all, delete-orphan")
    recommendations = relationship("SEORecommendation", back_populates="analysis", cascade="all, delete-orphan")
    category_scores = relationship("SEOCategoryScore", back_populates="analysis", cascade="all, delete-orphan")
    session = relationship("SEOAnalysisSession", back_populates="analyses")
    
    def __repr__(self):
        return f"<SEOAnalysis(url='{self.url}', score={self.overall_score}, status='{self.health_status}')>"

class SEOIssue(Base):
    """Critical SEO issues"""
    __tablename__ = 'seo_issues'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    session_id = Column(Integer, ForeignKey('seo_analysis_sessions.id'), nullable=True)
    action_run_id = Column(Integer, ForeignKey('seo_action_runs.id'), nullable=True)
    issue_text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)  # url_structure, meta_data, content, etc.
    priority = Column(String(20), default='critical')  # critical, high, medium, low
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    analysis = relationship("SEOAnalysis", back_populates="critical_issues")
    
    def __repr__(self):
        return f"<SEOIssue(category='{self.category}', priority='{self.priority}')>"

class SEOWarning(Base):
    """SEO warnings"""
    __tablename__ = 'seo_warnings'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    session_id = Column(Integer, ForeignKey('seo_analysis_sessions.id'), nullable=True)
    action_run_id = Column(Integer, ForeignKey('seo_action_runs.id'), nullable=True)
    warning_text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    priority = Column(String(20), default='medium')
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    analysis = relationship("SEOAnalysis", back_populates="warnings")
    
    def __repr__(self):
        return f"<SEOWarning(category='{self.category}', priority='{self.priority}')>"

class SEORecommendation(Base):
    """SEO recommendations"""
    __tablename__ = 'seo_recommendations'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    session_id = Column(Integer, ForeignKey('seo_analysis_sessions.id'), nullable=True)
    action_run_id = Column(Integer, ForeignKey('seo_action_runs.id'), nullable=True)
    recommendation_text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    difficulty = Column(String(20), default='medium')  # easy, medium, hard
    estimated_impact = Column(String(20), default='medium')  # high, medium, low
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    analysis = relationship("SEOAnalysis", back_populates="recommendations")
    
    def __repr__(self):
        return f"<SEORecommendation(category='{self.category}', difficulty='{self.difficulty}')>"

class SEOCategoryScore(Base):
    """Individual category scores"""
    __tablename__ = 'seo_category_scores'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    category = Column(String(100), nullable=False)  # url_structure, meta_data, content, etc.
    score = Column(Integer, nullable=False)
    max_score = Column(Integer, default=100)
    details = Column(JSON, nullable=True)  # Store category-specific details
    
    # Relationship
    analysis = relationship("SEOAnalysis", back_populates="category_scores")
    
    def __repr__(self):
        return f"<SEOCategoryScore(category='{self.category}', score={self.score})>"

class SEOAnalysisHistory(Base):
    """Historical SEO analysis data for tracking improvements"""
    __tablename__ = 'seo_analysis_history'
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False, index=True)
    analysis_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    overall_score = Column(Integer, nullable=False)
    health_status = Column(String(50), nullable=False)
    score_change = Column(Integer, default=0)  # Change from previous analysis
    
    # Category scores for tracking
    url_structure_score = Column(Integer, nullable=True)
    meta_data_score = Column(Integer, nullable=True)
    content_score = Column(Integer, nullable=True)
    technical_score = Column(Integer, nullable=True)
    performance_score = Column(Integer, nullable=True)
    accessibility_score = Column(Integer, nullable=True)
    user_experience_score = Column(Integer, nullable=True)
    security_score = Column(Integer, nullable=True)
    
    # Issue counts
    critical_issues_count = Column(Integer, default=0)
    warnings_count = Column(Integer, default=0)
    recommendations_count = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<SEOAnalysisHistory(url='{self.url}', score={self.overall_score}, date='{self.analysis_date}')>"

class SEOKeywordAnalysis(Base):
    """Keyword analysis data"""
    __tablename__ = 'seo_keyword_analyses'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    keyword = Column(String(200), nullable=False)
    density = Column(Float, nullable=True)
    count = Column(Integer, default=0)
    in_title = Column(Boolean, default=False)
    in_headings = Column(Boolean, default=False)
    in_alt_text = Column(Boolean, default=False)
    in_meta_description = Column(Boolean, default=False)
    
    def __repr__(self):
        return f"<SEOKeywordAnalysis(keyword='{self.keyword}', density={self.density})>"

class SEOTechnicalData(Base):
    """Technical SEO data"""
    __tablename__ = 'seo_technical_data'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    
    # Meta data
    title = Column(Text, nullable=True)
    title_length = Column(Integer, nullable=True)
    meta_description = Column(Text, nullable=True)
    meta_description_length = Column(Integer, nullable=True)
    
    # Technical elements
    has_canonical = Column(Boolean, default=False)
    canonical_url = Column(String(500), nullable=True)
    has_schema_markup = Column(Boolean, default=False)
    schema_types = Column(JSON, nullable=True)
    has_hreflang = Column(Boolean, default=False)
    hreflang_data = Column(JSON, nullable=True)
    
    # Social media
    og_tags_count = Column(Integer, default=0)
    twitter_tags_count = Column(Integer, default=0)
    
    # Technical files
    robots_txt_exists = Column(Boolean, default=False)
    sitemap_exists = Column(Boolean, default=False)
    
    def __repr__(self):
        return f"<SEOTechnicalData(title_length={self.title_length}, has_schema={self.has_schema_markup})>"

class SEOContentData(Base):
    """Content analysis data"""
    __tablename__ = 'seo_content_data'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    
    # Content metrics
    word_count = Column(Integer, default=0)
    char_count = Column(Integer, default=0)
    headings_count = Column(Integer, default=0)
    h1_count = Column(Integer, default=0)
    h2_count = Column(Integer, default=0)
    
    # Media
    images_count = Column(Integer, default=0)
    images_with_alt = Column(Integer, default=0)
    images_without_alt = Column(Integer, default=0)
    
    # Links
    internal_links_count = Column(Integer, default=0)
    external_links_count = Column(Integer, default=0)
    
    # Quality metrics
    readability_score = Column(Float, nullable=True)
    spelling_errors = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<SEOContentData(word_count={self.word_count}, readability={self.readability_score})>"

class SEOPerformanceData(Base):
    """Performance analysis data"""
    __tablename__ = 'seo_performance_data'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    
    # Load time
    load_time = Column(Float, nullable=True)
    
    # Compression
    is_compressed = Column(Boolean, default=False)
    compression_type = Column(String(50), nullable=True)  # gzip, br, etc.
    
    # Caching
    has_cache_headers = Column(Boolean, default=False)
    cache_control = Column(String(200), nullable=True)
    
    # HTTP headers
    content_encoding = Column(String(100), nullable=True)
    server_info = Column(String(200), nullable=True)
    
    def __repr__(self):
        return f"<SEOPerformanceData(load_time={self.load_time}, compressed={self.is_compressed})>"

class SEOAccessibilityData(Base):
    """Accessibility analysis data"""
    __tablename__ = 'seo_accessibility_data'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    
    # Alt text
    images_with_alt = Column(Integer, default=0)
    images_without_alt = Column(Integer, default=0)
    alt_text_ratio = Column(Float, nullable=True)
    
    # Forms
    form_fields_count = Column(Integer, default=0)
    labeled_fields_count = Column(Integer, default=0)
    label_ratio = Column(Float, nullable=True)
    
    # ARIA
    aria_elements_count = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<SEOAccessibilityData(alt_ratio={self.alt_text_ratio}, aria_count={self.aria_elements_count})>"

class SEOUserExperienceData(Base):
    """User experience analysis data"""
    __tablename__ = 'seo_user_experience_data'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    
    # Mobile
    is_mobile_friendly = Column(Boolean, default=False)
    has_viewport = Column(Boolean, default=False)
    
    # CTAs
    ctas_found = Column(JSON, nullable=True)  # List of found CTAs
    cta_count = Column(Integer, default=0)
    
    # Navigation
    has_navigation = Column(Boolean, default=False)
    nav_elements_count = Column(Integer, default=0)
    
    # Contact info
    has_contact_info = Column(Boolean, default=False)
    
    # Social media
    social_links_count = Column(Integer, default=0)
    social_links = Column(JSON, nullable=True)
    
    def __repr__(self):
        return f"<SEOUserExperienceData(mobile_friendly={self.is_mobile_friendly}, cta_count={self.cta_count})>"

class SEOSecurityData(Base):
    """Security headers analysis data"""
    __tablename__ = 'seo_security_data'
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('seo_analyses.id'), nullable=False)
    
    # Security headers
    has_x_frame_options = Column(Boolean, default=False)
    has_x_content_type_options = Column(Boolean, default=False)
    has_x_xss_protection = Column(Boolean, default=False)
    has_strict_transport_security = Column(Boolean, default=False)
    has_content_security_policy = Column(Boolean, default=False)
    has_referrer_policy = Column(Boolean, default=False)
    
    # HTTPS
    is_https = Column(Boolean, default=False)
    
    # Total security score
    security_score = Column(Integer, default=0)
    present_headers = Column(JSON, nullable=True)
    missing_headers = Column(JSON, nullable=True)
    
    def __repr__(self):
        return f"<SEOSecurityData(score={self.security_score}, https={self.is_https})>"

# Helper functions for data conversion
def create_analysis_from_result(result: 'SEOAnalysisResult') -> SEOAnalysis:
    """Create SEOAnalysis record from analysis result"""
    return SEOAnalysis(
        url=result.url,
        overall_score=result.overall_score,
        health_status=result.health_status,
        timestamp=result.timestamp,
        analysis_data=result.data
    )

def create_issues_from_result(analysis_id: int, result: 'SEOAnalysisResult') -> List[SEOIssue]:
    """Create SEOIssue records from analysis result"""
    issues = []
    for issue_data in result.critical_issues:
        # Handle both string and dictionary formats
        if isinstance(issue_data, dict):
            issue_text = issue_data.get('message', str(issue_data))
            category = issue_data.get('category', extract_category_from_text(issue_text))
        else:
            issue_text = str(issue_data)
            category = extract_category_from_text(issue_text)
            
        issues.append(SEOIssue(
            analysis_id=analysis_id,
            issue_text=issue_text,
            category=category,
            priority='critical'
        ))
    return issues

def create_warnings_from_result(analysis_id: int, result: 'SEOAnalysisResult') -> List[SEOWarning]:
    """Create SEOWarning records from analysis result"""
    warnings = []
    for warning_data in result.warnings:
        # Handle both string and dictionary formats
        if isinstance(warning_data, dict):
            warning_text = warning_data.get('message', str(warning_data))
            category = warning_data.get('category', extract_category_from_text(warning_text))
        else:
            warning_text = str(warning_data)
            category = extract_category_from_text(warning_text)
            
        warnings.append(SEOWarning(
            analysis_id=analysis_id,
            warning_text=warning_text,
            category=category,
            priority='medium'
        ))
    return warnings

def create_recommendations_from_result(analysis_id: int, result: 'SEOAnalysisResult') -> List[SEORecommendation]:
    """Create SEORecommendation records from analysis result"""
    recommendations = []
    for rec_data in result.recommendations:
        # Handle both string and dictionary formats
        if isinstance(rec_data, dict):
            rec_text = rec_data.get('message', str(rec_data))
            category = rec_data.get('category', extract_category_from_text(rec_text))
        else:
            rec_text = str(rec_data)
            category = extract_category_from_text(rec_text)
            
        recommendations.append(SEORecommendation(
            analysis_id=analysis_id,
            recommendation_text=rec_text,
            category=category,
            difficulty='medium',
            estimated_impact='medium'
        ))
    return recommendations

def create_category_scores_from_result(analysis_id: int, result: 'SEOAnalysisResult') -> List[SEOCategoryScore]:
    """Create SEOCategoryScore records from analysis result"""
    scores = []
    for category, data in result.data.items():
        if isinstance(data, dict) and 'score' in data:
            scores.append(SEOCategoryScore(
                analysis_id=analysis_id,
                category=category,
                score=data['score'],
                max_score=100,
                details=data
            ))
    return scores

def extract_category_from_text(text: str) -> str:
    """Extract category from issue/warning/recommendation text"""
    text_lower = text.lower()
    
    if any(word in text_lower for word in ['title', 'meta', 'description']):
        return 'meta_data'
    elif any(word in text_lower for word in ['https', 'url', 'security']):
        return 'url_structure'
    elif any(word in text_lower for word in ['content', 'word', 'heading', 'image']):
        return 'content_analysis'
    elif any(word in text_lower for word in ['schema', 'canonical', 'technical']):
        return 'technical_seo'
    elif any(word in text_lower for word in ['speed', 'load', 'performance']):
        return 'performance'
    elif any(word in text_lower for word in ['alt', 'accessibility', 'aria']):
        return 'accessibility'
    elif any(word in text_lower for word in ['mobile', 'cta', 'navigation']):
        return 'user_experience'
    else:
        return 'general' 