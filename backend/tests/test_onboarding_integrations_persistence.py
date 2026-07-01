"""Test onboarding integrations persistence.

Verifies that the PlatformIntegration model correctly stores the
full integrations payload from Step 1, including LinkedIn in
social_platforms and connected_platforms.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture(scope="module")
def engine():
    from models.onboarding import Base
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session


class TestPlatformIntegrationPersistence:

    def test_save_and_retrieve_full_integrations(self, db):
        from models.onboarding import OnboardingSession, PlatformIntegration

        session = OnboardingSession(user_id="test_user_clerk_123")
        db.add(session)
        db.flush()

        pi = PlatformIntegration(
            session_id=session.id,
            primary_website="https://example.com",
            website_platforms={
                "wix": [{"url": "https://mywixsite.com", "name": "Wix Site"}],
                "wordpress": [],
                "primaryWebsite": "https://mywixsite.com",
            },
            analytics_platforms={
                "gsc": {
                    "connected": True,
                    "sites": [{"siteUrl": "https://example.com"}],
                },
                "bing": {
                    "connected": False,
                    "sites": [],
                },
            },
            social_platforms={"linkedin": True},
            connected_platforms=["wix", "gsc", "linkedin"],
        )
        db.add(pi)
        db.commit()

        saved = db.query(PlatformIntegration).filter_by(session_id=session.id).first()

        assert saved is not None
        assert saved.primary_website == "https://example.com"
        assert saved.website_platforms["wix"][0]["url"] == "https://mywixsite.com"
        assert saved.website_platforms["primaryWebsite"] == "https://mywixsite.com"
        assert saved.analytics_platforms["gsc"]["connected"] is True
        assert saved.analytics_platforms["gsc"]["sites"][0]["siteUrl"] == "https://example.com"
        assert saved.analytics_platforms["bing"]["connected"] is False
        assert saved.social_platforms == {"linkedin": True}
        assert "linkedin" in saved.connected_platforms
        assert "wix" in saved.connected_platforms
        assert "gsc" in saved.connected_platforms
        assert len(saved.connected_platforms) == 3

    def test_empty_integrations_defaults(self, db):
        from models.onboarding import OnboardingSession, PlatformIntegration

        session = OnboardingSession(user_id="test_user_empty")
        db.add(session)
        db.flush()

        pi = PlatformIntegration(
            session_id=session.id,
            primary_website=None,
            website_platforms={},
            analytics_platforms={},
            social_platforms={},
            connected_platforms=[],
        )
        db.add(pi)
        db.commit()

        saved = db.query(PlatformIntegration).filter_by(session_id=session.id).first()
        assert saved is not None
        assert saved.primary_website is None
        assert saved.social_platforms == {}
        assert saved.connected_platforms == []

    def test_linkedin_in_social_and_connected(self, db):
        from models.onboarding import OnboardingSession, PlatformIntegration

        session = OnboardingSession(user_id="test_user_linkedin_only")
        db.add(session)
        db.flush()

        pi = PlatformIntegration(
            session_id=session.id,
            primary_website=None,
            website_platforms={},
            analytics_platforms={},
            social_platforms={"linkedin": True},
            connected_platforms=["linkedin"],
        )
        db.add(pi)
        db.commit()

        saved = db.query(PlatformIntegration).filter_by(session_id=session.id).first()
        assert saved.social_platforms == {"linkedin": True}
        assert saved.connected_platforms == ["linkedin"]

    def test_roundtrip_primary_site_selection(self, db):
        from models.onboarding import OnboardingSession, PlatformIntegration

        session = OnboardingSession(user_id="test_user_primary")
        db.add(session)
        db.flush()

        pi = PlatformIntegration(
            session_id=session.id,
            primary_website="https://chosen-site.com",
            website_platforms={
                "wix": [{"url": "https://wix-site.com", "name": "Wix Site"}],
                "wordpress": [{"url": "https://wp-site.com", "name": "WP Site"}],
                "primaryWebsite": "https://wix-site.com",
            },
            analytics_platforms={},
            social_platforms={},
            connected_platforms=["wix", "wordpress"],
        )
        db.add(pi)
        db.commit()

        saved = db.query(PlatformIntegration).filter_by(session_id=session.id).first()
        assert saved.primary_website == "https://chosen-site.com"
        assert "wix" in saved.connected_platforms
        assert "wordpress" in saved.connected_platforms
