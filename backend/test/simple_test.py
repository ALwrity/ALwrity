import sys
sys.path.insert(0, 'backend')

# Test individual components without problematic imports
try:
    from backend.services.llm_providers.textgen_utils.provider_utils import check_gpt_provider, _normalize_provider
    print('Provider utils: OK')
except Exception as e:
    print(f'Provider utils: FAILED - {e}')

try:
    from backend.services.llm_providers.textgen_utils.model_utils import _map_logical_model_to_provider_model
    print('Model utils: OK')
except Exception as e:
    print(f'Model utils: FAILED - {e}')

try:
    from backend.services.llm_providers.textgen_utils.api_key_utils import get_api_key
    print('API key utils: OK')
except Exception as e:
    print(f'API key utils: FAILED - {e}')

try:
    from backend.utils.logger_utils import emit_routing_event
    print('Logger utils: OK')
except Exception as e:
    print(f'Logger utils: FAILED - {e}')

# Test functions
try:
    result = _normalize_provider('gemini')
    print(f'Provider normalization: {result}')
except:
    print('Provider normalization: FAILED')

try:
    result = check_gpt_provider('google')
    print(f'Provider check: {result}')
except:
    print('Provider check: FAILED')

try:
    result = _map_logical_model_to_provider_model('huggingface', 'gpt-oss')
    print(f'Model mapping: {result}')
except:
    print('Model mapping: FAILED')

try:
    from loguru import logger
    payload = emit_routing_event(logger, flow_type='test', route_intent='primary', provider_selected='google', model_selected='gemini-2.0-flash-001', tenant_user_id='test123')
    print(f'Routing event: {payload.get("event_name")}')
except:
    print('Routing event: FAILED')

print('Analysis complete')
