"""Pytest configuration for backend tests."""

import sys
import types
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "dotenv" not in sys.modules:
    _dotenv = types.ModuleType("dotenv")
    _dotenv.load_dotenv = lambda *args, **kwargs: None
    sys.modules["dotenv"] = _dotenv

if "services" not in sys.modules:
    _services = types.ModuleType("services")
    _services.__path__ = [str(BACKEND_ROOT / "services")]
    sys.modules["services"] = _services

if "services.llm_providers.main_image_generation" not in sys.modules:
    _llm_pkg = types.ModuleType("services.llm_providers")
    _llm_pkg.__path__ = [str(BACKEND_ROOT / "services" / "llm_providers")]
    sys.modules["services.llm_providers"] = _llm_pkg

    _llm_img = types.ModuleType("services.llm_providers.main_image_generation")

    async def _enhance_image_prompt(prompt, user_id=None):
        return prompt

    _llm_img.enhance_image_prompt = _enhance_image_prompt
    sys.modules["services.llm_providers.main_image_generation"] = _llm_img
