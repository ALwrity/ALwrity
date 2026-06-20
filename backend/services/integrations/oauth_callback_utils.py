"""
Shared OAuth callback utilities for Wix and WordPress integrations.

Provides hardened postMessage-based HTML callback generation, origin
validation, and string sanitization used across OAuth callback routes.
"""

import json
import os
from typing import Any, Optional
from urllib.parse import urlparse


def sanitize_string(value: Any, max_len: int = 500) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())[:max_len]


def sanitize_error(error: Exception, max_len: int = 500) -> str:
    return sanitize_string(error, max_len)


def normalize_origin(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def trusted_frontend_origin() -> Optional[str]:
    origins_env = os.getenv("OAUTH_CALLBACK_ALLOWED_ORIGINS", "")
    configured = [
        origin
        for origin in (normalize_origin(o) for o in origins_env.split(",") if o.strip())
        if origin is not None
    ]
    if configured:
        return configured[0]
    return normalize_origin(os.getenv("FRONTEND_URL"))


def build_oauth_callback_html(
    payload: dict,
    title: str,
    heading: str,
    message: str,
) -> str:
    trusted_origin = trusted_frontend_origin()
    payload_json = json.dumps(payload)
    target_origin_json = json.dumps(trusted_origin or "")
    heading_html = heading.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    message_html = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"""
    <!DOCTYPE html>
    <html>
    <head><title>{title}</title></head>
    <body>
      <h1>{heading_html}</h1>
      <p>{message_html}</p>
      <script>
        (function() {{
          var payload = {payload_json};
          var targetOrigin = {target_origin_json};
          var destination = window.opener || window.parent;
          if (destination) {{
            if (targetOrigin) {{
              try {{
                destination.postMessage(payload, targetOrigin);
              }} catch (_e) {{}}
            }} else {{
              try {{
                destination.postMessage(payload, '*');
              }} catch (_e2) {{}}
            }}
          }}
          try {{
            window.close();
          }} catch (_e3) {{}}
        }})();
      </script>
    </body>
    </html>
    """
