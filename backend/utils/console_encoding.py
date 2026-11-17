import os
import sys

IS_WINDOWS = os.name == "nt"


def configure_windows_console_encoding(streams=None) -> None:
    """Escape characters unsupported by the current Windows console encoding."""
    if not IS_WINDOWS:
        return

    if streams is None:
        streams = (sys.stdout, sys.stderr)

    for stream in streams:
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(errors="backslashreplace")
            except Exception:
                continue
