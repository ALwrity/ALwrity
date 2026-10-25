import pytest

from models.subscription_models import APIProvider
from services.subscription.provider_detection import detect_actual_provider


@pytest.mark.parametrize("provider, expected", [
    (APIProvider.GEMINI, "google"),
    (APIProvider.OPENAI, "openai"),
    (APIProvider.ANTHROPIC, "anthropic"),
    (APIProvider.MISTRAL, "huggingface"),
])
def test_llm_enum_maps_directly(provider, expected):
    assert detect_actual_provider(provider) == expected


@pytest.mark.parametrize("model, expected", [
    ("alibaba/wan-2.5/text-to-video", "wavespeed"),
    ("tencent/hunyuan-video", "huggingface"),
    ("veo-3", "google"),
    ("sora-2", "openai"),
])
def test_video_from_model_name(model, expected):
    assert detect_actual_provider(APIProvider.VIDEO, model_name=model) == expected


def test_video_model_name_beats_endpoint():
    result = detect_actual_provider(
        APIProvider.VIDEO, model_name="veo-3", endpoint="/video-generation/wavespeed"
    )
    assert result == "google"


def test_video_from_endpoint_and_default():
    assert detect_actual_provider(APIProvider.VIDEO, endpoint="/video-generation/wavespeed") == "wavespeed"
    assert detect_actual_provider(APIProvider.VIDEO) == "wavespeed"


@pytest.mark.parametrize("model, expected", [
    ("minimax/speech-02-hd", "wavespeed"),
    ("gemini-2.5-flash-preview-tts", "google"),
])
def test_audio_from_model_name(model, expected):
    assert detect_actual_provider(APIProvider.AUDIO, model_name=model) == expected


def test_audio_default_is_wavespeed():
    assert detect_actual_provider(APIProvider.AUDIO) == "wavespeed"


@pytest.mark.xfail(strict=True, reason="Known bug: 'tts' matches the Google check before 'tts-1' reaches the OpenAI check")
@pytest.mark.parametrize("model", ["tts-1", "tts-1-hd"])
def test_audio_openai_tts_is_attributed_to_openai(model):
    assert detect_actual_provider(APIProvider.AUDIO, model_name=model) == "openai"


@pytest.mark.parametrize("model, expected", [
    ("stable-diffusion-xl", "stability"),
    ("flux-dev", "wavespeed"),
    ("runway-gen", "huggingface"),
])
def test_image_generation_from_model_name(model, expected):
    assert detect_actual_provider(APIProvider.STABILITY, model_name=model) == expected


def test_image_generation_default_is_stability():
    assert detect_actual_provider(APIProvider.STABILITY) == "stability"


@pytest.mark.parametrize("model, expected", [
    ("flux-kontext", "wavespeed"),
    ("stable-diffusion-inpaint", "stability"),
])
def test_image_edit_from_model_name(model, expected):
    assert detect_actual_provider(APIProvider.IMAGE_EDIT, model_name=model) == expected


def test_image_edit_default_is_wavespeed():
    assert detect_actual_provider(APIProvider.IMAGE_EDIT) == "wavespeed"
