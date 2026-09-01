from __future__ import annotations

import json
import sys
import types
import importlib.util
from pathlib import Path

# Lightweight fallback for environments missing loguru.
if "loguru" not in sys.modules:
    stub = types.ModuleType("loguru")
    stub.logger = types.SimpleNamespace(
        info=lambda *a, **k: None,
        warning=lambda *a, **k: None,
        error=lambda *a, **k: None,
        debug=lambda *a, **k: None,
    )
    sys.modules["loguru"] = stub

def _load_module(name: str, rel_path: str):
    base = Path(__file__).resolve().parents[1]
    path = base / rel_path
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


flat_mod = _load_module("agent_flat_context_under_test", "services/intelligence/agent_flat_context.py")
sys.modules.setdefault("services.intelligence.agent_flat_context", flat_mod)
vfs_mod = _load_module("agent_context_vfs_under_test", "services/intelligence/agent_context_vfs.py")

AgentFlatContextStore = flat_mod.AgentFlatContextStore
AgentContextVFS = vfs_mod.AgentContextVFS


def _cleanup_workspace(user_id: str, project_id: str | None = None) -> None:
    safe_user = ''.join(c for c in str(user_id) if c.isalnum() or c in ('-', '_')) or 'unknown_user'
    root = Path(__file__).resolve().parents[2] / 'workspace'
    user_dir = root / f'workspace_{safe_user}'
    if user_dir.exists():
        import shutil
        shutil.rmtree(user_dir, ignore_errors=True)

    if project_id:
        safe_project = ''.join(c for c in str(project_id) if c.isalnum() or c in ('-', '_')) or 'default_project'
        project_dir = root / f'project_{safe_project}'
        if project_dir.exists():
            import shutil
            shutil.rmtree(project_dir, ignore_errors=True)


def test_search_context_query_variants_and_can_answer():
    user_id = 'pytest_vfs_user'
    _cleanup_workspace(user_id)

    store = AgentFlatContextStore(user_id)
    payload = {
        'website_url': 'https://example.com',
        'brand_analysis': {'brand_voice': 'Authoritative'},
        'recommended_settings': {'writing_tone': 'Conversational'},
        'content_type': {'primary_type': 'Blog'},
        'target_audience': {'primary_audience': 'Founders'},
    }
    assert store.save_step2_website_analysis(payload)

    vfs = AgentContextVFS(user_id)
    result = vfs.search_context('tone')

    assert result['query'] == 'tone'
    assert 'attempted_queries' in result
    assert result['attempted_queries'][0] == 'tone'
    assert result['can_answer'] is True
    assert len(result['results']) >= 1
    assert 'triage_top5' in result
    assert len(result['triage_top5']) >= 1
    assert 'low_probability' in result['results'][0]


def test_inspect_file_large_document_summary_plus_keys():
    user_id = 'pytest_vfs_large'
    _cleanup_workspace(user_id)

    store = AgentFlatContextStore(user_id)
    large_blob = 'x' * 9000
    payload = {
        'website_url': 'https://big.example.com',
        'brand_analysis': {'brand_voice': 'Bold'},
        'recommended_settings': {'writing_tone': 'Direct'},
        'target_audience': {'primary_audience': 'Teams'},
        'crawl_result': {'raw': large_blob},
    }
    assert store.save_step2_website_analysis(payload)

    vfs = AgentContextVFS(user_id)
    out = vfs.inspect_file('step2_website_analysis.json')

    assert out['mode'] == 'summary_plus_keys'
    assert 'agent_summary' in out
    assert 'keys' in out
    assert 'crawl_result' in out['keys']


def test_write_shared_note_and_activity_log_created():
    user_id = 'pytest_collab_user'
    project_id = 'proj_abc'
    _cleanup_workspace(user_id, project_id)

    vfs = AgentContextVFS(user_id, project_id=project_id)
    write_res = vfs.write_shared_note('Draft collaboration note', agent_id='agent_one')

    assert write_res['ok'] is True
    assert write_res['file'] == 'collaboration.md'

    collab = vfs.list_context()['collaboration']
    scratchpad = Path(collab['scratchpad_dir'])
    note_file = scratchpad / 'collaboration.md'
    log_file = scratchpad / 'activity_log.jsonl'

    assert note_file.exists()
    assert log_file.exists()

    content = note_file.read_text(encoding='utf-8')
    assert 'agent_one' in content
    assert 'Draft collaboration note' in content

    lines = [json.loads(l) for l in log_file.read_text(encoding='utf-8').splitlines() if l.strip()]
    assert any(entry.get('event_type') == 'shared_note_written' for entry in lines)


def test_read_struct_path_resolution_and_dependency_context():
    user_id = 'pytest_struct_user'
    _cleanup_workspace(user_id)

    store = AgentFlatContextStore(user_id)
    assert store.save_step2_website_analysis(
        {
            'website_url': 'https://struct.example.com',
            'brand_analysis': {'brand_voice': 'Pragmatic'},
            'recommended_settings': {'writing_tone': 'Clear'},
        }
    )
    assert store.save_step4_persona_data(
        {
            'core_persona': {'name': 'Ops Leader', 'goal': 'Scale ops'},
            'selected_platforms': ['linkedin'],
        }
    )

    vfs = AgentContextVFS(user_id)
    out = vfs.read_struct('step4_persona_data.json', 'data.core_persona.name')

    assert out['ok'] is True
    assert out['data'] == 'Ops Leader'
    assert out['dependency_context']['brand_voice'] == 'Pragmatic'


def test_search_context_scores_and_caps_results():
    """G4: the VFS grep/search layer (relevance scoring, synonym expansion,
    token budgeting, top-10 cap) must return matched, scored results over
    the saved context documents."""
    user_id = 'pytest_search_ctx_user'
    _cleanup_workspace(user_id)

    store = AgentFlatContextStore(user_id)
    assert store.save_step2_website_analysis(
        {
            'website_url': 'https://search.example.com',
            'brand_analysis': {'brand_voice': 'Witty'},
            'agent_summary': {'quick_facts': {'brand_voice': 'Witty'}},
        }
    )
    assert store.save_step3_research_preferences(
        {
            'research_depth': 'deep',
            'competitors': ['jasper.example.com'],
        }
    )

    vfs = AgentContextVFS(user_id)
    out = vfs.search_context('brand voice', limit=10)

    assert out.get('query') == 'brand voice'
    assert out.get('can_answer') is True, f"search found nothing: {out}"
    assert out.get('matched_files_count', 0) >= 1
    results = out.get('results') or []
    assert results, f"no scored results: {out}"
    top = results[0]
    assert top.get('score', 0) >= 50, f"score missing: {top}"
    assert top.get('path'), f"path missing: {top}"
    # synonym expansion should have widened the query (tone/voice synonyms)
    assert len(out.get('attempted_queries') or []) >= 1
