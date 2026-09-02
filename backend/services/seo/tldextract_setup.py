"""Point tldextract's Public Suffix List cache at a writable directory.

RCA context (tracker #520, Phase 5 — env hygiene): tldextract's default
cache dir lives INSIDE its own package (``site-packages/tldextract/.suffix_cache``),
which is not writable on many deployments (Windows service hosts, non-root
containers). The Public Suffix List is then re-downloaded over HTTP on every
app startup and the logs fill with::

    [tldextract.cache] WARNING: unable to cache publicsuffix.org-tlds ...
    [WinError 5] Access is denied: '...site-packages/tldextract/.suffix_cache'

tldextract reads the ``TLDEXTRACT_CACHE`` environment variable when a
``TLDExtract`` instance is constructed, so setting it before the first
``import advertools`` / ``import tldextract`` (advertools uses tldextract
internally) routes the cache to a writable, workspace-scoped directory.

Multi-tenancy: the cache holds only the PUBLIC suffix list — no user data —
so one shared directory per deployment is correct and safe.
"""

import os
from pathlib import Path


def configure_tldextract_cache() -> str:
    """Set ``TLDEXTRACT_CACHE`` to a writable dir; idempotent.

    Returns the configured path. An explicit ``TLDEXTRACT_CACHE`` set by the
    deployer is respected and never overwritten.
    """
    existing = os.environ.get("TLDEXTRACT_CACHE")
    if existing:
        return existing

    cache_dir: Path
    try:
        # Imported lazily so this module stays import-safe anywhere (it is
        # imported before advertools at the earliest entry points) and so
        # tests can redirect the workspace root at call time.
        from services.workspace_paths import get_workspace_root

        cache_dir = Path(get_workspace_root()) / "tldextract_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        # No usable workspace in this deployment — the system temp dir is
        # still writable and better than re-downloading the PSL every boot.
        import tempfile

        cache_dir = Path(tempfile.gettempdir()) / "tldextract_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)

    os.environ["TLDEXTRACT_CACHE"] = str(cache_dir)
    return str(cache_dir)


# Configuring on import keeps every entry point safe: any module that needs
# tldextract can simply ``import services.seo.tldextract_setup`` FIRST, and
# app.py calls it in its early-env section before routing imports run.
configure_tldextract_cache()
