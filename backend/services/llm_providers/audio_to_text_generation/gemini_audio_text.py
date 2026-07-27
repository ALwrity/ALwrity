"""
Gemini Audio Text Generation Module

This module provides a comprehensive interface for working with audio files using Google's Gemini API.
It supports various audio processing capabilities including transcription, summarization, and analysis.

Key Features:
------------
1. Audio Transcription: Convert speech in audio files to text
2. Audio Summarization: Generate concise summaries of audio content
3. Segment Analysis: Analyze specific time segments of audio files
4. Timestamped Transcription: Generate transcriptions with timestamps
5. Token Counting: Count tokens in audio files
6. Format Support: Information about supported audio formats

Supported Audio Formats:
----------------------
- WAV (audio/wav)
- MP3 (audio/mp3)
- AIFF (audio/aiff)
- AAC (audio/aac)
- OGG Vorbis (audio/ogg)
- FLAC (audio/flac)

Technical Details:
----------------
- Each second of audio is represented as 32 tokens
- Maximum supported length of audio data in a single prompt is 9.5 hours
- Audio files are downsampled to 16 Kbps data resolution
- Multi-channel audio is combined into a single channel

Usage:
------
```python
from lib.gpt_providers.audio_to_text_generation.gemini_audio_text import transcribe_audio, summarize_audio

# Basic transcription
transcript = transcribe_audio("path/to/audio.mp3")
print(transcript)

# Summarization
summary = summarize_audio("path/to/audio.mp3")
print(summary)

# Analyze specific segment
segment_analysis = analyze_audio_segment("path/to/audio.mp3", "02:30", "03:29")
print(segment_analysis)
```

Requirements:
------------
- GEMINI_API_KEY environment variable must be set
- google-generativeai Python package
- python-dotenv for environment variable management
- loguru for logging

Dependencies:
------------
- google.genai
- dotenv
- loguru
- os, sys, base64, typing
"""

import os
import sys
from pathlib import Path
from typing import List, Optional
import google.genai as genai
from google.genai import types
from dotenv import load_dotenv

from loguru import logger
from utils.logger_utils import get_service_logger
from services.api_key_manager import APIKeyManager

# Use service-specific logger to avoid conflicts
logger = get_service_logger("gemini_audio_text")


def load_environment():
    """Loads environment variables from a .env file."""
    load_dotenv()
    logger.info("Environment variables loaded successfully.")


def configure_google_api():
    """
    Configures the Google Gemini API with the API key from environment variables.
    
    Raises:
        ValueError: If the GEMINI_API_KEY environment variable is not set.
    """
    # Use APIKeyManager instead of direct environment variable access
    api_key_manager = APIKeyManager()
    api_key = api_key_manager.get_api_key("gemini")
    
    if not api_key:
        error_message = "Gemini API key not found. Please configure it in the onboarding process."
        logger.error(error_message)
        raise ValueError(error_message)
    
    genai.configure(api_key=api_key)
    logger.info("Google Gemini API configured successfully.")


def transcribe_audio(audio_file_path: str, prompt: str = "Transcribe the following audio:") -> Optional[str]:
    """
    Transcribes audio using Google's Gemini model.

    Args:
        audio_file_path (str): The path to the audio file to be transcribed.
        prompt (str, optional): The prompt to guide the transcription. Defaults to "Transcribe the following audio:".

    Returns:
        str: The transcribed text from the audio. 
             Returns None if transcription fails.

    Raises:
        FileNotFoundError: If the audio file is not found.
    """
    try:
        # Load environment variables and configure the Google API
        load_environment()
        configure_google_api()

        logger.info(f"Attempting to transcribe audio file: {audio_file_path}")

        # Check if file exists
        if not os.path.exists(audio_file_path):
            error_message = f"FileNotFoundError: The audio file at {audio_file_path} does not exist."
            logger.error(error_message)
            raise FileNotFoundError(error_message)

        # Initialize a Gemini model appropriate for audio understanding
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")

        # Upload the audio file
        try:
            audio_file = genai.upload_file(audio_file_path)
            logger.info(f"Audio file uploaded successfully: {audio_file=}")
        except FileNotFoundError:
            error_message = f"FileNotFoundError: The audio file at {audio_file_path} does not exist."
            logger.error(error_message)
            raise FileNotFoundError(error_message) 
        except Exception as e:
            logger.error(f"Error uploading audio file: {e}")
            return None

        # Generate the transcription
        try:
            response = model.generate_content([
                prompt,
                audio_file
            ])

            # Check for valid response and extract text
            if response and hasattr(response, 'text'):
                transcript = response.text
                logger.info(f"Transcription successful:\n{transcript}")
                return transcript
            else:
                logger.warning("Transcription failed: Invalid or empty response from API.")
                return None

        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            return None

    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        return None


def summarize_audio(audio_file_path: str) -> Optional[str]:
    """
    Summarizes the content of an audio file using Google's Gemini model.

    Args:
        audio_file_path (str): The path to the audio file to be summarized.

    Returns:
        str: A summary of the audio content.
             Returns None if summarization fails.
    """
    return transcribe_audio(audio_file_path, prompt="Please summarize the audio content:")


def analyze_audio_segment(audio_file_path: str, start_time: str, end_time: str) -> Optional[str]:
    """
    Analyzes a specific segment of an audio file using timestamps.

    Args:
        audio_file_path (str): The path to the audio file.
        start_time (str): Start time in MM:SS format.
        end_time (str): End time in MM:SS format.

    Returns:
        str: Analysis of the specified audio segment.
             Returns None if analysis fails.
    """
    prompt = f"Analyze the audio content from {start_time} to {end_time}."
    return transcribe_audio(audio_file_path, prompt=prompt)


def transcribe_with_timestamps(audio_file_path: str) -> Optional[str]:
    """
    Transcribes audio with timestamps for each segment.

    Args:
        audio_file_path (str): The path to the audio file.

    Returns:
        str: Transcription with timestamps.
             Returns None if transcription fails.
    """
    return transcribe_audio(audio_file_path, prompt="Transcribe the audio with timestamps for each segment:")


def count_tokens(audio_file_path: str) -> Optional[int]:
    """
    Counts the number of tokens in an audio file.

    Args:
        audio_file_path (str): The path to the audio file.

    Returns:
        int: Number of tokens in the audio file.
             Returns None if counting fails.
    """
    try:
        # Load environment variables and configure the Google API
        load_environment()
        configure_google_api()

        logger.info(f"Attempting to count tokens in audio file: {audio_file_path}")

        # Check if file exists
        if not os.path.exists(audio_file_path):
            error_message = f"FileNotFoundError: The audio file at {audio_file_path} does not exist."
            logger.error(error_message)
            raise FileNotFoundError(error_message)

        # Initialize a Gemini model
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")

        # Upload the audio file
        try:
            audio_file = genai.upload_file(audio_file_path)
            logger.info(f"Audio file uploaded successfully: {audio_file=}")
        except Exception as e:
            logger.error(f"Error uploading audio file: {e}")
            return None

        # Count tokens
        try:
            response = model.count_tokens([audio_file])
            token_count = response.total_tokens
            logger.info(f"Token count: {token_count}")
            return token_count
        except Exception as e:
            logger.error(f"Error counting tokens: {e}")
            return None

    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        return None


def get_supported_formats() -> List[str]:
    """
    Returns a list of supported audio formats.

    Returns:
        List[str]: List of supported MIME types.
    """
    return [
        "audio/wav",
        "audio/mp3",
        "audio/aiff",
        "audio/aac",
        "audio/ogg",
        "audio/flac"
    ]


# Example usage
if __name__ == "__main__":
    # Example 1: Basic transcription
    audio_path = "path/to/your/audio.mp3"
    transcript = transcribe_audio(audio_path)
    print(f"Transcript: {transcript}")

    # Example 2: Summarization
    summary = summarize_audio(audio_path)
    print(f"Summary: {summary}")

    # Example 3: Analyze specific segment
    segment_analysis = analyze_audio_segment(audio_path, "02:30", "03:29")
    print(f"Segment Analysis: {segment_analysis}")

    # Example 4: Transcription with timestamps
    timestamped_transcript = transcribe_with_timestamps(audio_path)
    print(f"Timestamped Transcript: {timestamped_transcript}")

    # Example 5: Count tokens
    token_count = count_tokens(audio_path)
    print(f"Token Count: {token_count}")

    # Example 6: Get supported formats
    formats = get_supported_formats()
    print(f"Supported Formats: {formats}")
