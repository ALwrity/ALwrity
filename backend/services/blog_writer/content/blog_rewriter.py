"""
Blog Rewriter Service

Handles blog rewriting based on user feedback using structured AI calls.
"""

import time
import uuid
from datetime import datetime
from typing import Dict, Any
from loguru import logger

from services.llm_providers.gemini_provider import gemini_structured_json_response


class BlogRewriter:
    """Service for rewriting blog content based on user feedback."""
    
    def __init__(self, task_manager):
        self.task_manager = task_manager
    
    def start_blog_rewrite(self, request: Dict[str, Any]) -> str:
        """Start blog rewrite task with user feedback."""
        try:
            # Extract request data
            title = request.get("title", "Untitled Blog")
            sections = request.get("sections", [])
            research = request.get("research", {})
            outline = request.get("outline", [])
            feedback = request.get("feedback", "")
            tone = request.get("tone")
            audience = request.get("audience")
            focus = request.get("focus")
            
            if not sections:
                raise ValueError("No sections provided for rewrite")
            
            if not feedback or len(feedback.strip()) < 10:
                raise ValueError("Feedback is required and must be at least 10 characters")
            
            # Create task for rewrite
            task_id = f"rewrite_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            
            # Start the rewrite task
            self.task_manager.start_task(
                task_id,
                self._execute_blog_rewrite,
                title=title,
                sections=sections,
                research=research,
                outline=outline,
                feedback=feedback,
                tone=tone,
                audience=audience,
                focus=focus
            )
            
            logger.info(f"Blog rewrite task started: {task_id}")
            return task_id
            
        except Exception as e:
            logger.error(f"Failed to start blog rewrite: {e}")
            raise

    async def _execute_blog_rewrite(self, task_id: str, **kwargs):
        """Execute the blog rewrite task."""
        try:
            title = kwargs.get("title", "Untitled Blog")
            sections = kwargs.get("sections", [])
            research = kwargs.get("research", {})
            outline = kwargs.get("outline", [])
            feedback = kwargs.get("feedback", "")
            tone = kwargs.get("tone")
            audience = kwargs.get("audience")
            focus = kwargs.get("focus")
            
            # Update task status
            self.task_manager.update_task_status(task_id, "processing", "Analyzing current content and feedback...")
            
            # Build rewrite prompt with user feedback
            system_prompt = f"""You are an expert blog writer in {datetime.now().year}, tasked with rewriting content based on user feedback. 
            
            Current Blog Title: {title}
            User Feedback: {feedback}
            {f"Desired Tone: {tone}" if tone else ""}
            {f"Target Audience: {audience}" if audience else ""}
            {f"Focus Area: {focus}" if focus else ""}
            
            Your task is to rewrite the blog content to address the user's feedback while maintaining the core structure and research insights."""
            
            # Prepare content for rewrite
            full_content = f"Title: {title}\n\n"
            for section in sections:
                full_content += f"Section: {section.get('heading', 'Untitled')}\n"
                full_content += f"Content: {section.get('content', '')}\n\n"
            
            # Create rewrite prompt
            rewrite_prompt = f"""
            Based on the user feedback and current blog content, rewrite the blog to address their concerns and preferences.
            
            Current Content:
            {full_content}
            
            User Feedback: {feedback}
            {f"Desired Tone: {tone}" if tone else ""}
            {f"Target Audience: {audience}" if audience else ""}
            {f"Focus Area: {focus}" if focus else ""}
            
            Please rewrite the blog content in the following JSON format:
            {{
                "title": "New or improved blog title",
                "sections": [
                    {{
                        "id": "section_id",
                        "heading": "Section heading",
                        "content": "Rewritten section content"
                    }}
                ]
            }}
            
            Guidelines:
            1. Address the user's feedback directly
            2. Maintain the research insights and factual accuracy
            3. Improve flow, clarity, and engagement
            4. Keep the same section structure unless feedback suggests otherwise
            5. Ensure content is well-formatted with proper paragraphs
            """
            
            # Update task status
            self.task_manager.update_task_status(task_id, "processing", "Generating rewritten content...")
            
            # Use structured JSON generation
            schema = {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "sections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "heading": {"type": "string"},
                                "content": {"type": "string"}
                            }
                        }
                    }
                }
            }
            
            result = gemini_structured_json_response(
                prompt=rewrite_prompt,
                schema=schema,
                temperature=0.7,
                max_tokens=4096,
                system_prompt=system_prompt
            )
            
            logger.info(f"Gemini response for rewrite task {task_id}: {result}")
            
            # Check if we have a valid result - handle both multi-section and single-section formats
            is_valid_multi_section = result and not result.get("error") and result.get("title") and result.get("sections")
            is_valid_single_section = result and not result.get("error") and (result.get("heading") or result.get("title")) and result.get("content")
            
            if is_valid_multi_section or is_valid_single_section:
                # If single section format, convert to multi-section format for consistency
                if is_valid_single_section and not is_valid_multi_section:
                    # Convert single section to multi-section format
                    converted_result = {
                        "title": result.get("heading") or result.get("title") or "Rewritten Blog",
                        "sections": [
                            {
                                "id": result.get("id") or "section_1",
                                "heading": result.get("heading") or "Main Content",
                                "content": result.get("content", "")
                            }
                        ]
                    }
                    result = converted_result
                    logger.info(f"Converted single section response to multi-section format for task {task_id}")
                
                # Update task status with success
                self.task_manager.update_task_status(
                    task_id, 
                    "completed", 
                    "Blog rewrite completed successfully!",
                    result=result
                )
                logger.info(f"Blog rewrite completed successfully: {task_id}")
            else:
                # More detailed error handling
                if not result:
                    error_msg = "No response from AI"
                elif result.get("error"):
                    error_msg = f"AI error: {result.get('error')}"
                elif not (result.get("title") or result.get("heading")):
                    error_msg = "AI response missing title/heading"
                elif not (result.get("sections") or result.get("content")):
                    error_msg = "AI response missing sections/content"
                else:
                    error_msg = "AI response has invalid structure"
                
                self.task_manager.update_task_status(task_id, "failed", f"Rewrite failed: {error_msg}")
                logger.error(f"Blog rewrite failed: {error_msg}")
                
        except Exception as e:
            error_msg = f"Blog rewrite error: {str(e)}"
            self.task_manager.update_task_status(task_id, "failed", error_msg)
            logger.error(f"Blog rewrite task failed: {e}")
            raise
