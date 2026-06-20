"""
Logging configuration for ALwrity backend.
Provides clean logging setup for end users vs developers.
"""

import asyncio
import logging
import os
import sys
from loguru import logger


class InterceptHandler(logging.Handler):
    """Route standard logging records into Loguru."""

    def emit(self, record):
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.bind(logger_name=record.name).opt(
            depth=depth,
            exception=record.exc_info,
        ).log(level, record.getMessage())


def _patch_record_context(record):
    """Ensure common context keys exist in every log record."""
    extra = record["extra"]
    extra.setdefault("request_id", "-")
    extra.setdefault("job_id", "-")
    extra.setdefault("user_id", "-")


def _uncaught_exception_hook(exc_type, exc_value, exc_traceback):
    """Capture any uncaught top-level exception with traceback."""
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return

    logger.opt(exception=(exc_type, exc_value, exc_traceback)).critical(
        "Uncaught exception reached sys.excepthook"
    )


def _asyncio_exception_handler(loop, context):
    """Capture unhandled asyncio task/loop exceptions."""
    exception = context.get("exception")
    message = context.get("message", "Unhandled asyncio exception")

    if exception:
        logger.opt(exception=(type(exception), exception, exception.__traceback__)).critical(
            "{}", message
        )
    else:
        logger.critical("{} | context={}", message, context)


def _register_global_exception_handlers():
    """Register global hooks for uncaught runtime exceptions."""
    sys.excepthook = _uncaught_exception_hook

    try:
        policy = asyncio.get_event_loop_policy()

        class LoggingEventLoopPolicy(type(policy)):
            def new_event_loop(self):
                loop = super().new_event_loop()
                loop.set_exception_handler(_asyncio_exception_handler)
                return loop

        asyncio.set_event_loop_policy(LoggingEventLoopPolicy())
    except Exception:
        logger.exception("Failed to install asyncio event loop policy")

    try:
        loop = asyncio.get_event_loop()
        loop.set_exception_handler(_asyncio_exception_handler)
    except Exception:
        pass


def _configure_uvicorn_loggers(log_level):
    """Route uvicorn loggers through the same handlers and format as Loguru."""
    intercept_handler = InterceptHandler()

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = [intercept_handler]
        uvicorn_logger.propagate = False
        uvicorn_logger.setLevel(log_level)


def setup_clean_logging():
    """Set up clean logging for end users."""
    verbose_mode = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"

    logger.remove()
    logger.configure(patcher=_patch_record_context)

    common_format = (
        "{time:HH:mm:ss} | {level: <8} | req={extra[request_id]} "
        "job={extra[job_id]} user={extra[user_id]} | "
        "{name}:{function}:{line} - {message}\n{exception}"
    )

    if not verbose_mode:
        logging.getLogger('sqlalchemy.engine').setLevel(logging.CRITICAL)
        logging.getLogger('sqlalchemy.pool').setLevel(logging.CRITICAL)
        logging.getLogger('sqlalchemy.dialects').setLevel(logging.CRITICAL)
        logging.getLogger('sqlalchemy.orm').setLevel(logging.CRITICAL)
        logging.getLogger('sqlalchemy').setLevel(logging.CRITICAL)
        logging.getLogger('sqlalchemy.engine.Engine').setLevel(logging.CRITICAL)

        logging.getLogger('services').setLevel(logging.WARNING)
        logging.getLogger('api').setLevel(logging.WARNING)
        logging.getLogger('models').setLevel(logging.WARNING)

        noisy_loggers = [
            'linkedin_persona_service',
            'facebook_persona_service',
            'core_persona_service',
            'persona_analysis_service',
            'ai_service_manager',
            'ai_engine_service',
            'website_analyzer',
            'competitor_analyzer',
            'keyword_researcher',
            'content_gap_analyzer',
            'onboarding_data_service',
            'comprehensive_user_data',
            'strategy_data',
            'gap_analysis_data',
            'phase1_steps',
            'daily_schedule_generator',
            'gsc_service',
            'wordpress_oauth',
            'data_filter',
            'source_mapper',
            'grounding_engine',
            'blog_content_seo_analyzer',
            'linkedin_service',
            'citation_manager',
            'content_analyzer',
            'linkedin_prompt_generator',
            'linkedin_image_storage',
            'hallucination_detector',
            'writing_assistant',
            'enhanced_linguistic_analyzer',
            'persona_quality_improver',
            'logging_middleware',
            'exa_service',
            'step3_research_service',
            'sitemap_service',
            'router_manager',
            'frontend_serving',
            'database',
            'user_business_info',
            'auth_middleware',
            'pricing_service',
            'create_billing_tables'
        ]

        for logger_name in noisy_loggers:
            logging.getLogger(logger_name).setLevel(logging.WARNING)

        def warning_only_filter(record):
            return record["level"].name in ["WARNING", "ERROR", "CRITICAL"]

        logger.add(
            sys.stdout.write,
            level="WARNING",
            format=common_format,
            filter=warning_only_filter,
            backtrace=True,
            diagnose=True,
        )

        def video_generation_filter(record):
            msg = record.get("message", "")
            name = record.get("name", "")
            service = record.get("extra", {}).get("service")
            return (
                "[StoryVideoGeneration]" in msg
                or "services.story_writer.video_generation_service" in name
                or "[video_gen]" in msg
                or service == "video_generation_service"
                or "services.llm_providers.main_video_generation" in name
            )

        logger.add(
            sys.stdout.write,
            level="INFO",
            format=common_format,
            filter=video_generation_filter,
            backtrace=True,
            diagnose=True,
        )

        def linkedin_image_filter(record):
            msg = record.get("message", "")
            name = record.get("name", "")
            return (
                "[LinkedInImageGen]" in msg
                or "api.linkedin_image_generation" in name
                or "services.linkedin.image_generation" in name
            )

        logger.add(
            sys.stdout.write,
            level="INFO",
            format=common_format,
            filter=linkedin_image_filter,
            backtrace=True,
            diagnose=True,
        )
        uvicorn_level = logging.WARNING
    else:
        logger.add(
            sys.stdout.write,
            level="DEBUG",
            format=common_format,
            backtrace=True,
            diagnose=True,
        )
        uvicorn_level = logging.DEBUG

    _configure_uvicorn_loggers(uvicorn_level)
    _register_global_exception_handlers()

    return verbose_mode


def get_uvicorn_log_level():
    """Get appropriate uvicorn log level based on verbose mode."""
    verbose_mode = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
    return "debug" if verbose_mode else "warning"
