"""Custom exceptions for the GIF maker service."""


class GifServiceError(Exception):
    """Known, catchable error from GifService.
    
    Raised when input validation fails or Pillow processing encounters
    an error. Distinct from unexpected runtime errors (which should
    propagate as 500s).
    """
    pass
