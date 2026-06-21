"""Phase 2.2: thread-safe singleton helpers.

The ``TxtaiIntelligenceService`` follows a per-user singleton
pattern: ``TxtaiIntelligenceService(user_id)`` always returns the
same instance for the same ``user_id``. Pre-Phase 2.2 the
implementation was a single ``if user_id not in cls._instances``
check, which is not safe under contention: two threads could
both see the key missing and both create a new instance, with
the second overwriting the first and leaking the first.

This module provides a single helper, ``get_singleton``, that
implements the canonical double-checked locking pattern. The
fast path (key already present) is a single dict lookup with
no lock acquisition. The slow path acquires a per-class
``threading.Lock`` and re-checks the key inside the lock.

Usage from ``TxtaiIntelligenceService.__new__``::

    from .sif_singleton import get_singleton

    class TxtaiIntelligenceService:
        _instances = {}
        _singleton_lock = threading.Lock()

        def __new__(cls, user_id, *args, **kwargs):
            return get_singleton(
                cls=cls,
                user_id=user_id,
                instances=cls._instances,
                lock=cls._singleton_lock,
            )
"""
from __future__ import annotations

import threading
from typing import Any, Dict, Type, TypeVar

T = TypeVar("T")


def get_singleton(
    cls: Type[T],
    user_id: str,
    instances: Dict[str, T],
    lock: threading.Lock,
) -> T:
    """Return the singleton instance for ``user_id``, creating one
    if needed.

    Thread-safe via double-checked locking:
      1. Fast path: if ``user_id`` is in ``instances``, return it
         without acquiring the lock.
      2. Slow path: acquire ``lock``, re-check the key, create
         the instance via ``super(cls, cls).__new__(cls)`` if
         still missing, store it, return it.

    Args:
        cls: the class to instantiate. Must support
            ``super(cls, cls).__new__(cls)`` (i.e. a regular
            ``object`` subclass; not suitable for classes that
            override ``__new__`` to do work).
        user_id: the per-user key.
        instances: the class-level dict that holds the singletons.
            Typically ``cls._instances``.
        lock: the per-class ``threading.Lock`` that protects
            the slow path. Typically ``cls._singleton_lock``.
            Must NOT be re-entrant (``threading.Lock``, not
            ``RLock``) because ``__new__`` never recurses for
            the same class on the same thread.

    Returns:
        The singleton instance for ``user_id``.
    """
    if user_id in instances:
        return instances[user_id]
    with lock:
        if user_id not in instances:
            instances[user_id] = super(cls, cls).__new__(cls)
    return instances[user_id]
