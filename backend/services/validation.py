"""Enhanced validation service for ALwrity backend."""

import os
import re
from typing import Dict, Any, List, Tuple
from loguru import logger
from dotenv import load_dotenv

def check_all_api_keys(api_manager) -> Dict[str, Any]:
    """Enhanced API key validation with comprehensive checking.
    
    Args:
        api_manager: The API key manager instance
        
    Returns:
        Dict[str, Any]: Comprehensive validation results
    """
    try:
        logger.info("Starting comprehensive API key validation process...")
        
        # Load environment variables
        current_dir = os.getcwd()
        env_path = os.path.join(current_dir, '.env')
        logger.info(f"Looking for .env file at: {env_path}")
        
        # Check if .env file exists
        if not os.path.exists(env_path):
            logger.warning(f".env file not found at {env_path}")
            # Continue without .env file for now
        
        # Load environment variables if file exists
        if os.path.exists(env_path):
            load_dotenv(env_path, override=True)
            logger.debug("Environment variables loaded")
        
        # Log available environment variables
        logger.debug("Available environment variables:")
        for key in os.environ.keys():
            if any(provider in key for provider in ['API_KEY', 'SERPAPI', 'TAVILY', 'METAPHOR', 'FIRECRAWL']):
                logger.debug(f"Found environment variable: {key}")
        
        # Step 1: Check for at least one AI provider
        logger.info("Checking AI provider API keys...")
        ai_providers = [
            'OPENAI_API_KEY',
            'GEMINI_API_KEY',
            'ANTHROPIC_API_KEY',
            'MISTRAL_API_KEY',
            'ORCAROUTER_API_KEY'
        ]
        
        ai_provider_results = {}
        has_ai_provider = False
        
        for provider in ai_providers:
            value = os.getenv(provider)
            if value:
                validation_result = validate_api_key(provider.lower().replace('_api_key', ''), value)
                ai_provider_results[provider] = validation_result
                if validation_result.get('valid', False):
                    has_ai_provider = True
                    logger.info(f"Found valid {provider} (length: {len(value)})")
                else:
                    logger.warning(f"Found invalid {provider}: {validation_result.get('error', 'Unknown error')}")
            else:
                ai_provider_results[provider] = {
                    'valid': False,
                    'error': 'API key not configured'
                }
                logger.debug(f"Missing {provider}")
        
        # Step 2: Check for at least one research provider
        logger.info("Checking research provider API keys...")
        research_providers = [
            'SERPAPI_KEY',
            'TAVILY_API_KEY',
            'METAPHOR_API_KEY',
            'FIRECRAWL_API_KEY'
        ]
        
        research_provider_results = {}
        has_research_provider = False
        
        for provider in research_providers:
            value = os.getenv(provider)
            if value:
                validation_result = validate_api_key(provider.lower().replace('_key', ''), value)
                research_provider_results[provider] = validation_result
                if validation_result.get('valid', False):
                    has_research_provider = True
                    logger.info(f"Found valid {provider} (length: {len(value)})")
                else:
                    logger.warning(f"Found invalid {provider}: {validation_result.get('error', 'Unknown error')}")
            else:
                research_provider_results[provider] = {
                    'valid': False,
                    'error': 'API key not configured'
                }
                logger.debug(f"Missing {provider}")
        
        # Step 3: Check for website URL
        logger.info("Checking website URL...")
        website_url = os.getenv('WEBSITE_URL')
        website_valid = False
        if website_url:
            website_valid = validate_website_url(website_url)
            if website_valid:
                logger.success(f"✓ Website URL found and valid: {website_url}")
            else:
                logger.warning(f"Website URL found but invalid: {website_url}")
        else:
            logger.warning("No website URL found in environment variables")
        
        # Step 4: Check for personalization status
        logger.info("Checking personalization status...")
        personalization_done = os.getenv('PERSONALIZATION_DONE', 'false').lower() == 'true'
        if personalization_done:
            logger.success("✓ Personalization completed")
        else:
            logger.warning("Personalization not completed")
        
        # Step 5: Check for integration status
        logger.info("Checking integration status...")
        integration_done = os.getenv('INTEGRATION_DONE', 'false').lower() == 'true'
        if integration_done:
            logger.success("✓ Integrations completed")
        else:
            logger.warning("Integrations not completed")
        
        # Step 6: Check for final setup status
        logger.info("Checking final setup status...")
        final_setup_complete = os.getenv('FINAL_SETUP_COMPLETE', 'false').lower() == 'true'
        if final_setup_complete:
            logger.success("✓ Final setup completed successfully")
        else:
            logger.warning("Final setup not completed")
        
        # Determine overall validation status
        all_valid = (
            has_ai_provider and 
            has_research_provider and 
            website_valid and 
            personalization_done and 
            integration_done and 
            final_setup_complete
        )
        
        if all_valid:
            logger.success("All required API keys and setup steps validated successfully!")
        else:
            logger.warning("Some validation checks failed")
        
        return {
            'all_valid': all_valid,
            'results': {
                'ai_providers': ai_provider_results,
                'research_providers': research_provider_results,
                'website_url': {
                    'valid': website_valid,
                    'url': website_url,
                    'error': None if website_valid else 'Invalid or missing website URL'
                },
                'personalization': {
                    'valid': personalization_done,
                    'status': 'completed' if personalization_done else 'pending'
                },
                'integrations': {
                    'valid': integration_done,
                    'status': 'completed' if integration_done else 'pending'
                },
                'final_setup': {
                    'valid': final_setup_complete,
                    'status': 'completed' if final_setup_complete else 'pending'
                }
            },
            'summary': {
                'has_ai_provider': has_ai_provider,
                'has_research_provider': has_research_provider,
                'website_valid': website_valid,
                'personalization_done': personalization_done,
                'integration_done': integration_done,
                'final_setup_complete': final_setup_complete
            }
        }
        
    except Exception as e:
        logger.error(f"Error checking API keys: {str(e)}", exc_info=True)
        return {
            'all_valid': False,
            'error': str(e),
            'results': {}
        }

def validate_api_key(provider: str, api_key: str) -> Dict[str, Any]:
    """Enhanced API key validation with provider-specific checks."""
    try:
        if not api_key or len(api_key.strip()) < 10:
            return {'valid': False, 'error': 'API key too short or empty'}
        
        # Provider-specific format validation
        if provider == "openai":
            if not api_key.startswith("sk-"):
                return {'valid': False, 'error': 'OpenAI API key must start with "sk-"'}
            if len(api_key) < 20:
                return {'valid': False, 'error': 'OpenAI API key seems too short'}
        
        elif provider == "gemini":
            if not api_key.startswith("AIza"):
                return {'valid': False, 'error': 'Google API key must start with "AIza"'}
            if len(api_key) < 30:
                return {'valid': False, 'error': 'Google API key seems too short'}
        
        elif provider == "anthropic":
            if not api_key.startswith("sk-ant-"):
                return {'valid': False, 'error': 'Anthropic API key must start with "sk-ant-"'}
            if len(api_key) < 20:
                return {'valid': False, 'error': 'Anthropic API key seems too short'}
        
        elif provider == "mistral":
            if not api_key.startswith("mistral-"):
                return {'valid': False, 'error': 'Mistral API key must start with "mistral-"'}
            if len(api_key) < 20:
                return {'valid': False, 'error': 'Mistral API key seems too short'}

        elif provider == "orcarouter":
            if not api_key.startswith("sk-orca-"):
                return {'valid': False, 'error': 'OrcaRouter API key must start with "sk-orca-"'}
            if len(api_key) < 20:
                return {'valid': False, 'error': 'OrcaRouter API key seems too short'}

        elif provider == "tavily":
            if len(api_key) < 10:
                return {'valid': False, 'error': 'Tavily API key seems too short'}
        
        elif provider == "serper":
            if len(api_key) < 10:
                return {'valid': False, 'error': 'Serper API key seems too short'}
        
        elif provider == "metaphor":
            if len(api_key) < 10:
                return {'valid': False, 'error': 'Metaphor API key seems too short'}
        
        elif provider == "exa":
            # Exa API keys are UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
            import re
            exa_uuid_regex = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
            if not exa_uuid_regex.match(api_key):
                return {'valid': False, 'error': 'Exa API key must be a valid UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'}
        
        elif provider == "copilotkit":
            if not api_key.startswith("ck_pub_"):
                return {'valid': False, 'error': 'CopilotKit API key must start with "ck_pub_"'}
            if len(api_key) < 20:
                return {'valid': False, 'error': 'CopilotKit API key seems too short'}
        
        elif provider == "firecrawl":
            if len(api_key) < 10:
                return {'valid': False, 'error': 'Firecrawl API key seems too short'}
        
        else:
            # Generic validation for unknown providers
            if len(api_key) < 10:
                return {'valid': False, 'error': 'API key seems too short'}
        
        return {'valid': True, 'error': None}
    
    except Exception as e:
        logger.error(f"Error validating {provider} API key: {str(e)}")
        return {'valid': False, 'error': f'Validation error: {str(e)}'}

def validate_website_url(url: str) -> bool:
    """Validate website URL format and accessibility."""
    try:
        if not url:
            return False
        
        # Basic URL format validation
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        if not url_pattern.match(url):
            return False
        
        # Additional checks can be added here (accessibility, content, etc.)
        return True
        
    except Exception as e:
        logger.error(f"Error validating website URL: {str(e)}")
        return False

def validate_step_data(step_number: int, data: Dict[str, Any]) -> List[str]:
    """Validate step-specific data with enhanced logic."""
    errors = []
    
    logger.info(f"[validate_step_data] Validating step {step_number} with data: {data}")
    
    if step_number == 1:  # AI LLM Providers - Now requires Gemini, Exa, and CopilotKit
        required_providers = ['gemini', 'exa', 'copilotkit']
        missing_providers = []
        
        logger.info(f"[validate_step_data] Step 1 validation - data type: {type(data)}, data: {data}")
        
        if not data or 'api_keys' not in data:
            logger.warning(f"[validate_step_data] No data or api_keys missing. data: {data}")
            errors.append("API keys configuration is required")
        elif not data['api_keys']:
            logger.warning(f"[validate_step_data] api_keys is empty. data: {data}")
            errors.append("API keys configuration is required")
        else:
            # Check for all required providers
            for provider in required_providers:
                if provider not in data['api_keys'] or not data['api_keys'][provider]:
                    missing_providers.append(provider)
            
            if missing_providers:
                errors.append(f"Missing required API keys: {', '.join(missing_providers)}")
            
            # Validate each configured API key format
            for provider, api_key in data['api_keys'].items():
                if provider in required_providers and api_key:
                    if provider == 'gemini' and not api_key.startswith('AIza'):
                        errors.append("Gemini API key must start with 'AIza'")
                    elif provider == 'exa':
                        # Exa API keys are UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
                        import re
                        exa_uuid_regex = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
                        if not exa_uuid_regex.match(api_key):
                            errors.append("Exa API key must be a valid UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)")
                    elif provider == 'copilotkit' and not api_key.startswith('ck_pub_'):
                        errors.append("CopilotKit API key must start with 'ck_pub_'")
    
    elif step_number == 2:  # Website Analysis
        # Accept both 'website' and 'website_url' for backwards compatibility
        website_url = data.get('website') or data.get('website_url') if data else None
        if not website_url:
            errors.append("Website URL is required")
        elif not validate_website_url(website_url):
            errors.append("Invalid website URL format")
    
    elif step_number == 3:  # AI Research
        # Validate that research data is present (competitors, research summary, or sitemap analysis)
        if not data:
            errors.append("Research data is required for step 3 completion")
        else:
            # Check for required research fields
            has_competitors = 'competitors' in data and data['competitors']
            has_research_summary = 'researchSummary' in data and data['researchSummary']
            has_sitemap_analysis = 'sitemapAnalysis' in data and data['sitemapAnalysis']
            
            if not (has_competitors or has_research_summary or has_sitemap_analysis):
                errors.append("At least one research data field (competitors, researchSummary, or sitemapAnalysis) must be present")
    
    elif step_number == 4:  # Personalization
        # Validate that persona data is present
        if not data:
            errors.append("Persona data is required for step 4 completion")
        else:
            # Check for required persona fields
            required_persona_fields = ['corePersona', 'platformPersonas']
            missing_fields = []

            for field in required_persona_fields:
                if field not in data or not data[field]:
                    missing_fields.append(field)

            if missing_fields:
                errors.append(f"Missing required persona data: {', '.join(missing_fields)}")

            # Validate core persona structure if present
            if 'corePersona' in data and data['corePersona']:
                core_persona = data['corePersona']
                if not isinstance(core_persona, dict):
                    errors.append("corePersona must be a valid object")
                elif 'identity' not in core_persona:
                    errors.append("corePersona must contain identity information")

            # Validate platform personas structure if present
            if 'platformPersonas' in data and data['platformPersonas']:
                platform_personas = data['platformPersonas']
                if not isinstance(platform_personas, dict):
                    errors.append("platformPersonas must be a valid object")
                elif len(platform_personas) == 0:
                    errors.append("At least one platform persona must be configured")
    
    elif step_number == 5:  # Integrations
        # Optional step, no validation required
        pass
    
    elif step_number == 6:  # Complete Setup
        # This step requires all previous steps to be completed
        # Validation is handled by the progress tracking system
        pass
    
    return errors

def validate_environment_setup() -> Dict[str, Any]:
    """Validate the overall environment setup."""
    issues = []
    warnings = []
    
    # Check for required directories
    required_dirs = [
        "lib/workspace/alwrity_content",
        "lib/workspace/alwrity_web_research",
        "lib/workspace/alwrity_prompts",
        "lib/workspace/alwrity_config"
    ]
    
    for dir_path in required_dirs:
        if not os.path.exists(dir_path):
            try:
                os.makedirs(dir_path, exist_ok=True)
                warnings.append(f"Created missing directory: {dir_path}")
            except Exception as e:
                issues.append(f"Cannot create directory {dir_path}: {str(e)}")
    
    # Check for .env file
    if not os.path.exists(".env"):
        warnings.append(".env file not found. API keys will need to be configured.")
    
    # Check for write permissions
    try:
        test_file = ".test_write_permission"
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
    except Exception as e:
        issues.append(f"Cannot write to current directory: {str(e)}")
    
    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'warnings': warnings
    }

def validate_api_key_format(provider: str, api_key: str) -> bool:
    """Quick format validation for API keys."""
    if not api_key or len(api_key.strip()) < 10:
        return False
    
    # Provider-specific format checks
    if provider == "openai" and not api_key.startswith("sk-"):
        return False
    
    if provider == "gemini" and not api_key.startswith("AIza"):
        return False
    
    if provider == "anthropic" and not api_key.startswith("sk-ant-"):
        return False
    
    if provider == "mistral" and not api_key.startswith("mistral-"):
        return False

    if provider == "orcarouter" and not api_key.startswith("sk-orca-"):
        return False
    
    return True 