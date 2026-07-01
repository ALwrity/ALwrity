# Audio-Only Podcast Optimization Plan

## Executive Summary

This document outlines the optimization strategy for audio-only podcasts in ALwrity's Podcast Maker. The goal is to maximize the character throughput per API request while maintaining cost efficiency and audio quality.

---

## 1. Current Cost Analysis

### 1.1 Pricing Structure

| Service | Provider | Cost Formula | Notes |
|---------|----------|--------------|-------|
| **TTS (Audio)** | Minimax Speech-02-HD (WaveSpeed) | $0.05 per 1,000 chars | Exact billing per character |
| **Voice Clone** | Minimax Voice Clone | $0.50 per clone | One-time if using custom voice |
| **Research** | Exa Neural Search | $0.005 per query | + ~$0.001 for LLM insight extraction |
| **Avatar** | Ideogram Character | $0.10 per image | Only if AI-generated |

### 1.2 Cost Examples

| Podcast Duration | Characters (est.) | TTS Cost | Total Cost (audio-only) |
|------------------|-------------------|----------|--------------------------|
| 1 minute | 750 | $0.04 | $0.07 |
| 3 minutes | 2,250 | $0.11 | $0.14 |
| 5 minutes | 3,750 | $0.19 | $0.22 |
| 10 minutes | 7,500 | $0.38 | $0.41 |

---

## 2. Technical Constraints

### 2.1 API Limits

**Backend**: `main_audio_generation.py` (line 100)
```python
if len(text) > 10000:
    raise ValueError(f"Text is too long ({len(text)} characters). Maximum is 10,000 characters.")
```

**Current Limit**: 10,000 characters per single API request

### 2.2 Scene-Based Architecture

- Each scene = 1 API call
- Default scene length: 45 seconds (`scene_length_target` knob)
- Audio is generated per scene, then concatenated

---

## 3. Optimization Strategies

### 3.1 Strategy 1: Fewer, Longer Scenes

**Problem**: More scenes = more API calls = higher costs

**Solution**: 
- Increase `scene_length_target` from 45s to 60s or 90s
- Fewer scenes for the same podcast duration

**Impact**:
| Duration | Scenes (45s) | Scenes (60s) | Scenes (90s) | API Call Savings |
|----------|-------------|--------------|--------------|------------------|
| 5 min | 7 | 5 | 3 | 57% fewer calls |
| 10 min | 13 | 10 | 7 | 46% fewer calls |

### 3.2 Strategy 2: Per-Scene Character Budgeting

**Current behavior**: Each scene text is sent separately to TTS API

**Optimization options**:

1. **Text Concatenation**: Combine multiple scene texts with `<#x#>` pause markers
   ```python
   # Example: Combine scenes with pause markers
   combined_text = "Scene 1 text.<#x#>Scene 2 text.<#x#>Scene 3 text."
   ```
   - Risk: May hit 10,000 char limit faster
   - Benefit: Single API call for multiple scenes

2. **Smart Chunking**: Dynamically batch scenes based on character count
   ```python
   MAX_CHARS_PER_REQUEST = 9500  # Leave buffer
   # Group scenes until approaching limit
   ```

### 3.3 Strategy 3: Voice Settings for Longer Content

**Speed factor impacts**:
- Speed 0.8 = 25% more content per same duration
- Speed 1.2 = 20% less content

**Recommendation**: Use speed 0.9-1.0 for optimal quality/cost balance

### 3.4 Strategy 4: Audio-Only Mode Skip

**For audio-only podcasts** (no video):

1. **Skip avatar generation** - Save $0.10 per speaker
2. **Skip video rendering** - Save $0.30 per scene  
3. **Skip scene images** - Save $0.04-$0.10 per scene

**Estimated savings for 5-min, 5-scene audio podcast**:
| Component | Cost | Audio-Only Savings |
|-----------|------|---------------------|
| Avatar | $0.10 | $0.10 |
| Video (5 scenes) | $1.50 | $1.50 |
| Images (5 scenes) | $0.20-$0.50 | $0.20-$0.50 |
| **Total** | $1.80-$2.10 | **$1.80-$2.10** |

---

## 4. Implementation Plan

### 4.1 Phase 1: User-Facing Controls (Frontend)

#### 4.1.1 Add "Audio Only" Toggle
- Location: `CreateModal.tsx` or `PodcastConfiguration.tsx`
- Options: `Audio Only` | `Video Only` | `Audio + Video`
- When enabled: Skip avatar, image, video generation
- Pass `audio_only: true` or `video_only: true` to backend

#### 4.1.2 Cost Preview Updates
- Show cost comparison based on selected mode
- Display potential savings for audio-only vs video

### 4.2 Phase 2: Script Editor UI (NEW - CRITICAL)

#### 4.2.1 Three Mode UI Strategy

The script editor needs to adapt based on the podcast mode:

| Mode | Script Editor UI | Available Actions |
|------|------------------|-------------------|
| **Audio Only** | Single audio-optimized script | Generate Audio only |
| **Video Only** | Current video script editor | Generate Audio + Image + Video |
| **Audio + Video** | Two tabs: "Audio Script" + "Video Script" | Full generation options |

#### 4.2.2 Implementation Details

**File:** `frontend/src/components/PodcastMaker/ScriptEditor/ScriptEditor.tsx`

**New Component Structure:**

```typescript
interface ScriptEditorProps {
  // ... existing props
  audioOnlyMode: boolean;    // Audio-only podcast
  videoOnlyMode: boolean;    // Video-only podcast (current behavior)
  audioScript?: Script;      // Audio-optimized script (3-4 scenes, more lines)
  videoScript?: Script;      // Video-optimized script (current)
  onAudioScriptChange?: (script: Script) => void;
  onVideoScriptChange?: (script: Script) => void;
}
```

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Script Editor                              [Audio] [Video] tabs (if both)
├─────────────────────────────────────────────────────────────┤
│  Mode: Audio-Only                                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Scene 1: Introduction (90s)                     [Edit]│  │
│  │   Host: Welcome to today's episode...                 │  │
│  │   Host: Today we're diving deep into...               │  │
│  │   ... (6-10 lines per scene for audio)                │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  [Generate Audio] $0.04                                   │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.3 Tab Implementation for Audio + Video Mode

**When both Audio and Video are selected:**

1. Show two tabs in script editor:
   - **Tab 1: "Audio Script"** - Audio-optimized (fewer scenes, more content)
   - **Tab 2: "Video Script"** - Current video script (more scenes, visual)

2. Each tab has independent:
   - Scene structure
   - Edit capabilities
   - Generation buttons

3. Generation actions differ by tab:
   - Audio Tab: "Generate Audio" button only
   - Video Tab: "Generate Audio" + "Generate Image" + "Generate Video"

#### 4.2.4 Backend Script Generation Updates

**Script generation endpoint changes:**

```python
# In PodcastScriptRequest model
class PodcastScriptRequest(BaseModel):
    # ... existing fields
    audio_only: bool = False      # Generate audio-optimized script
    video_only: bool = False     # Generate video-optimized script (current)
    # If both False AND audio/video mode is "both", generate both scripts
```

**Prompt Selection Logic:**

```python
if request.audio_only:
    prompt = AUDIO_ONLY_PROMPT  # 3-4 scenes, 6-10 lines/scene
elif request.video_only:
    prompt = VIDEO_PROMPT        # Current 5-6 scenes, 2-4 lines/scene
else:
    # Generate both scripts with respective prompts
    audio_prompt = AUDIO_ONLY_PROMPT
    video_prompt = VIDEO_PROMPT
```

### 4.3 Phase 3: Backend Script Generation (AI Prompts)

#### 4.2.1 Two-Tier Script Generation Strategy

**Current Behavior (Video Podcast):**
- Existing prompt in `backend/api/podcast/handlers/script.py` (lines 125-151)
- Optimized for video with shorter scenes (2-4 lines per scene)
- 5-6 scenes max for visual storytelling
- Less content per scene to match video duration

**New Audio-Only Mode:**
- New prompt optimized for audio-only content
- More content-dense, information-rich
- Fewer scenes with MORE content per scene
- Maximizes use of research data
- Reduces API calls while delivering more value

#### 4.2.2 Audio-Only Script Prompt

**Location:** `backend/api/podcast/handlers/script.py`

**New Prompt for Audio-Only:**

```python
AUDIO_ONLY_PROMPT = """Create a DEEP, content-rich podcast script optimized for AUDIO-ONLY delivery.

{f"RESEARCH DATA (Use extensively - this is audio only, more content is better): {research_context[:3000]}" if research_context else "No research available - generate general content"}

{f"BIBLE: {bible_context[:1500]}" if bible_context else ""}
{f"{analysis_context}" if analysis_context else ""}

Topic: "{request.idea}"
Duration: {request.duration_minutes} min | Speakers: {request.speakers}
MODE: AUDIO-ONLY (no video constraints - maximize content density)

COST OPTIMIZATION (Audio-Only):
- 3-4 scenes MAX for entire episode (fewer scenes = fewer API calls)
- EACH scene should have 6-10 LINES (more content per scene)
- Each line: 3-5 sentences, information-dense
- Include: facts, statistics, examples, insights from research
- NO visual descriptions needed (save tokens for content)
- Make every line deliver unique value

STRUCTURE per scene:
- scene_id: string
- title: short descriptive title
- duration: seconds (target {request.duration_minutes*60 // 3}-{request.duration_minutes*60 // 4} per scene)
- emotion: neutral|happy|excited|serious|curious|confident
- lines: array of {{speaker, text, emphasis}}
  - speaker: "Host" or "Guest"
  - text: 3-5 sentences, rich with facts/insights
  - emphasis: true|false for important points

Return JSON with scenes array.
"""
```

**Key Differences:**

| Aspect | Video (Current) | Audio-Only (New) |
|--------|------------------|------------------|
| Scenes | 5-6 | 3-4 |
| Lines/Scene | 2-4 | 6-10 |
| Sentences/Line | 1-3 | 3-5 |
| Research Usage | 1,200 chars | 3,000 chars |
| Focus | Visual storytelling | Content density |
| API Calls | More (lower cost/scene) | Fewer (higher cost/scene) |

#### 4.2.3 Implementation Details

**File:** `backend/api/podcast/handlers/script.py`

1. Add `audio_only: bool` parameter to `PodcastScriptRequest`
2. Conditionally select prompt based on `audio_only` flag
3. For audio-only:
   - Use expanded research context (3,000 chars vs 1,200)
   - Request more lines per scene
   - Fewer total scenes
   - More content per line

### 4.4 Phase 4: Backend Optimizations

#### 4.3.1 Smart Scene Batching
- File: `backend/api/podcast/handlers/audio.py`
- Logic: Group scenes with total chars < 9000
- Add pause markers between scenes

#### 4.3.2 Audio-Only Flag in Project
- Model: Add `audio_only: bool` to project settings
- Skip: Avatar generation, image generation, video rendering

### 4.4 Phase 4: Cost Calculation Updates

#### 4.4.1 Update Frontend Estimation
- File: `frontend/src/services/podcastApi.ts`
- Formula updates:
  ```typescript
  const estimatedApiCalls = Math.ceil(totalChars / 9500);
  const ttsCost = estimatedApiCalls * 0.05;
  ```

---

## 5. Technical Details

### 5.1 Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/PodcastMaker/types.ts` | Add `audio_only`, `video_only`, `podcast_mode` to project settings |
| `frontend/src/components/PodcastMaker/CreateModal.tsx` | Add mode toggle (Audio/Video/Both) |
| `frontend/src/services/podcastApi.ts` | Update cost estimation for each mode |
| `frontend/src/components/PodcastMaker/ScriptEditor/ScriptEditor.tsx` | Add tab support for Audio + Video mode |
| `frontend/src/components/PodcastMaker/ScriptEditor/SceneEditor.tsx` | Conditional action buttons per mode |
| `backend/api/podcast/models.py` | Add `audio_only`, `video_only` fields to request model |
| `backend/api/podcast/handlers/script.py` | Add audio-only + video-only prompts, return both scripts when needed |
| `backend/api/podcast/handlers/audio.py` | Implement smart batching |

### 5.2 API Endpoints

```python
# PodcastScriptRequest model changes
class PodcastScriptRequest(BaseModel):
    idea: str
    duration_minutes: int
    speakers: int
    research: Optional[Dict] = None
    bible: Optional[Dict] = None
    analysis: Optional[Dict] = None
    outline: Optional[Dict] = None
    # NEW FIELDS:
    audio_only: bool = False      # Generate audio-optimized script
    video_only: bool = False      # Generate video-optimized script (current)
    # Both False = generate both scripts for audio+video mode

# Response includes both scripts when needed
class PodcastScriptResponse(BaseModel):
    audio_script: Optional[Script] = None   # Audio-optimized
    video_script: Optional[Script] = None   # Video-optimized
```

### 5.3 Database Schema

```python
# In PodcastProject model
audio_only: bool = False
scene_length_target: int = 60  # seconds
```

---

## 6. User Experience

### 6.1 Create Phase - Mode Toggle

```
┌─────────────────────────────────────────────────────────────┐
│  🎙️ Create New Podcast                                     │
├─────────────────────────────────────────────────────────────┤
│  Duration: [5] minutes   Speakers: [1] [2]                   │
│                                                             │
│  Podcast Mode:                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Audio Only  │ │ Video Only  │ │ Audio+Video │          │
│  │   ($0.22)   │ │   ($2.02)   │ │   ($2.24)   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│  Est. Cost: $0.22 (audio only) vs $2.02 (with video)       │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Script Editor - Audio Only Mode

```
┌─────────────────────────────────────────────────────────────┐
│  Script Editor                                              │
├─────────────────────────────────────────────────────────────┤
│  📻 Audio-Only Mode                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Scene 1: Introduction (90s)                     [Edit]│
│  │   Host: Welcome to today's episode on AI...         │
│  │   Host: Today we're diving deep into how AI...      │
│  │   Host: I'm excited to share three key insights...  │
│  │   ... (6-10 lines for audio)                        │
│  │                                                      │
│  │ Scene 2: Main Topic (120s)                      [Edit]│
│  │   ...                                               │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Generate Audio] $0.04      [Generate Image] Disabled    │
│  [Generate Video] Disabled                                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Script Editor - Video Only Mode (Current)

```
┌─────────────────────────────────────────────────────────────┐
│  Script Editor                                              │
├─────────────────────────────────────────────────────────────┤
│  🎬 Video Mode                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Scene 1: Intro (30s)          [Image] [Audio] [V] │
│  │ Scene 2: Hook (30s)            [Image] [Audio] [V]  │
│  │ Scene 3: Content (45s)         [Image] [Audio] [V]  │
│  │ Scene 4: Example (30s)         [Image] [Audio] [V]  │
│  │ Scene 5: CTA (15s)             [Image] [Audio] [V]   │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Generate Audio] $0.19   [Generate Image] $0.10           │
│  [Generate Video] $1.50                                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Script Editor - Audio + Video Mode (Both)

```
┌─────────────────────────────────────────────────────────────┐
│  Script Editor                             [Audio] [Video] │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [Audio] Tab | [Video] Tab                           │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ Audio Script:                                        │  │
│  │   Scene 1: Intro (90s) - 8 lines                   │  │
│  │   Scene 2: Deep Dive (120s) - 10 lines              │  │
│  │                                                      │  │
│  │ [Generate Audio] $0.04                              │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
OR
┌─────────────────────────────────────────────────────────────┐
│  Script Editor                             [Audio] [Video] │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [Audio] Tab | [Video] Tab                           │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ Video Script:                                       │  │
│  │   Scene 1: Intro (30s)    [Img] [Aud] [Vid]         │  │
│  │   Scene 2: Hook (30s)      [Img] [Aud] [Vid]        │  │
│  │   Scene 3: Content (45s)   [Img] [Aud] [Vid]        │  │
│  │                                                      │  │
│  │ [Generate Audio] [Generate Image] [Generate Video]  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 Cost Comparison UI

| Mode | Scenes | Lines/Scene | TTS Cost | Video Cost | Total |
|------|--------|-------------|----------|------------|-------|
| Audio Only | 3-4 | 6-10 | $0.19 | $0 | **$0.22** |
| Video Only | 5-6 | 2-4 | $0.19 | $1.50 | **$1.69** |
| Audio+Video | 3-4 + 5-6 | varies | $0.19 | $1.50 | **$1.72** |

---

## 7. Testing Plan

### 7.1 Unit Tests

1. Test character count calculation
2. Test scene batching logic (under 10k chars)
3. Test cost estimation accuracy

### 7.2 Integration Tests

1. Generate audio for 10-minute podcast with 5 scenes
2. Verify all scenes generate correctly
3. Verify cost tracking in database

### 7.3 Performance Tests

1. Measure time for batched vs sequential API calls
2. Verify no timeout issues with longer text

---

## 8. Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API calls per 5-min podcast | 5 | 7 |
| Cost per 5-min audio podcast | $0.22 | $0.22 + video |
| User-visible savings | 50%+ | N/A |
| Scene length default | 60s | 45s |

---

## 9. Appendix: Related Files

### Backend
- `backend/services/llm_providers/main_audio_generation.py` - TTS cost calculation
- `backend/api/podcast/handlers/audio.py` - Audio generation endpoint
- `backend/api/podcast/handlers/script.py` - Script generation
- `backend/services/subscription/pricing_service.py` - Pricing configuration

### Frontend  
- `frontend/src/services/podcastApi.ts` - Cost estimation
- `frontend/src/components/PodcastMaker/CreateModal.tsx` - Create UI
- `frontend/src/components/PodcastMaker/types.ts` - Type definitions

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-08 | ALwrity Team | Initial document creation |

---

*This document serves as the reference for audio-only podcast optimization in ALwrity Podcast Maker.*
