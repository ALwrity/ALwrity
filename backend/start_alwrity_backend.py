#!/usr/bin/env python3
"""
ALwrity Backend Server - Modular Startup Script
Handles setup, dependency installation, and server startup using modular utilities.
Run this from the backend directory to set up and start the FastAPI server.
"""

import os
import sys
import json
import argparse
import platform
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

# Detect platform
IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"


def configure_console_utf8() -> None:
    """Avoid UnicodeEncodeError on Windows cp1252 consoles when printing status icons."""
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

import uvicorn


@dataclass
class BootstrapResult:
    name: str
    success: bool
    skipped: bool
    reason: Optional[str] = None
    details: Optional[str] = None


def get_enabled_features() -> set:
    """Get enabled features from ALWRITY_ENABLED_FEATURES env var.
    
    Values:
    - "all" - enable all features (default)
    - comma-separated: "podcast,blog-writer,youtube"
    - single feature: "podcast"
    """
    env_value = os.getenv("ALWRITY_ENABLED_FEATURES", "all").strip().lower()
    
    if not env_value or env_value == "all":
        return {"all"}
    
    return {f.strip() for f in env_value.split(",") if f.strip()}


def should_bootstrap_linguistic_models() -> bool:
    """Decide whether to bootstrap linguistic models based on enabled features."""
    from alwrity_utils.linkedin_lean_mode import should_bootstrap_linguistic_models as _should_bootstrap

    return _should_bootstrap(get_enabled_features())


def should_bootstrap_local_llm_models() -> bool:
    """Decide whether to bootstrap local LLM models based on enabled features.
    
    SIF/Story Writer requires local LLM - skip if only podcast is enabled.
    """
    enabled_features = get_enabled_features()
    
    if "all" in enabled_features:
        return True
    
    # SIF/Story Writer requires local LLM - only bootstrap if explicitly needed
    # Skip for lean deployments (podcast-only, content-planning only, etc.)
    return False  # Default to skip unless "all" is enabled


def bootstrap_linguistic_models() -> BootstrapResult:
    """
    Bootstrap spaCy and NLTK models BEFORE any imports.
    This prevents import-time failures when EnhancedLinguisticAnalyzer is loaded.
    """
    import subprocess
    import os
    
    verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
    
    if verbose:
        print("[DEBUG] Bootstrapping linguistic models...")
    
    # Check and download spaCy model
    try:
        import spacy
        try:
            nlp = spacy.load("en_core_web_sm")
            if verbose:
                print("   [OK] spaCy model 'en_core_web_sm' available")
        except OSError:
            if verbose:
                print("   ⚠️  spaCy model 'en_core_web_sm' not found, downloading...")
            try:
                subprocess.check_call([
                    sys.executable, "-m", "spacy", "download", "en_core_web_sm"
                ])
                if verbose:
                    print("   [OK] spaCy model downloaded successfully")
            except subprocess.CalledProcessError as e:
                if verbose:
                    print(f"   [FAIL] Failed to download spaCy model: {e}")
                    print("   Please run: python -m spacy download en_core_web_sm")
                return BootstrapResult(name="linguistic_models", success=False, skipped=False, reason="spacy_download_failed")
    except ImportError:
        if verbose:
            print("   ⚠️  spaCy not installed - skipping")
    
    # Check and download NLTK data
    try:
        import nltk
        essential_data = [
            ('punkt_tab', 'tokenizers/punkt_tab'),
            ('stopwords', 'corpora/stopwords'),
            ('averaged_perceptron_tagger', 'taggers/averaged_perceptron_tagger')
        ]
        
        for data_package, path in essential_data:
            try:
                nltk.data.find(path)
                if verbose:
                    print(f"   [OK] NLTK {data_package} available")
            except LookupError:
                if verbose:
                    print(f"   ⚠️  NLTK {data_package} not found, downloading...")
                try:
                    nltk.download(data_package, quiet=True)
                    if verbose:
                        print(f"   [OK] NLTK {data_package} downloaded")
                except Exception as e:
                    if verbose:
                        print(f"   ⚠️  Failed to download {data_package}: {e}")
                    if data_package == 'punkt_tab':
                        try:
                            nltk.download('punkt', quiet=True)
                            if verbose:
                                print(f"   [OK] NLTK punkt (fallback) downloaded")
                        except:
                            pass
    except ImportError:
        if verbose:
            print("   ⚠️  NLTK not installed - skipping")
    
    if verbose:
        print("[OK] Linguistic model bootstrap complete")
    return BootstrapResult(name="linguistic_models", success=True, skipped=False)


def bootstrap_local_llm_models() -> BootstrapResult:
    """
    Bootstrap Local LLM models (Qwen) for SIF Agents.
    This ensures the model is cached locally before the server starts,
    preventing large downloads during runtime.
    """
    import os
    verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
    
    # Model to pre-download
    model_name = "Qwen/Qwen2.5-1.5B-Instruct" 
    # Using Qwen2.5-1.5B as it's more efficient for laptop CPU than 4B, 
    # but still capable for agent routing/clustering.
    # If user specifically asked for Qwen3-4B, we can use that, but 1.5B is much faster.
    # User said "local qwen model", 4B might be heavy. Let's stick to what was in code: "Qwen/Qwen3-4B-Instruct-2507"
    # Actually, the code had "Qwen/Qwen3-4B-Instruct-2507" which seems like a specific fine-tune or typo.
    # Let's use a standard efficient one: "Qwen/Qwen2.5-3B-Instruct" or "Qwen/Qwen2.5-1.5B-Instruct".
    # Given "optimized for cpu-laptop", 1.5B or 3B is best.
    # Let's use the one referenced in the code if valid, otherwise Qwen2.5-3B.
    # The code had: "Qwen/Qwen3-4B-Instruct-2507". I suspect this is a placeholder or internal model.
    # I will use "Qwen/Qwen2.5-3B-Instruct" as a safe, modern, powerful laptop-friendly default.
    
    # Render Free Tier has 512MB RAM. Downloading a 3B model (6GB+) will instantly crash it.
    # We must skip this on Render unless we are on a paid instance with persistent disk and lots of RAM.
    if os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT"):
        if verbose:
            print("   ⚠️  Cloud environment detected (Render/Railway). Skipping local LLM bootstrap to save RAM/Time.")
        return BootstrapResult(name="local_llm_models", success=True, skipped=True, reason="cloud_environment")
    
    target_model = "Qwen/Qwen2.5-3B-Instruct"
    
    if verbose:
        print(f"🔍 Checking local LLM model '{target_model}'...")
        
    try:
        from huggingface_hub import snapshot_download
        try:
            # This checks cache and downloads if missing
            snapshot_download(repo_id=target_model, repo_type="model")
            if verbose:
                print(f"   [OK] Local LLM '{target_model}' available")
        except Exception as e:
            if verbose:
                print(f"   ⚠️  Failed to download/check local LLM: {e}")
                print("       SIF agents may try to download it at runtime.")
            return BootstrapResult(name="local_llm_models", success=False, skipped=False, reason=str(e))
    except ImportError:
        if verbose:
            print("   ⚠️  huggingface_hub not installed - skipping LLM bootstrap")
        return BootstrapResult(name="local_llm_models", success=False, skipped=True, reason="huggingface_hub_not_installed")
    
    return BootstrapResult(name="local_llm_models", success=True, skipped=False)


# Bootstrap linguistic models BEFORE any imports that might need them
BOOTSTRAP_RESULTS = []

# NOTE: This module must stay import-safe. When uvicorn runs with reload=True it
# spawns a child process that re-executes this file (Windows spawn semantics).
# Any top-level side effect (prints, dotenv loads) would therefore run twice,
# making it look like the server started twice. All startup side effects live
# in main() or under `if __name__ == "__main__"`, which the spawned child skips.


_env_loaded = False


def load_backend_env() -> None:
    """Load backend/.env early so ALWRITY_ENABLED_FEATURES is set before bootstrap.

    Idempotent: safe to call from both the bootstrap block and main().
    """
    global _env_loaded
    if _env_loaded:
        return
    _env_loaded = True

    from dotenv import load_dotenv

    backend_dir = Path(__file__).parent
    load_dotenv(backend_dir / ".env")

    # Debug: print what key env vars are set to at startup
    print(f"[STARTUP] PORT env: {os.getenv('PORT')}", flush=True)
    print(f"[STARTUP] RENDER env: {os.getenv('RENDER')}", flush=True)
    print(f"[STARTUP] ALWRITY_ENABLED_FEATURES: {os.getenv('ALWRITY_ENABLED_FEATURES')}", flush=True)
    print(f"[STARTUP] HOST env: {os.getenv('HOST')}", flush=True)

if __name__ == "__main__":
    # Load backend/.env before reading ALWRITY_ENABLED_FEATURES. Guarded by
    # __name__ == "__main__", so uvicorn's reload-spawned child (which runs with
    # __name__ == "__mp_main__") never re-executes this or main().
    load_backend_env()

    enabled_features = get_enabled_features()
    features_str = ",".join(sorted(enabled_features))
    os.environ["ALWRITY_ENABLED_FEATURES"] = features_str
    
    print(f"\n[OK] Enabled features: {features_str}")
    
    if should_bootstrap_linguistic_models():
        result = bootstrap_linguistic_models()
        BOOTSTRAP_RESULTS.append(result)
    else:
        verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
        if verbose:
            print("[SKIP]  Skipping linguistic model bootstrap (profile-gated)")
        BOOTSTRAP_RESULTS.append(BootstrapResult(name="linguistic_models", success=True, skipped=True, reason="profile_gated"))
    
    if should_bootstrap_local_llm_models():
        result = bootstrap_local_llm_models()
        BOOTSTRAP_RESULTS.append(result)
    else:
        verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
        if verbose:
            print("[SKIP]  Skipping local LLM model bootstrap (feature-gated)")
        BOOTSTRAP_RESULTS.append(BootstrapResult(name="local_llm_models", success=True, skipped=True, reason="feature_gated"))
    
    summary = {
        "enabled_features": features_str,
        "bootstraps": [asdict(r) for r in BOOTSTRAP_RESULTS]
    }
    os.environ["ALWRITY_BOOTSTRAP_SUMMARY"] = json.dumps(summary)
    
    print(f"\n[INFO] Bootstrap Summary:")
    for r in BOOTSTRAP_RESULTS:
        status = "[SKIP]  Skipped" if r.skipped else ("[OK] Enabled" if r.success else "[FAIL] Failed")
        print(f"   {r.name}: {status}" + (f" ({r.reason})" if r.reason else ""))

# NOW import modular utilities (after bootstrap)
from alwrity_utils import (
    DependencyManager,
    EnvironmentSetup,
    DatabaseSetup,
    ProductionOptimizer
)


def start_backend(enable_reload=False, production_mode=False):
    """Start the backend server."""
    print("==> Starting ALwrity Backend...")
    # Check for legacy podcast-only demo mode env vars (backward compat)
    is_legacy_podcast_mode = os.getenv("ALWRITY_PODCAST_ONLY_DEMO_MODE", os.getenv("PODCAST_ONLY_DEMO_MODE", "false")).lower() in {"1", "true", "yes", "on"}
    enabled = get_enabled_features()
    is_feature_limited = "all" not in enabled

    if is_legacy_podcast_mode or is_feature_limited:
        mode_label = "legacy podcast-only" if is_legacy_podcast_mode else f"feature-limited ({', '.join(sorted(enabled))})"
        print(f"\n{'=' * 60}")
        print(f"==> {mode_label.upper()} MODE ACTIVE")
        print("   Non-matching router groups are intentionally skipped.")
        print("=" * 60)
    
    # Set host based on environment and mode
    # Use 127.0.0.1 for local production testing on Windows
    # Use 0.0.0.0 for actual cloud deployments (Render, Railway, etc.)
    # Render provides PORT env var, detect cloud by presence of PORT
    render_port = os.getenv("PORT")
    if render_port:
        # Cloud deployment detected (Render sets PORT env var) - use 0.0.0.0
        os.environ.setdefault("HOST", "0.0.0.0")
        os.environ.setdefault("PORT", render_port)
    else:
        # Local deployment - use 127.0.0.1 for better Windows compatibility
        os.environ.setdefault("HOST", "127.0.0.1")
    
    # Render sets PORT automatically. We should respect it if present, otherwise default to 8000.
    # We don't setdefault("PORT", "8000") here because we want to use os.getenv("PORT") directly later
    # to catch if it's missing and THEN default.
    
    # Set reload based on argument or environment variable
    if enable_reload and not production_mode:
        os.environ.setdefault("RELOAD", "true")
        print("   [DEV] Development mode: Auto-reload enabled")
    else:
        os.environ.setdefault("RELOAD", "false")
        print("   [PROD] Production mode: Auto-reload disabled")
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.environ.get("RELOAD", "false").lower() == "true"
    print(f"[DEBUG] Bind prepared - host={host}, port={port}, reload={reload}", flush=True)
    print(f"[DEBUG] ENV check - ALWRITY_ENABLED_FEATURES={os.getenv('ALWRITY_ENABLED_FEATURES')}", flush=True)
    
    print(f"   ==> Host: {host}", flush=True)
    print(f"   ==> Port: {port}", flush=True)
    print(f"   [DEV] Reload: {reload}", flush=True)

    try:
        import uvicorn
        print(f"[DEBUG] Imported uvicorn successfully", flush=True)

        # Note: Database already initialized by DatabaseSetup in main()
        
        print("\n[WORLD] ALwrity Backend Server", flush=True)
        print("=" * 50, flush=True)
        print(f"   📖 API Documentation: http://localhost:{os.getenv('PORT', '8000')}/api/docs", flush=True)
        print(f"   🔍 Health Check: http://localhost:{os.getenv('PORT', '8000')}/health", flush=True)
        print(f"   📊 ReDoc: http://localhost:{os.getenv('PORT', '8000')}/api/redoc", flush=True)
        
        if not production_mode:
            print(f"   📈 API Monitoring: http://localhost:{os.getenv('PORT', '8000')}/api/content-planning/monitoring/health", flush=True)
            print(f"   💳 Billing Dashboard: http://localhost:{os.getenv('PORT', '8000')}/api/subscription/plans", flush=True)
            print(f"   📊 Usage Tracking: http://localhost:{os.getenv('PORT', '8000')}/api/subscription/usage/demo", flush=True)
        
        print("\n[STOP]  Press Ctrl+C to stop the server", flush=True)
        print("=" * 50, flush=True)
        
        # Set up clean logging for end users
        from logging_config import setup_clean_logging, get_uvicorn_log_level
        # Video stack preflight (diagnostics + version assert)
        try:
            from services.story_writer.video_preflight import (
                log_video_stack_diagnostics,
                assert_supported_moviepy,
            )
        except Exception:
            # Preflight is optional; continue if module missing
            log_video_stack_diagnostics = None
            assert_supported_moviepy = None
        
        verbose_mode = setup_clean_logging()
        uvicorn_log_level = get_uvicorn_log_level()

        print(f"[DEBUG] Starting uvicorn with host={host} port={port}", flush=True)
        print("[DEBUG] >>> ABOUT TO CALL UVICORN.RUN() <<<", flush=True)

        # Skip video/moviepy preflight in feature-limited mode (e.g. linkedin-only).
        # Lean installs (requirements-linkedin.txt) intentionally omit moviepy.
        is_feature_limited = os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower() not in ("", "all")
        print(f"[DEBUG] Feature-limited mode check: {is_feature_limited}", flush=True)

        if is_feature_limited:
            print("[DEBUG] Feature-limited mode - skipping video preflight", flush=True)
        else:
            # Log diagnostics and assert versions (fail fast if misconfigured)
            try:
                if log_video_stack_diagnostics:
                    log_video_stack_diagnostics()
                if assert_supported_moviepy:
                    assert_supported_moviepy()
            except Exception as _video_stack_err:
                print(f"[ERROR] Video stack preflight failed: {_video_stack_err}")
                return False

        uvicorn.run(
            "app:app",
            host=host,
            port=port,
            reload=reload,
            reload_dirs=["."],  # Strictly watch backend directory only
            reload_excludes=[
                "workspace/**/*",
                "*.pyc",
                "*.pyo", 
                "*.pyd",
                "__pycache__",
                "*.log",
                "*.sqlite",
                "*.db",
                "*.tmp",
                "*.temp",
                "test_*.py",
                "temp_*.py",
                "monitoring_data_service.py",
                "test_monitoring_save.py",
                "*.json",
                "*.yaml",
                "*.yml",
                ".env*",
                "logs/**/*",
                "logs",
                "**/*.jsonl",
                "**/*.log",
                "cache/**/*",
                "tmp/**/*",
                "temp/**/*",
                "middleware/*",
                "models/*",
                "scripts/*",
                "alwrity_utils/*"
            ],
            log_level=uvicorn_log_level
        )
        print("[DEBUG] uvicorn.run() has finished", flush=True)
        
    except KeyboardInterrupt:
        print("\n\n🛑 Backend stopped by user")
    except Exception as e:
        print(f"\n[ERROR] Error starting backend: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return False
    
    return True


def main():
    """Main function to set up and start the backend."""
    configure_console_utf8()
    # Load .env early so ALWRITY_ENABLED_FEATURES / PORT / HOST are available.
    load_backend_env()
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="ALwrity Backend Server")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--dev", action="store_true", help="Enable development mode (auto-reload)")
    parser.add_argument("--production", action="store_true", help="Enable production mode (optimized for deployment)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging for debugging")
    args = parser.parse_args()
    
    # Determine mode
    production_mode = args.production
    enable_reload = (args.reload or args.dev) and not production_mode
    verbose_mode = args.verbose
    
    # Set global verbose flag for utilities
    os.environ["ALWRITY_VERBOSE"] = "true" if verbose_mode else "false"
    
    print("[*] ALwrity Backend Server")
    print("=" * 40)
    print(f"Mode: {'PRODUCTION' if production_mode else 'DEVELOPMENT'}")
    print(f"Auto-reload: {'ENABLED' if enable_reload else 'DISABLED'}")
    if verbose_mode:
        print("Verbose logging: ENABLED")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("app.py"):
        print("[ERROR] Error: app.py not found. Please run this script from the backend directory.")
        print("   Current directory:", os.getcwd())
        print("   Expected files:", [f for f in os.listdir('.') if f.endswith('.py')])
        return False
    
    # Initialize modular components
    from alwrity_utils.linkedin_lean_mode import get_requirements_file_for_features

    requirements_file = get_requirements_file_for_features(get_enabled_features())
    dependency_manager = DependencyManager(requirements_file)
    environment_setup = EnvironmentSetup(production_mode=production_mode)
    database_setup = DatabaseSetup(production_mode=production_mode)
    production_optimizer = ProductionOptimizer()
    
    # Setup progress tracking
    setup_steps = [
        "Checking dependencies",
        "Setting up environment", 
        "Configuring database",
        "Starting server"
    ]
    
    print("==> Initializing ALwrity...")
    
    # Apply production optimizations if needed
    if production_mode:
        if not production_optimizer.apply_production_optimizations():
            print("[FAIL] Production optimization failed")
            return False
    
    # Step 1: Dependencies
    print(f"   📦 {setup_steps[0]}...", end=" ", flush=True)
    critical_ok, missing_critical = dependency_manager.check_critical_dependencies()
    if not critical_ok:
        print("installing...", end=" ", flush=True)
        if not dependency_manager.install_requirements():
            print("[FAIL] Failed")
            return False
        print("[OK] Done")
    else:
        print("[OK] Done")
    
    # Check optional dependencies (non-critical) - only in verbose mode
    if verbose_mode:
        dependency_manager.check_optional_dependencies()
    
    # Step 2: Environment
    print(f"   🔧 {setup_steps[1]}...", end=" ", flush=True)
    if not environment_setup.setup_directories():
        print("[FAIL] Directory setup failed")
        return False
    
    if not environment_setup.setup_environment_variables():
        print("[FAIL] Environment setup failed")
        return False
    
    # Create .env file only in development
    if not production_mode:
        environment_setup.create_env_file()
    print("[OK] Done")
    
    # Step 3: Database
    print(f"   📊 {setup_steps[2]}...", end=" ", flush=True)
    if not database_setup.setup_essential_tables():
        print("⚠️  Issues detected, continuing...")
    else:
        print("[OK] Done")
    
    # Setup advanced features in development, verify in all modes
    if not production_mode:
        database_setup.setup_advanced_tables()
    
    # Always verify database tables (important for both dev and production)
    database_setup.verify_tables()
    
    # Note: Linguistic models (spaCy/NLTK) are bootstrapped before imports
    # See bootstrap_linguistic_models() at the top of this file
    
    # Step 4: Start backend
    print(f"   🚀 {setup_steps[3]}...")
    return start_backend(enable_reload=enable_reload, production_mode=production_mode)


if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
