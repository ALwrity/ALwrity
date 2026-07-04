# ALwrity Contact Page — UI/UX/SEO Audit (July 2026)

**Page:** Public contact page (`/contact`)  
**Date:** July 4, 2026  
**Auditor:** AI Full-Stack Code Engineer / Technical UI/UX/SEO Auditor  
**Framework:** Alwrity Master Audit Framework (Modules 1–3, Four Growth Pillars)  
**Scope:** Full contact page top-to-bottom — navigation through footer, plus global SEO/compliance items  

---

## EXECUTIVE SUMMARY

The ALwrity Contact page exists, is listed in the sitemap, and gives visitors a clear email address and a simple form. **22 actionable issues** were found across functionality, visual UX, content/SEO, and trust signals. Nothing fully blocks the page from loading or being indexed, but several items create false success messages, confusing trust signals, or dead ends for users without an email app.


| Severity     | Count | Response target           |
| ------------ | ----- | ------------------------- |
| Critical     | 0     | —                         |
| Warning      | 11    | Fix within current sprint |
| Optimization | 11    | Backlog / opportunistic   |


**Strategic pillar breakdown:**

- **Time-to-Value:** Email cards and form are easy to find, but “Back to home” can send signed-in users to the dashboard instead of the marketing site; the form can show success without actually sending anything.
- **CTR / Dynamic UX:** Page title and meta mention “billing,” but the page does not guide billing users clearly; the “Send Message” button behaves differently than most users expect.
- **Core Web Vitals:** Page is lightweight; lazy loading may show a brief spinner on first visit.
- **E-E-A-T / Trust:** “Last updated: June 2025” on a contact page is misleading and outdated; three “different” contact channels all show the same address.

**Estimated manual re-test time (full pass):** ~45 minutes  
**QA prerequisite:** Open an **incognito/private window**, go to `http://localhost:3000/contact` (or production `https://www.alwrity.com/contact`). Stay **signed out** for the first pass; repeat key tests **signed in** for Test Case 004.

---



## PAGE MAP (Top → Bottom)

1. Top navigation bar (`LandingNav` via `LegalPageLayout`)
2. “← Back to home” link
3. Page title (`Contact Us` H1) + subline (“Last updated… info@alwrity.com”)
4. Intro paragraph
5. **How can we help?** — three channel cards
6. **Send a message** — name / email / message form + submit button
7. Footer (`LandingFooter`)
8. Global (SEO meta, schema, accessibility, cross-page links)

---



# REMAINING ACTION ITEMS

---



## SECTION 0 — SKIP LINK (MISSING)

---

**Test Case No:** 001  
**Audited Section:** Skip to main content — not present on Contact page  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Keyboard and screen-reader users must tab through the entire top menu before reaching the contact form. The main landing page has a skip link; this page does not.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LegalPageLayout.tsx` — no skip link (compare with `frontend/src/components/Landing/Landing.tsx` lines ~271–296, which has `href="#main-content"`).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** No skip link; content starts inside `<Container>` without `<main id="main-content">`.  
- **After:** Add a skip link at the top of `LegalPageLayout` (same pattern as landing): visible on keyboard focus, text **“Skip to main content”**, target `#main-content`. Wrap page body in `<Box component="main" id="main-content">`.  
**Manual Verification Steps:**

1. Open `/contact` in Chrome.
2. Press **Tab** once from the address bar.
3. **Before fix:** First focus goes to logo or menu — no skip link appears.
4. **After fix:** **“Skip to main content”** appears top-left; **Enter** jumps to the H1 / form area.

**Estimated Test Time to Complete:** 2 minutes  

---



## SECTION 1 — TOP NAVIGATION

---

**Test Case No:** 002  
**Audited Section:** Top menu — no “Contact” link in main navigation  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Visitors on other pages must scroll to the footer to find Contact. Users with billing or support questions may not discover the page quickly.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LandingNav.tsx` lines 40–45 — `NAV_ITEMS` lists Home, Lifecycle, Features, Pricing only. Contact exists in footer: `frontend/src/components/Landing/LandingFooter.tsx` line 26.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Top menu has no Contact item.  
- **After option A:** Add `{ label: 'Contact', href: '/contact' }` to `NAV_ITEMS`.  
- **After option B:** Keep nav as-is but add a **“Need help?”** text link in the mobile drawer above the menu list.  
**Manual Verification Steps:**

1. Open `/contact` on desktop (wide screen).
2. Scan the top menu left-to-right.
3. Confirm Contact is **not** in the center nav (only in footer).

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 003  
**Audited Section:** Top menu — hides when scrolling on a short page  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** On mobile, after scrolling to the form, the menu can slide away. Users must use the floating **Menu** pill (bottom-right) or scroll back up.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LandingNav.tsx` lines 47–48, 105–109, 192–194, 322–348.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Nav hides after scrolling down on `/contact` (same behavior as landing).  
- **After option A:** Disable auto-hide on legal/contact routes (`pathname` matches `/contact`, `/privacy`, etc.).  
- **After option B:** No change if mobile **Menu** pill test passes (already implemented on landing).  
**Manual Verification Steps:**

1. Open `/contact` on phone or Chrome mobile view (375px wide).
2. Scroll down to **Send a message**.
3. Try to tap **Pricing** in the top bar without scrolling up.
4. **Before fix:** Top bar is hidden — use bottom-right **Menu** pill or scroll up.

**Estimated Test Time to Complete:** 3 minutes  

---



## SECTION 2 — BACK TO HOME LINK

---

**Test Case No:** 004  
**Audited Section:** “← Back to home” sends signed-in users to dashboard, not marketing home  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** A signed-in user who clicked Contact from the footer expects to return to the public marketing page. Instead, **Back to home** goes to `/`, which routes signed-in users through `InitialRouteHandler` to the dashboard — not `/home`.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LegalPageLayout.tsx` line 72 — `to="/"`. `frontend/src/App.tsx` lines 94–100, 189–190 — `/` uses `RootRoute` (signed in → dashboard path); `/home` always shows `Landing`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** `to="/"`  
- **After:** `to="/home"` (matches `LANDING_MARKETING_PATH` in `frontend/src/utils/landingNavigation.ts` line 4)  
**Manual Verification Steps:**

1. Sign in to ALwrity.
2. Open `/contact`.
3. Click **← Back to home**.
4. **Before fix:** You land on dashboard (or onboarding), **not** the marketing landing with hero.
5. **After fix:** You land on `/home` with the full marketing page.

**Estimated Test Time to Complete:** 3 minutes  

---



## SECTION 3 — PAGE HEADER (H1 + SUBLINE)

---

**Test Case No:** 005  
**Audited Section:** “Last updated: June 2025” shown on Contact page  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T / Trust  
**Why It Matters / Impact:** Contact is not a legal document that gets “updated” like Privacy or Terms. Showing **Last updated: June 2025** (now stale in July 2026) makes the page look unmaintained and confuses visitors.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LegalPageLayout.tsx` lines 90–95 — subline is shared by all pages using this layout, including `ContactPage.tsx`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before (Contact page):** `Last updated: June 2025 · Questions? info@alwrity.com`  
- **After option A:** Add optional prop `showLastUpdated?: boolean` to `LegalPageLayout`; set `showLastUpdated={false}` on `ContactPage.tsx`.  
- **After option B:** Replace subline on Contact with: **`We usually reply within 1–2 business days.`** (remove “Last updated” entirely on this page).  
**Manual Verification Steps:**

1. Open `/contact`.
2. Read the gray line directly under **Contact Us**.
3. Confirm it says **Last updated: June 2025** — inappropriate for a contact page.

**Estimated Test Time to Complete:** 1 minute  

---

**Test Case No:** 006  
**Audited Section:** Page title (browser tab) — acceptable but generic  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** Dynamic UX for CTR  
**Why It Matters / Impact:** Search results show **Contact Us — ALwrity**. A slightly more specific title can improve clicks from people searching “ALwrity support” or “ALwrity billing help.”  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/LegalPageLayout.tsx` line 31 — `fullTitle = \`${title} — ALwrity\``; `ContactPage.tsx` line 63 — `title="Contact Us"`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Browser tab / og:title: **Contact Us — ALwrity**  
- **After:** **Contact & Support — ALwrity** (update `title` prop in `ContactPage.tsx` only)  
**Manual Verification Steps:**

1. Open `/contact`.
2. Check the browser tab title.
3. Compare with a search-friendly phrase like “support” or “help.”

**Estimated Test Time to Complete:** 1 minute  

---



## SECTION 4 — INTRO PARAGRAPH

---

**Test Case No:** 007  
**Audited Section:** Meta description mentions billing; intro paragraph does not  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Dynamic UX for CTR  
**Why It Matters / Impact:** Google and social previews promise **“billing questions,”** but the visible intro only mentions being a small open-source team. Visitors from search may feel the page doesn’t match the snippet.  
**Repository Location & Structural Logic:** `ContactPage.tsx` line 64 — `metaDescription="...billing questions..."`. `ContactPage.tsx` lines 67–69 — intro text has no billing mention.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before (intro):** *“We're a small, open-source team building ALwrity in the open. Reach out — we typically respond within 1–2 business days.”*  
- **After (intro):** *“We're a small, open-source team building ALwrity in the open. Reach out for product support, billing help, or partnerships — we typically respond within 1–2 business days.”*  
**Manual Verification Steps:**

1. View page source or DevTools → Elements → `<meta name="description">` after load.
2. Confirm meta mentions **billing**.
3. Read the first paragraph on the page — confirm billing is **not** mentioned (**Before**).

**Estimated Test Time to Complete:** 2 minutes  

---



## SECTION 5 — HOW CAN WE HELP? (CHANNEL CARDS)

---

**Test Case No:** 008  
**Audited Section:** Three contact channels all show the same email address  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Cards titled **Product & support**, **Partnerships**, and **General inquiries** look like three paths, but all show **info@alwrity.com**. Users waste time choosing between identical options.  
**Repository Location & Structural Logic:** `frontend/src/components/Landing/ContactPage.tsx` lines 22–44 — all three `action` values are `info@alwrity.com`; only `href` subject lines differ.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Three cards, same visible email.  
- **After option A:** Merge into **one** card: title **Email us**, description **Product support, billing, partnerships, and general questions — one inbox, we route internally.**, link **info@alwrity.com**.  
- **After option B:** Keep three cards but add distinct helper lines under each email, e.g. Partnerships card: **“Put ‘Partnership’ in your subject line.”**  
**Manual Verification Steps:**

1. Open `/contact`.
2. Read all three cards under **How can we help?**
3. Confirm each shows **info@alwrity.com** with no visible difference except small mailto subject differences (invisible until clicked).

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 009  
**Audited Section:** No dedicated billing / account help path  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T / Trust  
**Why It Matters / Impact:** Meta and enterprise pricing flows mention billing. Contact page gives no shortcut for **subscription, invoices, or refunds** — users may email generic support without context.  
**Repository Location & Structural Logic:** `ContactPage.tsx` — no billing card; compare `PricingPage.tsx` lines 623–637 (mailto only, no link to `/contact`).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** No billing guidance on Contact page.  
- **After:** Add a fourth card or a line under the intro: **Billing & subscriptions:** For plan changes, invoices, or refunds, email **info@alwrity.com** with subject **“Billing — [your account email]”** or visit **Pricing** (`/pricing`) first.  
**Manual Verification Steps:**

1. Open `/contact`.
2. Search the page for the word **billing** (Ctrl+F).
3. **Before:** Word appears only in meta tags, not in visible body copy.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 010  
**Audited Section:** Channel cards — only the email text is clickable  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** On mobile, users often tap the card area expecting the whole box to open email. Only the small blue email link works.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 79–114 — `<Card>` is not wrapped in a link; only inner `<Link href={channel.href}>`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Card body is not clickable.  
- **After:** Wrap each card in `<Link component="a" href={channel.href}>` with `underline="none"` and `cursor: pointer`, or add `onClick` on Card that sets `window.location.href = channel.href`.  
**Manual Verification Steps:**

1. On mobile view, tap the **Product & support** card title or description (not the email link).
2. **Before:** Nothing happens.
3. Tap the **info@alwrity.com** link — email client opens.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 011  
**Audited Section:** Channel card headings — inconsistent punctuation  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T  
**Why It Matters / Impact:** Headings use H1 → H2 → H3 correctly. Optional polish: card titles could use consistent punctuation (**Product & support** vs **General inquiries**).  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 72–74 (H2), 103 (H3).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** **Product & support** / **Partnerships** / **General inquiries**  
- **After:** **Product and support** / **Partnerships** / **General inquiries** (consistent “and” vs “&”)  
**Manual Verification Steps:**

1. Visually scan the three card titles for punctuation consistency.

**Estimated Test Time to Complete:** 1 minute  

---



## SECTION 6 — SEND A MESSAGE (FORM)

---

**Test Case No:** 012  
**Audited Section:** Form does not send in the browser — opens email app only  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Many users (web-only Gmail, corporate laptops without mailto, some mobile browsers) click **Send Message** and nothing useful happens. There is no server-side contact API in the repo.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 53–58 — `handleSubmit` sets `window.location.href = mailto:...`; no backend contact endpoint found.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Submit opens mail client via `mailto:`.  
- **After option A (short term):** Add visible note above the form: **“This button opens your email app with your message filled in. No email app? Write to info@alwrity.com directly.”**  
- **After option B (long term):** Add backend `/api/contact` endpoint and POST form data; show **“Message sent — we’ll reply within 1–2 business days.”**  
**Manual Verification Steps:**

1. Use a browser **without** a configured email client (or Chrome on a machine with no default mail app).
2. Fill name, email, message; click **Send Message**.
3. **Before:** Page may show green success alert but **no email is sent** and no mail window opens.

**Estimated Test Time to Complete:** 4 minutes  

---

**Test Case No:** 013  
**Audited Section:** Green success alert appears even when email may not open  
**Evaluation Module:** Module 1  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T / Trust  
**Why It Matters / Impact:** The alert says **“Your email client should open…”** but `setSent(true)` runs **immediately** after assigning `mailto`, with no check that an email app opened. Users think the message was sent when it was not.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 57–58 and 123–127.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Alert text: **“Your email client should open with your message ready to send.”** (shows unconditionally on submit)  
- **After option A:** Change to: **“If your email app opened, review the message and press Send there. We have not received it until you send from your email app.”**  
- **After option B:** Only show alert after detecting `mailto` navigation (still imperfect); prefer real form POST (Test Case 012 option B).  
**Manual Verification Steps:**

1. Submit the form without a mail client configured.
2. Confirm green success box still appears (**Before**).
3. Confirm no email was actually delivered to ALwrity.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 014  
**Audited Section:** Button label **“Send Message”** implies in-browser send  
**Evaluation Module:** Module 3  
**Severity:** Warning  
**Strategic Pillar:** Dynamic UX for CTR  
**Why It Matters / Impact:** Users expect the button to send like a normal contact form. Instead it opens a separate app. This mismatch causes drop-off and support confusion.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 157–159 — `Send Message` button with `type="submit"`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Button text **Send Message**  
- **After:** **Open in email app** (with envelope icon) — or **Continue in email app →**  
**Manual Verification Steps:**

1. Read the button label without prior knowledge of mailto behavior.
2. Ask: “Will this send without leaving the browser?” — expected user answer is **yes** (**Before**), which is wrong.

**Estimated Test Time to Complete:** 1 minute  

---

**Test Case No:** 015  
**Audited Section:** No helper text above form explaining how submission works  
**Evaluation Module:** Module 2  
**Severity:** Warning  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** First-time visitors don’t know the form is a shortcut to email, not an in-page send.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 119–121 — H2 **Send a message** with no explanatory line before the form.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Heading only: **Send a message**  
- **After:** Add paragraph under H2: **“Fill in the form below and we’ll open your email app with everything filled in. You’ll need to press Send in your email app to deliver the message.”**  
**Manual Verification Steps:**

1. Open `/contact` as a new visitor.
2. Scroll to **Send a message**.
3. Confirm there is no instruction text before the fields (**Before**).

**Estimated Test Time to Complete:** 1 minute  

---

**Test Case No:** 016  
**Audited Section:** Form — browser-only validation, no friendly error messages  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Empty or invalid email relies on the browser’s default tooltip (often small and easy to miss on mobile).  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 131–156 — `required` and `type="email"` only; no `error` / `helperText` on TextField.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** No custom validation messages.  
- **After:** On submit with empty fields, show red helper text: **“Please enter your name.”** / **“Please enter a valid email address.”** / **“Please enter your message.”**  
**Manual Verification Steps:**

1. Leave all fields empty; click **Send Message**.
2. Note whether errors are generic browser bubbles only.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 017  
**Audited Section:** Message field — no character limit; very long text may break mailto link  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Core Web Vitals (reliability)  
**Why It Matters / Impact:** `mailto:` URLs have length limits (often ~2000 characters). A long message may truncate or fail silently.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 56–57 — full message in URL via `encodeURIComponent`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** No max length on message field.  
- **After:** Add `inputProps={{ maxLength: 1500 }}` and helper text: **“Maximum 1,500 characters (email link limit).”**  
**Manual Verification Steps:**

1. Paste 3,000+ characters into **Message**.
2. Submit and check whether the opened email body is truncated or empty.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 018  
**Audited Section:** Message field missing explicit autocomplete attribute  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Name and email have autocomplete; message does not document intent. Minor accessibility / autofill gap.  
**Repository Location & Structural Logic:** `ContactPage.tsx` lines 148–156 — message TextField has no `autoComplete`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **After:** Add `inputProps={{ autoComplete: 'off' }}` explicitly (message should not autofill) — document as intentional, **or** add `aria-describedby` linking to helper text.  
**Manual Verification Steps:**

1. Inspect message field attributes in DevTools.

**Estimated Test Time to Complete:** 1 minute  

---



## SECTION 7 — FOOTER

---

**Test Case No:** 019  
**Audited Section:** Footer Contact link works (baseline — verify only)  
**Evaluation Module:** Module 1  
**Severity:** Optimization (verification checkpoint)  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Confirms primary discovery path for this page.  
**Repository Location & Structural Logic:** `LandingFooter.tsx` line 26 — `{ label: 'Contact', to: '/contact' }`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **No change needed** if link resolves correctly.  
**Manual Verification Steps:**

1. From `/home`, scroll to footer; click **Contact**.
2. Confirm URL is `/contact` and page loads.

**Estimated Test Time to Complete:** 1 minute  

---

**Test Case No:** 020  
**Audited Section:** Pricing page “Email us” does not link to `/contact`  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Time-to-Value  
**Why It Matters / Impact:** Users on `/pricing` get raw `mailto:` links instead of the richer Contact page (channels, form, response-time promise).  
**Repository Location & Structural Logic:** `frontend/src/components/Pricing/PricingPage.tsx` lines 507–508, 613–614, 628 — `mailto:info@alwrity.com` without `/contact`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** **Email info@alwrity.com** → `mailto:`  
- **After:** **Contact our team** → `/contact` (keep mailto as secondary link if desired)  
**Manual Verification Steps:**

1. Open `/pricing`.
2. Trigger enterprise/plan inquiry dialog if available.
3. Confirm links go to mailto, not `/contact`.

**Estimated Test Time to Complete:** 3 minutes  

---



## SECTION 8 — GLOBAL (SEO, ACCESSIBILITY, TRUST)

---

**Test Case No:** 021  
**Audited Section:** Missing `<main>` landmark for screen readers  
**Evaluation Module:** Module 2 (Supplementary: Accessibility)  
**Severity:** Warning  
**Strategic Pillar:** E-E-A-T / Trust  
**Why It Matters / Impact:** Screen readers cannot jump to “main content” easily; hurts accessibility audits and WCAG best practice.  
**Repository Location & Structural Logic:** `LegalPageLayout.tsx` lines 64–121 — content in `<Container>` / `<Box>` but no `<main>`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** No `<main>` element.  
- **After:** Wrap lines 68–118 in `<Box component="main" id="main-content" aria-label="Contact page content">` (or dynamic label from `title` prop).  
**Manual Verification Steps:**

1. DevTools → Elements: search for `<main`.
2. **Before:** Not found on `/contact`.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 022  
**Audited Section:** Social / Open Graph image is generic landing image  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** Dynamic UX for CTR  
**Why It Matters / Impact:** When `/contact` is shared on LinkedIn or Slack, preview image is the main landing hero — not contact-specific. Acceptable but not ideal.  
**Repository Location & Structural Logic:** `LegalPageLayout.tsx` line 50 — `og:image` always `og-alwrity-landing.png`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Shared preview uses landing OG image.  
- **After (optional):** Add `public/og-alwrity-contact.png` and optional `ogImage` prop on `LegalPageLayout`; Contact page passes contact-specific image.  
**Manual Verification Steps:**

1. Use Facebook Sharing Debugger or LinkedIn Post Inspector on production `/contact`.
2. Note preview image is landing generic.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 023  
**Audited Section:** No ContactPage structured data on this URL  
**Evaluation Module:** Module 3 (Supplementary: Structured Data)  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T  
**Why It Matters / Impact:** Organization contact info exists globally in `index.html`, but this page could reinforce **ContactPage** / **ContactPoint** schema for search clarity.  
**Repository Location & Structural Logic:** Global: `frontend/public/index.html` lines 61–73 — Organization `contactPoint`. `LegalPageLayout.tsx` — no page-level JSON-LD.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **After:** Inject JSON-LD in `ContactPage` or `LegalPageLayout` when `canonicalPath === '/contact'`: `@type: ContactPage`, `url: https://www.alwrity.com/contact`, nested Organization contactPoint with `email: info@alwrity.com`, `contactType: customer support`, `availableLanguage: English`.  
**Manual Verification Steps:**

1. View page source on `/contact` after load.
2. Search for `ContactPage` in JSON-LD — **Before:** not present.

**Estimated Test Time to Complete:** 3 minutes  

---

**Test Case No:** 024  
**Audited Section:** Incomplete Open Graph tags on legal/contact pages  
**Evaluation Module:** Module 3  
**Severity:** Optimization  
**Strategic Pillar:** Dynamic UX for CTR  
**Why It Matters / Impact:** `LegalPageLayout` sets `og:title`, `og:description`, `og:url`, `og:image` but not `og:type` or `twitter:card`. Previews may fall back inconsistently.  
**Repository Location & Structural Logic:** `LegalPageLayout.tsx` lines 46–53 — compare `index.html` lines 16–27 which set full OG + Twitter set.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **After:** In `setMeta` block, add: `og:type` = **website**, `twitter:card` = **summary_large_image**, `og:image:alt` = **Contact ALwrity — support and partnerships**  
**Manual Verification Steps:**

1. DevTools → Elements → `<head>` on `/contact`.
2. Confirm `og:type` and `twitter:card` are missing (**Before**).

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 025  
**Audited Section:** Sitemap and public route — working (verify)  
**Evaluation Module:** Module 1 (Supplementary: Technical SEO)  
**Severity:** Optimization (positive checkpoint)  
**Strategic Pillar:** E-E-A-T  
**Why It Matters / Impact:** Confirms crawlers can find the page.  
**Repository Location & Structural Logic:** `frontend/public/sitemap.xml` lines 28–32 — `/contact` listed, priority 0.6. `frontend/src/api/client.ts` line 38 — `/contact` is public (no auth redirect).  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **No change** unless production URL differs from `https://www.alwrity.com/contact`.  
**Manual Verification Steps:**

1. Open `https://www.alwrity.com/sitemap.xml` — confirm `/contact` entry.
2. Open `/contact` signed out — page loads without login redirect.

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 026  
**Audited Section:** Visual inconsistency — Contact uses dark nav; Pricing uses light nav  
**Evaluation Module:** Module 2  
**Severity:** Optimization  
**Strategic Pillar:** E-E-A-T  
**Why It Matters / Impact:** Public pages feel like two different sites. Contact/Privacy/Terms are dark; Pricing is white. Not broken, but brand cohesion suffers.  
**Repository Location & Structural Logic:** `LegalPageLayout.tsx` — default dark `LandingNav` / `LandingFooter`. `PricingPageLayout.tsx` lines 53–57 — `surface="light"`.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **After option A:** Pass `surface="light"` to nav/footer on Contact for parity with Pricing.  
- **After option B:** Document dark theme as intentional for “legal/support” pages — no change.  
**Manual Verification Steps:**

1. Open `/contact` and `/pricing` in two tabs.
2. Compare top bar background (dark transparent vs white).

**Estimated Test Time to Complete:** 2 minutes  

---

**Test Case No:** 027  
**Audited Section:** Lazy-loaded page — brief loading spinner on first visit  
**Evaluation Module:** Module 1  
**Severity:** Optimization  
**Strategic Pillar:** Core Web Vitals  
**Why It Matters / Impact:** First navigation to `/contact` shows app loading fallback until chunk loads. Legal pages are small — eager load could remove flicker.  
**Repository Location & Structural Logic:** `App.tsx` line 32 — `React.lazy(() => import('./components/Landing/ContactPage'))`; wrapped in `<Suspense fallback={<LazyLoadingFallback />}>` line 187.  
**Actionable Recommendation & Concrete "Before/After" Adjustments:**  

- **Before:** Lazy import for ContactPage.  
- **After:** Static import ContactPage like `PricingPage` (line 15) for instant paint.  
**Manual Verification Steps:**

1. Hard refresh `/contact` with Network throttling “Fast 3G.”
2. Note spinner/skeleton before content (**Before**).

**Estimated Test Time to Complete:** 2 minutes  

---



## RECOMMENDED FIX ORDER (AFTER APPROVAL)

1. **004, 012, 013, 014, 015** — trust and dead-end issues (back link, form honesty, button label)
2. **005, 007, 008, 009** — content and meta alignment
3. **001, 021** — accessibility (skip link + main landmark)
4. **Remaining optimizations** — nav Contact link, structured data, pricing cross-links, lazy load

---



## Changes


| Test Case | Date Fixed | Verified By | Notes |
| --------- | ---------- | ----------- | ----- |
| 001       | 2026-07-04 | —           | Skip link + `#main-content` on `LegalPageLayout.tsx` |
| 003       | 2026-07-04 | —           | Nav auto-hide disabled on legal routes (`LandingNav.tsx`) |
| 004       | 2026-07-04 | —           | Back to home → `/home` (`LegalPageLayout.tsx`) |
| 005       | 2026-07-04 | —           | Removed “Last updated…” subline on Contact (`showLastUpdated={false}`) |
| 006       | 2026-07-04 | —           | Title → **Contact & Support — ALwrity** (`ContactPage.tsx`) |
| 007       | 2026-07-04 | —           | Intro updated; response time **5 business days** |
| 008       | 2026-07-04 | —           | Option B: subject-line hints under each channel card |
| 009       | 2026-07-04 | —           | Billing and subscriptions guidance block added |
| 010       | 2026-07-04 | —           | Full channel cards clickable (`Card component="a"`) |
| 011       | 2026-07-04 | —           | **Product and support** (consistent “and” vs “&”) |
| 012       | 2026-07-04 | —           | `POST /api/contact` + SMTP via `contact_form_service.py` |
| 013       | 2026-07-04 | —           | Success alert only after successful API POST (no mailto false positive) |
| 014       | 2026-07-04 | —           | Button **Send message** (accurate with in-browser POST; supersedes mailto label) |
| 015       | 2026-07-04 | —           | Form helper text for in-browser POST (`ContactPage.tsx`) |
| 016       | 2026-07-04 | —           | Inline field validation messages on submit |
| 017       | 2026-07-04 | —           | Message `maxLength={1500}` + helper text |
| 018       | 2026-07-04 | —           | Message `autoComplete="off"` + `aria-describedby` |
| 019       | 2026-07-04 | —           | Verified: footer **Contact** → `/contact` (no code change) |
| 020       | 2026-07-04 | —           | Pricing links → **Contact our team** / `/contact` (`PricingPage.tsx`) |
| 021       | 2026-07-04 | —           | `<main>` + dynamic `aria-label` on `LegalPageLayout.tsx` |
| 022       | 2026-07-04 | —           | `og-alwrity-contact.png` + `ogImage` prop on Contact |
| 023       | 2026-07-04 | —           | `ContactJsonLd.tsx` ContactPage schema |
| 024       | 2026-07-04 | —           | `og:type`, `twitter:card`, `og:image:alt` in `LegalPageLayout.tsx` |
| 026       | 2026-07-04 | —           | Option A: `surface="light"` on Contact nav/footer + light page styling |
| 027       | 2026-07-04 | —           | Eager import `ContactPage` in `App.tsx` (no lazy load) |
| —         | 2026-07-04 | —           | **Fix:** Register `/api/contact` on `app.py` (dev server entry); public API auth skip in `client.ts` |


**Instructions for next audit session:**  

- Do **not** delete rows above — add new rows when a test case is fixed.  
- Copy the original test case text from this document; mark status in **Notes** (e.g. “Verified on staging 2026-08-01”).  
- If a test case is rejected/won’t fix, add row with Notes: **“Won’t fix — reason…”**

---

*End of audit document.*
