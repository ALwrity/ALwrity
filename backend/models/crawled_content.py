from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Index
from datetime import datetime
from models.base import Base

class EndUserWebsiteContent(Base):
    """
    Model for storing crawled content from the end user's website.
    """
    __tablename__ = "end_user_website_content"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    website_url = Column(String(500), nullable=False, index=True)
    
    # Page details
    url = Column(String(2048), nullable=False)
    title = Column(String(1000), nullable=True)
    content = Column(Text, nullable=True)  # Main content
    raw_html = Column(Text, nullable=True) # Raw HTML if needed (maybe truncate or store separately)
    published_date = Column(DateTime, nullable=True)
    
    # Metadata
    metadata_info = Column(JSON, nullable=True) # Any other metadata
    
    # Crawl info
    crawled_at = Column(DateTime, default=datetime.utcnow)
    status_code = Column(Integer, nullable=True)
    
    __table_args__ = (
        Index('idx_end_user_website_content_user_url', 'user_id', 'url', mysql_length={'url': 255}),
    )

    def __repr__(self):
        return f"<EndUserWebsiteContent(id={self.id}, user_id={self.user_id}, url={self.url})>"
