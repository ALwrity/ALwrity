"""FastAPI app factory for tests.

Builds a throw-away FastAPI app containing exactly the routers requested
plus the auth overrides needed to exercise them. Provides convenience
helpers for the common suites (LinkedIn first; expand as new feature
suites land).

Design constraints:

* Each call returns a *new* app so tests don't share mutable state.
* Routers are imported lazily so this module can be imported before any
  router module (the modules themselves require Fernet keys + the
  ``dotenv``/``main_image_generation`` stubs in :mod:`tests.conftest`).
* Auth overrides follow the convention from :mod:`tests.framework.auth`.
"""

from __future__ import annotations

from typing import Callable, Dict, List, Optional, Sequence, Union

from fastapi import APIRouter, FastAPI


_APIRouterLike = Union[APIRouter, object]


def _resolve_router(item: _APIRouterLike) -> APIRouter:
    """Accept either an APIRouter or an object that exposes ``.router``.

    ``APIRouter`` instances are mounted directly. ``_RoutedModule``s
    (used internally) and test pages with a ``router`` attribute are
    unwrapped automatically.
    """
    if isinstance(item, APIRouter):
        return item
    nested = getattr(item, "router", None)
    if isinstance(nested, APIRouter):
        return nested
    raise TypeError(
        f"Cannot resolve router from {type(item).__name__!r}; "
        "expected an APIRouter or an object exposing `.router`."
    )


def build_app(
    routers: Sequence[_APIRouterLike],
    auth_user_factory: Optional[Callable[[], Dict]] = None,
    *,
    title: str = "ALwrity Test App",
) -> FastAPI:
    """Build a fresh FastAPI app with the given routers mounted.

    Each element of ``routers`` may be:

    * an ``APIRouter`` instance, or
    * an object exposing a ``router`` attribute (e.g. a router module
      imported by name, or a ``_RoutedModule`` produced by
      :func:`_load_linkedin_routers`).
    """
    app = FastAPI(title=title)
    for r in routers:
        app.include_router(_resolve_router(r))
    if auth_user_factory is not None:
        from tests.framework.auth import override_auth_deps
        override_auth_deps(app, auth_user_factory)
    return app


def build_linkedin_app(
    *,
    auth_user_factory: Optional[Callable[[], Dict]] = None,
    exclude: Optional[Sequence[str]] = None,
) -> FastAPI:
    """Build a FastAPI app with every LinkedIn router mounted.

    Excludes the optional routers listed in ``exclude`` (by their
    ``CORE_ROUTER_REGISTRY`` entry name, e.g. ``"linkedin_video"``).
    Useful when a test wants only a subset (e.g. skip LLM-heavy
    video endpoints).
    """
    exclude_set = set(exclude or ())
    routers = _load_linkedin_routers(exclude=exclude_set)
    return build_app(
        routers=routers,
        auth_user_factory=auth_user_factory,
        title="ALwrity LinkedIn Test App",
    )


def _load_linkedin_routers(exclude: set):
    """Lazy-import every LinkedIn router module listed in registry.

    Falls back silently if a module isn't in :mod:`router_manager`
    registry (some tools or test variants may add new routers ad-hoc).
    """
    from alwrity_utils.router_manager import CORE_ROUTER_REGISTRY

    modules: list = []
    for entry in CORE_ROUTER_REGISTRY:
        name = entry.get("name", "")
        if not name:
            continue
        if not name.startswith("linkedin"):
            continue
        if name in exclude:
            continue
        module_path = entry["module"]
        attr = entry.get("attr", "router")
        # Import via the module path so submodules resolve naturally.
        try:
            mod = __import__(module_path, fromlist=[attr])
        except Exception:
            # Skip modules that can't be imported at test time (e.g.
            # missing optional LLM dependencies in CI).
            continue
        router = getattr(mod, attr, None)
        if router is None:
            continue
        modules.append(_RoutedModule(module_path=module_path, router=router))
    return modules


class _RoutedModule:
    """Tiny wrapper so we can pass name + router object around uniformly."""

    __slots__ = ("module_path", "router")

    def __init__(self, module_path: str, router):
        self.module_path = module_path
        self.router = router
