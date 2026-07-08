from services.translation.translation_factory import get_translator, clear_translator_cache, _TRANSLATOR_CACHE
from services.translation.base_translation import TranslationQuality

def test_translator_cache_hits():
    clear_translator_cache()
    
    # Get translator first time
    t1 = get_translator(TranslationQuality.LOW, api_key="test_key_1")
    
    # Get translator second time with same kwargs
    t2 = get_translator(TranslationQuality.LOW, api_key="test_key_1")
    
    # Should refer to the same instance (cache hit)
    assert t1 is t2
    assert len(_TRANSLATOR_CACHE) == 1

def test_translator_cache_miss_with_different_kwargs():
    clear_translator_cache()
    
    # Get translator with key 1
    t1 = get_translator(TranslationQuality.LOW, api_key="test_key_1")
    
    # Get translator with key 2
    t2 = get_translator(TranslationQuality.LOW, api_key="test_key_2")
    
    # Should refer to different instances
    assert t1 is not t2
    assert len(_TRANSLATOR_CACHE) == 2

def test_translator_cache_force_new():
    clear_translator_cache()
    
    t1 = get_translator(TranslationQuality.LOW, api_key="test_key_1")
    t2 = get_translator(TranslationQuality.LOW, force_new=True, api_key="test_key_1")
    
    assert t1 is not t2
