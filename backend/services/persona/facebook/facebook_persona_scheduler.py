"""
Facebook Persona Scheduler

Thin wrapper around the generic platform persona scheduler, kept for backward
compatibility. New callers should use
``services.persona.platform_persona_scheduler`` directly.
"""

from services.persona.platform_persona_scheduler import (
    generate_platform_persona_task,
    schedule_platform_persona_generation,
)


async def generate_facebook_persona_task(user_id: str):
    """Generate a Facebook persona (delegates to the generic scheduler task)."""
    await generate_platform_persona_task(user_id, "facebook")


def schedule_facebook_persona_generation(user_id: str, delay_minutes: int = 20) -> str:
    """Schedule Facebook persona generation (delegates to the generic scheduler)."""
    return schedule_platform_persona_generation(user_id, "facebook", delay_minutes)
