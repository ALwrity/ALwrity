"""Tests for the shared robust LLM JSON parser."""

import json

import pytest

from services.llm_providers.json_parsing import robust_json_parse, robust_json_loads


class TestRobustJsonParse:
    def test_clean_json(self):
        assert robust_json_parse('{"a": 1, "b": "hello"}') == {"a": 1, "b": "hello"}

    def test_nested_json(self):
        raw = '{"identity": {"persona_name": "The Operator", "traits": [1, 2]}, "confidence": 0.8}'
        parsed = robust_json_parse(raw)
        assert parsed is not None
        assert parsed["identity"]["persona_name"] == "The Operator"

    def test_markdown_fenced_json(self):
        assert robust_json_parse('```json\n{"a": 1}\n```') == {"a": 1}

    def test_single_quote_escaped_apostrophe(self):
        # LLMs sometimes emit \\' (Python-style) inside JSON strings, which is
        # invalid JSON. This was the exact failure mode for Facebook personas.
        raw = '{"engagement": ["Ask about marketers\\\' biggest bottlenecks."]}'
        parsed = robust_json_parse(raw)
        assert parsed is not None
        assert "marketers' biggest" in parsed["engagement"][0]

    def test_python_dict_syntax_single_quotes(self):
        assert robust_json_parse("{'a': 'value', 'b': [1, 2, 3]}") == {"a": "value", "b": [1, 2, 3]}

    def test_json_with_true_false_null(self):
        assert robust_json_parse('{"a": true, "b": false, "c": null}') == {"a": True, "b": False, "c": None}

    def test_surrounding_text_extraction(self):
        assert robust_json_parse('Here is the result:\n{"a": 1}\nHope this helps.') == {"a": 1}

    def test_empty_or_garbage_returns_none(self):
        assert robust_json_parse("") is None
        assert robust_json_parse("not json at all") is None

    def test_top_level_array_parses_to_list(self):
        # Drop-in for json.loads: top-level arrays are preserved (not coerced
        # to None), matching the pre-refactor json.loads behaviour.
        assert robust_json_parse('["a", "b"]') == ["a", "b"]


class TestRobustJsonLoads:
    def test_parses_valid_json(self):
        assert robust_json_loads('{"a": 1}') == {"a": 1}

    def test_tolerates_apostrophe_escape(self):
        raw = '{"x": "don\\\'t"}'
        assert robust_json_loads(raw) == {"x": "don't"}

    def test_raises_on_garbage(self):
        with pytest.raises(json.JSONDecodeError):
            robust_json_loads("not json at all")

    def test_parses_top_level_array(self):
        # Drop-in for json.loads: top-level arrays parse to a list.
        assert robust_json_loads('["a", "b"]') == ["a", "b"]

    def test_parses_scalar(self):
        # Drop-in for json.loads: scalars parse to their Python value.
        assert robust_json_loads("42") == 42
        assert robust_json_loads('"hello"') == "hello"
