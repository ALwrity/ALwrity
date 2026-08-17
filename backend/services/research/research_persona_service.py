"""
Research Persona Service

Handles generation, caching, and retrieval of AI-powered research personas.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from loguru import logger
from fastapi import HTTPException

from sqlalchemy import text
from services.database import get_db_session
from models.onboarding import PersonaData, OnboardingSession
from models.research_persona_models import ResearchPersona
from .research_persona_prompt_builder import ResearchPersonaPromptBuilder
from services.llm_providers.main_text_generation import llm_text_gen
from services.persona_data_service import PersonaDataService
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService


class ResearchPersonaService:
    """Service for generating and managing research personas."""
    
    CACHE_TTL_DAYS = 7  # 7-day cache TTL
    
    def __init__(self, db_session=None):
        self.db = db_session
        self.prompt_builder = ResearchPersonaPromptBuilder()
        # self.persona_data_service was initialized here but unused in this service
        self.integration_service = OnboardingDataIntegrationService()
        self._research_persona_cols_checked = False

    def _get_session(self, user_id: str):
        """Helper to get a database session."""
        if self.db:
            return self.db, False
        return get_db_session(user_id), True

    def _ensure_research_persona_columns(self, session_db) -> None:
        """Ensure research_persona columns exist in persona_data table (runtime migration)."""
        if self._research_persona_cols_checked:
            return
        
        try:
            # Check if columns exist using PRAGMA (SQLite) or information_schema (PostgreSQL)
            db_url = str(session_db.bind.url) if session_db.bind else ""
            
            if 'sqlite' in db_url.lower():
                # SQLite: Use PRAGMA to check columns
                result = session_db.execute(text("PRAGMA table_info(persona_data)"))
                cols = {row[1] for row in result}  # Column name is at index 1
                
                if 'research_persona' not in cols:
                    logger.info("Adding missing column research_persona to persona_data table")
                    session_db.execute(text("ALTER TABLE persona_data ADD COLUMN research_persona JSON"))
                    session_db.commit()
                
                if 'research_persona_generated_at' not in cols:
                    logger.info("Adding missing column research_persona_generated_at to persona_data table")
                    session_db.execute(text("ALTER TABLE persona_data ADD COLUMN research_persona_generated_at TIMESTAMP"))
                    session_db.commit()
            else:
                # PostgreSQL: Try to query the columns (will fail if they don't exist)
                try:
                    session_db.execute(text("SELECT research_persona, research_persona_generated_at FROM persona_data LIMIT 0"))
                except Exception:
                    # Columns don't exist, add them
                    logger.info("Adding missing columns research_persona and research_persona_generated_at to persona_data table")
                    try:
                        session_db.execute(text("ALTER TABLE persona_data ADD COLUMN research_persona JSONB"))
                        session_db.execute(text("ALTER TABLE persona_data ADD COLUMN research_persona_generated_at TIMESTAMP"))
                        session_db.commit()
                    except Exception as alter_err:
                        logger.error(f"Failed to add research_persona columns: {alter_err}")
                        session_db.rollback()
                        raise
        except Exception as e:
            logger.error(f"Error ensuring research_persona columns: {e}")
            session_db.rollback()
            raise
        finally:
            self._research_persona_cols_checked = True
    
    def get_cached_only(
        self, 
        user_id: str
    ) -> Optional[ResearchPersona]:
        """
        Get research persona for user if it exists in database (regardless of cache validity).
        This method NEVER generates - it only returns existing personas.
        Use this for config endpoints to avoid triggering rate limit checks.
        
        Note: Returns persona even if cache is expired - cache validity only matters for regeneration.
        
        Args:
            user_id: User ID (Clerk string)
            
        Returns:
            ResearchPersona if exists in database, None otherwise
        """
        db = None
        should_close = False
        try:
            db, should_close = self._get_session(user_id)
            if not db:
                logger.error(f"Could not get database session for user {user_id}")
                return None
                
            # Get persona data record
            persona_data = self._get_persona_data_record(user_id, db)
            
            if not persona_data:
                logger.debug(f"[get_cached_only] No persona data record found for user {user_id}")
                return None
            
            # Check if research_persona field exists and is not None/empty
            # Handle cases where it might be None, empty dict {}, or empty string ""
            research_persona_raw = persona_data.research_persona
            has_persona = (
                research_persona_raw is not None 
                and research_persona_raw != {}
                and research_persona_raw != ""
                and (isinstance(research_persona_raw, dict) and len(research_persona_raw) > 0)
            )
            
            logger.info(
                f"[get_cached_only] Checking research persona for user {user_id}: "
                f"persona_data exists=True, research_persona_raw={research_persona_raw is not None}, "
                f"research_persona type={type(research_persona_raw)}, "
                f"has_persona={has_persona}, "
                f"generated_at={persona_data.research_persona_generated_at}"
            )
            
            # Return persona if it exists, regardless of cache validity
            # Cache validity only matters when deciding whether to regenerate
            if has_persona:
                try:
                    cache_valid = self.is_cache_valid(persona_data)
                    cache_status = "valid" if cache_valid else "expired"
                    logger.info(
                        f"[get_cached_only] ✅ Returning research persona for user {user_id} "
                        f"(cache: {cache_status}, generated_at: {persona_data.research_persona_generated_at})"
                    )
                    # Ensure we're passing a dict to ResearchPersona
                    if not isinstance(research_persona_raw, dict):
                        logger.error(f"[get_cached_only] research_persona_raw is not a dict: {type(research_persona_raw)}")
                        return None
                    parsed_persona = ResearchPersona(**research_persona_raw)
                    logger.info(
                        f"[get_cached_only] ✅ Successfully parsed persona for user {user_id}: "
                        f"industry={parsed_persona.default_industry}, "
                        f"target_audience={parsed_persona.default_target_audience}"
                    )
                    return parsed_persona
                except Exception as e:
                    logger.error(f"[get_cached_only] ❌ Failed to parse research persona for user {user_id}: {e}", exc_info=True)
                    logger.debug(
                        f"[get_cached_only] Persona data details: "
                        f"type={type(research_persona_raw)}, "
                        f"is_dict={isinstance(research_persona_raw, dict)}, "
                        f"value sample: {str(research_persona_raw)[:500] if research_persona_raw else 'None'}"
                    )
                    return None
            
            # Persona doesn't exist in database
            logger.info(f"[get_cached_only] ⚠️ No research persona found in database for user {user_id}")
            return None
                
        except Exception as e:
            logger.error(f"[get_cached_only] ❌ Error getting research persona for user {user_id}: {e}", exc_info=True)
            return None
        finally:
            if should_close and db:
                db.close()

    def get_or_generate(
        self, 
        user_id: str, 
        force_refresh: bool = False
    ) -> Optional[ResearchPersona]:
        """
        Get research persona for user, generating if missing or expired.
        
        Args:
            user_id: User ID (Clerk string)
            force_refresh: If True, regenerate even if cache is valid
            
        Returns:
            ResearchPersona if successful, None otherwise
        """
        db = None
        should_close = False
        try:
            db, should_close = self._get_session(user_id)
            if not db:
                logger.error(f"Could not get database session for get_or_generate (user {user_id})")
                return None
                
            # Get persona data record
            persona_data = self._get_persona_data_record(user_id, db)
            
            if not persona_data:
                logger.warning(f"No persona data found for user {user_id}, cannot generate research persona")
                return None
            
            # Check if persona exists in database
            if persona_data.research_persona:
                # Persona exists - check if we should return it or regenerate
                cache_valid = self.is_cache_valid(persona_data)
                
                if not force_refresh and cache_valid:
                    # Cache is valid - return existing persona
                    logger.info(f"Using cached research persona for user {user_id}")
                    try:
                        return ResearchPersona(**persona_data.research_persona)
                    except Exception as e:
                        logger.warning(f"Failed to parse cached research persona: {e}, regenerating...")
                        # Fall through to regeneration if parsing fails
                elif not force_refresh:
                    # Persona exists but cache expired - return it anyway (don't regenerate unless forced)
                    logger.info(f"Research persona exists for user {user_id} but cache expired - returning existing persona (use force_refresh=true to regenerate)")
                    try:
                        return ResearchPersona(**persona_data.research_persona)
                    except Exception as e:
                        logger.warning(f"Failed to parse existing research persona: {e}, regenerating...")
                        # Fall through to regeneration if parsing fails
                else:
                    # force_refresh=True - regenerate even though persona exists
                    logger.info(f"Forcing refresh of research persona for user {user_id}")
            else:
                # Persona doesn't exist - generate new one
                logger.info(f"Research persona missing for user {user_id}, generating...")
            
            # Generate new research persona (only reaches here if:
            # 1. Persona doesn't exist, OR
            # 2. force_refresh=True, OR
            # 3. Parsing of existing persona failed
            try:
                logger.info(f"Generating research persona for user {user_id}")
                research_persona = self.generate_research_persona(user_id, db)
            except HTTPException:
                # Re-raise HTTPExceptions (e.g., 429 subscription limit) so they propagate to API
                raise
            
            if research_persona:
                # generate_research_persona saves it automatically now
                logger.info(f"✅ Research persona generated and saved for user {user_id}")
                return research_persona
            else:
                # Log detailed error for debugging expensive failures
                logger.error(
                    f"❌ Failed to generate research persona for user {user_id} - "
                    f"This is an expensive failure (API call consumed). Check logs above for details."
                )
                # Don't return None silently - let the caller know this failed
                return None
                
        except HTTPException:
            # Re-raise HTTPExceptions (e.g., 429 subscription limit) so they propagate to API
            raise
        except Exception as e:
            logger.error(f"Error getting/generating research persona for user {user_id}: {e}")
            return None
        finally:
            if should_close and db:
                db.close()
    
    def generate_research_persona(self, user_id: str, db=None) -> Optional[ResearchPersona]:
        """
        Generate a new research persona for the user.
        
        Args:
            user_id: User ID (Clerk string)
            db: Optional database session
            
        Returns:
            ResearchPersona if successful, None otherwise
        """
        session_db = None
        should_close = False
        try:
            session_db = db
            if not session_db:
                session_db, should_close = self._get_session(user_id)
            
            if not session_db:
                logger.error(f"Could not get database session for generate_research_persona (user {user_id})")
                return None

            logger.info(f"Generating research persona for user {user_id}")
            
            # Collect onboarding data
            onboarding_data = self._collect_onboarding_data(user_id, session_db)
            
            if not onboarding_data:
                logger.warning(f"Insufficient onboarding data for user {user_id}")
                return None
            
            # Build prompt
            prompt = self.prompt_builder.build_research_persona_prompt(onboarding_data)
            
            # Get JSON schema for structured response
            json_schema = self.prompt_builder.get_json_schema()
            
            # Call LLM with structured JSON response
            logger.info(f"Calling LLM for research persona generation (user: {user_id})")
            try:
                response_text = llm_text_gen(
                    prompt=prompt,
                    json_struct=json_schema,
                    user_id=user_id
                )
            except HTTPException:
                # Re-raise HTTPExceptions (e.g., 429 subscription limit) so they propagate to API
                logger.warning(f"HTTPException during LLM call for user {user_id} - re-raising")
                raise
            except RuntimeError as e:
                # Re-raise RuntimeError (subscription limits) as HTTPException
                logger.warning(f"RuntimeError during LLM call for user {user_id}: {e}")
                raise HTTPException(status_code=429, detail=str(e))
            
            if not response_text:
                logger.error("Empty response from LLM")
                return None
            
            # Parse JSON response
            import json
            try:
                # When json_struct is provided, llm_text_gen may return a dict directly
                if isinstance(response_text, dict):
                    # Already parsed, use directly
                    persona_dict = response_text
                elif isinstance(response_text, str):
                    # Handle case where LLM returns markdown-wrapped JSON or plain JSON string
                    response_text = response_text.strip()
                    if response_text.startswith("```json"):
                        response_text = response_text[7:]
                    if response_text.startswith("```"):
                        response_text = response_text[3:]
                    if response_text.endswith("```"):
                        response_text = response_text[:-3]
                    response_text = response_text.strip()
                    
                    persona_dict = json.loads(response_text)
                else:
                    logger.error(f"Unexpected response type from LLM: {type(response_text)}")
                    return None
                
                # Add generated_at timestamp
                persona_dict["generated_at"] = datetime.utcnow().isoformat()
                
                # Validate and create ResearchPersona
                # Log the dict structure for debugging if validation fails
                try:
                    research_persona = ResearchPersona(**persona_dict)
                    logger.info(f"✅ Research persona generated successfully for user {user_id}")
                    
                    # Save the generated persona
                    save_success = self.save_research_persona(user_id, research_persona, session_db)
                    if not save_success:
                        logger.warning(f"Failed to save generated persona for user {user_id}")
                    
                    return research_persona
                except Exception as validation_error:
                    logger.error(f"Failed to validate ResearchPersona from dict: {validation_error}")
                    logger.debug(f"Persona dict keys: {list(persona_dict.keys()) if isinstance(persona_dict, dict) else 'Not a dict'}")
                    logger.debug(f"Persona dict sample: {str(persona_dict)[:500]}")
                    # Re-raise to be caught by outer exception handler
                    raise
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM response as JSON: {e}")
                logger.debug(f"Response text: {response_text[:500] if isinstance(response_text, str) else str(response_text)[:500]}")
                return None
            except Exception as e:
                logger.error(f"Failed to create ResearchPersona from response: {e}")
                return None
                
        except HTTPException:
            # Re-raise HTTPExceptions (e.g., 429 subscription limit) so they propagate to API
            raise
        except Exception as e:
            logger.error(f"Error generating research persona for user {user_id}: {e}")
            return None
        finally:
            if should_close and session_db:
                session_db.close()
    
    def is_cache_valid(self, persona_data: PersonaData) -> bool:
        """
        Check if cached research persona is still valid (within TTL).
        
        Args:
            persona_data: PersonaData database record
            
        Returns:
            True if cache is valid, False otherwise
        """
        if not persona_data.research_persona_generated_at:
            return False
        
        # Check if within TTL
        cache_age = datetime.utcnow() - persona_data.research_persona_generated_at
        is_valid = cache_age < timedelta(days=self.CACHE_TTL_DAYS)
        
        if not is_valid:
            logger.debug(f"Cache expired (age: {cache_age.days} days, TTL: {self.CACHE_TTL_DAYS} days)")
        
        return is_valid
    
    def save_research_persona(
        self, 
        user_id: str, 
        research_persona: ResearchPersona,
        db=None
    ) -> bool:
        """
        Save research persona to database.
        
        Args:
            user_id: User ID (Clerk string)
            research_persona: ResearchPersona to save
            db: Optional database session
            
        Returns:
            True if successful, False otherwise
        """
        session_db = None
        should_close = False
        try:
            session_db = db
            if not session_db:
                session_db, should_close = self._get_session(user_id)
            
            if not session_db:
                logger.error(f"Could not get database session for save_research_persona (user {user_id})")
                return False

            persona_data = self._get_persona_data_record(user_id, session_db)
            
            if not persona_data:
                logger.error(f"No persona data record found for user {user_id}")
                return False
            
            # Convert ResearchPersona to dict for JSON storage
            persona_dict = research_persona.dict()
            
            # Update database record
            persona_data.research_persona = persona_dict
            persona_data.research_persona_generated_at = datetime.utcnow()
            
            session_db.commit()
            
            logger.info(f"✅ Research persona saved for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving research persona for user {user_id}: {e}")
            if session_db:
                session_db.rollback()
            return False
        finally:
            if should_close and session_db:
                session_db.close()
    
    def _get_persona_data_record(self, user_id: str, db=None) -> Optional[PersonaData]:
        """Get PersonaData database record for user."""
        try:
            session_db = db or self.db
            if not session_db:
                logger.error(f"No database session provided for _get_persona_data_record (user {user_id})")
                return None

            # Ensure research_persona columns exist before querying
            self._ensure_research_persona_columns(session_db)
            
            # Get onboarding session
            session = session_db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).first()
            
            if not session:
                return None
            
            # Get persona data
            persona_data = session_db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            return persona_data
            
        except Exception as e:
            logger.error(f"Error getting persona data record for user {user_id}: {e}")
            return None
    
    def _collect_onboarding_data(self, user_id: str, db=None) -> Optional[Dict[str, Any]]:
        """
        Collect all onboarding data needed for research persona generation.
        
        Returns:
            Dictionary with website_analysis, persona_data, research_preferences, business_info
        """
        try:
            session_db = db or self.db
            if not session_db:
                logger.error(f"No database session provided for _collect_onboarding_data (user {user_id})")
                return None
                
            # Get integrated data via SSOT
            integrated_data = self.integration_service.get_integrated_data_sync(user_id, session_db)
            
            if not integrated_data:
                logger.warning(f"No integrated data found for user {user_id}")
                return None
                
            website_analysis = integrated_data.get('website_analysis', {})
            persona_data_dict = integrated_data.get('persona_data', {})
            research_prefs = integrated_data.get('research_preferences', {})
            canonical_profile = integrated_data.get('canonical_profile', {})
            
            business_info = {}
            canonical_business = canonical_profile.get('business_info')
            if isinstance(canonical_business, dict):
                business_info.update(canonical_business)

            # E.3 (deferred): STRUCTURED consumer — read canonical_profile.brand_voice ONLY
            # (unified persona-or-website, §2.2); this file's own business_info/canonical
            # logic is the migration shim, removed at E.4.
            # Use canonical profile data (SSOT) instead of manual logic if possible
            # The canonical profile already handles logic for industry/target_audience from various sources
            if not business_info.get('industry') and canonical_profile.get('industry'):
                 business_info['industry'] = canonical_profile.get('industry')
            
            if not business_info.get('target_audience') and canonical_profile.get('target_audience'):
                 business_info['target_audience'] = canonical_profile.get('target_audience')
            
            # Fallback logic if canonical profile is missing these (though it should have them)
            if not business_info.get('industry') and website_analysis:
                target_audience_data = website_analysis.get('target_audience', {})
                if isinstance(target_audience_data, dict):
                    industry_focus = target_audience_data.get('industry_focus')
                    if industry_focus:
                        business_info['industry'] = industry_focus
            
            has_basic_data = bool(
                website_analysis or
                persona_data_dict or
                research_prefs.get('content_types') or
                business_info.get('industry')
            )

            if not has_basic_data:
                logger.warning(f"Insufficient onboarding data for user {user_id} - no basic data found")
                return None

            # If we have minimal data, add intelligent defaults to help the AI
            if not business_info.get('industry'):
                # Try to infer industry from research preferences or content types
                content_types = research_prefs.get('content_types', [])
                if 'blog' in content_types or 'article' in content_types:
                    business_info['industry'] = 'Content Marketing'
                    business_info['inferred'] = True
                elif 'social_media' in content_types:
                    business_info['industry'] = 'Social Media Marketing'
                    business_info['inferred'] = True
                elif 'video' in content_types:
                    business_info['industry'] = 'Video Content Creation'
                    business_info['inferred'] = True

            if not business_info.get('target_audience'):
                # Default to professionals for content creators
                business_info['target_audience'] = 'Professionals and content consumers'
                business_info['inferred'] = True
            
            # Get competitor analysis data (if available)
            # Use SSOT (Integrated data contains competitor info)
            competitor_analysis = integrated_data.get('competitor_analysis')
            if not competitor_analysis:
                competitor_analysis = []
            
            return {
                "website_analysis": website_analysis,
                "persona_data": persona_data_dict,
                "research_preferences": research_prefs,
                "business_info": business_info,
                "competitor_analysis": competitor_analysis
            }
            
        except Exception as e:
            logger.error(f"Error collecting onboarding data for user {user_id}: {e}")
            return None
