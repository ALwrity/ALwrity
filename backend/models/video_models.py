from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Float, Enum
from datetime import datetime
import enum
from models.base import Base

class VideoTaskStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class VideoGenerationTask(Base):
    """
    Model for tracking video generation tasks (Video Studio).
    """
    __tablename__ = "video_generation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(36), unique=True, index=True, nullable=False) # UUID
    user_id = Column(String(255), nullable=False, index=True)
    
    status = Column(Enum(VideoTaskStatus), default=VideoTaskStatus.PENDING)
    
    # Task inputs (stored as JSON)
    request_data = Column(JSON, nullable=True)
    
    # Task results
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    
    # Progress tracking
    progress = Column(Float, default=0.0)
    message = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
