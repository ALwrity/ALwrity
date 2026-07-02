import sys
sys.path.insert(0, 'backend')

try:
    from backend.services.llm_providers.textgen_utils.api_key_utils import get_api_key
    print('API key utils import successful')
except Exception as e:
    print(f'API key utils import failed: {e}')

try:
    from backend.services.llm_providers.textgen_utils.provider_utils import check_gpt_provider
    print('Provider utils import successful')
except Exception as e:
    print(f'Provider utils import failed: {e}')

try:
    from backend.services.llm_providers.textgen_utils.model_utils import _map_logical_model_to_provider_model
    print('Model utils import successful')
except Exception as e:
    print(f'Model utils import failed: {e}')
