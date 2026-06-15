"""
Ricos Document Converter for Wix

Converts markdown content to Wix Ricos JSON format using either:
1. Wix's official Ricos Documents API (preferred)
2. Custom markdown parser (fallback)
"""

import json
import requests
import jwt
from typing import Dict, Any, Optional
from loguru import logger


def markdown_to_html(markdown_content: str) -> str:
    """
    Convert markdown content to HTML.
    Uses a simple markdown parser for basic conversion.
    
    Args:
        markdown_content: Markdown content to convert
        
    Returns:
        HTML string
    """
    try:
        # Try using markdown library if available
        import markdown
        html = markdown.markdown(markdown_content, extensions=['fenced_code', 'tables'])
        return html
    except ImportError:
        # Fallback: Simple regex-based conversion for basic markdown
        logger.warning("markdown library not available, using basic markdown-to-HTML conversion")
        import re
        
        if not markdown_content or not markdown_content.strip():
            return "<p>This is a post from ALwrity.</p>"
        
        lines = markdown_content.split('\n')
        result = []
        in_list = False
        list_type = None  # 'ul' or 'ol'
        in_code_block = False
        code_block_content = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Handle code blocks first
            if line.startswith('```'):
                if not in_code_block:
                    in_code_block = True
                    code_block_content = []
                    i += 1
                    continue
                else:
                    in_code_block = False
                    code_html = "\n".join(code_block_content)
                    result.append(f'<pre><code>{code_html}</code></pre>')
                    code_block_content = []
                    i += 1
                    continue
            
            if in_code_block:
                code_block_content.append(lines[i])
                i += 1
                continue
            
            # Close any open lists
            if in_list and not (line.startswith('- ') or line.startswith('* ') or re.match(r'^\d+\.\s+', line)):
                result.append(f'</{list_type}>')
                in_list = False
                list_type = None
            
            if not line:
                i += 1
                continue
            
            # Headers
            if line.startswith('###'):
                result.append(f'<h3>{line[3:].strip()}</h3>')
            elif line.startswith('##'):
                result.append(f'<h2>{line[2:].strip()}</h2>')
            elif line.startswith('#'):
                result.append(f'<h1>{line[1:].strip()}</h1>')
            # Lists
            elif line.startswith('- ') or line.startswith('* '):
                if not in_list or list_type != 'ul':
                    if in_list:
                        result.append(f'</{list_type}>')
                    result.append('<ul>')
                    in_list = True
                    list_type = 'ul'
                # Process inline formatting in list item
                item_text = line[2:].strip()
                item_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', item_text)
                item_text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', item_text)
                result.append(f'<li>{item_text}</li>')
            elif re.match(r'^\d+\.\s+', line):
                if not in_list or list_type != 'ol':
                    if in_list:
                        result.append(f'</{list_type}>')
                    result.append('<ol>')
                    in_list = True
                    list_type = 'ol'
                # Process inline formatting in list item
                match = re.match(r'^\d+\.\s+(.*)', line)
                if match:
                    item_text = match.group(1)
                    item_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', item_text)
                    item_text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', item_text)
                    result.append(f'<li>{item_text}</li>')
            # Blockquotes
            elif line.startswith('>'):
                quote_text = line[1:].strip()
                quote_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', quote_text)
                quote_text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', quote_text)
                result.append(f'<blockquote><p>{quote_text}</p></blockquote>')
            # Regular paragraphs
            else:
                para_text = line
                # Process inline formatting
                para_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', para_text)
                para_text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', para_text)
                para_text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', para_text)
                para_text = re.sub(r'`([^`]+)`', r'<code>\1</code>', para_text)
                result.append(f'<p>{para_text}</p>')
            
            i += 1
        
        # Close any open lists
        if in_list:
            result.append(f'</{list_type}>')
        
        # Ensure we have at least one paragraph
        if not result:
            result.append('<p>This is a post from ALwrity.</p>')
        
        html = '\n'.join(result)
        
        logger.debug(f"Converted {len(markdown_content)} chars markdown to {len(html)} chars HTML")
        return html


def convert_via_wix_api(markdown_content: str, access_token: str, base_url: str = 'https://www.wixapis.com') -> Dict[str, Any]:
    """
    Convert markdown to Ricos using Wix's official Ricos Documents API.
    Uses HTML format for better reliability (per Wix documentation, HTML is fully supported).
    
    Wix API Limitation: HTML content must be 10,000 characters or less.
    If content exceeds this limit, it will be truncated with an ellipsis.
    
    Reference: https://dev.wix.com/docs/api-reference/assets/rich-content/ricos-documents/convert-to-ricos-document
    
    Args:
        markdown_content: Markdown content to convert (will be converted to HTML)
        access_token: Wix access token
        base_url: Wix API base URL (default: https://www.wixapis.com)
        
    Returns:
        Ricos JSON document
    """
    # Validate content is not empty
    markdown_stripped = markdown_content.strip() if markdown_content else ""
    if not markdown_stripped:
        logger.error("Markdown content is empty or whitespace-only")
        raise ValueError("Content cannot be empty for Wix Ricos API conversion")
    
    logger.debug(f"Converting markdown to HTML: input_length={len(markdown_stripped)} chars")
    
    # Convert markdown to HTML for better reliability with Wix API
    # HTML format is more structured and less prone to parsing errors
    html_content = markdown_to_html(markdown_stripped)
    
    # Validate HTML content is not empty - CRITICAL for Wix API
    html_stripped = html_content.strip() if html_content else ""
    if not html_stripped or len(html_stripped) == 0:
        logger.error(f"HTML conversion produced empty content! Markdown length: {len(markdown_stripped)}")
        logger.error(f"Markdown sample: {markdown_stripped[:500]}...")
        logger.error(f"HTML result: '{html_content}' (type: {type(html_content)})")
        # Fallback: use a minimal valid HTML if conversion failed
        html_content = "<p>Content from ALwrity blog writer.</p>"
        logger.warning("Using fallback HTML due to empty conversion result")
    else:
        html_content = html_stripped
    
    # CRITICAL: Wix API has a 10,000 character limit for HTML content
    # If content exceeds this limit, truncate intelligently at paragraph boundaries
    MAX_HTML_LENGTH = 10000
    if len(html_content) > MAX_HTML_LENGTH:
        logger.warning(f"⚠️ HTML content ({len(html_content)} chars) exceeds Wix API limit of {MAX_HTML_LENGTH} chars")
        
        # Try to truncate at a paragraph boundary to avoid breaking HTML tags
        truncate_at = MAX_HTML_LENGTH - 100  # Leave room for closing tags and ellipsis
        
        # Look for the last </p> tag before the truncation point
        last_p_close = html_content.rfind('</p>', 0, truncate_at)
        if last_p_close > 0:
            html_content = html_content[:last_p_close + 4]  # Include the </p> tag
        else:
            # If no paragraph boundary found, just truncate
            html_content = html_content[:truncate_at]
        
        # Add an ellipsis paragraph to indicate truncation
        html_content += '<p><em>... (Content truncated due to length constraints)</em></p>'
        
        logger.warning(f"✅ Truncated HTML to {len(html_content)} chars (at paragraph boundary)")
    
    logger.debug(f"✅ Converted markdown to HTML: {len(html_content)} chars, preview: {html_content[:200]}...")
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    # Add wix-site-id if available from token
    try:
        token_str = str(access_token)
        if token_str and token_str.startswith('OauthNG.JWS.'):
            jwt_part = token_str[12:]
            payload = jwt.decode(jwt_part, options={"verify_signature": False, "verify_aud": False})
            data_payload = payload.get('data', {})
            if isinstance(data_payload, str):
                try:
                    data_payload = json.loads(data_payload)
                except:
                    pass
            instance_data = data_payload.get('instance', {})
            meta_site_id = instance_data.get('metaSiteId')
            if isinstance(meta_site_id, str) and meta_site_id:
                headers['wix-site-id'] = meta_site_id
    except Exception as e:
        logger.debug(f"Could not extract site ID from token: {e}")
    
    # Call Wix Ricos Documents API: Convert to Ricos Document
    # Official endpoint: https://www.wixapis.com/ricos/v1/ricos-document/convert/to-ricos
    # Reference: https://dev.wix.com/docs/rest/assets/rich-content/ricos-documents/convert-to-ricos-document
    endpoint = f"{base_url}/ricos/v1/ricos-document/convert/to-ricos"
    
    # Ensure HTML content is not empty or just whitespace
    html_stripped = html_content.strip() if html_content else ""
    if not html_stripped or len(html_stripped) == 0:
        logger.error(f"HTML content is empty after conversion. Markdown length: {len(markdown_content)}")
        logger.error(f"Markdown preview (first 500 chars): {markdown_content[:500] if markdown_content else 'N/A'}")
        raise ValueError(f"HTML content cannot be empty. Original markdown had {len(markdown_content)} characters.")
    
    # Payload structure per Wix API: html/markdown/plainText field at root, optional plugins
    payload = {
        'html': html_stripped,  # Direct field, not nested in options
        'plugins': []  # Optional: empty array uses default plugins
    }
    
    logger.warning(f"📤 Sending to Wix Ricos API: html_length={len(payload['html'])}, plugins_count={len(payload['plugins'])}")
    logger.debug(f"HTML preview (first 300 chars): {html_stripped[:300]}...")
    
    try:
        # Log the exact payload being sent (for debugging)
        logger.warning(f"📤 Wix Ricos API Request:")
        logger.warning(f"  Endpoint: {endpoint}")
        logger.warning(f"  Payload keys: {list(payload.keys())}")
        logger.warning(f"  HTML length: {len(payload.get('html', ''))}")
        logger.warning(f"  Plugins: {payload.get('plugins', [])}")
        logger.debug(f"  Full payload (first 500 chars of HTML): {str(payload)[:500]}")
        
        response = requests.post(
            endpoint,
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        
        # Extract the ricos document from response
        # Response structure: { "document": { "nodes": [...], "metadata": {...}, "documentStyle": {...} } }
        ricos_document = result.get('document')
        if not ricos_document:
            # Fallback: try other possible response fields
            ricos_document = result.get('ricosDocument') or result.get('ricos') or result
        
        if not ricos_document:
            logger.error(f"Unexpected response structure from Wix API: {list(result.keys())}")
            logger.error(f"Response: {result}")
            raise ValueError("Wix API did not return a valid Ricos document")
        
        logger.warning(f"✅ Successfully converted HTML to Ricos via Wix API: {len(ricos_document.get('nodes', []))} nodes")
        return ricos_document
        
    except requests.RequestException as e:
        logger.error(f"❌ Wix Ricos API conversion failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"  Response status: {e.response.status_code}")
            logger.error(f"  Response headers: {dict(e.response.headers)}")
            try:
                error_body = e.response.json()
                logger.error(f"  Response JSON: {error_body}")
            except:
                logger.error(f"  Response text: {e.response.text}")
            logger.error(f"  Request payload was: {json.dumps(payload, indent=2)[:1000]}...")  # First 1000 chars
        raise

