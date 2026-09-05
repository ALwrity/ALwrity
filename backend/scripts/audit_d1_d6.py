"""Deep-dive audit for D1-D6 recommendations.

Checks the actual scheduler execution model, SQLite configuration,
ThreadPoolExecutor contention, embedding model lifecycle, and dashboard
polling patterns to validate or refute each recommendation.
"""
import ast
import re

def scan(pattern, files, label):
    print(f"\n=== {label} ===")
    for f in files:
        src = open(f, encoding='utf-8', errors='ignore').read()
        for m in re.finditer(pattern, src):
            line_no = src[:m.start()].count('\n') + 1
            line = src[src.rfind('\n', 0, m.start())+1:m.start()+120].strip()
            print(f"  {f.split(chr(92))[-1]}:{line_no}: {line[:120]}")

scheduler_files = [
    'services/scheduler/__init__.py',
    'services/scheduler/core/scheduler.py',
    'services/scheduler/core/check_cycle_handler.py',
]

# D1: How does max_concurrent_executions actually work?
scan(r'max_concurrent|semaphore|Semaphore|_active_count|slot', scheduler_files, 'D1: Concurrency mechanism')

# D2: SQLite WAL mode, connection pooling
scan(r'WAL|journal_mode|pool_size|max_overflow|NullPool|StaticPool|create_engine',
     ['services/database.py', 'app.py'], 'D2: SQLite/Connection config')

# D2b: How many sessions does a scheduler executor open?
scan(r'get_session_for_user', 
     ['services/scheduler/core/check_cycle_handler.py',
      'services/scheduler/executors/sif_indexing_executor.py',
      'services/scheduler/executors/deep_competitor_analysis_executor.py'],
     'D2b: Executor DB sessions')

# D3: When are next_execution timestamps set?
scan(r'next_execution.*=|next_execution.*now',
     ['api/onboarding_utils/onboarding_task_scheduler.py'], 'D3: Task scheduling timestamps')

# D5: Where is the embedding model loaded?
scan(r'Embeddings\(|model_path|all-MiniLM|_initialize_embeddings',
     ['services/intelligence/txtai_service.py'], 'D5: Embedding model lifecycle')

# D4: Where does self-heal block?
scan(r'maybe_self_heal|_maybe_self_heal',
     ['services/intelligence/agents/core_agent_framework.py'], 'D4: Self-heal blocking')

# Executor durations - check for timeout/cancellation
scan(r'timeout|cancel|kill|terminate|max_runtime',
     ['services/scheduler/core/scheduler.py'], 'Scheduler: timeout/cancellation')

# ThreadPoolExecutor contention
scan(r'ThreadPoolExecutor|max_workers',
     ['services/intelligence/agents/core_agent_framework.py',
      'services/intelligence/agents/strategy_orchestrator_agent.py'],
     'ThreadPoolExecutor contention')
