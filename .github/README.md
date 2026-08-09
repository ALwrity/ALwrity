<div align="center">

# 🚀 ALwrity — AI-Powered Digital Marketing Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://react.dev/)
[![Stars](https://img.shields.io/github/stars/AJaySi/AI-Writer?style=social)](https://github.com/AJaySi/AI-Writer/stargazers)

**Core claim:
 ALwrity is a contextual content OS: it understands your brand, website, competitors, and channels, then uses that understanding to drive every story, video, podcast, and campaign, with memory and analytics in one place.**

[🌐 Live Demo](https://www.alwrity.com) • [📚 Docs Site](https://alwrity.github.io/ALwrity/) • [📖 Wiki](https://github.com/AJaySi/AI-Writer/wiki) • [💬 Discussions](https://github.com/AJaySi/AI-Writer/discussions) • [🐛 Issues](https://github.com/AJaySi/AI-Writer/issues)

</div>

<p align="center">
  <a href="https://ajaysi.github.io/ALwrity/"><img src="https://raw.githubusercontent.com/AJaySi/AI-Writer/main/docs-site/docs/assests/hero-1.jpg" alt="ALwrity dashboard overview" width="30%"/></a>
  <a href="https://ajaysi.github.io/ALwrity/features/blog-writer/overview/"><img src="https://raw.githubusercontent.com/AJaySi/AI-Writer/main/docs-site/docs/assests/hero-2.png" alt="Story Writer workflow" width="30%"/></a>
  <a href="https://ajaysi.github.io/ALwrity/features/seo-dashboard/overview/"><img src="https://raw.githubusercontent.com/AJaySi/AI-Writer/main/docs-site/docs/assests/hero-3.png" alt="SEO dashboard insights" width="30%"/></a>
</p>

---

### What ALwrity is
- **Contextual content OS**: Ingests your website, competitors, and channels to build a reusable brand brain.
- **Multi-surface by design**: Blogs, stories, YouTube, podcasts, and video all read from the same understanding.
- **Agent-driven flows**: Orchestrated research, planning, writing, and optimization instead of one-off prompts.
- **Production-ready**: JWT/OAuth2 auth, usage tracking, limits, monitoring, and cost awareness built-in.

---

### Why ALwrity exists
ALwrity exists for people who care more about **context** than prompts.

Most tools either drown you in knobs or reset to a blank page every time.  
We wanted a system that:
- Remembers what your brand stands for and who you’re speaking to.
- Grounds content in real data (SEO, competitors, web) before it writes.
- Reuses that understanding across every surface instead of duplicating effort.

---

### Why it matters for creators & marketers
- **One brain, many surfaces**: The same insights power blog posts, stories, YouTube scripts, podcast outlines, and video scenes.
- **Less tool-juggling**: Guided flows replace “copy data between 5 SaaS tools and a spreadsheet”.
- **Safer, more factual content**: Grounding and citations reduce hallucinations and rewrites.
- **On-brand by default**: Personas and brand voice settings keep outputs consistent across channels.
- **Operational visibility**: Scheduler “tasks needing intervention”, alerts, and logs highlight issues before your audience does.

---

### What’s functional now
- **AI Blog Writer (Phases)**: Research → Outline → Content → SEO → Publish, with guarded navigation and local persistence (`frontend/src/hooks/usePhaseNavigation.ts`).
- **Story Writer**: Premise → Outline → Chapters → Export, with phase navigation (`frontend/src/hooks/useStoryWriterPhaseNavigation.ts`).
- **YouTube Creator Studio**: Plan → scenes → avatar → render workflow for YouTube videos (`frontend/src/components/YouTubeCreator`).
- **Podcast Maker / Test Persona**: Turn voice + avatar into short videos using the shared video pipeline.
- **Video Studio**: Multi-module video creation, editing, and transformation (`frontend/src/components/VideoStudio`).
- **SEO Dashboard**: Analysis, metadata, and Google Search Console insights (see docs under `docs-site/docs/features/seo-dashboard`).
- **LinkedIn (Factual, Google‑Grounded)**: Real Google grounding + citations + quality metrics for posts/articles/carousels/scripts (see `docs/linkedin_factual_google_grounded_url_content.md`).
- **Persona System**: Core personas and platform adaptations via APIs (`backend/api/persona.py`).
- **Facebook Persona Service**: Gemini structured JSON for Facebook‑specific persona optimization (`backend/services/persona/facebook/facebook_persona_service.py`).
- **Personalization & Brand Voice**: Validation and configuration of writing style, tone, structure (`backend/services/component_logic/personalization_logic.py`).

See details in the Wiki: [Docs Home](https://github.com/AJaySi/AI-Writer/wiki)

---

### Quick Start
1) Clone & install

```bash
git clone https://github.com/AJaySi/AI-Writer.git
cd AI-Writer/backend && pip install -r requirements.txt
cd ../frontend && npm install
```

2) Run locally

```bash
# Backend
cd backend && python start_alwrity_backend.py
# Frontend
cd frontend && npm start
```

3) Open and create
- Frontend: http://localhost:3000
- API docs (local): http://localhost:8000/api/docs
- Complete onboarding → generate content → publish

---

### Integrations & Security
- **Integrations**: Google Search Console (SEO Dashboard), LinkedIn (factual/grounded content).
- **AI Models**: OpenAI, Google Gemini/Imagen, Hugging Face, Anthropic, Mistral.
- **Security**: JWT auth, OAuth2, rate limiting, monitoring/logging.
- **Reliability**: Grounding + retrieval and citation tracking for factual generation.

---

### Tech Stack

| Area | Technologies |
| --- | --- |
| Backend | FastAPI, Python 3.10+, SQLAlchemy |
| Frontend | React 18+, TypeScript, Material‑UI, CopilotKit |
| AI/Research | OpenAI, Gemini/Imagen, Hugging Face, Anthropic, Mistral; Exa, Tavily, Serper (auto provider selection: Gemini default, HF fallback) |
| Data | SQLite (PostgreSQL‑ready) |
| Integrations | Google Search Console, LinkedIn |
| Ops | Loguru monitoring, rate limiting, JWT/OAuth2 |

---

### LLM Providers: Gemini & Hugging Face
- **Auto‑selection**: The backend auto‑selects the provider based on `GPT_PROVIDER` and available keys.  
  - Default: Gemini (if `GEMINI_API_KEY` present)  
  - Fallback: Hugging Face (if `HF_TOKEN` present)
- **Configure**:
  - `GEMINI_API_KEY=...` (text + structured JSON; image via Imagen)
  - `HF_TOKEN=...` (text via Inference API; image via supported HF models)
  - Optional: `GPT_PROVIDER=gemini` or `GPT_PROVIDER=hf_response_api`
- **Text generation**:
  - Gemini: optimized for structured outputs and fast general generation
  - HF: broad model access via the Inference Providers
- **Image generation**:
  - Gemini/Imagen and Hugging Face providers are supported with a unified interface

For module details, see `backend/services/llm_providers/README.md`.

---

### Documentation
- Docs Site (MkDocs): https://ajaysi.github.io/ALwrity/
- Blog Writer (phases and UI): `docs-site/docs/features/blog-writer/overview.md`
- SEO Dashboard overview: `docs-site/docs/features/seo-dashboard/overview.md`
- SEO Dashboard GSC integration: `docs-site/docs/features/seo-dashboard/gsc-integration.md`
- LinkedIn factual, Google-grounded content: `docs/linkedin_factual_google_grounded_url_content.md`
- Persona Development (docs-site): `docs-site/docs/features/content-strategy/personas.md`

For additional pages, browse the `docs-site/docs/` folder.

---

### Personas (Brief)
ALwrity generates a core writing persona from onboarding data, then adapts it per platform (e.g., Facebook, LinkedIn). Personas guide tone, structure, and content preferences across tools.

- Core Persona & API: `backend/api/persona.py`
- Facebook Persona Service (Gemini structured JSON): `backend/services/persona/facebook/facebook_persona_service.py`
- Personalization/Brand Voice logic: `backend/services/component_logic/personalization_logic.py`
- Docs (GitHub paths):
  - Personas (docs-site): https://github.com/AJaySi/AI-Writer/blob/main/docs-site/docs/features/content-strategy/personas.md
  - LinkedIn Grounded Content plan: https://github.com/AJaySi/AI-Writer/blob/main/docs/linkedin_factual_google_grounded_url_content.md

At a glance:
- Data → Persona: Onboarding + website analysis → core persona
- Platform adaptations: Platform-specific JSON with validations/optimizations
- Usage: Informs tone, content length, structure, and platform best practices

---

### Community
- **Docs & Wiki**: https://github.com/AJaySi/AI-Writer/wiki  
- **Discussions**: https://github.com/AJaySi/AI-Writer/discussions  
- **Issues**: https://github.com/AJaySi/AI-Writer/issues  
- **Website**: https://www.alwrity.com

---

### License
MIT — see [LICENSE](../LICENSE).

<div align="center">

Made with ❤️ by the ALwrity team

</div>
