"""Regression tests for PersonaDataService platform persona persistence.

Locks the fix for the SQLAlchemy JSON mutation-detection bug: saving a new
platform persona when another platform already exists must actually persist,
otherwise "Generate Now" results vanish after a page reload.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _build_session(existing_platform_personas=None):
    from models.base import Base
    from models.onboarding import OnboardingSession, PersonaData

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[OnboardingSession.__table__, PersonaData.__table__])
    session = sessionmaker(bind=engine)()
    sess = OnboardingSession(user_id="user_test", onboarding_type="website")
    session.add(sess)
    session.flush()
    session.add(PersonaData(
        session_id=sess.id,
        core_persona={"identity": {}},
        platform_personas=existing_platform_personas or {},
    ))
    session.commit()
    return session, sess.id


def test_save_platform_persona_persists_when_other_platforms_exist():
    from services.persona_data_service import PersonaDataService

    # Reproduces the bug: platform_personas already contains a platform.
    db, session_id = _build_session(existing_platform_personas={"linkedin": {"platform_type": "linkedin"}})
    service = PersonaDataService(db_session=db)

    assert service.save_platform_persona("user_test", "youtube", {"platform_type": "youtube"}) is True

    db.expire_all()
    loaded = service.get_user_persona_data("user_test")
    platforms = loaded["platform_personas"]
    assert "linkedin" in platforms
    assert "youtube" in platforms
    assert platforms["youtube"]["platform_type"] == "youtube"


def test_update_platform_persona_persists_nested_changes():
    from services.persona_data_service import PersonaDataService

    db, session_id = _build_session(existing_platform_personas={"podcast": {"platform_type": "podcast", "tone": "warm"}})
    service = PersonaDataService(db_session=db)

    assert service.update_platform_persona("user_test", "podcast", {"tone": "crisp"}) is True

    db.expire_all()
    loaded = service.get_user_persona_data("user_test")
    assert loaded["platform_personas"]["podcast"]["tone"] == "crisp"
