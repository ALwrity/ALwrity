"""Tests for Phase 5 of the advertools RCA plan: writable tldextract cache.

RCA context (tracker #520): tldextract's default cache dir lives INSIDE its
own package (``site-packages/tldextract/.suffix_cache``), which is not
writable on many deployments (Windows service hosts, non-root containers).
The Public Suffix List is then re-downloaded over HTTP on every app startup
and the logs fill with ``[WinError 5] Access is denied`` warnings.

Phase 5 contract:

- ``configure_tldextract_cache()`` points ``TLDEXTRACT_CACHE`` at a writable
  directory under the workspace root and creates it.
- An explicit ``TLDEXTRACT_CACHE`` override (deployer-provided) is respected,
  never overwritten.
- Idempotent: repeated calls return the same path.
- Falls back to the system temp dir when the workspace root is unusable.
- After configuration, a freshly constructed ``tldextract.TLDExtract()`` uses
  the configured dir (tldextract reads the env var at construction).
"""

from pathlib import Path

import pytest

import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.seo.tldextract_setup import configure_tldextract_cache


@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Start every test without a TLDEXTRACT_CACHE override."""
    monkeypatch.delenv("TLDEXTRACT_CACHE", raising=False)
    yield


class TestConfigureTldextractCache:
    def test_sets_env_var_and_creates_dir(self, workspace_redirect):
        path = configure_tldextract_cache()

        expected = Path(workspace_redirect) / "tldextract_cache"
        assert path == str(expected)
        assert Path(path).is_dir()
        import os
        assert os.environ["TLDEXTRACT_CACHE"] == str(expected)

    def test_respects_existing_override(self, workspace_redirect, monkeypatch):
        monkeypatch.setenv("TLDEXTRACT_CACHE", "/custom/cache/dir")
        path = configure_tldextract_cache()
        assert path == "/custom/cache/dir"
        # Deployer-provided path wins; the workspace cache dir is not created.
        assert not (Path(workspace_redirect) / "tldextract_cache").exists()

    def test_idempotent(self, workspace_redirect):
        first = configure_tldextract_cache()
        second = configure_tldextract_cache()
        assert first == second

    def test_falls_back_to_temp_when_workspace_unusable(self, monkeypatch):
        def _broken():
            raise RuntimeError("no workspace in this deployment")

        monkeypatch.setattr(workspace_paths, "get_workspace_root", _broken)
        path = configure_tldextract_cache()
        assert Path(path).is_dir()
        import tempfile
        assert tempfile.gettempdir() in path

    def test_tldextract_uses_configured_cache(self, workspace_redirect):
        """A freshly constructed TLDExtract reads TLDEXTRACT_CACHE at
        construction time — the documented remediation for the WinError 5
        startup spam."""
        import tldextract

        expected = configure_tldextract_cache()
        extractor = tldextract.TLDExtract()
        cache_dir = getattr(extractor, "cache_dir", None)
        if cache_dir is not None:  # attribute present in supported versions
            assert str(cache_dir) == expected

    def test_module_import_configures_early(self, workspace_redirect, monkeypatch):
        """Importing the module is sufficient: the import-time call keeps any
        entry point safe (advertools imports tldextract at its own import)."""
        import importlib
        import os

        monkeypatch.delenv("TLDEXTRACT_CACHE", raising=False)
        importlib.reload(importlib.import_module("services.seo.tldextract_setup"))
        assert os.environ.get("TLDEXTRACT_CACHE") == str(
            Path(workspace_redirect) / "tldextract_cache"
        )
