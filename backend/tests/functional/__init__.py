"""LinkedIn functional test suite — shared fixtures and configuration.

This file is the entry point for everything under
``tests/functional/linkedin/``. Pull in fixtures from
:mod:`tests.framework` and add LinkedIn-specific behaviour on top
(e.g. LinkedIn-shaped fake users, per-user OAuth DB stubs).

Conventions:
* Each test file under this directory pulls the shared fixtures from
  here (``linkedin_app``, ``linkedin_client``, ``linkedin_user``).
* Per-file overrides go in that file's own ``conftest.py`` if needed
  (none yet).
"""
