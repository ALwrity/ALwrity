# GSC Brainstorm Topics — Testing Guide

> For testers, content creators, and non-technical reviewers.
> This document explains what the feature does, how to test it, what to look for in the UI, how the backend logic works, and how to estimate costs.

---

## 1. What Is This Feature?

The **Brainstorm Topics** feature analyzes your **Google Search Console (GSC)** data and suggests blog post ideas you should write.

It answers the question:

> *"I run a website about [topic X]. What should I blog about next to get more traffic?"*

The tool looks at which search queries are already bringing people to your site, finds underperforming content and keyword gaps, and uses an AI to recommend specific blog post titles with traffic estimates.

---

## 2. Prerequisites

| Requirement | Details |
|---|---|
| GSC Connection | You must have Google Search Console connected to your account (Settings > Integrations > GSC) |
| GSC Data | Your site must have at least 30 days of search data in GSC |
| Topic Input | You must enter **at least 3 words** describing what you want to write about (e.g. "vegan meal prep recipes") |
| AI Credits | The AI recommendations step uses LLM credits |

---

## 3. Step-by-Step Testing Walkthrough

### Step 1: Open the Brainstorm Modal

1. Navigate to the **Blog Writer** page
2. Look for the **Brainstorm Topics** button (next to the topic input field)
   - If you have configured GSC API (experimental): You will see a green glowing dot next to the button
3. Click the button

**Expected result:** A large modal dialog opens (90vw × 90vh) with a loading state showing progress messages.

### Step 2: Enter a Topic

1. In the modal header, you will see an input field pre-filled with your current blog topic
2. You can edit this to a more specific topic (e.g. change "vegan" to "vegan meal prep for beginners")
3. Click the **Re-Run** button (next to the input field)

**Expected result:** The modal shows a loading state with step-by-step progress messages:
   - "Fetching GSC data..."
   - "Analyzing topic relevance..."
   - "Finding opportunities..."
   - "Generating AI recommendations..."

### Step 3: Observe the Results

After ~30–120 seconds (depending on your GSC data size), the modal will display a **Summary Dashboard** and **5 tabs** of analysis:

#### Summary Dashboard (shown at the top)
```
┌──────────────────────────────────────────────────────────┐
│  Keywords: 342  │  Impressions: 45.2K  │  Clicks: 1.2K  │
│  Avg Position: 14.2  │  Avg CTR: 2.7%  │  Health: 42/100 │
│  [Donut chart: position distribution]                     │
│  SEO Health: 42/100 - Below average. 58% of keywords     │
│  rank outside the top 20 results.                         │
└──────────────────────────────────────────────────────────┘
```

**What to look for:**
- ✓ The numbers should reflect your actual GSC site data
- ✓ The donut chart segments should sum to 100%
- ✓ The health score explanation should match your distribution
- ✓ Hover over metrics to see tooltips explaining what each means

#### Tab 1: Quick Wins
Keywords already on **page 1** (positions 4–10) that with small optimizations could reach the top 3.

**What to look for:**
- ✓ Each item shows: keyword, current position, CTR, estimated traffic gain
- ✓ Keywords should be **topic-relevant** (related to your entered topic)
- ✓ With a broad/well-trafficked topic: expect 3–5 items
- ✓ With a narrow/new topic: expect 0–2 items (this is normal — see Optimization 4)

#### Tab 2: Content Opportunities
Two types:
- **Content Optimization**: High impressions + low CTR (Google shows your page but people don't click)
- **Content Enhancement**: Ranking on page 2 (positions 11–20) — a content boost could push to page 1

**What to look for:**
- ✓ Each item explains WHY this is an opportunity and gives an estimated traffic gain
- ✓ The "potential_impact" tag says "High" or "Medium"
- ✓ The "suggested_format" recommends a content type (How-To, Listicle, etc.)

#### Tab 3: Keyword Gaps
Keywords ranking on page 1–2 (positions 4–20) that have untapped traffic potential if improved.

**What to look for:**
- ✓ Shows gap_from_page1 (how many positions to improve)
- ✓ Shows estimated_traffic_if_page1 (clicks if ranking #1–3)
- ✓ Keywords should be topic-relevant

#### Tab 4: Pages (Page Opportunities)
Individual pages with high impressions but low CTR (<2%).

**What to look for:**
- ✓ Page URL + current CTR + suggested fix
- ✓ These are pages where the title/meta description needs rewriting

#### Tab 5: AI Recommendations
LLM-generated blog post suggestions based on all the data above. Three sections:

| Section | Purpose |
|---|---|
| **Immediate Opportunities** | 3–5 specific blog posts you can write TODAY |
| **Content Strategy** | 3–5 pillar/strategic content ideas |
| **Long-Term Strategy** | 3–5 authority-building content ideas |

**What to look for:**
- ✓ Each recommendation has a **specific title** (not vague — e.g. "10 Vegan Meal Prep Recipes Under 30 Minutes" not just "Write about vegan")
- ✓ Each references the keyword it targets + WHY (based on the data)
- ✓ Has a specific format recommendation
- ✓ Every recommendation relates to your entered topic

### Step 4: Use a Suggestion

Click anywhere on a suggestion to select it. The keyword/title is passed back to the Blog Writer input.

**Expected result:** The modal closes and the selected keyword/topic appears in the Blog Writer's topic field.

---

## 4. What to Test — Edge Cases & Failure Modes

### 4.1 No GSC Data
**How to test:** Use a new site with < 30 days of search data.
**Expected:** Error message: *"No keyword data available for the selected period..."*

### 4.2 No Topic Match
**How to test:** Enter a very niche/unrelated topic (e.g. "quantum physics gardening" on a food blog).
**Expected:** Error message: *"No GSC keywords matched your topic..."* or very few results (0–3 per category).

### 4.3 Short Topic (< 3 words)
**How to test:** Enter 1–2 words.
**Expected:** API returns 400 error: *"Please provide at least 3 words..."*

### 4.4 No GSC Connected
**How to test:** Don't configure GSC or use a user account without GSC.
**Expected:** Error message: *"No GSC sites found..."*

### 4.5 Loading State
**How to test:** Click "Brainstorm Topics" and watch the progress messages.
**Expected:** You should see sequential messages updating every ~10–15 seconds. If the same message persists for >2 minutes, something is stuck.

### 4.6 Re-Run with Different Keywords
**How to test:**
1. Run brainstorm on "vegan recipes"
2. Edit the topic to "vegan meal prep for beginners"
3. Click Re-Run

**Expected:** New data loads. The results should be different — more focused on "meal prep" and "beginners" keywords.

### 4.7 Re-Run on Same Keywords (Cache)
**How to test:**
1. Run brainstorm on "vegan recipes"
2. Immediately click Re-Run with the same keywords
3. Note how long it takes

**Expected:** The second run should complete faster (~2–5 seconds instead of 30–120s) because results are cached in the frontend localStorage.

### 4.8 Very Broad Topic
**How to test:** Enter a broad topic like "marketing" or "business".
**Expected:** Many results across all tabs (10+ in most categories). The AI recommendations should be more general.

---

## 5. The 4 Backend Optimizations — What Changed & How to Verify

We made four improvements to make results more topic-relevant. Here is how to verify each:

### Optimization 1: Keyword Overlap Scoring

**What it does:** Before any analysis, every GSC keyword is scored for how much it overlaps with your topic. Only the top topic-relevant keywords are kept.

**How to verify:**
- Run brainstorm on "vegan recipes"
- Check that results show vegan-related keywords (tofu, plant-based, meatless, etc.) — NOT your site's overall top keywords like "homepage" or "contact us"

### Optimization 2: Topic-Specific Prompt Enrichment

**What it does:** The AI prompt now includes **25 topic-relevant keywords** (name, position, impressions, CTR) instead of just the site's global top 5.

**How to verify:**
- Look at the AI Recommendations tab
- Check that each recommendation references a topic-relevant keyword
- Example: For topic "vegan meal prep", recommendations should say "Write about 'meal prep containers'" not "Write about 'gaming laptops'"

### Optimization 3: Semantic Similarity Filter

**What it does:** Uses an AI embedding model to catch **synonyms**. For example, "plant-based protein" gets scored as relevant to "vegan" even though they share no exact words.

**How to verify:**
- Test with a topic like "vegan" and look for results about "plant-based diet", "dairy-free", "cruelty-free"
- Test with "budget travel" and look for results about "cheap flights", "affordable hotels", "backpacking"

### Optimization 4: Adjusted Rule Thresholds

**What it does:** When your topic is narrow (few matching keywords), the system lowers impression thresholds to surface more opportunities that would otherwise be hidden.

**How to verify:**
- Test with a very narrow topic (e.g. "organic vegan gluten-free dog food")
- The "Quick Wins" and "Keyword Gaps" tabs should show at least 1–3 results even with limited data
- Compare with a broad topic (e.g. "digital marketing") — that tab should show 5+ results
- If you get 0 results on a narrow topic, Optimization 4 would have helped surface them

---

## 6. Backend Logic Walkthrough (Non-Tech)

Here is what happens when you click "Brainstorm Topics":

```
Step 1: FETCH ───────────────────────────────────────────────
  │  Your GSC API is called to get the last 30 days of
  │  search query data (~1,000 rows) and page data
  ▼
Step 2: FILTER ──────────────────────────────────────────────
  │  Each keyword is scored for topic relevance:
  │    • Term overlap (50%): Does "vegan" appear in the keyword?
  │    • Semantic match (50%): Is the meaning similar? 
  │      (e.g. "plant-based protein" ≈ "vegan")
  │  Top relevant keywords are kept, rest are discarded
  ▼
Step 3: ANALYZE ─────────────────────────────────────────────
  │  The filtered keywords are checked against 4 rules:
  │    • Quick Wins: Keywords on page 1 (positions 4-10)
  │    • Content Optimization: High impressions, low CTR
  │    • Keyword Gaps: Untapped traffic potential
  │    • Page Issues: Pages with low CTR
  │  Thresholds auto-adjust if data is sparse
  ▼
Step 4: SUMMARIZE ───────────────────────────────────────────
  │  Metrics are computed: total impressions, clicks,
  │  average position, CTR, health score, etc.
  ▼
Step 5: AI RECOMMEND ────────────────────────────────────────
  │  The filtered keyword data, opportunities, and quick
  │  wins are sent to an LLM (GPT/Gemini) which generates
  │  specific blog post titles with traffic estimates
  ▼
Step 6: DISPLAY ─────────────────────────────────────────────
  │  Results are returned to the UI and shown in tabs
```

### Real Example

User enters: **"vegan meal prep"**

1. **Fetch**: GSC returns 1,000 keywords for this site
2. **Filter**: Only ~85 keywords relate to "vegan" or "meal prep" — these are kept
   - "vegan recipes" ✓, "plant based protein" ✓ (via semantic match), "python tutorial" ✗
3. **Analyze**:
   - Quick wins: "vegan protein powder" (position 6, 600 impressions)
   - Content opty: "vegan meal prep" (position 14, 300 impressions → needs enhancement)
   - Gaps: "tofu recipes" (position 8, could hit position 3 with +200 clicks)
4. **AI recommends**:
   - "10 Vegan Meal Prep Bowls Under 30 Minutes" (targets: meal prep, vegan recipes)
   - "Best Plant-Based Protein Powders for Beginners" (targets: plant based protein)
   - "Complete Guide to Tofu: From Beginner to Master Chef" (targets: tofu recipes)

---

## 7. Free Plan & Cost Estimation

### GSC API Quota (Free)

Google Search Console API is **free** with these limits:

| Limit | Value |
|---|---|
| Daily queries per project | 200,000 |
| Queries per 100 seconds per project | 2,000 |
| Queries per 100 seconds per user | 200 |

Each brainstorm call uses **1 query for keywords + 1 query for pages = 2 queries**.
At 200k daily quota, you can run **100,000 brainstorm calls per day** — effectively unlimited.

### LLM Costs (Used for AI Recommendations)

Only the AI Recommendations tab (Step 5) costs money. Steps 1–4 are free.

| Model | Approx cost per brainstorm |
|---|---|
| GPT-4o-mini | ~$0.001 (1/10 cent) |
| Gemini 1.5 Flash | ~$0.0005 (1/20 cent) |
| Claude 3 Haiku | ~$0.001 (1/10 cent) |

**Estimated range: $0.0005 – $0.003 per brainstorm** (depending on keyword count and model).

### How to Estimate Your Monthly Cost

```
Monthly cost = Brainstorms per month × Cost per brainstorm

Example: 100 brainstorms/month × $0.001 = $0.10/month
```

The main cost driver is the **AI recommendations step** — the filtering and rule analysis are free.

### Caching

Results are cached in your browser (localStorage) so re-running the same topic with the same site URL does NOT cost additional LLM credits. The cache is cleared when:
- You close the browser tab
- You clear your browser cache
- The cache exceeds its size limit

---

## 8. Data Flow Diagram (Simplified)

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Blog Writer  │────▶│  Brainstorm Modal │────▶│  /gsc/brainstorm  │
│  (topic input)│     │  (UI, tabs, etc) │     │  API endpoint     │
└──────────────┘     └──────────────────┘     └────────┬──────────┘
                                                       │
                                                       ▼
                                              ┌───────────────────┐
                                              │ GSCBrainstorm     │
                                              │ Service           │
                                              │                   │
                                              │ 1. Fetch GSC data  │
                                              │ 2. Filter by topic │
                                              │ 3. Rule analysis   │
                                              │ 4. Summary metrics │
                                              │ 5. AI recommendations│
                                              └───────────────────┘
                                                       │
                                                       ▼
                                              ┌───────────────────┐
                                              │ Google Search     │
                                              │ Console API (free) │
                                              └───────────────────┘
```

---

## 9. Troubleshooting Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Loading spinner >2 min | GSC API timeout or LLM timeout | Close modal, check GSC connection, try again |
| "No GSC sites found" | GSC not connected | Go to Settings > Integrations > GSC |
| "Provide at least 3 words" | Topic too short | Enter a longer topic phrase |
| 0 results in all tabs | Topic too narrow or no GSC data | Try a broader topic or check GSC data exists |
| AI recommendations empty | LLM quota exhausted or API error | Check your LLM provider credits |
| "Failed to fetch GSC data" | GSC credentials expired | Reconnect GSC in Settings |
| Green dot missing on button | GSC experimental flag off | Toggle "Enable GSC API" in settings |

---

## 10. Verification Checklist for Testers

Use this checklist to confirm the feature is working correctly:

- [ ] Brainstorm button is visible on Blog Writer page
- [ ] Clicking button opens the modal (large, 90vw×90vh)
- [ ] Loading state shows progress messages
- [ ] Summary dashboard shows with correct numbers
- [ ] Donut chart renders correctly (4 segments)
- [ ] Metric tooltips appear on hover
- [ ] Quick Wins tab shows topic-relevant keywords
- [ ] Content Opportunities tab shows >0 items for broad topics
- [ ] Keyword Gaps tab shows items with traffic estimates
- [ ] Pages tab shows pages with low CTR
- [ ] AI Recommendations tab has 3 sections with 3–5 items each
- [ ] Clicking a suggestion closes modal and fills topic input
- [ ] Re-Run with different keywords works
- [ ] Re-Run with same keywords is cached (fast)
- [ ] Error states show friendly messages (not raw JSON)
- [ ] "No GSC data" shows the right error message
- [ ] "No topic match" shows the right error message
- [ ] Green indicator visible when GSC API is configured
- [ ] Content creators understand all metric explanations (plain English)
- [ ] Semantic synonyms appear (e.g. "plant-based" for "vegan")
- [ ] Narrow topics still show at least some results
