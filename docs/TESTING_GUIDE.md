# ALwrity Testing Guide

> Written for non-technical testers and content creators. Covers Free Plan limits, subscription billing flow, and cost estimation verification.

---

## Table of Contents

1. [What We're Testing](#1-what-were-testing)
2. [Plans at a Glance](#2-plans-at-a-glance)
3. [Free Plan Limits — What You Can & Can't Do](#3-free-plan-limits)
4. [Cost Estimation — How It's Calculated](#4-cost-estimation)
5. [UI Checks — What to Look For](#5-ui-checks)
6. [Step-by-Step Test Cases](#6-test-cases)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. What We're Testing

Recent fixes changed:

- **Free Plan limits**: Image generation (3→10), audio clips (5→10)
- **Cost estimation breakdown**: Now shows all 5 cost phases (Analysis, Research, Script, Voice, Visuals) instead of only 3
- **Subscription sync**: Plan changes from Stripe (upgrade/downgrade/ cancel) are correctly reflected in the app
- **Billing page access**: `/billing` and `/pricing` pages are always accessible (no onboarding gate)
- **Image generation enforcement**: Checks the correct limit for your AI provider (not always hardcoded to Stability)

---

## 2. Plans at a Glance

| Feature | Free | Basic ($29/mo) | Pro ($79/mo) | Enterprise ($199/mo) |
|---------|------|----------------|--------------|----------------------|
| AI text generation | 50 calls | 500 calls | 3,000 calls | Unlimited |
| Image generation | 10 images | 25 images | 100 images | Unlimited |
| Audio clips | 10 clips | 100 clips | 100 clips | Unlimited |
| Video renders | 2 videos | 10 videos | 30 videos | Unlimited |
| Research queries | 10 queries | 100 queries | 500 queries | Unlimited |
| Monthly cost cap | **$2.00** | $25.00 | $100.00 | $500.00 |
| Price | Free | $29/mo or $290/yr | $79/mo or $790/yr | $199/mo or $1,990/yr |

### Key Free Plan Details

The Free plan is designed to let you try **2 complete podcasts** (5 scenes each):

- **10 images** = 5 images per podcast × 2 podcasts
- **10 audio clips** = 5 clips per podcast × 2 podcasts
- **2 video renders** = 1 video per podcast × 2 podcasts
- **50 AI text calls** = covers analysis, research, and script generation
- **$2.00 monthly cap** = prevents accidental overspend

---

## 3. Free Plan Limits

### What counts toward each limit

| Limit | What consumes it |
|-------|-----------------|
| **AI text generation** (50) | Every LLM call: topic analysis, research synthesis, script writing |
| **Image generation** (10) | Every avatar/scene image you generate |
| **Audio clips** (10) | Every audio narration clip (each speaker segment) |
| **Video renders** (2) | Every full video render of a podcast episode |
| **Research queries** (10) | Every search query to Exa/Google during research |
| **Image edits** (5) | Every AI image edit/ retouch |
| **Monthly cost cap** ($2.00) | Hard stop — prevents total monthly cost from exceeding $2 |

### How to check your usage

1. Click your avatar (top-right corner)
2. Your plan name shows next to your name (green = Free, blue = Basic, purple = Pro)
3. Click **"View Costing Details"** to see per-category usage
4. When you hit a limit, the app shows a **red error banner** explaining what's blocked

### What happens when you hit a limit

- **Warning**: You'll see usage bars approaching 80-90% in the Costing Details popup
- **Blocked**: The feature stops working with a message like *"You've reached your [X] limit. Upgrade to Basic to continue."*
- **Cost cap hit**: All paid API calls stop until the next billing cycle
- **Next billing cycle**: Limits reset on the 1st of each month

### Upgrading

1. Click your avatar → **Manage Subscription** (opens Stripe Customer Portal)
2. Choose a new plan (Basic/Pro/Enterprise)
3. After payment, the app syncs automatically within 2 seconds
4. Your plan chip color updates and old limits are removed

---

## 4. Cost Estimation

Every time you open the **Create Podcast** modal, ALwrity calculates an estimated cost based on your settings:

### How cost is calculated

The backend uses **pricing catalog rates** for each AI service:

| Service | Model | Rate |
|---------|-------|------|
| LLM (analysis, research, script) | Gemini 2.5 Flash | $0.30 per 1M input tokens, $2.50 per 1M output tokens |
| Search | Exa | $0.005 per query |
| Audio TTS (voice narration) | Minimax Speech 02 HD | $0.05 per 1,000 characters |
| Voice Clone | Qwen3 | $0.005 per request + $0.05 per 1,000 chars |
| Image (avatar) | Qwen Image | $0.03 per image |
| Video | WAN 2.5 | $0.25 per video render |

### What goes into each cost phase

**Analysis Cost**
- Reading the topic URL/idea: ~1,800 tokens input
- Writing the analysis: ~1,000 tokens output
- Formula: `(1800 × input_rate) + (1000 × output_rate)`
- Example: `(1800 × $0.0000003) + (1000 × $0.0000025)` = **$0.003**

**Research Cost**
- LLM synthesis: ~2,200 tokens input + ~900 tokens output
- Search API: 3 queries × $0.005 = $0.015
- Formula: `(2200 × input_rate) + (900 × output_rate) + (queries × $0.005)`
- Example: `(2200 × $0.0000003) + (900 × $0.0000025) + (3 × $0.005)` = **$0.019**

**Script Cost**
- Input: 1,800 + (duration_min × 300) tokens
- Output: 2,200 + (duration_min × 700) tokens
- Example (5 min podcast): `(3300 × $0.0000003) + (5700 × $0.0000025)` = **$0.015**

**Voice Cost (TTS + Voice Clone)**
- Characters: 900 chars × minutes × speakers
- Voice clone: 1 setup per speaker
- Formula: `(chars × $0.00005) + (speakers × $0.005)`
- Example (5 min, 2 speakers): `(9000 × $0.00005) + (2 × $0.005)` = **$0.46**

**Visuals Cost**
- Avatar images: speakers × $0.03
- Video renders: minutes × $0.25
- Example (5 min, 2 speakers): `(2 × $0.03) + (5 × $0.25)` = **$1.31**

### Example: 5-minute podcast, 2 speakers, Audio+Video mode

| Phase | Cost |
|-------|------|
| Analysis | $0.003 |
| Research | $0.019 |
| Script | $0.015 |
| Voice (TTS + clone) | $0.460 |
| Visuals (avatar + video) | $1.310 |
| **Total** | **$1.81** |

### How to verify a cost estimate

1. Open the Create Podcast modal
2. Set: Duration = 5, Speakers = 2, Mode = Audio+Video
3. The "Est. Cost" chip in the topic input shows **~$1.80**
4. Hover over the chip to see the tooltip with settings used
5. After creating the podcast, the Estimate Card shows all 5 phase chips
6. The Header progress bar also shows the phase breakdown
7. Verify: **Analysis + Research + Script + Voice + Visuals = Total** (shown in the Estimate Card big number)

### What to check visually

- **All 5 chips** are visible: Analysis, Research, Script, Voice, Visuals
- **No chips show $0.00** unless the corresponding phase isn't needed
- The **total matches** what you'd get by adding the chips manually
- **Voice + Visuals chip values change** when you adjust duration or speakers

---

## 5. UI Checks

### A. Plan Chip (top-right corner)

| What to check | Expected |
|---------------|----------|
| Color | Free = green, Basic = blue, Pro = purple, Enterprise = orange |
| Label | Shows "Free", "Basic", "Pro", or "Enterprise" |
| Loading state | Shows a spinning animation while subscription syncs |
| Refresh button | Click to manually re-sync plan from Stripe |

### B. "Manage Subscription" Button

| What to check | Expected |
|---------------|----------|
| Location | Dropdown menu under your avatar |
| Appearance | Gradient indigo→purple button |
| Click behavior | Opens Stripe Customer Portal in a new tab |
| After upgrade | Wait 2 seconds — plan chip updates automatically |
| After downgrade | Plan changes to Free, limits reset to Free tier |

### C. "View Costing Details" Button

| What to check | Expected |
|---------------|----------|
| Location | Dropdown menu under your avatar |
| Appearance | Gradient cyan→blue button |
| Click behavior | Opens Usage Dashboard popup showing per-category usage bars |
| Data accuracy | Usage counts match what you've actually generated |

### D. Estimate Card (after creating a podcast)

| What to check | Expected |
|---------------|----------|
| Chips visible | Analysis, Research, Script, Voice, Visuals |
| Chip values | Positive numbers that add up to the displayed total |
| Total | The big number equals sum of all chips |
| Voice chip | Value changes when you change duration or speaker count |
| Visuals chip | Changes with duration and speaker count |

### E. Phase Breakdown in Header

| What to check | Expected |
|---------------|----------|
| 4 phases shown | Analyze, Gather, Write, Produce |
| Phase costs | No phase should be $0.00 (unless data hasn't loaded yet) |
| Total shown | Sum of 4 phases equals total from Estimate Card |

### F. Billing Page

| What to check | Expected |
|---------------|----------|
| URL | `/billing` loads without redirecting to onboarding |
| Pricing page | `/pricing` also accessible without onboarding |
| Content | Shows plan comparison table and current plan status |

### G. Onboarding/Signup Flow

| What to check | Expected |
|---------------|----------|
| New user | Sees onboarding wizard |
| Billing during onboarding | Can click pricing links without getting stuck |
| After onboarding | Redirected to dashboard with Free plan active |

---

## 6. Test Cases

### Test Case 1: Free Plan Image Generation

**Setup**: User on Free plan, `GPT_PROVIDER` set to `gemini`

**Steps**:
1. Create a podcast (5 min, 2 speakers, Audio+Video)
2. Let it generate through the avatar/scene image phase
3. Check the error/success

**Expected**: Works — up to 10 images per month. The system checks `gemini_calls` limit (not `stability_calls`).

**To verify**: Check the Usage Dashboard → Image generation count increased by 5 (one per scene).

---

### Test Case 2: Free Plan Limit Enforcement

**Setup**: User on Free plan with 0 remaining image calls (simulated or after generating 10 images)

**Steps**:
1. Try to generate another podcast with images

**Expected**: Preflight check blocks with: *"You've reached your Image Generation limit. Upgrade to Basic to continue."*

---

### Test Case 3: Cost Estimate Sum Check

**Setup**: Any plan

**Steps**:
1. Open Create Podcast modal
2. Note the "Est. Cost" amount
3. Create the podcast
4. Look at the Estimate Card in the dashboard
5. Manually add: Analysis + Research + Script + Voice + Visuals chips

**Expected**: Sum = Total displayed. Numbers match the pre-estimate from step 2.

---

### Test Case 4: Phase Breakdown Completeness

**Setup**: A podcast with analysis, research, and script completed

**Steps**:
1. Go to the Podcast Dashboard
2. Look at the Header progress bar (top)
3. Hover over or inspect the cost breakdown

**Expected**: All 4 phases (Analyze, Gather, Write, Produce) show non-zero costs. None shows $0.00.

---

### Test Case 5: Duration Affects Cost

**Setup**: Any plan

**Steps**:
1. Open Create Podcast modal
2. Set Duration = 1 min, Speakers = 1 → note Est. Cost
3. Change Duration = 10 min, Speakers = 2 → note Est. Cost

**Expected**: The 10-min/2-speaker estimate is higher. Voice cost increases the most (more TTS characters). Video cost also increases.

---

### Test Case 6: Upgrade → Downgrade Round-Trip

**Setup**: User starts on Free plan

**Steps**:
1. Click avatar → Manage Subscription
2. In Stripe: upgrade to Basic ($29/mo) and complete payment
3. Go back to the app — wait 5 seconds
4. Click avatar → plan should show "Basic" (blue)
5. Click Manage Subscription again
6. In Stripe: downgrade to Free plan
7. Go back to the app — wait 5 seconds
8. Click avatar → plan should show "Free" (green)

**Expected**: Plan chip updates within ~5 seconds after upgrade and after downgrade. No stale "Basic" label after downgrading.

---

### Test Case 7: Billing Page Without Onboarding

**Setup**: A fresh user who hasn't completed onboarding

**Steps**:
1. Log in
2. Navigate directly to `/billing`
3. Navigate directly to `/pricing`

**Expected**: Both pages load normally. No redirect to onboarding. User can see pricing plans.

---

### Test Case 8: Cost Cap Stop

**Setup**: Free plan user who has spent $2.00 (or a value close to it)

**Steps**:
1. Try to generate any AI content (podcast, blog, image, etc.)

**Expected**: All generation is blocked with message about monthly cost cap. User sees: *"Monthly cost limit reached. Upgrade to continue."*

---

### Test Case 9: Estimate Card Chip Count

**Setup**: Any completed podcast

**Steps**:
1. Look at the Estimate Card (below the podcast title area)

**Expected**: Exactly 5 chips visible:
- Analysis: $X.XX
- Research: $X.XX  
- Script: $X.XX
- Voice: $X.XX
- Visuals: $X.XX

No duplicate chips or missing chips.

---

### Test Case 10: Dark Mode / Light Mode

**Setup**: Any plan

**Steps**: Toggle between light/dark mode (if available)

**Expected**: Cost chips remain readable. Text colors adapt to mode. Gradient buttons remain visible.

---

## 7. Troubleshooting

### Cost Estimate Shows "Unavailable"

- **Cause**: Backend pricing data not loaded
- **Fix**: Restart the backend server. Check logs for `initialize_default_pricing`.
- **Manual check**: Hit `GET /api/podcast/pre-estimate?duration=5&speakers=2&query_count=3&podcast_mode=audio_video`

### Plan Chip Shows Wrong Plan

- **Cause**: Stale subscription cache
- **Fix**: Click the **refresh** (circular arrow) button next to the plan chip
- **If still wrong**: Click "Manage Subscription" → Stripe shows correct plan → go back to app
- **Still stuck**: Clear browser cache and reload

### Phase Breakdown Shows All Zeros

- **Cause**: Podcast was created before the fix (old data)
- **Fix**: This affects only new podcasts created after the fix. Old podcasts won't have phase breakdown retroactively.
- **For testers**: Always test with a freshly created podcast

### "Image generation blocked" on Free Plan

- **Possible cause 1**: You've reached 10 images this month
- **Possible cause 2**: Your `GPT_PROVIDER` is set to a provider without Free plan access
- **To check**: Look at the error message — it should say which limit was hit

### Cost Chips Sum Doesn't Match Total

- The Estimate Card now combines **TTS + Voice Clone** into a single "Voice" chip, and **Avatar + Video** into a single "Visuals" chip
- Chip sum = Analysis + Research + Script + Voice(TTS+clone) + Visuals(avatar+video) = **Total** ✓
- If you see a mismatch, check if you're looking at an **older podcast** created before the fix — those won't have the updated chip breakdown (but the total remains correct)

### "Manage Subscription" Opens Blank Page

- **Cause**: Stripe Customer Portal not configured in backend
- **Fix**: Ensure `STRIPE_CUSTOMER_PORTAL_ID` and `STRIPE_SECRET_KEY` are set in `.env`
- **Fallback**: Contact support to manually change plan

---

## Appendix: Quick Reference Formulas

```
Analysis_Cost = (1800 × LLM_input_rate) + (1000 × LLM_output_rate)

Research_Cost = (2200 × LLM_input_rate) + (900 × LLM_output_rate) + (query_count × Exa_rate)

Script_Cost = ((1800 + minutes × 300) × LLM_input_rate) + ((2200 + minutes × 700) × LLM_output_rate)

Voice_Cost = (900 × minutes × speakers × TTS_rate) + (speakers × voice_clone_setup_rate)

Visuals_Cost = (speakers × image_rate) + (minutes × video_rate)

Total = Analysis + Research + Script + Voice + Visuals
```

### Default rates (used by the system)

```
LLM_input_rate        = $0.0000003  (Gemini 2.5 Flash input)
LLM_output_rate       = $0.0000025  (Gemini 2.5 Flash output)
Exa_rate              = $0.005      (per search query)
TTS_rate              = $0.00005    (per character, Minimax Speech 02 HD)
Voice_clone_setup_rate = $0.005     (per speaker, Qwen3 voice clone)
Image_rate            = $0.03       (per image, Qwen Image)
Video_rate            = $0.25       (per render, WAN 2.5)
```

---

*Last updated: May 2026*
*Questions? Open a GitHub issue or contact support.*
