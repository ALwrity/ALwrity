"""
CLI entrypoint: ingest-if-needed, load index, start FastAPI server.

Usage::

    python -m doc_rag --host 127.0.0.1 --port 8001
    python -m doc_rag --force-reingest --verbose
    python -m doc_rag --debug

Logging:
    --verbose   INFO execution trace with [module.function] tags
    --debug     DEBUG detail (implies verbose)
    DOC_RAG_VERBOSE=1 / DOC_RAG_DEBUG=1 env vars also supported

Job queue (requires Redis)::

    # Terminal 1: API
    python -m doc_rag --host 127.0.0.1 --port 8001

    # Terminal 2: ingest worker
    python -m doc_rag.worker ingest

    # Terminal 3: RAG worker
    python -m doc_rag.worker rag

    # Enqueue ingest: POST /jobs/ingest or POST /ingest
    # Enqueue RAG:    POST /jobs/rag
    # Poll status:    GET /jobs/{job_id}
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import uvicorn

# Ensure backend/ is on sys.path when run as `python -m doc_rag`
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from doc_rag.api import create_app
from doc_rag.config import DocRagConfig
from doc_rag.ingest import run_ingest
from doc_rag.index_manager import IndexManager
from doc_rag.logging_utils import FnLogger

log = FnLogger("__main__")


def parse_args() -> argparse.Namespace:
    """Parse CLI flags for host, port, ingest behaviour, and logging verbosity."""
    parser = argparse.ArgumentParser(description="ALwrity Doc RAG service")
    parser.add_argument("--host", default=None, help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=None, help="Bind port (default: 8001)")
    parser.add_argument(
        "--docs-path",
        default=None,
        help="Path to docs directory (default: repo docs/)",
    )
    parser.add_argument(
        "--force-reingest",
        action="store_true",
        help="Rebuild index even if manifest exists",
    )
    parser.add_argument(
        "--skip-ingest",
        action="store_true",
        help="Skip ingest even if index is missing (fail if no index)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable execution-trace logging ([module.function] tags)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging (implies --verbose)",
    )
    return parser.parse_args()


def main() -> None:
    """
    Startup sequence:
      1. Load config and configure logging
      2. Ingest if no index (or if --force-reingest)
      3. Load hybrid index into memory
      4. Start FastAPI via uvicorn
    """
    args = parse_args()
    overrides: dict = {
        "verbose": args.verbose,
        "debug": args.debug,
    }
    if args.docs_path:
        overrides["docs_path"] = Path(args.docs_path).resolve()
    if args.host:
        overrides["host"] = args.host
    if args.port:
        overrides["port"] = args.port

    config = DocRagConfig.from_env(**overrides)
    manager = IndexManager(config)

    log.trace("main", "Startup args force_reingest={} skip_ingest={}", args.force_reingest, args.skip_ingest)

    if args.force_reingest:
        log.info("main", "Force re-ingest requested")
        manager.release()
        run_ingest(config, force=True, manager=manager)
    elif not manager.index_exists():
        if args.skip_ingest:
            log.error("main", "No index found and --skip-ingest was set")
            sys.exit(1)
        log.info("main", "No index found — starting initial ingest")
        run_ingest(config, force=False, manager=manager)
    else:
        log.info("main", "Existing index found — skipping ingest")

    log.trace("main", "Loading index into memory")
    embeddings = manager.load()
    app = create_app(config, embeddings)

    log.info("main", "Starting Doc RAG API on {}:{}", config.host, config.port)
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level="debug" if config.debug else "info",
    )


if __name__ == "__main__":
    main()
