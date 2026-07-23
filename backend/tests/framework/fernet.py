"""Fernet key helpers for tests.

Many backend services (LinkedIn OAuth in particular) read encryption keys
from environment variables on module import. This module centralises the
"generate + inject" logic so test files don't need to repeat it.

Usage::

    from tests.framework.fernet import generate_fernet_key, patch_fernet_key

    key = generate_fernet_key()
    with patch_fernet_key(key):
        # import a route module that reads LINKEDIN_TOKEN_ENCRYPTION_KEY
        ...
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator


def generate_fernet_key() -> str:
    """Return a fresh Fernet key as a url-safe base64 string.

    Always prefer generating a new key per test invocation so tests can't
    accidentally share encryption state. The caller is responsible for
    patching it into the relevant env var before importing code that
    reads it.
    """
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode("utf-8")


@contextmanager
def patch_fernet_key(key: str) -> Iterator[str]:
    """Temporarily set ``LINKEDIN_TOKEN_ENCRYPTION_KEY`` to ``key``.

    Restores the previous value on exit.
    """
    sentinel = object()
    previous = os.environ.get("LINKEDIN_TOKEN_ENCRYPTION_KEY", sentinel)
    os.environ["LINKEDIN_TOKEN_ENCRYPTION_KEY"] = key
    try:
        yield key
    finally:
        if previous is sentinel:
            os.environ.pop("LINKEDIN_TOKEN_ENCRYPTION_KEY", None)
        else:
            os.environ["LINKEDIN_TOKEN_ENCRYPTION_KEY"] = previous
