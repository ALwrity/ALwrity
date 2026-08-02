"""Guardrail: startup-loaded modules must not write filesystem at import time."""

from __future__ import annotations

import ast
from pathlib import Path


STARTUP_MODULES = [
    "app.py",
    "alwrity_utils/router_manager.py",
    "routers/seo_tools.py",
    "middleware/logging_middleware.py",
    "api/youtube/router.py",
    "api/youtube/handlers/avatar.py",
    "api/youtube/handlers/images.py",
    "api/youtube/handlers/audio.py",
    "utils/media_utils.py",
]


def _is_forbidden_call(node: ast.Call) -> bool:
    func = node.func
    if isinstance(func, ast.Attribute):
        if isinstance(func.value, ast.Name) and func.value.id == "os" and func.attr == "makedirs":
            return True
        if func.attr == "mkdir":
            return True
    return False


def _top_level_forbidden_calls(tree: ast.AST) -> list[tuple[int, str]]:
    """Return forbidden calls that execute during module import.

    We intentionally do not flag calls inside function/class bodies, because those
    are runtime operations and safe for this policy.
    """
    violations: list[tuple[int, str]] = []

    for statement in getattr(tree, "body", []):
        # Skip function/class definitions: their bodies are not executed at import time.
        if isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue

        nodes_to_visit = [statement]
        while nodes_to_visit:
            node = nodes_to_visit.pop()

            # Do not descend into nested function/class definitions.
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue

            if isinstance(node, ast.Call) and _is_forbidden_call(node):
                violations.append((node.lineno, ast.unparse(node.func)))

            nodes_to_visit.extend(ast.iter_child_nodes(node))

    return violations


def test_no_import_time_mkdir_calls_in_startup_modules() -> None:
    all_violations: list[str] = []

    for rel in STARTUP_MODULES:
        module_file = Path(rel)
        source = module_file.read_text(encoding="utf-8")
        tree = ast.parse(source)
        violations = _top_level_forbidden_calls(tree)
        for line, call in violations:
            all_violations.append(f"{rel}:{line} -> {call}")

    assert not all_violations, "Top-level filesystem writes found:\n" + "\n".join(all_violations)
