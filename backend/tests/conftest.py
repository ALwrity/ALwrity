"""
Test configuration for the backend.

The SIF contract tests in tests/test_sif_contracts.py need to load
``services.intelligence.sif_errors`` and ``services.intelligence.semantic_cache``
without going through the full ``services/__init__.py`` import chain
(which pulls in the translation layer, AI providers, etc.).

The test file handles that itself via fixtures. This conftest is a
placeholder for shared fixtures that future tests may need.
"""
