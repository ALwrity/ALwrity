# GSC Brainstorm Service - Complete Guide

**Feature Status**: ✅ Production Ready (May 26, 2026)  
**Integration**: Blog Writer + Google Search Console  
**Type**: AI-Powered Topic Research & Suggestion Engine  
**Scope**: Multi-dimensional GSC analysis with LLM insights

---

## 🎯 What is GSC Brainstorm?

The **GSC Brainstorm Service** is an intelligent topic research tool that analyzes your real Google Search Console data to suggest blog posts you should write about. It combines **rule-based heuristics** with **AI-powered strategic insights** to transform raw search analytics into actionable content ideas.

### Core Purpose

Instead of guessing what to write about, Brainstorm lets you:
- ✅ Discover **high-ROI topics** your audience is already searching for
- ✅ Find **low-hanging fruit** (quick wins) you can capitalize on today
- ✅ Identify **content gaps** that could boost rankings
- ✅ Get **AI-generated strategies** for each topic suggestion
- ✅ Understand **why each topic matters** in plain English (not jargon)

---

## 🚀 How It Works

### 5-Step Analysis Pipeline

```
┌─────────────────────────────────────────┐
│  Step 1: Fetch GSC Data                 │
│  • Query data (30 days)                 │
│  • Page data (impressions, clicks, CTR) │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  Step 2: Parse & Filter by Topic        │
│  • Tokenize keywords                    │
│  • Semantic similarity scoring          │
│  • Topic relevance filtering (0-1 scale)│
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  Step 3: Rule-Based Analysis            │
│  • Content Opportunities (high vol, low CTR) │
│  • Quick Wins (positions 4-10, easy boost) │
│  • Keyword Gaps (positions 11-20)       │
│  • Page Opportunities (poor performing)  │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  Step 4: Generate Summary               │
│  • Health Score (0-100)                 │
│  • Position distribution                │
│  • CTR vs industry benchmark            │
│  • Top keywords & pages                 │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  Step 5: AI Strategic Recommendations   │
│  • LLM analyzes all findings            │
│  • Generates 3-5 blog post suggestions  │
│  • Includes format, keywords, ROI       │
└─────────────────────────────────────────┘
```

---

## 🎓 Feature Breakdown

### Feature 1: Content Opportunities Analysis

**What It Finds**: Keywords with **high impressions but low click-through rate (CTR)**

**Business Logic**:
- Keywords with 500+ monthly impressions but <3% CTR are being "wasted"
- Your site appears for these searches but isn't getting clicks
- Solution: Improve the title tag and meta description to increase CTR

**Example Output**:
```json
{
  "type": "Content Optimization",
  "keyword": "best productivity tools",
  "opportunity": "Your site appears for 'best productivity tools' (1,200 impressions/month) but only 1.8% CTR. Improving your title and meta description could bring ~45 more clicks/month.",
  "potential_impact": "High",
  "current_position": 5,
  "current_ctr": 1.8,
  "impressions": 1200,
  "estimated_traffic_gain": 45,
  "suggested_format": "Top Picks / Review"
}
```

**Action Item**: Write a "Best Productivity Tools" guide to capture this search demand

---

### Feature 2: Quick Wins Detection

**What It Finds**: Keywords where you're **already on page 1** but have room to improve

**Business Logic**:
- Keywords at positions 4-10 with decent impressions
- Moving from position 7 to position 3 = 3x more clicks
- Usually requires minor content improvements (better structure, examples, formatting)

**Example Output**:
```json
{
  "keyword": "python tutorial",
  "position": 7,
  "impressions": 800,
  "current_ctr": 2.1,
  "estimated_traffic_gain": 12,
  "reason": "Already on page 1 at position #7. Optimizing this page could increase CTR from 2.1% to ~11%, gaining ~12 clicks/month."
}
```

**Action Item**: Update existing content to move from position 7 to position 3

---

### Feature 3: Keyword Gaps Analysis

**What It Finds**: Keywords you **should be ranking for but aren't**

**Business Logic**:
- Keywords at positions 11-20 (page 2) represent "gap opportunity"
- Small ranking boost moves these to page 1
- Page 1 keywords get 10x more clicks than page 2

**Example Output**:
```json
{
  "keyword": "machine learning basics",
  "position": 15,
  "impressions": 500,
  "estimated_traffic_if_page1": 120,
  "gap_from_page1": "12 positions away"
}
```

**Action Item**: Create comprehensive guide to push this from page 2 to page 1

---

### Feature 4: Page Opportunities

**What It Finds**: **High-traffic pages performing poorly** in search results

**Business Logic**:
- Pages with 300+ impressions but <2% CTR
- Indicates the page title/description don't match searcher intent
- Quick fix: Update title tag and meta description

**Example Output**:
```json
{
  "page": "/blog/advanced-python-tutorial",
  "page_title": "Advanced Python Tutorial",
  "impressions": 600,
  "current_ctr": 1.5,
  "reason": "This page gets 600 impressions but only 1.5% CTR. Reviewing the title and meta description could significantly boost clicks."
}
```

**Action Item**: A/B test new title and meta description to increase CTR

---

### Feature 5: AI Recommendations (Strategic Insights)

**What It Does**: Analyzes ALL findings and generates **specific blog post suggestions** using LLM

**3-Tier Strategy**:

#### 1. Immediate Opportunities (0-30 days)
Quick wins and high-impact content ideas you can implement immediately

```json
{
  "title": "The Complete Guide to Python Productivity Tools for Developers",
  "keyword": "best productivity tools",
  "reason": "Currently 5th position with 1,200 impressions/month but only 1.8% CTR. A comprehensive review could boost CTR to 5%, adding ~40 clicks/month within 2-3 weeks.",
  "format": "Top Picks / Review",
  "estimated_impact": "+40 clicks/month"
}
```

#### 2. Content Strategy (1-3 months)
Foundational content pieces that establish topical authority

```json
{
  "title": "Topic Cluster: Building a Complete Python Ecosystem",
  "keyword": "python ecosystem",
  "reason": "Gap opportunity: You rank for 15 Python-related keywords but have no pillar content. Creating a hub page could improve rankings for all related keywords.",
  "format": "Pillar Page + Spokes",
  "estimated_impact": "+200 clicks/month over 3 months"
}
```

#### 3. Long-Term Strategy (3-6 months)
Authority-building content that establishes expertise

```json
{
  "title": "The Definitive Developer's Guide to Python (2026)",
  "keyword": "python guide",
  "reason": "Forward-looking mega-guide that attracts backlinks and establishes authority. This type of content becomes reference material in your niche.",
  "format": "Long-Form Guide",
  "estimated_impact": "+500 clicks/month over 6 months"
}
```

---

## 📊 Performance Metrics & Health Score

### Health Score (0-100)

**Definition**: Composite score based on your SEO performance relative to industry benchmarks

**Calculation**:
- 60% based on keyword position distribution (% on page 1)
- 30% based on CTR vs 3.1% industry average
- 10% based on impressions momentum

**Score Interpretation**:
- **80-100**: Excellent (most keywords on page 1, above-average CTR)
- **60-80**: Good (good page 1 presence, average CTR)
- **40-60**: Needs Work (50% on page 1, below-average CTR)
- **0-40**: Critical (page 3+ rankings, very low CTR)

**Example**:
```json
{
  "health_score": 68,
  "interpretation": "Good SEO health with room for improvement",
  "keyword_distribution": {
    "positions_1_3": 24,
    "positions_4_10": 31,
    "positions_11_20": 18,
    "positions_21_plus": 27
  }
}
```

---

## 🔧 Topic Relevance Filtering

### How It Works

Brainstorm smartly filters GSC keywords to focus only on your **topic of interest**, using two methods:

#### Method 1: Semantic Similarity (AI-powered)
- Uses `sentence-transformers` model (all-MiniLM-L6-v2)
- Understands synonyms and related concepts
- Example: "plant-based protein" matches "vegan nutrition"
- **Result**: Catches conceptual relevance

#### Method 2: Token-Based Matching (Fallback)
- Splits keywords into tokens
- Matches overlapping words
- Example: "Python tutorial" matches "advanced Python guide"
- **Result**: Simple keyword overlap

#### Combined Scoring
```
Final Relevance = 0.5 × Semantic Similarity + 0.5 × Token Overlap
```

This hybrid approach ensures you get:
- ✅ Conceptually related keywords (semantic)
- ✅ Direct keyword matches (token-based)
- ✅ Robustness if ML model unavailable (fallback)

---

## 🔌 Integration Points

### Integration 1: Blog Writer

**Location**: `frontend/src/components/BlogWriter/BrainstormButton.tsx`

**How It Works**:
1. User types research topic (3+ words) in Blog Writer
2. Clicks "🔍 Brainstorm" button
3. System fetches GSC data and generates suggestions
4. User clicks a suggestion → Keyword auto-populates in Blog Writer
5. User proceeds with content creation

**Example Workflow**:
```
User: "Write about Python productivity"
  ↓
Brainstorm analyzes GSC data for Python-related keywords
  ↓
Suggests: "The Complete Guide to Python Productivity Tools"
  ↓
User clicks suggestion
  ↓
Blog Writer keyword field: "Python productivity tools"
  ↓
User writes the blog post
```

### Integration 2: Google Search Console Connection

**Location**: `frontend/src/hooks/useGSCBrainstorm.ts`

**Requirements**:
- GSC account connected to ALwrity
- Site verified in Google Search Console
- Last 30 days of search data available

**Automatic Site Selection**:
- If no site specified: Uses first verified site
- If multiple sites: User can select which site to analyze

### Integration 3: Caching System

**Purpose**: Reduce API calls and provide faster repeat analyses

**Implementation**:
- Caches results in `localStorage` with unique key
- Cache key: `gsc_brainstorm_${userId}_${keywords}_${siteUrl}`
- TTL: Session (cleared on logout)
- Can force refresh: Click "Re-Run" button

**Benefits**:
- ✅ Faster re-loads for same topic
- ✅ Reduced GSC API usage
- ✅ No re-running expensive LLM calls

---

## 📱 UI/UX Components

### GSCBrainstormModal.tsx

**Purpose**: Full-screen modal displaying brainstorm results

**5 Tab Interface**:
1. **Quick Wins** (Green) - Immediate quick wins on page 1
2. **Opportunities** (Blue) - Content optimization opportunities
3. **Keyword Gaps** (Orange) - Page 2 → Page 1 gaps
4. **Pages** (Red) - High-traffic pages with low CTR
5. **AI Recommendations** (Purple) - LLM-generated strategies

**Features**:
- Real-time progress messages while analyzing
- Summary dashboard with health score
- Position distribution pie chart
- Clickable suggestions (auto-populate research topic)
- Re-run capability with custom keywords

**Metrics Dashboard**:
```
Impressions: 15,240        Avg CTR: 2.8%
Clicks: 427                vs 3.1% avg ↓
Avg Position: 6.2          SEO Health: 68/100
```

---

## 🛠️ Backend Architecture

### Core Service: GSCBrainstormService

**File**: `backend/services/gsc_brainstorm_service.py` (1,000+ lines)

**Methods**:

#### 1. `brainstorm_topics()` (Public entry point)
```python
def brainstorm_topics(
    user_id: str,
    keywords: str,
    site_url: Optional[str] = None,
) -> Dict[str, Any]
```

**Flow**:
1. Resolves site_url (auto-selects if not provided)
2. Fetches 30 days of GSC data
3. Filters by topic relevance
4. Applies rule-based analysis
5. Generates AI recommendations
6. Returns structured JSON

**Response**:
```json
{
  "content_opportunities": [...],
  "keyword_gaps": [...],
  "quick_wins": [...],
  "page_opportunities": [...],
  "ai_recommendations": {
    "immediate_opportunities": [...],
    "content_strategy": [...],
    "long_term_strategy": [...]
  },
  "summary": {...}
}
```

#### 2. `_filter_by_topic_relevance()` (Topic filtering)
```python
def _filter_by_topic_relevance(
    keywords_data: List[Dict],
    pages_data: List[Dict],
    user_keywords: str,
) -> tuple
```

**Logic**:
- Scores all keywords for relevance
- Keeps top 150 by relevance
- Adds top 50 by impressions (fallback)
- Filters pages by keyword containment
- Returns merged deduplicated lists

#### 3. `_identify_*()` (Rule-based analysis methods)

**Four methods for opportunity detection**:
- `_identify_content_opportunities()` - High volume, low CTR
- `_identify_keyword_gaps()` - Positions 11-20
- `_identify_quick_wins()` - Positions 4-10
- `_identify_page_opportunities()` - High traffic pages, low CTR

#### 4. `_generate_ai_recommendations()` (LLM integration)
```python
def _generate_ai_recommendations(
    keywords_data: List[Dict],
    pages_data: List[Dict],
    summary: Dict,
    user_keywords: str,
    content_opportunities: List[Dict],
    quick_wins: List[Dict],
    keyword_gaps: List[Dict],
) -> Dict[str, Any]
```

**Process**:
1. Prepares context with top keywords, opportunities, and stats
2. Crafts specialized prompt for blog strategist role
3. Calls LLM with structured output format
4. Parses JSON response into recommendation tiers
5. Falls back to rule-based recommendations if LLM fails

### API Endpoint

**Router**: `backend/routers/gsc_auth.py`

**Endpoint**:
```
POST /gsc/brainstorm
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "keywords": "Python productivity tools",
  "site_url": "https://example.com" (optional)
}

Response (200):
{
  "content_opportunities": [...],
  "keyword_gaps": [...],
  ...
}

Response (400):
{
  "detail": "Please provide at least 3 words for brainstorming topic suggestions."
}

Response (500):
{
  "detail": "Error brainstorming topics: {error}"
}
```

---

## 💡 Use Cases & Examples

### Use Case 1: Content Creator Planning Next Post

**Scenario**: Writer has published 20 posts but isn't sure what to write next

**How Brainstorm Helps**:
1. User opens Blog Writer
2. Enters recent interest: "Python web frameworks"
3. Clicks Brainstorm
4. Results show:
   - Quick win: "FastAPI vs Django" (position 8, 600 impressions/month)
   - Opportunity: "Getting Started with FastAPI" (1,200 impressions, low CTR)
   - Gap: "Async Python Web Development" (position 18, 400 impressions)
5. User selects "FastAPI vs Django" suggestion
6. Starts writing with topic populated

**Result**: Data-driven topic selection vs guesswork

---

### Use Case 2: SEO Professional Auditing Client Site

**Scenario**: Hired to improve SEO for client blog

**How Brainstorm Helps**:
1. Connects client's GSC account
2. Runs Brainstorm analysis on core topic: "Content Marketing"
3. Identifies 3 months of quick wins
4. Creates content roadmap:
   - Week 1-2: Quick wins (5 posts)
   - Week 3-4: Opportunity optimization (3 posts)
   - Month 2: Keyword gap content (4 posts)
5. Presents data-backed strategy to client

**Result**: Objective, data-driven content roadmap

---

### Use Case 3: Blog Network Manager

**Scenario**: Managing 5 blogs across different niches

**How Brainstorm Helps**:
1. Runs Brainstorm on each blog weekly
2. Identifies top 3 quick wins per blog
3. Batches content creation across team
4. Tracks health scores over time
5. Measures impact of suggestions vs actual rankings

**Result**: Systematic, scalable content planning process

---

## 🎯 Real-World Example

### Full Brainstorm Run

**Input**: 
```
User: Diana, Tech Blogger
Topic: "JavaScript async programming"
Site: https://techblog.example.com
Data Period: Last 30 days
```

**GSC Raw Data**:
- 245 total keywords tracked
- 12,400 total impressions
- 312 total clicks (2.5% average CTR)

**After Topic Filtering**:
- 47 relevant keywords found
- 5,200 impressions (42% of total)
- 128 clicks

**Rule-Based Analysis Results**:

```
QUICK WINS (5):
├─ "JavaScript promises tutorial" - Pos 6, 800 impr, +18 clicks potential
├─ "Async await best practices" - Pos 8, 620 impr, +12 clicks potential
├─ "Promise.all vs Promise.allSettled" - Pos 7, 480 impr, +10 clicks potential
├─ "JavaScript callbacks explained" - Pos 9, 350 impr, +8 clicks potential
└─ "Async function error handling" - Pos 5, 290 impr, +6 clicks potential

CONTENT OPPORTUNITIES (4):
├─ "JavaScript event loop" - 2,100 impr, 1.1% CTR, +45 clicks potential
├─ "JavaScript asynchronous programming" - 1,800 impr, 1.5% CTR, +35 clicks potential
├─ "Async programming patterns" - 1,200 impr, 2.1% CTR, +18 clicks potential
└─ "Parallel execution JavaScript" - 600 impr, 0.8% CTR, +12 clicks potential

KEYWORD GAPS (3):
├─ "JavaScript concurrency" - Pos 16, 450 impr, +80 if page 1
├─ "Concurrent programming JavaScript" - Pos 14, 380 impr, +65 if page 1
└─ "JavaScript parallelization" - Pos 19, 200 impr, +35 if page 1
```

**AI Recommendations**:

```
IMMEDIATE OPPORTUNITIES:
1. "The Ultimate Guide to JavaScript Async/Await"
   - Targets: "async await best practices", "async function error handling"
   - Format: How-To Guide
   - Impact: +30 clicks/month in 2-3 weeks

2. "JavaScript Promises vs Async/Await: Complete Comparison"
   - Targets: "JavaScript promises tutorial", "Promise.all vs Promise.allSettled"
   - Format: Comparison
   - Impact: +28 clicks/month

3. "JavaScript Event Loop Explained (2026)"
   - Targets: "JavaScript event loop", "JavaScript asynchronous programming"
   - Format: Explainer
   - Impact: +80 clicks/month in 4-6 weeks

CONTENT STRATEGY:
1. "Topic Cluster: Mastering JavaScript Asynchronous Programming"
   - Create pillar page + 5-7 related articles
   - Establish topical authority
   - Impact: +200 clicks/month over 3 months

LONG-TERM STRATEGY:
1. "The Definitive JavaScript Async/Concurrent Programming Handbook"
   - Comprehensive reference guide
   - Attracts backlinks and citations
   - Impact: +500 clicks/month over 6 months
```

**Health Score**: 64/100
- Interpretation: Good page 1 presence (13 keywords), room for CTR improvement
- Action: Focus on quick wins and opportunity optimization

---

## ✅ Implementation Details

### Frontend Stack
- **React 18+** with TypeScript strict mode
- **Hooks**: `useGSCBrainstorm()` custom hook for state management
- **Components**: 
  - `BrainstormButton.tsx` - Button to trigger brainstorm
  - `GSCBrainstormModal.tsx` - Full modal interface (1,000+ lines)
  - Tab system with 5 views

### Backend Stack
- **FastAPI** with async/await
- **Pydantic** for request/response validation
- **LLM Integration**: Gemini Pro via `llm_text_gen()`
- **GSC API**: Google's Search Console API v1
- **ML Model**: sentence-transformers (all-MiniLM-L6-v2) for semantic similarity

### Data Flow
```
Frontend                Backend                GSC API
   │                       │                      │
   ├─ POST /gsc/brainstorm ─→ Parse request       │
   │                           │                  │
   │                           ├─ Get OAuth creds │
   │                           │                  │
   │                           └─ Fetch GSC data ←─
   │                              (30 days)
   │
   │                           Filter by topic
   │                           ↓
   │                           Rule-based analysis
   │                           ↓
   │                           LLM recommendations
   │                           ↓
   │                           Format response
   │
   │← JSON response ←──────────┤
   │
   Display results
   ├─ 5 tabs
   ├─ Health score
   ├─ Metrics
   └─ Clickable suggestions
```

---

## 🔐 Security & Permissions

### Authentication
- **Required**: User must be logged in
- **Token**: OAuth 2.0 JWT bearer token
- **Scope**: User can only access their own GSC data

### Authorization
- **GSC Connection**: User must have connected GSC account
- **Site Verification**: Site must be verified in GSC
- **Data Privacy**: Data stored per user_id

### Rate Limiting
- **Max Brainstorms**: 10 per hour per user
- **Timeout**: 5 minutes (for LLM calls via Wavespeed)
- **Caching**: Results cached in localStorage to reduce API calls

---

## 📈 Performance Characteristics

### Execution Time
| Step | Duration | Notes |
|------|----------|-------|
| GSC Data Fetch | 0.5-1s | API call to Google |
| Topic Filtering | 0.2-0.5s | ML model inference |
| Rule-Based Analysis | 0.1-0.2s | Local computation |
| LLM Recommendations | 2-4s | Gemini API call |
| **Total** | **3-6s** | End-to-end (can vary) |

### Optimization Strategies
1. **Parallelization**: Fetch GSC + check cache in parallel
2. **Caching**: localStorage prevents re-running for same keywords
3. **Lazy Loading**: Render results tabs one at a time
4. **Streaming**: Progress messages to keep UI responsive

---

## 🐛 Error Handling

### Common Errors & Solutions

**Error 1**: "No GSC sites found"
- **Cause**: User hasn't connected GSC or no verified sites
- **Solution**: Prompt user to connect GSC first

**Error 2**: "Please provide at least 3 words"
- **Cause**: User entered 1-2 word topic
- **Solution**: Show requirement in input help text

**Error 3**: "No keyword data available"
- **Cause**: Site is new or has no search traffic
- **Solution**: Inform user and suggest checking GSC directly

**Error 4**: LLM timeout (>5 min)
- **Cause**: Wavespeed API lag or network issue
- **Solution**: Fallback to rule-based recommendations

---

## 🎓 Configuration & Customization

### Backend Configuration

**GSC Credentials** (`backend/gsc_credentials.json`):
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

### Threshold Customization

**File**: `backend/services/gsc_brainstorm_service.py` (methods starting with `_identify`)

**Thresholds**:
- Impressions multiplier: `int(500 * threshold_multiplier)` - Adjustable per topic
- CTR threshold: `3.0%` - Industry average
- Position ranges: Hardcoded (positions 4-10 for quick wins, etc.)

---

## 📚 Advanced Topics

### Semantic Similarity Scoring

**How It Works**:
1. **Encode User Keywords**: "Python productivity tools" → Vector (384-dim)
2. **Encode Each GSC Keyword**: "Python IDE" → Vector
3. **Compute Cosine Similarity**: Ranges 0-1
4. **Threshold Filtering**: Keep similarities > 0.3

**Advantages**:
- ✅ Catches synonyms ("Python IDE" ≈ "Python editor")
- ✅ Understands compound concepts
- ✅ Language agnostic

**Limitations**:
- ⚠️ ML model requires download on first use
- ⚠️ Slower than token-based matching
- ⚠️ May timeout if model unavailable

### Topic Relevance Algorithm

**Blended Score Formula**:
```
Final Relevance = 0.5 × Semantic_Similarity + 0.5 × Token_Overlap

where:
  Token_Overlap = (Matching_Tokens / Total_User_Tokens) × 0.5 + 
                  (Substring_Matches / Total_User_Tokens) × 0.2

  Semantic_Similarity = cosine_sim(encode(user_keywords), encode(gsc_keyword))
```

**Ranking Strategy**:
1. Sort all keywords by Final_Relevance (descending)
2. Keep top 150
3. Add top 50 by impressions (ensures coverage)
4. Deduplicate by keyword text
5. Result: 150-200 focused keywords

---

## 🚀 Future Enhancements

### Planned Features (Phase 2)

**1. A/B Testing Suggestions**
- Propose title/meta variations for each opportunity
- Predict CTR impact
- Track performance over time

**2. Competitive Gap Analysis**
- "Your competitors rank for X, you don't"
- Suggest topics to match competitor portfolios

**3. Trend Detection**
- "This keyword is trending up 45% month-over-month"
- Prioritize emerging keywords

**4. Content Calendar Integration**
- Auto-schedule suggested posts in editorial calendar
- Assign to team members

**5. Performance Tracking**
- Track which suggestions you published
- Measure actual rankings vs predictions
- Calculate ROI

---

## 🤝 Related Features

- **[Blog Writer](./overview.md)** - Content creation with integrated brainstorm
- **[SEO Dashboard](../seo-dashboard/overview.md)** - Comprehensive GSC analysis
- **[GSC Integration](../seo-dashboard/gsc-integration.md)** - How to connect GSC
- **[Research Integration](./research.md)** - Topic research capabilities

---

## 📞 Support & Troubleshooting

### FAQ

**Q: Why are my topic suggestions not showing?**  
A: Make sure you've connected your GSC account and your site has at least 7 days of search data.

**Q: How often is GSC data refreshed?**  
A: We fetch fresh data each time you run Brainstorm (no caching at service level, only frontend cache).

**Q: Can I brainstorm multiple topics simultaneously?**  
A: Not recommended - it would generate too many suggestions. Brainstorm one topic at a time.

**Q: What's the minimum word count for a topic?**  
A: Minimum 3 words required (e.g., "Python web frameworks" ✅, "Python" ❌).

**Q: How accurate are the traffic projections?**  
A: Based on industry benchmarks and historical patterns. Actual results vary by competition and content quality (typically 70-90% accurate).

---

## 📊 Analytics & Monitoring

### Logging

**Service Logging**:
- INFO: GSC brainstorm requests, completion status
- WARNING: ML model unavailability, fallback to token matching
- ERROR: API failures, LLM timeouts, GSC connection issues

**Frontend Logging**:
- Network requests to `/gsc/brainstorm`
- Suggestion selection (which topics users pick)
- Tab views (which findings users find most valuable)

---

*Last Updated: May 26, 2026*  
*Status: ✅ Production Ready*  
*Integration Level: Full Frontend-Backend Integration*
