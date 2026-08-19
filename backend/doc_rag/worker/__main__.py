"""
Start standalone ARQ workers for doc_rag.

Usage::

    python -m doc_rag.worker ingest
    python -m doc_rag.worker rag
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from arq.worker import Worker

_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from doc_rag.config import DocRagConfig
from doc_rag.logging_utils import FnLogger
from doc_rag.queue.worker_settings import worker_settings_for

log = FnLogger("worker")


def main() -> None:
    parser = argparse.ArgumentParser(description="Doc RAG ARQ worker")
    parser.add_argument(
        "mode",
        choices=["ingest", "rag"],
        help="Worker type: ingest (index build) or rag (LLM generation)",
    )
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    DocRagConfig.from_env(verbose=args.verbose, debug=args.debug)
    settings_cls = worker_settings_for(args.mode)
    log.info("main", "Starting {} worker max_jobs={}", args.mode, settings_cls.max_jobs)

    worker = Worker(
        functions=settings_cls.functions,
        redis_settings=settings_cls.redis_settings,
        max_jobs=settings_cls.max_jobs,
        job_timeout=settings_cls.job_timeout,
        queue_name=settings_cls.queue_name,
    )
    worker.run()


if __name__ == "__main__":
    main()
