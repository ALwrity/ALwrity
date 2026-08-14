# Agent Directory

Detailed reference for all 8 specialised agents, plus the orchestrator and supporting components.

## Committee Agents

### Content Strategy Agent

| Property | Value |
|---|---|
| Registry Key | `content_strategist` |
| Agent Type | `content` |
| Class | `ContentStrategyAgent` |
| Source | `backend/services/intelligence/agents/specialized/content_strategy.py` |
| Pillar Focus | `plan` |

**Role:** Identifies content opportunities, strategic gaps, and performance improvement areas. Proposes tasks for content planning, topic cluster development, and content refreshes.

**Data Sources:**
- Onboarding data (business info, goals, target audience)
- Content performance metrics
- SIF semantic analysis
- Topic cluster graph

**Output:** `TaskProposal` objects with title, description, priority, pillar assignment, and reasoning.

---

### Strategy Architect Agent

| Property | Value |
|---|---|
| Registry Key | `strategy_architect` |
| Agent Type | `strategy` |
| Class | `StrategyArchitectAgent` |
| Source | `backend/services/intelligence/agents/specialized/strategy_architect.py` |
| Pillar Focus | `plan` |

**Role:** Analyses SIF semantic vectors to suggest strategic pivots — topic rebalancing, pillar restructuring, and long-term content roadmap adjustments.

**Data Sources:**
- SIF vector index (txtai semantic embeddings)
- Topic clustering output
- Content gap analysis reports
- Historical strategy performance

**Output:** `TaskProposal` objects focused on strategic planning tasks.

---

### SEO Optimization Agent

| Property | Value |
|---|---|
| Registry Key | `seo_specialist` |
| Agent Type | `seo` |
| Class | `SEOOptimizationAgent` |
| Source | `backend/services/intelligence/agents/specialized/seo_optimization.py` |
| Pillar Focus | `analyze` |

**Role:** Scans for SEO issues (missing metadata, poor keyword coverage, cannibalisation risks, content freshness gaps) and proposes fixes.

**Data Sources:**
- SEO audit results (on-page, technical)
- Keyword performance data
- Content cannibalisation analysis
- Internal linking structure

**Output:** `TaskProposal` objects for SEO remediation tasks.

---

### Social Amplification Agent

| Property | Value |
|---|---|
| Registry Key | `social_media_manager` |
| Agent Type | `social` |
| Class | `SocialAmplificationAgent` |
| Source | `backend/services/intelligence/agents/specialized/social_amplification.py` |
| Pillar Focus | `engage` |

**Role:** Recommends social engagement actions — cross-posting, platform-specific content adaptation, engagement timing optimisation, and audience interaction.

**Data Sources:**
- Social media profiles and accounts
- Engagement metrics
- Platform-specific best practices
- Content calendar items

**Output:** `TaskProposal` objects for social amplification tasks.

---

### Competitor Response Agent

| Property | Value |
|---|---|
| Registry Key | `competitor_analyst` |
| Agent Type | `competitor` |
| Class | `CompetitorResponseAgent` |
| Source | `backend/services/intelligence/agents/specialized/competitor_response.py` |
| Pillar Focus | `analyze` |

**Role:** Monitors competitor content activity and alerts when competitors publish relevant content, launch campaigns, or target overlapping keywords.

**Data Sources:**
- Competitor domain list (from onboarding)
- Exa competitor content index
- SERP ranking changes
- Content freshness tracking

**Output:** `TaskProposal` objects for competitive response actions.

---

### Content Gap Radar Agent

| Property | Value |
|---|---|
| Registry Key | `content_gap_radar` |
| Agent Type | `content_gap_radar` |
| Class | `ContentGapRadarAgent` |
| Source | `backend/services/intelligence/agents/content_gap_radar_agent.py` |
| Pillar Focus | `generate` |

**Role:** Scores and prioritises content opportunities by combining SIF semantic gap analysis, SERP ranking presence (Google CSE), competitor content deep-dives (Exa), and trend momentum into a single ROI score per topic.

**Pipeline:**
1. Get topic-level gaps from SIF semantic analysis
2. Get SERP ranking data per topic
3. Get Exa competitor content for top topics
4. Compute ROI score combining gap size, ranking opportunity, competitor coverage, and trend momentum

**Data Sources:**
- SIF vector index (txtai)
- Google Custom Search Engine (SERP data)
- Exa API (competitor content)
- Google Trends data
- `SerpGapService`
- `CompetitorContentService`

**Output:** `TaskProposal` objects for priority content creation.

---

## Independent Agents

### Trend Surfer Agent

| Property | Value |
|---|---|
| Registry Key | `trend_surfer` |
| Agent Type | `trend` |
| Class | `TrendSurferAgent` |
| Source | `backend/services/intelligence/agents/trend_surfer_agent.py` |

**Role:** Identifies high-potential market trends and generates timely content angle suggestions. Integrates real-time Google Trends data with internal market signals from `MarketSignalDetector`.

**Pipeline:**
1. Fetch real-time trending searches from Google Trends
2. Detect internal market signals (competitor moves, SERP shifts)
3. Analyse real-time trends and convert actionable ones to signals
4. Filter for high-impact trends (High/Critical urgency)
5. Assign content angles, urgency, and ROI projections

**Data Sources:**
- Google Trends service
- `MarketSignalDetector` (competitor signals, SERP signals)
- Historical trend performance

**Output:** Trend opportunity list with impact score, urgency, suggested content angle, and coverage gap context. Logged as `trend_signals` event in the activity feed.

---

### Content Guardian Agent

| Property | Value |
|---|---|
| Registry Key | `content_guardian` |
| Agent Type | `guardian` |
| Class | `ContentGuardianAgent` |
| Source | `backend/services/intelligence/agents/specialized/content_guardian.py` |

**Role:** Committee watchdog that audits proposal quality, evaluates agent behaviour, detects coverage gaps and overlaps, and generates alerts for serious faults. *Never proposes daily tasks alongside the committee.*

**Capabilities:**
- `audit_committee(proposals)` — full committee audit
- `perform_site_audit(url)` — external site quality analysis
- `check_cannibalization()` — content cannibalisation detection
- `style_enforcer(text)` — brand voice compliance
- `safety_filter(text)` — content safety checks

See [ContentGuardianAgent](content-guardian.md) for full detail.

---

## Orchestrator

### StrategyOrchestratorAgent

| Property | Value |
|---|---|
| Class | `StrategyOrchestratorAgent` |
| Source | `backend/services/intelligence/agents/core_agent_framework.py` |

**Role:** Master coordinator. Receives all agent proposals, selects and prioritises tasks, delegates strategic execution to sub-agents, and synthesises results into a unified daily plan.

**Key Functions:**
- `run(instruction, task_context)` — execute orchestration cycle
- `set_sub_agents(agents)` — register the agent team
- `build_task_prompt(instruction, task_context)` — construct the prompt with agent capabilities
- Delegates tasks via `task_delegator` tool to specific sub-agents

---

## Supporting Components

| Component | Role |
|---|---|
| `MarketSignalDetector` | Detects external market signals (competitor moves, SERP changes, industry shifts) |
| `SafetyConstraintManager` | Enforces content safety rules, manages rollback and user approval flows |
| `AgentPerformanceMonitor` | Tracks per-agent execution metrics, success rates, and latency |
| `LLM (txtai / shared)` | Text generation backbone used by agents for task proposals and reasoning |
| `TxtaiIntelligenceService` | Semantic search and vector indexing for SIF agents |
