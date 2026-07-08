# ALwrity - AI-First Digital Marketing & Content OS

> 💡 **Internship Assessment Submission**
> This repository contains the technical assessment and bug-squishing tasks completed by **Joseph Vincent** (GitHub: [@josephvincenp2804](https://github.com/josephvincenp2804)) for the **Technical QA, Bug Fix & AI Ops Intern** role at ALwrity.

ALwrity is an open-source, AI-powered digital marketing powerhouse. It automates content strategy, content generation, and publishing across multiple channels (stories, essays, video, audio, podcasts, and social media) by integrating advanced Large Language Models (LLMs) with modern digital systems.

This repository is organized as a monorepo consisting of:
*   **FastAPI Backend** (`/backend`): Powers AI content pipelines, translation services, scheduling, and database persistence.
*   **React Frontend** (`/frontend`): A modern React and TypeScript dashboard to plan, generate, and analyze your content.

---

## ✨ Features

*   **Multimodal AI Engine:** Generates blogs, essays, videos, podcasts, and social media campaigns using flagship model APIs (Gemini, OpenAI) and open-source models.
*   **Contextual Content Strategy:** Learn about your brand, competitors, and keywords to automate SEO-optimized publishing.
*   **Advanced Translation & Dubbing:** dubs audio and translates text in 34+ languages with DeepL and WaveSpeed providers.
*   **Task Scheduler:** Set and schedule automated marketing campaigns and track metrics.

---

## 🛠️ Internship Challenge - Bug Fixes & Enhancements

This fork contains fixes and enhancements implemented for the technical QA and bug-squishing challenge:

### 1. Translation Provider Caching Bug Fix
*   **Problem:** The backend `get_translator()` cached translation provider instances using `id(kwargs)`. Because `kwargs` is instantiated as a new dictionary on every call, its memory ID changes constantly. This resulted in zero cache hits, causing memory bloat and repeated instance creations.
*   **Fix:** Updated `translation_factory.py` to generate stable cache keys by sorting and string-formatting `kwargs` keys and values (`kwargs_str = "_".join(...)`).

### 2. Isolated Language Code Mapping State Bug Fix
*   **Problem:** `LANGUAGE_CODE_MAPPING` was defined as a mutable class-level dictionary. Multiple subclass instances (e.g. `DeepLTranslator`, `WaveSpeedTranslator`) wrote to this dictionary directly in their constructor without re-instantiation, causing mapping state pollution across subclasses.
*   **Fix:** Re-instantiated `self.LANGUAGE_CODE_MAPPING = {}` inside `BaseTranslationProvider.__init__` to isolate the state per instance.

### 3. Persistent File-Based Cache [New Feature]
*   **Enhancement:** Created a new file-based persistent caching system (`backend/services/translation/translation_cache.py`) that serializes translation results to `backend/cache/translation_cache.json`.
*   **Benefit:** Instantly resolves duplicate translation requests for free without invoking external APIs (DeepL or WaveSpeed), boosting performance and reducing API expenses.

### 4. Added Caching & Mapping Isolation Unit Tests
*   **Files:** `test_translation_cache.py` and `test_translation_persistent_cache.py`.
*   **Tests:** Verifies translation cache hits, cache misses, mapping state isolation, and persistence.

---

## 🚀 Setup & Execution Guide

### Prerequisites
*   **Python:** Version 3.10 to 3.12 (Recommended). *Note: Python 3.14 currently has issues compiling binary wheels like `pandas` and `lxml` on Windows.*
*   **Node.js:** v18+ with `npm`.

---

### 1. Backend Setup & Run

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Comment out or remove `lxml` from `requirements.txt` if you are on an unsupported Python version (e.g. Python 3.14), as it is not directly imported in the source code.
3.  Create and activate a virtual environment:
    ```bash
    python -m venv .venv
    # Windows PowerShell:
    .\.venv\Scripts\Activate.ps1
    # Linux/macOS:
    source .venv/bin/activate
    ```
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Start the FastAPI backend:
    ```bash
    python start_alwrity_backend.py
    ```
    *The API documentation will be available at [http://localhost:8000/api/docs](http://localhost:8000/api/docs).*

---

### 2. Frontend Setup & Run

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Start the development server:
    *On some Windows or Cloud IDE systems, you might need to bypass the Webpack dev server host check due to proxy configurations:*
    ```powershell
    # Windows PowerShell:
    $env:DANGEROUSLY_DISABLE_HOST_CHECK="true"
    npm start

    # Linux/macOS/Git Bash:
    DANGEROUSLY_DISABLE_HOST_CHECK=true npm start
    ```
    *The React application will open automatically at [http://localhost:3000](http://localhost:3000).*

---

## 🧪 Running Tests

To run the backend test suite:
1.  Ensure your virtual environment is active in the `backend` folder.
2.  Run pytest:
    ```bash
    pytest
    ```
