# ALwrity Landing Page — UI/UX/SEO Audit (July 2026)

**Page:** Public marketing landing (`/` when signed out, `/home` always)  
**Date:** July 3, 2026  
**Auditor:** AI Full-Stack Code Engineer / Technical UI/UX/SEO Auditor  
**Framework:** Alwrity Master Audit Framework (Modules 1–3, Four Growth Pillars)  
**Scope:** Full landing page top-to-bottom — skip link through footer, plus global SEO/compliance items  

---

## EXECUTIVE SUMMARY

The ALwrity marketing landing page presents a strong visual story and clear sign-up paths, but **40 actionable issues** were found across functionality, visual UX, content/SEO, and trust signals. Nothing fully blocks sign-up today, but several items hurt first impressions, search clarity, and credibility.


| Severity     | Count | Response target           |
| ------------ | ----- | ------------------------- |
| Critical     | 0     | —                         |
| Warning      | 24    | Fix within current sprint |
| Optimization | 16    | Backlog / opportunistic   |


**Strategic pillar breakdown:**

- **Time-to-Value:** Hero is visually strong but the main action button may sit below the fold on phones; top menu hides while scrolling.
- **CTR / Dynamic UX:** Rotating headline and button text change what users (and search tools) read on each visit.
- **Core Web Vitals:** Large background images and lazy-loaded sections may cause layout shifts and slow first paint on mobile networks.
- **E-E-A-T / Trust:** Several stats and claims (GitHub stars, “zero tracking,” “join thousands”) are not backed up on the page.

**Estimated manual re-test time (full pass):** ~75 minutes  
**QA prerequisite:** Open an **incognito/private window**, go to `http://localhost:3000/home` (or production `/home`). Do **not** rely on `/` if you are already signed in — signed-in users are redirected away from `/`.

---



## PAGE MAP (Top → Bottom)

1. Skip to main content link
2. Top navigation bar (`LandingNav`)
3. Hero section (`HeroSection`)
4. Welcome / Why ALwrity (`IntroducingAlwrity`)
5. Content Lifecycle section (inline in `Landing.tsx`)
6. Experience the Platform carousel (`FeatureShowcase`)
7. Solopreneur struggle section (`SolopreneurDilemma`)
8. Choose Your Plan teaser (inline in `Landing.tsx`)
9. Final sign-up panel (`EnterpriseCTA`)
10. Footer (`LandingFooter`)
11. Global (SEO, URLs, performance, accessibility)

---



# REMAINING ACTION ITEMS

---



## SECTION 0 — SKIP TO MAIN CONTENT

---

**Test Case No:** 001  
**Audited Section:** Skip link — keyboard access  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** A skip link helps keyboard and screen-reader users jump past the menu to the main content. It exists but is easy to miss because it only appears when focused.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/Landing.tsx` — skip link around lines 340–360 (`href="#main-content"`, hidden with `left: -9999` until `:focus`).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Link text reads “Skip to main content” and only shows after Tab focus.  
- **After:** No change required if keyboard test passes. Optional polish: add visible hint in QA checklist that first Tab press should reveal the link at top-left.  
**Manual Verification Steps:**

1. Open `/home` in Chrome.
2. Click once in the address bar, then press **Tab** once.
3. Confirm a **“Skip to main content”** link appears at the top-left.
4. Press **Enter** — page should jump to the hero/main area.

**Estimated Test Time to Complete:** 2 minutes  

---



## SECTION 1 — TOP NAVIGATION

---

**Test Case No:** 002  
**Audited Section:** Top menu — hides when scrolling down  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** When visitors scroll down the page, the top menu slides off-screen. On phones there is no “move mouse to top” trick — users must scroll all the way back up or open the hamburger menu. This adds friction when they want Pricing or Sign in mid-page.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LandingNav.tsx` — scroll handler lines 91–110 sets `navVisible` to false; AppBar uses `transform: translateY(-110%)` when hidden (lines 189–191).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Menu disappears after scrolling down ~64px; reappears only when scrolling up, at the very top, or when the mouse touches the top 72px of the screen (desktop only).  
- **After option A:** Keep menu **always visible** on viewports under 960px.  
- **After option B:** Add a small **floating “Menu” pill** at the bottom-right on mobile when the top bar is hidden.  
**Manual Verification Steps:**

1. Open `/home` on a phone or Chrome mobile view (375px wide).
2. Scroll down past the hero.
3. Try to tap **Pricing** or **Welcome** in the top bar without scrolling back to the top.
4. **Before fix:** Top links are gone — only the hamburger icon works if you find it.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 003  
**Audited Section:** Top menu — “Pricing” goes to a different page, not the pricing section on this page  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Dynamic UX for CTR  
**Why It Matters / Impact:** The same page has a **“Choose Your Plan”** section further down (`id="pricing"`), but the menu **Pricing** link opens the separate `/pricing` page. Visitors may expect to land on the in-page section.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LandingNav.tsx` line 42 — `{ label: 'Pricing', href: '/pricing' }`. Pricing teaser section: `Landing.tsx` line 717 `id="pricing"`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Menu **Pricing** → navigates to `/pricing`.  
- **After option A:** Menu **Pricing** → scrolls to `#pricing` on `/home` (same as Home/Lifecycle/Features).  
- **After option B:** Rename menu item to **“Full pricing”** so it is clear it opens another page.  
**Manual Verification Steps:**

1. On `/home`, click **Pricing** in the desktop menu (or mobile drawer).
2. Note whether you leave the landing page or scroll to **Choose Your Plan**.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 004  
**Audited Section:** Top menu — “Welcome” button label is vague for new visitors  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** The top-right button shows **“👋 Welcome”** (or a first name if returning). New users may not understand this is the **sign-in / sign-up** action.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/NavAuthButton.tsx` lines 40–41 — label `👋 Welcome` or `👋 Welcome {name}`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Button text: **“👋 Welcome”**  
- **After:** Button text: **“Sign in free”** (signed out) or **“Go to dashboard”** (signed in).  
**Manual Verification Steps:**

1. Open `/home` signed out.
2. Read the top-right button (desktop) or drawer button (mobile).
3. Ask: “Would a first-time visitor know this starts sign-up?”

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 005  
**Audited Section:** Brand logo subtitle — inconsistent spelling “Alwrity” vs “ALwrity”  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** The logo title says **ALwrity** but the subtitle under it says **“Alwrity Marketing Operating System”** (lowercase “w”). Small inconsistency weakens brand polish.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/BrandMark.tsx` line 52 — subtitle text `Alwrity Marketing Operating System`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `Alwrity Marketing Operating System`  
- **After:** `ALwrity Marketing Operating System`  
**Manual Verification Steps:**

1. Look at the logo in the top-left on `/home`.
2. Read the small italic line under **ALwrity**.

**Estimated Test Time to Complete:** 1 minute  

---



## SECTION 2 — HERO

---

**Test Case No:** 006  
**Audited Section:** Hero headline — rotating words in the main title  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Dynamic UX for CTR + E-E-A-T  
**Why It Matters / Impact:** The main page title (H1) cycles through phrases like “Content Planning,” “MultiModal Generation,” etc. Search engines and social previews may only capture **one** phrase. Visitors also see different headlines on each visit, which can feel inconsistent.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/H`005`eroSection.tsx` — `HEADLINE_PHRASES` lines 29–36; `ScramblingText` inside `<Typography component="h1">` lines 275–281.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** H1 reads: **“AI Copilot for [rotating phrase]”** (e.g. “AI Copilot for Content Planning”).  
- **After:** Use one stable H1: **“AI Copilot for Your Entire Content Lifecycle”** and move rotating phrases to a **subtitle line** below (not the H1 tag).  
**Manual Verification Steps:**

1. Open `/home`, note the big headline.
2. Wait 12 seconds — headline should change to a different phrase.
3. View page source or use a SEO browser extension — confirm only one phrase appears in the H1 at a time.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 007  
**Audited Section:** Hero headline — typo in rotating phrase list  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** One rotating phrase reads **“All-Analytics One-platform”** — awkward grammar and hyphenation hurt credibility when it appears in the main title.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` line 33 — `'All-Analytics One-platform'`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `All-Analytics One-platform`  
- **After:** `All-in-One Analytics Platform`  
**Manual Verification Steps:**

1. Stay on `/home` hero for up to 72 seconds (6 phrases × 12s) until **“All-Analytics One-platform”** appears, or search the phrase list in code.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 008  
**Audited Section:** Hero — main action button text keeps changing  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** The purple hero button cycles between **“Start Free Trial”**, **“Get Started Now”**, and **“Try AI Copilot”** every 6 seconds. Users mid-click may see the label change; A/B meaning is lost without tracking.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` lines 362–368 — `ScramblingText` phrases on the primary CTA button.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Button label rotates every 6 seconds.  
- **After:** Fixed label: **“Start free — no card required”** (single string, no animation on the button).  
**Manual Verification Steps:**

1. Watch the hero button for 20 seconds without clicking.
2. Count how many different labels appear.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 009  
**Audited Section:** Hero — stat footnote text is extremely small  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Core Web Vitals / Readability  
**Why It Matters / Impact:** The line *“Based on internal beta user surveys, 2025.”* uses ~9px font size — hard to read on mobile and may fail accessibility size guidelines.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` lines 442–452 — `fontSize: '0.58rem'`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Footnote at `0.58rem` (~9px).  
- **After:** Footnote at `0.75rem` **(12px)** minimum, full width under the stat row.  
**Manual Verification Steps:**

1. On a phone, zoom to 100% and try to read the footnote under the four stats (70%, 65%, etc.).

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 010  
**Audited Section:** Hero — stat labels (e.g. “Time Savings”) are very small  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Readability  
**Why It Matters / Impact:** Labels under each stat use `0.52rem` (~8px) — difficult for many users to read without zooming.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` lines 425–436 — stat label `fontSize: '0.52rem'`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Label size `0.52rem`.  
- **After:** Label size `0.7rem` **(11px) minimum**, or move labels above the numbers.  
**Manual Verification Steps:**

1. On 375px width, read **“Time Savings”**, **“Better Engagement”**, etc. without pinch-zoom.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 011  
**Audited Section:** Hero — primary button may sit below the fold on mobile  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** On small screens the hero stacks chips, long headline, subhead, spacer, then the glass panel with the button. Users may need to scroll before seeing **Get Started**.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` — `minHeight: { xs: 'auto', md: '100vh' }` line 151; glass panel at bottom lines 309–325.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** On 375×812 mobile, CTA may require scroll.  
- **After:** Move **one** compact CTA button **directly under the subhead** (above the glass stats panel) on viewports under 768px.  
**Manual Verification Steps:**

1. Chrome DevTools → iPhone 12 (390×844).
2. Load `/home` — do **not** scroll.
3. Check if the purple **Get Started** button is fully visible.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 012  
**Audited Section:** Hero — top chips look clickable but do the same as sign-up  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** **“AI Marketing Platform”** and **“AI-First Copilot”** chips use pointer cursor and hover lift but only open the same sign-in flow as the main button — no extra value.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` lines 229–252 — `onClick={handleAuthNavigation}` on both chips.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Chips are buttons that open sign-in.  
- **After option A:** Make chips **non-clickable** labels (remove `onClick`, default cursor).  
- **After option B:** **AI-First Copilot** chip scrolls to `#features`; **AI Marketing Platform** scrolls to `#lifecycle`.  
**Manual Verification Steps:**

1. Click each chip — note both open sign-in (or dashboard if signed in).

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 013  
**Audited Section:** Hero — performance stats lack clear source on first glance  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T  
**Why It Matters / Impact:** Stats show **70%*, 65%*, 5x*, 21%*** with a tiny footnote. The asterisk is easy to miss; bold numbers may feel like guaranteed results.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/HeroSection.tsx` lines 110–115 (stats array), 423 (`{stat.value}`*), 451 (footnote).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `70%`* with separate 9px footnote.  
- **After:** `Up to 70% time saved`* inline, with footnote at `0.75rem` directly under the stat row: **“*Based on ALwrity beta survey, 2025 (n=XX).”** — add sample size when available.  
**Manual Verification Steps:**

1. Show the hero to someone unfamiliar with ALwrity — ask if stats feel like guarantees or estimates.



**Estimated Test Time to Complete:** 2 minutes  

---



## SECTION 3 — WELCOME / WHY ALWRITY

---

**Test Case No:** 014  
**Audited Section:** Social proof numbers — not verified on the page  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** The section shows **1K+ GitHub Stars**, **10K+ Content Pieces**, **95% User Satisfaction**, **500+ Active Contributors** with no link to GitHub, survey, or methodology. Unverified claims hurt trust if challenged.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/IntroducingAlwrity.tsx` lines 70–75 (`socialProofStats`), rendered lines 269–307.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `1K+ GitHub Stars` with no link.  
- **After:** `1K+ GitHub stars` as a **clickable link** to the real repo, or soften to **“Growing open-source community”** until numbers are verified.  
**Manual Verification Steps:**

1. Scroll to **Welcome to ALwrity**.
2. Try clicking each stat — nothing happens today.
3. Cross-check GitHub star count manually.

**Estimated Test Time to Complete:** 5 minutes  

---

**Test Case No:** 015  
**Audited Section:** “Zero Tracking” privacy claim  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** A card claims **“Zero Tracking”** and **“No tracking, no data mining”** while the app uses **Clerk** for auth (third-party) and standard web hosting logs. Overstated privacy claims are a trust risk.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/IntroducingAlwrity.tsx` lines 57–60 — Privacy First card, highlight **Zero Tracking**.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** **“Zero Tracking”** badge and **“No tracking”** in body copy.  
- **After:** **“Privacy-first design”** and body: **“We don’t sell your data. See our Privacy Policy for what we collect for account security.”** with link to `/privacy`.  
**Manual Verification Steps:**

1. Read the **Privacy First** card.
2. Compare wording to `/privacy` policy.

**Estimated Test Time to Complete:** 4 minutes  

---

**Test Case No:** 016  
**Audited Section:** “Sub-second Response” speed claim  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** **Lightning Fast** card claims **“Sub-second Response”** — AI generation often takes several seconds. Misaligned expectations cause disappointment after sign-up.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/IntroducingAlwrity.tsx` lines 63–66 — highlight **Sub-second Response**.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** **“Sub-second Response”**  
- **After:** **“Fast AI responses”** or **“Optimized for quick drafts”** without a specific sub-second promise.  
**Manual Verification Steps:**

1. Read the **Lightning Fast** card on `/home`.
2. After sign-up, time one AI generation — compare to claim.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 017  
**Audited Section:** Open source claim — no GitHub link  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** **“100% Open Source”** and **“Full source code available on GitHub”** but no GitHub URL on the card or CTA.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/IntroducingAlwrity.tsx` lines 51–55; footer `LandingFooter.tsx` line 72 — **“Open-source & community-driven”** without link.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Text-only open-source claims.  
- **After:** Add link **“View on GitHub →”** pointing to the official repository URL on the Open Source card and in the footer.  
**Manual Verification Steps:**

1. Search the landing page for **“GitHub”** — confirm no clickable repo link on `/home`.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 018  
**Audited Section:** Duplicate sign-up message so soon after hero  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** **“Start free with ALwrity”** appears again immediately after the hero CTA — same action, little new information.  
**Repository Location & Structural Logic:** `IntroducingAlwrity.tsx` lines 148–170 — second primary CTA after hero.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Second purple **Start free with ALwrity** button right after hero.  
- **After:** Replace with **“See how it works ↓”** scroll link to `#lifecycle`, or remove button and keep stats/cards only.  
**Manual Verification Steps:**

1. From top of page, count how many **Start free / Get Started** buttons appear before the lifecycle section.

**Estimated Test Time to Complete:** 2 minutes  

---



## SECTION 4 — CONTENT LIFECYCLE

---

**Test Case No:** 019  
**Audited Section:** Lifecycle cards — description hidden on mobile until hover  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Readability  
**Why It Matters / Impact:** Card descriptions are clamped to **3 lines** by default; full text only shows on **hover** (`WebkitLineClamp`). Phones have no hover — users see truncated text.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/Landing.tsx` lines 612–625 — `.lifecycle-card-desc` clamp and hover unclamp.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** 3-line clamp on mobile; expand on hover only.  
- **After:** Show **full description always** on viewports under 768px; keep hover expand optional on desktop.  
**Manual Verification Steps:**

1. Mobile view → **Content Lifecycle** cards.
2. Read **Content Planning** description — check if it cuts off mid-sentence.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 020  
**Audited Section:** Lifecycle phase chips — animated scrambling text  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Core Web Vitals / Accessibility  
**Why It Matters / Impact:** Phase chips cycle words (**Plan / Strategy / Research**) with animation. Can distract readers and may discomfort users sensitive to motion.  
**Repository Location & Structural Logic:** `Landing.tsx` lines 522–531 — `ScramblingText` inside lifecycle chips.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Animated word cycling on all six chips.  
- **After:** Static labels: **Plan, Generate, Publish, Analyze, Engage, Remarket** only.  
**Manual Verification Steps:**

1. Watch lifecycle chips for 10 seconds — words should change.
2. Enable **prefers-reduced-motion** in OS settings — animation should stop (currently it does **not**).

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 021  
**Audited Section:** Lifecycle cards — “Sign in to explore” destinations  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Each card opens sign-in then redirects to a feature route (`/content-planning`, `/dashboard`, etc.). Worth verifying each path works after auth.  
**Repository Location & Structural Logic:** `Landing.tsx` lines 243–286 (`features` hrefs), lines 671–673 `openSignIn({ forceRedirectUrl: feature.href })`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Six **Sign in to explore →** links with different redirect URLs.  
- **After:** No copy change — QA must confirm post-sign-in landing matches card title (manual checklist in Changes when verified).  
**Manual Verification Steps:**

1. Signed out → click **Sign in to explore** on **Content Planning** — complete sign-in — confirm arrival at content planning area.
2. Repeat for **Content Analytics** (`/seo-dashboard`) and **Content Engagement** (`/linkedin-writer`).

**Estimated Test Time to Complete:** 10 minutes  

---



## SECTION 5 — EXPERIENCE THE PLATFORM (FEATURE SHOWCASE)

---

**Test Case No:** 022  
**Audited Section:** Feature carousel — copy focuses on LinkedIn, not full platform  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Dynamic UX / CTR match  
**Why It Matters / Impact:** First feature card: **“Your personal LinkedIn writing assistant…”** — the page title promises a full **AI Digital Marketing OS**. LinkedIn-only wording may mismatch visitor expectations from search ads or SERP.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/FeatureShowcase.tsx` lines 33–37 — first feature description.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** **“Your personal LinkedIn writing assistant with persona-aware content generation.”**  
- **After:** **“Your AI writing copilot for LinkedIn, blogs, and social — persona-aware content that matches your voice.”**  
**Manual Verification Steps:**

1. Scroll to **Experience the Platform**.
2. Read first card — note LinkedIn-only wording.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 023  
**Audited Section:** Feature carousel — mobile shows three tall cards per “page”  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** On mobile the grid is **1 column** but still loads **3 feature cards** per carousel page — long vertical scroll before dots/next page.  
**Repository Location & Structural Logic:** `FeatureShowcase.tsx` lines 191–192 `itemsPerPage = 3`; grid `xs: '1fr'` line 299.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** 3 stacked cards per page on mobile.  
- **After:** `itemsPerPage = 1` on viewports under 768px (one card per swipe).  
**Manual Verification Steps:**

1. Mobile 375px — count cards visible before carousel dots.
2. Scroll length to reach **Solopreneur** section.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 024  
**Audited Section:** Feature carousel — arrow buttons overlap card edges on narrow screens  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Readability  
**Why It Matters / Impact:** Previous/Next circles sit `absolute` at `left: 4px` / `right: 4px` — may cover card content on small screens.  
**Repository Location & Structural Logic:** `FeatureShowcase.tsx` lines 405–440 — arrow `IconButton` positioning.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Arrows overlay cards at 375px width.  
- **After:** Move arrows **below** the card row on mobile, or increase horizontal padding to `px: 6`.  
**Manual Verification Steps:**

1. Mobile view — check if left/right arrows cover feature titles.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 025  
**Audited Section:** Feature images — mixed file name capitalization  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Core Web Vitals (broken assets)  
**Why It Matters / Impact:** Image paths mix `Alwrity-`, `ALwrity-`, and `Fact-check1.png`. Works on Windows dev machines but can **404 on Linux production** if casing differs.  
**Repository Location & Structural Logic:** `FeatureShowcase.tsx` lines 34–69; files in `frontend/public/` (e.g. `Alwrity-copilot1.png`, `ALwrity-assistive-writing.png`).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Mixed-case paths in code.  
- **After:** Rename all public assets to **lowercase kebab-case** (e.g. `alwrity-copilot1.png`) and update every reference to match exactly.  
**Manual Verification Steps:**

1. Open DevTools → Network tab on `/home`.
2. Filter **Img** — confirm all six feature images return **200**, not 404.
3. Repeat on production Linux host if available.

**Estimated Test Time to Complete:** 5 minutes  

---



## SECTION 6 — SOLOPRENEUR STRUGGLE SECTION

---

**Test Case No:** 026  
**Audited Section:** Pain point titles — scrambling animation  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Accessibility  
**Why It Matters / Impact:** Pain titles cycle (**Content Overwhelm / Content Chaos / …**) — harder to scan; no reduced-motion fallback.  
**Repository Location & Structural Logic:** `SolopreneurDilemma.tsx` lines 279–284 — `ScramblingText` on pain titles; CTA lines 422–426.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Animated pain titles and CTA (**End the Struggle Today / Stop the Chaos / …**).  
- **After:** Static titles and **“End the struggle today”** button text.  
**Manual Verification Steps:**

1. Scroll to **Content Struggle Is Real** — watch titles for 15 seconds.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 027  
**Audited Section:** Layout — content shifted right on desktop  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** ReaWrapper uses `margin-left: 45%` on desktop — pushes Before/After columns right, leaving empty space on the left.dability  
**Why It Matters / Impact:**   
**Repository Location & Structural Logic:** `SolopreneurDilemma.tsx` line 200 — `ml: { xs: 0, md: '45%' }`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** 45% left margin on desktop.  
- **After:** Remove offset — use standard centered `Container maxWidth="lg"` two-column grid.  
**Manual Verification Steps:**

1. Desktop 1280px — check for large empty band on the left of Before/After cards.

**Estimated Test Time to Complete:** 2 minutes  

---



## SECTION 7 — PRICING TEASER

---

**Test Case No:** 028  
**Audited Section:** In-page `#pricing` link does not scroll (hash not supported)  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Section has `id="pricing"` but hash parser only allows `hero`, `lifecycle`, `features`. URL `/home#pricing` will **not** scroll to plans.  
**Repository Location & Structural Logic:** `Landing.tsx` line 717 `id="pricing"`; `landingNavigation.ts` lines 52–57 — `parseLandingHash` omits `pricing`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `/home#pricing` loads page top only.  
- **After:** Add `pricing` to `LandingSectionId` and `parseLandingHash`; include in scroll retry logic.  
**Manual Verification Steps:**

1. Navigate to `http://localhost:3000/home#pricing`.
2. Page should scroll to **Choose Your Plan** — currently it does not.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 029  
**Audited Section:** Plan cards — no direct “Choose plan” buttons  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Four plan cards show prices and bullets but **only one button below the grid** (**View Plans & Features**). Extra click friction for ready buyers.  
**Repository Location & Structural Logic:** `Landing.tsx` lines 747–815 — pricing grid without per-card CTAs.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Cards are display-only.  
- **After:** Add button on each card: **“Start free”** on Free tier, **“See Basic plan →”** on others linking to `/pricing`.  
**Manual Verification Steps:**

1. Scroll to **Choose Your Plan**.
2. Try clicking a plan card — nothing happens except hover shadow.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 030  
**Audited Section:** Plan teaser bullets may not match full pricing page  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T  
**Why It Matters / Impact:** Teaser lists features like **“Limited monthly AI credits”** — must stay in sync with backend plans (`pricingGridReference.ts`) or users feel misled.  
**Repository Location & Structural Logic:** `Landing.tsx` lines 44–97 `PRICING_TEASER_PLANS`; backend reference `frontend/src/components/Pricing/pricingGridReference.ts`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Hard-coded teaser copy in `Landing.tsx`.  
- **After:** Share one source of truth with pricing page API/reference, or add quarterly QA sync checklist.  
**Manual Verification Steps:**

1. Compare Free/Basic bullets on `/home` vs `/pricing` side by side.

**Estimated Test Time to Complete:** 5 minutes  

---



## SECTION 8 — FINAL SIGN-UP PANEL

---

**Test Case No:** 031  
**Audited Section:** “Join thousands of creators” — unverified claim  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T Authority  
**Why It Matters / Impact:** **“Join thousands of creators, marketers, and businesses…”** — no customer logos, case studies, or count source on page.  
**Repository Location & Structural Logic:** `EnterpriseCTA.tsx` lines 129–131.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** **“Join thousands of creators…”**  
- **After:** **“Join creators and marketers using ALwrity’s open-source AI platform”** OR add **3 customer logos** with permission.  
**Manual Verification Steps:**

1. Read final CTA paragraph — note **“thousands”** claim.

**Estimated Test Time to Complete:** 1 minute  

---

**Test Case No:** 032  
**Audited Section:** “No credit card required” — verify against Clerk sign-up  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Bullet says **✓ No credit card required** — must match actual Clerk sign-up fields or trust is broken.  
**Repository Location & Structural Logic:** `EnterpriseCTA.tsx` lines 162–166; hero subline `HeroSection.tsx` line 383.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Static **No credit card required** text.  
- **After:** QA confirms Clerk free sign-up has no card step — if card ever required, remove bullet immediately.  
**Manual Verification Steps:**

1. Click **Start creating now** — complete sign-up — confirm no payment step.

**Estimated Test Time to Complete:** 4 minutes  

---



## SECTION 9 — FOOTER

---

**Test Case No:** 033  
**Audited Section:** Contact page missing from footer links  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T / Trust  
**Why It Matters / Impact:** `/contact` is in `sitemap.xml` but footer only links Privacy, Code of Conduct, Terms — no **Contact** link. Users looking for support may not find the page.  
**Repository Location & Structural Logic:** `LandingFooter.tsx` lines 76–85 (link row); `frontend/public/sitemap.xml` line 29 `/contact`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Footer links: Privacy, Code of Conduct, Terms only.  
- **After:** Add **Contact** link → `/contact` next to Terms.  
**Manual Verification Steps:**

1. Scroll to footer — search for **Contact** link (missing today).
2. Manually open `/contact` — page should load.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 034  
**Audited Section:** Footer — duplicate copyright block  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Readability  
**Why It Matters / Impact:** Copyright appears twice — short line under logo and longer centered line after divider. Redundant visual noise.  
**Repository Location & Structural Logic:** `LandingFooter.tsx` lines 71–73 and 96–118.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Two copyright blocks.  
- **After:** Keep **one** centered block with legal links + email; remove the shorter duplicate under the logo.  
**Manual Verification Steps:**

1. Footer — count how many times **© 2026 ALwrity** appears.

**Estimated Test Time to Complete:** 1 minute  

---



## SECTION 10 — GLOBAL (SEO, URLS, PERFORMANCE, ACCESSIBILITY)

---

**Test Case No:** 035  
**Audited Section:** `/home` vs `/` — duplicate content for search engines  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T / SEO  
**Why It Matters / Impact:** Same landing renders at `/` (signed out) and `/home` (always). Canonical tag points only to `https://www.alwrity.com/` — `/home` may look like duplicate content to crawlers.  
**Repository Location & Structural Logic:** `frontend/public/index.html` line 14 canonical; `landingNavigation.ts` `LANDING_MARKETING_PATH = '/home'`; `App.tsx` RootRoute.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `/home` has no canonical hint in runtime; sitemap lists `/` only.  
- **After option A:** **301 redirect** `/home` → `/` for anonymous users.  
- **After option B:** Set canonical to `/` on both routes via small hook in `Landing.tsx`.  
**Manual Verification Steps:**

1. View source on `/` and `/home` — same title/description; canonical always `/`.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 036  
**Audited Section:** Animated text — no “reduced motion” support  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Accessibility / Core Web Vitals  
**Why It Matters / Impact:** Scramble animations run on hero, lifecycle, solopreneur, and CTA buttons even when users enable **Reduce motion** in OS settings — can cause discomfort and fails accessibility best practice.  
**Repository Location & Structural Logic:** `frontend/src/components/ScrambleText.tsx`; used across `HeroSection.tsx`, `Landing.tsx`, `SolopreneurDilemma.tsx`, `FeatureShowcase` (carousel motion via Framer). No `prefers-reduced-motion` checks in `frontend/src/components/Landing/`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Animations always run.  
- **After:** Wrap scramble/Framer loops: if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, show **static final text** only.  
**Manual Verification Steps:**

1. Windows: Settings → Accessibility → Visual effects → **Animation effects Off**.
2. Reload `/home` — headline and buttons should **not** scramble.

**Estimated Test Time to Complete:** 4 minutes  

---

**Test Case No:** 037  
**Audited Section:** Page heading structure — many skipped levels  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** SEO  
**Why It Matters / Impact:** One H1 (hero), then H2 section titles, but card titles use **H6** — skips H3–H5. Screen readers and SEO parsers prefer logical stair-steps.  
**Repository Location & Structural Logic:** Browser audit snapshot — section H2s (e.g. Welcome, Lifecycle) with card titles as **level 6 headings**; lifecycle card titles use `variant="subtitle1"` without semantic downgrade to `h3`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Card titles announced as **heading level 6**.  
- **After:** Use `component="h3"` for first card level under each H2 section, or use `<p>` with bold styling (not heading tags) for cards.  
**Manual Verification Steps:**

1. Use browser accessibility tree or HeadingsMap extension — list heading levels top to bottom.

**Estimated Test Time to Complete:** 4 minutes  

---

**Test Case No:** 038  
**Audited Section:** Structured data — missing WebSite and FAQ schema  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T / SEO  
**Why It Matters / Impact:** `index.html` includes **SoftwareApplication** and **Organization** JSON-LD only — no **WebSite** (sitelinks search) or **FAQ** blocks for common questions.  
**Repository Location & Structural Logic:** `frontend/public/index.html` lines 46–75.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Two JSON-LD blocks only.  
- **After:** Add **WebSite** schema with `url` and `name`; if FAQ section added later, add **FAQPage** markup.  
**Manual Verification Steps:**

1. Paste production URL in Google Rich Results Test — note valid types shown.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 039  
**Audited Section:** Large hero background images — performance on slow networks  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Core Web Vitals  
**Why It Matters / Impact:** `index.html` preloads **two** full-size PNG backgrounds; lifecycle, features, solopreneur sections add more full-viewport backgrounds. On **4G slow**, first paint may lag (hurts LCP).  
**Repository Location & Structural Logic:** `index.html` lines 12–13 preload; `HeroSection.tsx` line 164; `Landing.tsx` line 400; `FeatureShowcase.tsx` lines 29–30; `SolopreneurDilemma.tsx` line 129.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Multiple large PNG `background-image` URLs.  
- **After:** Convert hero/lifecycle backgrounds to **WebP/AVIF**; serve smaller crop on mobile via CSS `image-set` or responsive `<picture>`.  
**Manual Verification Steps:**

1. Chrome DevTools → Network → **Slow 4G** — reload `/home`.
2. Note time until hero text readable and LCP in Lighthouse mobile.

**Estimated Test Time to Complete:** 5 minutes  

---

**Test Case No:** 040  
**Audited Section:** Lazy sections — layout shift when skeletons swap to content  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Core Web Vitals (CLS)  
**Why It Matters / Impact:** `IntroducingAlwrity`, `FeatureShowcase`, `SolopreneurDilemma`, `EnterpriseCTA` load with **Suspense skeletons** then expand — can push content down when real sections mount (CLS).  
**Repository Location & Structural Logic:** `Landing.tsx` lines 323–336 `SectionSkeleton`; Suspense wrappers lines 369–823.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Skeleton heights (520, 640, 560, 480) may not match final section height.  
- **After:** Match skeleton `minHeight` to measured real section heights, or remove lazy load for above-the-fold-adjacent **IntroducingAlwrity**.  
**Manual Verification Steps:**

1. Lighthouse mobile → inspect **CLS** score and flagged elements.
2. Watch scroll position when Welcome section replaces skeleton.

**Estimated Test Time to Complete:** 4 minutes  

---



# PRIORITY SUMMARY


| Priority     | Count | Focus                                                                          |
| ------------ | ----- | ------------------------------------------------------------------------------ |
| Critical     | 0     | No fully blocking bugs found this pass                                         |
| Warning      | 24    | Nav hide, hash pricing, mobile UX, E-E-A-T claims, performance, duplicate URLs |
| Optimization | 16    | Copy polish, heading structure, carousel layout, skip link, duplicate CTAs     |


**Total test cases:** 40 (TC 001–040)  
**Estimated manual pass:** ~75 minutes  

---



## Suggestions for Product Team

1. **Single primary CTA label:** Pick one hero button string and use it site-wide above the fold — reduces confusion and simplifies ad landing QA.
2. **Trust strip:** Add a row of 3 verifiable badges (GitHub link, Privacy Policy link, “Beta survey 2025” PDF) below hero stats.
3. **Mobile nav:** Keep sign-up visible — sticky bottom bar with **Start free** on phones.
4. **Quarterly copy sync:** Align `PRICING_TEASER_PLANS` in `Landing.tsx` with live `/pricing` backend plans.
5. **Regression script:** Before each release, run Network tab image 200-check for all `/Alwrity-`* paths on staging Linux.

---



## Changes


| Test Case | Date Fixed | Verified By | Notes                                                                                            |
| --------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------ |
| 001       | 2026-07-04 | —           | Skip link `:focus-visible` polish with fixed position + white outline (`Landing.tsx`)            |
| 002       | 2026-07-04 | —           | Option B: floating **Menu** pill bottom-right on mobile when top bar hidden (`LandingNav.tsx`)   |
| 003       | 2026-07-04 | —           | Option A: **Pricing** nav scrolls to `#pricing`; added `pricing` to `landingNavigation.ts`       |
| 005       | 2026-07-04 | —           | Subtitle → **ALwrity Marketing Operating System** (`BrandMark.tsx`)                              |
| 007       | 2026-07-04 | —           | Phrase fixed to **All-in-One Analytics Platform**; H1 `nowrap` from `sm` up for one-line display |
| 009       | 2026-07-04 | —           | Stat footnote `0.6rem`, full-width centered (`HeroSection.tsx`)                                  |
| 010       | 2026-07-04 | —           | Stat labels `0.6rem`, centered in middle grid row of stat box                                    |
| 011       | 2026-07-04 | —           | Mobile-only CTA placed directly under subhead; desktop CTA stays in glass panel                  |
| 012       | 2026-07-04 | —           | Option B: chips scroll to `#lifecycle` / `#features` (`HeroSection.tsx`)                         |
| —         | 2026-07-04 | —           | **NR1:** Hero chips + H1 + subhead pushed lower (`pt` 11/12, chips `mt` 2/3)                     |
| —         | 2026-07-04 | —           | **NR3:** Privacy badge → **Privacy-first design** (`IntroducingAlwrity.tsx`)                     |
| 018       | 2026-07-04 | —           | CTA → **See how it works ↓** with rocket icon, scrolls to `#lifecycle`                           |
| 019       | 2026-07-04 | —           | Lifecycle card descriptions always full on mobile (`Landing.tsx`)                                |
| 022       | 2026-07-04 | —           | AI-First Copilot copy updated for LinkedIn/blogs/social (`FeatureShowcase.tsx`)                  |
| 023       | 2026-07-04 | —           | Feature carousel `itemsPerPage = 1` on mobile (`FeatureShowcase.tsx`)                            |
| 024       | 2026-07-04 | —           | Carousel arrows below cards on mobile; side arrows on desktop                                    |
| 025       | 2026-07-04 | —           | Public images renamed to lowercase kebab-case; all references updated                            |
| —         | 2026-07-04 | —           | **NR-H1:** Hero glass panel moved up (removed bottom anchor flex)                                |
| —         | 2026-07-04 | —           | **NR-FS:** Feature subtitle lower; more space between H2 and carousel cards                      |
| —         | 2026-07-04 | —           | **NR-WA:** Welcome section social stats moved up (reduced top spacing)                           |
| 027       | 2026-07-04 | —           | Removed 45% left offset; standard two-column grid (`SolopreneurDilemma.tsx`)                     |
| 028       | 2026-07-04 | —           | Already done: `#pricing` hash scroll (`landingNavigation.ts`)                                    |
| 029       | 2026-07-04 | —           | Per-plan CTA buttons on pricing teaser cards (`Landing.tsx`)                                     |
| 030       | 2026-07-04 | —           | Teaser plans aligned to backend limits via `landingPricingTeaser.ts`                             |
| —         | 2026-07-04 | —           | **NR-H2:** Hero block moved up — reduced container `pt` (9.5/10.5) and top-chip `mt` (`HeroSection.tsx`) |
| 027       | 2026-07-04 | —           | **Reverted:** Restored desktop `ml: 35%` wrapper on Before/After grid (`SolopreneurDilemma.tsx`) |
| —         | 2026-07-04 | —           | **NR-S6:** Reduced solopreneur section top padding (`py`, container `pt`, header `mb`)         |
| 031       | 2026-07-04 | —           | Final CTA copy → open-source platform wording (`EnterpriseCTA.tsx`)                            |
| 032       | 2026-07-04 | —           | Removed **No credit card required**; replaced with **Human-in-the-loop** bullet                |
| 033       | 2026-07-04 | —           | Footer **Contact** link; enhanced `/contact` page with channels + form (`ContactPage.tsx`)     |
| 034       | 2026-07-04 | —           | Single footer copyright block; legal links deduplicated (`LandingFooter.tsx`)                  |
| 037       | 2026-07-04 | —           | Heading hierarchy: card titles `h3`, decorative text `component="p"` across landing sections     |
| 039       | 2026-07-04 | —           | Removed vortex preload; hero `fetchpriority=high`; deferred below-fold section backgrounds     |
| —         | 2026-07-04 | —           | **NR-S8:** Final sign-up panel — moderate padding trim; full copilot image restored on all breakpoints (`EnterpriseCTA.tsx`) |
| 021       | 2026-07-04 | —           | Lifecycle redirects centralized in `landingLifecycleFeatures.ts`; routes verified vs `App.tsx`; Generation→`/blog-writer`, Remarketing→`/seo-dashboard` |
| 035       | 2026-07-04 | —           | `useLandingCanonical()` sets canonical to `https://www.alwrity.com/` on `/` and `/home` |
| 040       | 2026-07-04 | —           | Skeleton heights tuned (480/520/420); `EnterpriseCTA` eager-loaded (no Suspense swap) |


**Instructions for next audit session:**  

- Do **not** delete rows above — add new rows when a test case is fixed.  
- Copy the original test case text from this document; mark status in **Notes** (e.g. “Verified on staging 2026-08-01”).  
- If a test case is rejected/won’t fix, add row with Notes: **“Won’t fix — reason…”**

---

*End of audit document. Implementation passes: July 4, 2026 (TC 001–012, 018–019, 022–025, NR1–NR3).*