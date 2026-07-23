"""Blog Writer functional test suite.

Skeleton for the next test suite, mirroring the LinkedIn suite at
``tests/functional/linkedin/``. The framework primitives in
``tests/framework/`` are reused — only the suite-specific fixtures,
mock points, and tests live here.

Activate this suite as Blog Writer functionality lands:

* Add new fixtures to ``tests/functional/blog_writer/conftest.py``
  using the same patterns as ``linkedin/conftest.py``.
* Drop domain-specific tests into corresponding files:
  ``test_health.py``, ``test_router_registration.py``,
  ``test_outline_generation.py``, etc.
* Mark the test classes with ``pytestmark = [pytest.mark.blog_writer,
  pytest.mark.functional]``.

The CI workflow automatically picks these up — see
``tests/framework/CONTRIBUTING.md`` for the discovery rules.
"""
