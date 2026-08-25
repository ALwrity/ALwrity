"""
Seed the seo_action_types table with the canonical set of SEO actions.

Run (from backend/):
  python scripts/seed_seo_action_types.py
"""

from typing import List, Dict
from loguru import logger
import sys, os

# Ensure backend/ is on sys.path when running as a script
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services.database import init_database, get_db_session
from models.seo_analysis import SEOActionType


def get_actions() -> List[Dict]:
    return [
        {
            "code": "analyze_seo_comprehensive",
            "name": "Analyze SEO (Comprehensive)",
            "category": "analysis",
            "description": "Perform a comprehensive SEO analysis across technical, on-page, and performance.",
        },
        {
            "code": "generate_meta_descriptions",
            "name": "Generate Meta Descriptions",
            "category": "content",
            "description": "Generate optimized meta description suggestions for pages.",
        },
        {
            "code": "analyze_page_speed",
            "name": "Analyze Page Speed",
            "category": "performance",
            "description": "Run page speed and Core Web Vitals checks for mobile/desktop.",
        },
        {
            "code": "analyze_sitemap",
            "name": "Analyze Sitemap",
            "category": "discovery",
            "description": "Analyze sitemap structure, coverage, and publishing patterns.",
        },
        {
            "code": "generate_image_alt_text",
            "name": "Generate Image Alt Text",
            "category": "content",
            "description": "Propose SEO-friendly alt text for images.",
        },
        {
            "code": "generate_opengraph_tags",
            "name": "Generate OpenGraph Tags",
            "category": "content",
            "description": "Create OpenGraph/Twitter meta tags for better social previews.",
        },
        {
            "code": "analyze_on_page_seo",
            "name": "Analyze On-Page SEO",
            "category": "on_page",
            "description": "Audit titles, headings, keyword usage, and internal links.",
        },
        {
            "code": "analyze_technical_seo",
            "name": "Analyze Technical SEO",
            "category": "technical",
            "description": "Audit crawlability, canonicals, schema, security, and redirects.",
        },
        {
            "code": "analyze_enterprise_seo",
            "name": "Analyze Enterprise SEO",
            "category": "enterprise",
            "description": "Advanced enterprise-level audits and recommendations.",
        },
        {
            "code": "analyze_content_strategy",
            "name": "Analyze Content Strategy",
            "category": "content",
            "description": "Analyze content themes, gaps, and strategy effectiveness.",
        },
        {
            "code": "perform_website_audit",
            "name": "Perform Website Audit",
            "category": "analysis",
            "description": "Holistic website audit with prioritized issues and actions.",
        },
        {
            "code": "analyze_content_comprehensive",
            "name": "Analyze Content (Comprehensive)",
            "category": "content",
            "description": "Deep content analysis including readability and structure.",
        },
        {
            "code": "check_seo_health",
            "name": "Check SEO Health",
            "category": "analysis",
            "description": "Quick health check and score snapshot.",
        },
        {
            "code": "explain_seo_concept",
            "name": "Explain SEO Concept",
            "category": "education",
            "description": "Explain SEO concepts in simple terms with examples.",
        },
        {
            "code": "update_seo_charts",
            "name": "Update SEO Charts",
            "category": "visualization",
            "description": "Update dashboard charts and visualizations per user request.",
        },
        {
            "code": "customize_seo_dashboard",
            "name": "Customize SEO Dashboard",
            "category": "visualization",
            "description": "Modify dashboard layout, widgets, and focus areas.",
        },
        {
            "code": "analyze_seo_full",
            "name": "Analyze SEO (Full)",
            "category": "analysis",
            "description": "Full analysis variant (alternate flow or endpoint).",
        },
    ]


def seed_action_types():
    init_database()
    db = get_db_session()
    if db is None:
        raise RuntimeError("Could not get DB session")

    try:
        actions = get_actions()
        created, updated, skipped = 0, 0, 0
        for action in actions:
            existing = db.query(SEOActionType).filter(SEOActionType.code == action["code"]).one_or_none()
            if existing:
                # Update name/category/description if changed
                changed = False
                if existing.name != action["name"]:
                    existing.name = action["name"]; changed = True
                if existing.category != action["category"]:
                    existing.category = action["category"]; changed = True
                if existing.description != action["description"]:
                    existing.description = action["description"]; changed = True
                if changed:
                    updated += 1
                else:
                    skipped += 1
            else:
                db.add(SEOActionType(**action))
                created += 1
        db.commit()
        logger.info(f"SEO action types seeding done. created={created}, updated={updated}, unchanged={skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_action_types()


