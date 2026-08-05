import logging
import time
from datetime import datetime
from sqlalchemy import text
from services.database import get_session_for_user
from models.subscription_models import APIProvider, UsageSummary

logger = logging.getLogger(__name__)

def track_agent_usage_sync(user_id: str, model_name: str, prompt: str, response_text: str, duration: float):
    """
    Synchronously track agent LLM usage.
    This mimics the logic in llm_text_gen to ensure consistency and robustness.
    """
    try:
        # Detect provider
        provider_enum = APIProvider.GEMINI  # Default
        actual_provider_name = "gemini"
        
        model_lower = model_name.lower()
        if "gemini" in model_lower:
            provider_enum = APIProvider.GEMINI
            actual_provider_name = "gemini"
        elif "gpt" in model_lower or "openai" in model_lower or "mistral" in model_lower:
            # Check if it's WaveSpeed vs HuggingFace based on context or model naming
            # WaveSpeed models don't have :cerebras suffix, HF models do
            if ":cerebras" in model_name.lower() or "huggingface" in model_name.lower():
                provider_enum = APIProvider.MISTRAL
                actual_provider_name = "huggingface"
            else:
                # Assume WaveSpeed for gpt models without provider suffix
                provider_enum = APIProvider.WAVESPEED
                actual_provider_name = "wavespeed"
        elif "claude" in model_lower or "anthropic" in model_lower:
            provider_enum = APIProvider.ANTHROPIC
            actual_provider_name = "anthropic"
            
        logger.info(f"[AgentTracking] Tracking usage for user {user_id}, provider {actual_provider_name}, model {model_name}")
        
        db = get_session_for_user(user_id)
        if not db:
            logger.error(f"[AgentTracking] Could not get database session for user {user_id}")
            return

        try:
            # Estimate tokens
            tokens_input = int(len(prompt.split()) * 1.3)
            tokens_output = int(len(str(response_text).split()) * 1.3)
            tokens_total = tokens_input + tokens_output
            
            from services.subscription import PricingService

            pricing = PricingService(db)
            current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")
            
            # Get limits
            limits = pricing.get_user_limits(user_id)
            token_limit = 0
            provider_key = provider_enum.value
            if limits and limits.get('limits'):
                token_limit = limits['limits'].get(f"{provider_key}_tokens", 0) or 0
                
            # Check for existing record
            check_query = text("SELECT COUNT(*) FROM usage_summaries WHERE user_id = :user_id AND billing_period = :period")
            record_count = db.execute(check_query, {'user_id': user_id, 'period': current_period}).scalar()
            
            current_calls_before = 0
            current_tokens_before = 0
            
            if record_count and record_count > 0:
                # Read current values
                sql_query = text(f"""
                    SELECT {provider_key}_calls, {provider_key}_tokens 
                    FROM usage_summaries 
                    WHERE user_id = :user_id AND billing_period = :period 
                    LIMIT 1
                """)
                result = db.execute(sql_query, {'user_id': user_id, 'period': current_period}).first()
                if result:
                    current_calls_before = result[0] if result[0] is not None else 0
                    current_tokens_before = result[1] if result[1] is not None else 0
            else:
                # Create new summary
                summary = UsageSummary(user_id=user_id, billing_period=current_period)
                db.add(summary)
                db.flush()
                
            # Update calls
            new_calls = current_calls_before + 1
            update_calls_query = text(f"""
                UPDATE usage_summaries 
                SET {provider_key}_calls = :new_calls 
                WHERE user_id = :user_id AND billing_period = :period
            """)
            db.execute(update_calls_query, {
                'new_calls': new_calls,
                'user_id': user_id,
                'period': current_period
            })
            
            # Update tokens with limit check
            if provider_enum in [APIProvider.GEMINI, APIProvider.OPENAI, APIProvider.ANTHROPIC, APIProvider.MISTRAL]:
                projected_new_tokens = current_tokens_before + tokens_total
                
                if token_limit > 0 and projected_new_tokens > token_limit:
                    new_tokens = token_limit
                    tokens_total = max(0, token_limit - current_tokens_before)
                else:
                    new_tokens = projected_new_tokens
                    
                update_tokens_query = text(f"""
                    UPDATE usage_summaries 
                    SET {provider_key}_tokens = :new_tokens 
                    WHERE user_id = :user_id AND billing_period = :period
                """)
                db.execute(update_tokens_query, {
                    'new_tokens': new_tokens,
                    'user_id': user_id,
                    'period': current_period
                })
            else:
                tokens_total = 0
                
            # Calculate cost
            try:
                tracked_tokens_input = min(tokens_input, tokens_total)
                tracked_tokens_output = max(0, tokens_total - tracked_tokens_input)
                
                cost_info = pricing.calculate_api_cost(
                    provider=provider_enum,
                    model_name=model_name,
                    tokens_input=tracked_tokens_input,
                    tokens_output=tracked_tokens_output,
                    request_count=1
                )
                cost_total = cost_info.get('cost_total', 0.0) or 0.0
                cost_input = cost_info.get('cost_input', 0.0) or 0.0
                cost_output = cost_info.get('cost_output', 0.0) or 0.0
            except Exception as e:
                logger.error(f"[AgentTracking] Cost calculation failed: {e}")
                cost_total = 0.0
                cost_input = 0.0
                cost_output = 0.0
            
            # Insert into APIUsageLog
            try:
                log_query = text("""
                    INSERT INTO api_usage_logs (
                        user_id, provider, endpoint, method, model_used, 
                        tokens_input, tokens_output, tokens_total, 
                        cost_input, cost_output, cost_total, 
                        response_time, status_code, billing_period, 
                        timestamp, actual_provider_name
                    ) VALUES (
                        :user_id, :provider, :endpoint, :method, :model_used,
                        :tokens_input, :tokens_output, :tokens_total,
                        :cost_input, :cost_output, :cost_total,
                        :response_time, :status_code, :billing_period,
                        :created_at, :actual_provider_name
                    )
                """)
                
                db.execute(log_query, {
                    'user_id': user_id,
                    'provider': provider_enum.value,  # Use value (gemini) not name (GEMINI) for consistency
                    'endpoint': 'agent_action',
                    'method': 'GENERATE',
                    'model_used': model_name,
                    'tokens_input': tracked_tokens_input,
                    'tokens_output': tracked_tokens_output,
                    'tokens_total': tracked_tokens_input + tracked_tokens_output,
                    'cost_input': cost_input,
                    'cost_output': cost_output,
                    'cost_total': cost_total,
                    'response_time': duration,
                    'status_code': 200,
                    'billing_period': current_period,
                    'created_at': datetime.utcnow(),
                    'actual_provider_name': actual_provider_name
                })
            except Exception as log_e:
                logger.error(f"[AgentTracking] Failed to insert usage log: {log_e}")

            if cost_total > 0:
                update_costs_query = text(f"""
                    UPDATE usage_summaries 
                    SET {provider_key}_cost = COALESCE({provider_key}_cost, 0) + :cost,
                        total_cost = COALESCE(total_cost, 0) + :cost
                    WHERE user_id = :user_id AND billing_period = :period
                """)
                db.execute(update_costs_query, {
                    'cost': cost_total,
                    'user_id': user_id,
                    'period': current_period
                })
                
            # Update totals
            update_totals_query = text("""
                UPDATE usage_summaries 
                SET total_calls = COALESCE(total_calls, 0) + 1, 
                    total_tokens = COALESCE(total_tokens, 0) + :tokens_total 
                WHERE user_id = :user_id AND billing_period = :period
            """)
            db.execute(update_totals_query, {
                'tokens_total': tokens_total,
                'user_id': user_id,
                'period': current_period
            })
            
            db.commit()
            from services.subscription.cache import clear_dashboard_cache
            clear_dashboard_cache(user_id)
            logger.info(f"[AgentTracking] ✅ Usage tracked: {new_calls} calls, {cost_total} cost")
            
        except Exception as e:
            logger.error(f"[AgentTracking] Error tracking usage: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"[AgentTracking] Top level error: {e}", exc_info=True)
