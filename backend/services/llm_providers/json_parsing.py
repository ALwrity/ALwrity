"""Robust JSON parsing for LLM structured output.

LLMs (especially routed models) sometimes emit slightly-off JSON:

  - markdown code fences
  - Python-style escapes (e.g. ``\'``) that are invalid JSON
  - Python dict syntax (single-quoted keys/values, ``None``/``True``/``False``)

This module is the single source of truth for parsing structured LLM
responses so every provider's structured-response path tolerates the same
quirks consistently, without changing what ``json.loads`` would return.
"""

import ast
import json
import re
from typing import Any, Optional


def robust_json_loads(content: str) -> Any:
    """Drop-in replacement for ``json.loads`` that tolerates common LLM quirks.

    Returns the parsed value (dict, list, or scalar) exactly as ``json.loads``
    would, but also accepts markdown fences, Python-style ``\'`` escapes, and
    Python literal syntax (single quotes, ``None``/``True``/``False``).

    Raises ``json.JSONDecodeError`` if nothing could be parsed.
    """
    if not content:
        raise json.JSONDecodeError("Invalid JSON", "", 0)

    content = content.strip()

    # Strip markdown code fences
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    # LLMs sometimes emit Python-style ``\'`` inside JSON strings, which is
    # invalid JSON (only ``\"`` is a legal escape). Normalize it before
    # json.loads so an otherwise-valid document with a stray ``\'`` parses.
    content = content.replace("\\'", "'")

    # 1. Standard JSON
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        pass

    # 2. Python literal syntax (single quotes, Python booleans/None)
    try:
        return ast.literal_eval(content)
    except (ValueError, SyntaxError, TypeError):
        pass

    # 3. Extract the first {...} object and retry both parsers
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if match:
        extracted = match.group(0)
        try:
            return json.loads(extracted)
        except (json.JSONDecodeError, TypeError):
            pass
        try:
            return ast.literal_eval(extracted)
        except (ValueError, SyntaxError, TypeError):
            pass

    raise json.JSONDecodeError("Invalid JSON", content, 0)


def robust_json_parse(content: str) -> Optional[Any]:
    """Parse an LLM JSON string, tolerating common model quirks.

    Returns the parsed value (dict, list, or scalar), or ``None`` if nothing
    could be parsed.

    Note: a JSON ``null`` input parses to Python ``None`` and is therefore
    indistinguishable from "unparseable". Structured responses are never
    ``null``, so this is a non-issue in practice.
    """
    try:
        return robust_json_loads(content)
    except (json.JSONDecodeError, ValueError, TypeError):
        return None
