import sys
sys.path.insert(0, 'backend')

try:
    from backend.services.llm_providers.routing_policy import resolve_text_provider_alias
    print('routing_policy import successful')
except Exception as e:
    print(f'routing_policy import failed: {e}')
    import traceback
    traceback.print_exc()
