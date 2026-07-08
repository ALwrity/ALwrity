# ALwrity — AI-Powered Digital Marketing Platform

**Create, Optimize, and Publish AI-Generated Content Across All Channels with Contextual Intelligence**

---

## Overview

ALwrity is a production-ready, contextual content operating system designed for creators and marketers who demand intelligence over tools. The platform ingests your website, competitors, and channels to build a reusable brand brain, enabling multi-surface content generation (blogs, stories, YouTube, podcasts, video) from a single understanding.

**Key Value Proposition:**
- **One Brain, Many Surfaces** — Same insights power blog posts, stories, YouTube scripts, podcasts, and videos
- **Grounded in Reality** — All content derives from real data (SEO, competitors, web research) before generation
- **Production-Ready** — JWT/OAuth2 auth, usage tracking, rate limiting, monitoring, and cost awareness built-in
- **Operator-First Design** — Guides workflows with intelligence, not knobs

---

## What's New in This Release (feat/create-wedge-enhancements)

### 🎯 LinkedIn Content Studio Enhancements

#### **1. Brainstorm & Content Discovery**
- **Article Brainstorm Integration** — Full brainstorming flow for LinkedIn articles with research grounding
- **Exa-Powered Research** — Advanced content discovery using Exa search for personalized ideas
- **Research-to-Key-Points Mapping** — Automatic conversion of research findings into structured key points
- **Brainstorm Modal Refinements** — Improved UX with proper modal sequencing and safety timeouts
- **Enhanced Create Wedge Modal** — Integrated brainstorm, advanced options, and get-key-points in one workflow

#### **2. Format & Content Management**
- **Carousel & Video Format Controls** — Greyed out unsupported formats with clear UX indicators
- **Format Picker Integration** — Unified format selection across content creation
- **Advanced Options Panel** — Expanded customization for content generation parameters
- **Variations Framework** — Support for multiple content variations with comparison

#### **3. Data Models & APIs**
- **LinkedIn Brainstorm Models** — `linkedin_brainstorm_saved_ideas_db_models.py` with persistence layer
- **LinkedIn Search Models** — `linkedin_search_models.py` for Unipile-based search integration
- **LinkedIn Social Models** — Enhanced social interaction data structures
- **Brainstorm Service** — `services/brainstorm/` with personalized and search providers
- **Contact Form Service** — `contact_form_service.py` for user engagement tracking

#### **4. Frontend Components**
- **BrainstormFlow** — Complete brainstorm workflow component (977+ lines)
- **DataSourceSelector** — Research source selection and filtering
- **MySavedIdeas** — Persistent saved ideas panel with library management
- **PersonalizedIdeasPanel** — AI-powered personalized content suggestions
- **KeyPointsSection** — Structured key points generation and display
- **OutlineEditor** — Full article outline editing with research grounding
- **VariationPicker** — Content variation selection and comparison
- **LinkedInSearchModal** — Integrated LinkedIn search with Unipile Classic API
  - Search bar with autocomplete
  - Multi-type results (people, companies, jobs, posts)
  - Error handling and empty states
  - Result filtering and pagination

#### **5. Dashboard & Analytics**
- **Analysis Wedge Modals** — AnalysisWedgeModals component (1364+ lines)
- **Engagement Wedge Modals** — EngagementWedgeModals for engagement insights
- **Publish Wedge Modals** — Publishing workflow with scheduling and analytics
- **Remark Wedge Modals** — Feedback and revision tracking
- **Knowledge Center Modals** — AI-first features replacing static tiles
- **Post Analytics Panel** — Enhanced analytics with:
  - Brand Score Summary Card
  - Engagement Trends Timeline Chart
  - Post Analytics with real-time metrics
- **Profile Growth Widget** — Visualization of profile optimization progress
- **Daily Digest Widget** — Content recommendations and insights

#### **6. Profile Optimization**
- **Brand Identity Card** — Brand voice and identity management (333+ lines)
- **Section Scores Panel** — Per-section profile health metrics
- **Profile Optimization Overhaul** — Comprehensive refactor (517+ lines)
- **Profile Validation Types** — `profile_validation_types.py` with structured validation rules

#### **7. Editor & Formatting**
- **Rich Text Editor** — RichTextEditor component with markdown support
- **Markdown Toolbar** — Complete markdown formatting toolbar
- **Markdown Formatting Utils** — contentFormatters utilities for text processing
- **Content Display Area** — Enhanced preview with research source display

#### **8. APIs & Integrations**
- **LinkedIn Search Routes** — `linkedin_search_routes.py` (171 lines) with Unipile integration
- **LinkedIn Social Routes** — Social interaction endpoints
- **Contact Routes** — `contact_routes.py` for form submissions and tracking
- **Brainstorm API** — Enhanced `api/brainstorm.py` (536 lines) with multiple providers
- **Research Cache** — `services/cache/research_cache.py` for query result caching

#### **9. Backend Services**
- **Personalized Brainstorm Service** — ML-powered content idea generation
- **Search Brainstorm Service** — Search-driven discovery and ideation
- **Exa Research Provider** — Enhanced Exa API integration
- **LinkedIn Search Service** — `linkedin_search_service.py` with Unipile Classic
- **Unipile Client** — `unipile_client.py` for LinkedIn data access
- **LinkedIn OAuth Service** — Enhanced OAuth with token refresh and rotation

#### **10. Landing & Marketing Pages**
- **Contact Page Audit (Jul 2026)** — Professional contact form with JSON-LD
- **Landing Page Redesign** — Hero section, feature showcase, pricing teaser
- **Enterprise CTA** — Call-to-action for enterprise customers
- **Brand Mark Refinement** — Updated logo and brand assets
- **Landing Navigation** — Improved site navigation with deep-linking support
- **Navigation Canonical Tags** — SEO-optimized canonical URLs

#### **11. Onboarding & Setup**
- **Onboarding Task Scheduler** — Fixed background task execution
- **Step 3 Routing** — Improved website analysis step handling
- **Step Management Service** — Enhanced step state management
- **Competitor Analysis Step** — Refined competitor data collection
- **Website Analysis** — Deep-link support and per-section analysis

#### **12. DevOps & Deployment**
- **Daily Prod Sync Scripts** — `scripts/git/daily-prod-sync.ps1` for production synchronization
- **Enterprise Branch Creation** — `scripts/git/new-enterprise-branch.ps1`
- **Enterprise Push Scripts** — `scripts/git/push-enterprise.ps1` for multi-repo workflow
- **Gunicorn Configuration** — Production-ready WSGI server config

---

## Technical Architecture

### Backend Stack
| Component | Technology |
|-----------|-----------|
| **Framework** | FastAPI (Python 3.10+) |
| **ORM** | SQLAlchemy with SQLite/PostgreSQL support |
| **Auth** | JWT + OAuth2 (LinkedIn, Google, YouTube) |
| **Research** | Exa API with caching layer |
| **Search** | Unipile Classic (LinkedIn) |
| **AI Models** | OpenAI, Google Gemini/Imagen, Hugging Face |
| **Monitoring** | Loguru with structured logging |

### Frontend Stack
| Component | Technology |
|-----------|-----------|
| **Framework** | React 18+ with TypeScript |
| **UI Library** | Material-UI (MUI) |
| **State** | React Context + Custom Hooks |
| **HTTP Client** | Axios with request/response interceptors |
| **Rich Editing** | Markdown + HTML-based editors |

### Data Flow
1. **Input** — Website, competitor data, user preferences
2. **Analysis** — Brand brain construction via onboarding pipeline
3. **Generation** — Multi-surface content creation with research grounding
4. **Optimization** — AI-driven quality scoring and improvements
5. **Publishing** — Scheduled or immediate publication to channels
6. **Monitoring** — Usage tracking, cost analysis, error handling

---

## Feature Modules

### ✅ Functional Features

**LinkedIn Studio** (Fact-Grounded, Google-Researched)
- Post/Carousel/Script/Article creation with citations
- Engagement Trends dashboard with snapshot models
- Profile Optimization with per-section scoring
- Brainstorm with Exa research integration
- Search via Unipile Classic API
- Publish Wedge with scheduling and drafts

**Blog Writer** (Research → Outline → Content → SEO → Publish)
- Phase-based navigation with state persistence
- Google-grounded research integration
- Article outline + shared editor
- Quality scorecard and analytics

**Story Writer** (Premise → Outline → Chapters → Export)
- Multi-chapter story generation
- Character persona development
- Export to markdown/PDF

**YouTube Creator Studio**
- Plan → Scenes → Avatar → Render workflow
- Scene-based video composition
- Avatar integration with speech synthesis

**Podcast Maker**
- Audio + Avatar → Short Video generation
- Test Persona workflow
- Audio quality optimization

**Video Studio**
- Multi-module video creation and editing
- Transformation pipelines
- Asset library integration

**SEO Dashboard**
- Google Search Console integration
- Keyword analysis and tracking
- Metadata and performance insights
- Content recommendations

**Persona System**
- Core persona generation from onboarding data
- Platform-specific adaptations (LinkedIn, Facebook, etc.)
- Brand voice and tone configuration
- Persona validation and persistence

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 16+ with npm
- PostgreSQL (optional; SQLite for development)

### Installation

```bash
# Clone the repository
git clone https://github.com/ALwrity/ALwrity.git
cd ALwrity

# Backend setup
cd backend
pip install -r requirements.txt
python start_alwrity_backend.py

# Frontend setup (in a new terminal)
cd frontend
npm install
npm start
```

### Environment Configuration

Create a `.env` file in the `backend` directory:

```bash
# API Keys
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
HF_TOKEN=your_hugging_face_token

# Research APIs
EXA_API_KEY=your_exa_key
SERPER_API_KEY=your_serper_key

# Social Integrations
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_secret
GOOGLE_CLIENT_ID=your_google_client_id
YOUTUBE_API_KEY=your_youtube_key

# Database
DATABASE_URL=sqlite:///./alwrity.db

# Logging
LOG_LEVEL=INFO

# Feature Flags
ENABLE_PODCAST_DEMO=false
```

### Quick Start

1. **Access the Application**
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/api/docs

2. **Complete Onboarding**
   - Connect your website
   - Analyze competitors
   - Set up brand voice and persona

3. **Create Content**
   - Navigate to LinkedIn Studio or Blog Writer
   - Use brainstorm to discover ideas
   - Generate content with research grounding
   - Optimize and publish

---

## API Reference

### Key Endpoints

**Brainstorm**
- `POST /api/brainstorm/ideas` — Generate brainstorm ideas
- `GET /api/brainstorm/saved-ideas` — Retrieve saved ideas
- `POST /api/brainstorm/key-points` — Extract key points from research

**LinkedIn Search**
- `POST /api/linkedin/search` — Search LinkedIn via Unipile
- `GET /api/linkedin/search/results` — Retrieve search results
- `GET /api/linkedin/search/filters` — Get available filters

**Content Generation**
- `POST /api/content/generate-post` — Generate LinkedIn post
- `POST /api/content/generate-article` — Generate LinkedIn article
- `POST /api/content/generate-carousel` — Generate carousel content

**Profile Optimization**
- `GET /api/linkedin/profile/analysis` — Get profile analysis
- `POST /api/linkedin/profile/optimize` — Get optimization recommendations
- `GET /api/linkedin/profile/scores` — Section-level scores

**Publishing**
- `POST /api/publish/schedule` — Schedule content publication
- `POST /api/publish/now` — Publish immediately
- `GET /api/publish/drafts` — List draft content

For complete API documentation, visit: http://localhost:8000/api/docs

---

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# Integration tests
python test/complete_enhanced_test.py
```

---

## Project Structure

```
ALwrity/
├── backend/
│   ├── api/                    # FastAPI routes and endpoints
│   ├── services/               # Business logic and integrations
│   │   ├── brainstorm/         # Brainstorm service providers
│   │   ├── linkedin/           # LinkedIn-specific services
│   │   ├── research/           # Research providers (Exa, etc.)
│   │   └── intelligence/       # AI agents and orchestration
│   ├── models/                 # SQLAlchemy ORM models
│   ├── routers/                # Route mounting and organization
│   └── middleware/             # Request/response middleware
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client services
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Helper utilities
│   └── public/                 # Static assets
├── docs-site/                  # MkDocs documentation
├── scripts/                    # DevOps and automation scripts
└── README.md                   # This file
```

---

## Documentation

- **Docs Site**: [https://ajaysi.github.io/ALwrity/](https://ajaysi.github.io/ALwrity/)
- **Blog Writer Guide**: `docs-site/docs/features/blog-writer/overview.md`
- **SEO Dashboard**: `docs-site/docs/features/seo-dashboard/`
- **LinkedIn Integration**: `frontend/docs/linkedin_factual_google_grounded_url_content.md`
- **Onboarding Flow**: `docs-site/docs/features/onboarding/`
- **SIF Agents**: `docs-site/docs/features/sif-agents/`

---

## Integrations & Security

### Supported Integrations
- **Google Search Console** — SEO data and insights
- **LinkedIn** — Native post, article, profile optimization, and search
- **YouTube** — Channel management and publishing
- **Stripe** — Subscription and payment management

### Security Features
- **JWT Authentication** — Stateless session management
- **OAuth2 Flow** — Secure third-party integrations
- **Rate Limiting** — Request throttling per user/API key
- **CORS Protection** — Cross-origin request validation
- **API Key Injection** — Middleware-level key management
- **Encrypted Tokens** — Secure credential storage

---

## Performance & Reliability

### Optimization Strategies
- **Research Caching** — Deduplicate queries across sessions
- **Database Indexing** — Optimized for common queries
- **Lazy Loading** — Components load data on-demand
- **Batch Processing** — Group API calls to reduce latency
- **Error Recovery** — Automatic retry with exponential backoff

### Monitoring & Observability
- **Structured Logging** — Loguru for detailed tracing
- **Performance Metrics** — Response times and throughput
- **Error Tracking** — Comprehensive error capture and alerts
- **Usage Analytics** — Track feature adoption and costs

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit changes with descriptive messages
4. Push to your fork and submit a pull request

---

## Code of Conduct

Please read our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

---

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/ALwrity/ALwrity/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ALwrity/ALwrity/discussions)
- **Wiki**: [ALwrity Wiki](https://github.com/ALwrity/ALwrity/wiki)
- **Website**: [alwrity.com](https://www.alwrity.com)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Authors

- **AJaySi** — Founder & Lead Developer
- **Team ALwrity** — Contributors and maintainers

Made with ❤️ for creators and marketers who demand intelligence.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Latest Release: feat/create-wedge-enhancements
**256 files changed, 39,802 insertions(+), 5,030 deletions(-)**

Key commits:
- feat(linkedin): article brainstorm, grey out carousel/video, research-to-key-points mapping
- feat(linkedin): enhance Create wedge Post modal with brainstorm, advanced options, get key points
- feat(linkedin): brainstrom revamp — Exa search + personalized ideas + inline form in Plan modal
- feat(contact): July 2026 audit — form API, UX polish, and SEO
- feat(landing): July 2026 audit fixes for marketing page

---

## Acknowledgments

This project builds on the work of:
- [FastAPI](https://fastapi.tiangolo.com/) — Modern Python web framework
- [React](https://react.dev/) — UI library
- [Material-UI](https://mui.com/) — Component library
- [SQLAlchemy](https://www.sqlalchemy.org/) — ORM
- [Exa](https://exa.ai/) — Research API
- [Unipile](https://unipile.com/) — Social media integration
- OpenAI, Google Gemini, Hugging Face — AI models

