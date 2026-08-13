"""SIF integration subpackage.

Holds the mixin classes extracted from ``sif_integration.py`` so the
facade module stays light. Import mixins directly from their submodules
(e.g. ``services.intelligence.sif._base.SIFBase``); do not re-export
here to avoid circular imports at package load time.
"""
