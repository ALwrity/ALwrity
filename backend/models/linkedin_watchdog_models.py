from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


class WatchdogIndustry(BaseModel):
    id: str
    user_id: str
    name: str
    search_queries: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class WatchdogCompany(BaseModel):
    id: str
    user_id: str
    name: str
    url: Optional[str] = None
    industry_tag: Optional[str] = None
    search_queries: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class WatchdogPerson(BaseModel):
    id: str
    user_id: str
    name: str
    title: Optional[str] = None
    company: Optional[str] = None
    linkedin_url: Optional[str] = None
    search_queries: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class WatchdogUpdate(BaseModel):
    id: str
    user_id: str
    category: Literal["industry", "company", "person"]
    reference_id: str
    reference_name: str
    title: str
    url: str
    summary: str
    source: str
    published_date: Optional[str] = None
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class WatchdogIndustryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    search_queries: List[str] = Field(default_factory=list)


class WatchdogIndustryUpdate(BaseModel):
    name: Optional[str] = None
    search_queries: Optional[List[str]] = None


class WatchdogCompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    url: Optional[str] = None
    industry_tag: Optional[str] = None
    search_queries: Optional[List[str]] = None


class WatchdogCompanyUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    industry_tag: Optional[str] = None
    search_queries: Optional[List[str]] = None


class WatchdogPersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    title: Optional[str] = None
    company: Optional[str] = None
    linkedin_url: Optional[str] = None
    search_queries: Optional[List[str]] = None


class WatchdogPersonUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    linkedin_url: Optional[str] = None
    search_queries: Optional[List[str]] = None


class WatchdogUpdatesResponse(BaseModel):
    success: bool = True
    updates: List[WatchdogUpdate] = Field(default_factory=list)
    total_count: int = 0
    unread_count: int = 0


class WatchdogRefreshResponse(BaseModel):
    success: bool = True
    new_updates: int = 0
    total_updates: int = 0
    message: str = "Watchdog refreshed successfully"


class WatchdogListResponse(BaseModel):
    success: bool = True
    industries: List[WatchdogIndustry] = Field(default_factory=list)
    companies: List[WatchdogCompany] = Field(default_factory=list)
    people: List[WatchdogPerson] = Field(default_factory=list)


class WatchdogDiscoverCompaniesRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    num_results: int = Field(default=5, ge=1, le=20)


class WatchdogDiscoverPeopleRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    num_results: int = Field(default=5, ge=1, le=20)


class WatchdogDiscoverResponse(BaseModel):
    success: bool = True
    results: List[Dict[str, Any]] = Field(default_factory=list)
