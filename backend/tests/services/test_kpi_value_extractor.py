"""Phase 6a: KPI value extractor tests (red->green)."""
from types import SimpleNamespace

from services.kpi_value_extractor import (
    extract_kpi_last_values,
    extract_metric_value,
    is_extractable,
    normalize_kpi_metric,
)


def test_extracts_gsc_ctr():
    result = {"performance_overview": {"overall_ctr": 3.41, "total_impressions": 500}}
    assert extract_metric_value(result, "gsc.ctr") == 3.41


def test_extracts_sitemap_total_urls():
    assert extract_metric_value({"total_urls": 42}, "sitemap.total_urls") == 42.0


def test_extracts_pagespeed_nested_score():
    result = {"category_scores": {"performance": {"score": 0.87}}}
    assert extract_metric_value(result, "pagespeed.performance_score") == 0.87


def test_unknown_or_unmapped_metric_returns_none():
    assert extract_metric_value({"total_urls": 1}, "serp.share_of_voice") is None
    assert extract_metric_value({"x": 1}, "gsc.ctr") is None


def test_missing_key_and_non_numeric_return_none():
    assert extract_metric_value({"performance_overview": {}}, "gsc.ctr") is None
    assert extract_metric_value(
        {"performance_overview": {"overall_ctr": "n/a"}}, "gsc.ctr") is None


def test_non_dict_payload_returns_none():
    assert extract_metric_value(["not", "a", "dict"], "gsc.ctr") is None
    assert extract_metric_value(None, "gsc.ctr") is None


def test_is_extractable_flags_registered_only():
    assert is_extractable("gsc.ctr") is True
    assert is_extractable("serp.share_of_voice") is False


def test_normalize_kpi_metric_resolves_suffix():
    assert normalize_kpi_metric("visibility_score") == "gsc.visibility_score"
    assert normalize_kpi_metric("ctr") == "gsc.ctr"
    assert normalize_kpi_metric("") is None
    assert normalize_kpi_metric("no_such_metric_xyz") is None


def test_extract_kpi_last_values_from_success_only():
    success = SimpleNamespace(
        status="success",
        result_data={"metric": "gsc.ctr",
                     "tool_result": {"performance_overview": {"overall_ctr": 2.5}}},
    )
    failed = SimpleNamespace(
        status="failed",
        result_data={"metric": "gsc.ctr",
                     "tool_result": {"performance_overview": {"overall_ctr": 9.9}}},
    )
    no_tool = SimpleNamespace(status="success", result_data={"metric": "sitemap.total_urls"})
    out = extract_kpi_last_values({1: success, 2: failed, 3: no_tool})
    assert out == {"gsc.ctr": 2.5}


def test_extract_kpi_last_values_empty_when_none():
    assert extract_kpi_last_values({}) == {}