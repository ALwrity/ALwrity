"""
Logger utilities to prevent conflicts between different logging configurations.
"""

from loguru import logger
import sys

from utils.console_encoding import configure_windows_console_encoding


def safe_logger_config(format_string: str, level: str = "INFO"):
    """
    Safely configure logger without removing existing handlers.
    This prevents conflicts with the main logging configuration.
    
    Args:
        format_string: Log format string
        level: Log level
    """
    try:
        # Only add a new handler if we don't already have one with this format
        existing_handlers = logger._core.handlers
        for handler in existing_handlers:
            if hasattr(handler, '_sink') and handler._sink == sys.stdout:
                # Check if format is similar to avoid duplicates
                if hasattr(handler, '_format') and handler._format == format_string:
                    return  # Handler already exists with this format
        
        # Add new handler only if needed
        configure_windows_console_encoding()
        logger.add(
            sys.stdout,
            level=level,
            format=format_string,
            colorize=True
        )
    except Exception as e:
        # If there's any error, just use the existing logger configuration
        pass


def get_service_logger(service_name: str, format_string: str = None):
    """
    Get a logger for a specific service without conflicting with main configuration.
    
    Args:
        service_name: Name of the service
        format_string: Optional custom format string
        
    Returns:
        Logger instance
    """
    if format_string:
        safe_logger_config(format_string)
    
    return logger.bind(service=service_name)
