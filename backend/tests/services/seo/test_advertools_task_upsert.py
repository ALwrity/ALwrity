"""Tests for the canonical AdvertoolsTask atomic upsert + DB unique constraint.

The RCA failure mode was duplicate ``content_audit`` rows (same user, site,
type), each running the full sitemap pipeline concurrently. The definitive fix
combines:
  1. A DB-level UNIQUE constraint on (user_id, website_url, task_type).
  2. A single atomic upsert (IntegrityError-safe) that every creation path uses.

These tests pin the new invariant and the race-safety of the helper.
"""

import importlib
import shutil
from uuid import uuid4

import pytest

db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user

WEBSITE_URL = "https://acme-corp.example.com"


@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture
def user_db(workspace_redirect):
    user_id = f"upsert_{uuid4().hex[:10]}"
    db = get_session_for_user(user_id)
    ctx = {"user_id": user_id, "db": db, "workspace": workspace_redirect}
    try:
        yield ctx
    finally:
        try:
            db.close()
        finally:
            engine = db_engine_mod._user_engines.pop(user_id, None)
            if engine is not None:
                engine.dispose()
            shutil.rmtree(str(workspace_redirect), ignore_errors=True)


class TestTaskTypeDerivation:
    def test_payload_type_derives_task_type(self, user_db):
        from models.advertools_monitoring_models import AdvertoolsTask

        user_id, db = user_db["user_id"], user_db["db"]
        row = AdvertoolsTask(
            user_id=user_id,
            website_url=WEBSITE_URL,
            payload={"type": "site_health", "website_url": WEBSITE_URL},
        )
        assert row.task_type == "site_health"
        row.payload = {"type": "content_audit", "website_url": WEBSITE_URL}
        assert row.task_type == "content_audit"


class TestUpsertAtomicity:
    def test_create_then_mutation_updates_same_row(self, user_db):
        """Repeated upsert for (user, site, type) updates the SAME row; the
        count never grows, even across commit boundaries."""
        from services.seo.advertools_task_upsert import upsert_advertools_task
        from models.advertools_monitoring_models import AdvertoolsTask

        user_id, db = user_db["user_id"], user_db["db"]
        r1 = upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"status": "active", "payload": {"website_url": WEBSITE_URL}},
        )
        db.commit()
        r2 = upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"status": "paused", "payload": {"website_url": WEBSITE_URL}},
        )
        db.commit()
        assert r2.id == r1.id
        rows = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id,
            AdvertoolsTask.task_type == "content_audit",
        ).all()
        assert len(rows) == 1
        assert rows[0].status == "paused"
        assert rows[0].task_type == "content_audit"

    def test_upsert_updates_existing_row_inserted_elsewhere(self, user_db):
        """If a row already exists for the key (e.g. created by restoration or
        onboarding), upsert finds and updates it rather than erroring or
        duplicating — this is the race-safe coexist path."""
        from services.seo.advertools_task_upsert import upsert_advertools_task
        from models.advertools_monitoring_models import AdvertoolsTask

        user_id, db = user_db["user_id"], user_db["db"]
        existing = AdvertoolsTask(
            user_id=user_id,
            website_url=WEBSITE_URL,
            status="active",
            payload={"type": "content_audit", "website_url": WEBSITE_URL},
        )
        db.add(existing)
        db.commit()

        row = upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"status": "running", "payload": {"website_url": WEBSITE_URL}},
        )
        db.commit()
        assert row.id == existing.id
        db.refresh(existing)
        assert existing.status == "running"
        assert len(db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id
        ).all()) == 1

    def test_different_types_coexist(self, user_db):
        """content_audit and site_health are independent pipelines and both
        rows may exist for the same site."""
        from services.seo.advertools_task_upsert import upsert_advertools_task
        from models.advertools_monitoring_models import AdvertoolsTask

        user_id, db = user_db["user_id"], user_db["db"]
        upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"payload": {"website_url": WEBSITE_URL}},
        )
        upsert_advertools_task(
            db, user_id, WEBSITE_URL, "site_health",
            defaults={"payload": {"website_url": WEBSITE_URL}},
        )
        db.commit()
        types = [
            r.task_type for r in db.query(AdvertoolsTask).filter(
                AdvertoolsTask.user_id == user_id
            ).all()
        ]
        assert sorted(types) == ["content_audit", "site_health"]


class TestSchemaUniqueConstraint:
    def test_duplicate_insert_rejected_by_db(self, user_db):
        """Two rows with the same (user, site, type) cannot both persist: the
        DB-level unique constraint rejects the second insert."""
        from sqlalchemy.exc import IntegrityError
        from services.seo.advertools_task_upsert import upsert_advertools_task
        from models.advertools_monitoring_models import AdvertoolsTask

        user_id, db = user_db["user_id"], user_db["db"]
        upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"payload": {"website_url": WEBSITE_URL}},
        )
        db.commit()

        dup = AdvertoolsTask(
            user_id=user_id,
            website_url=WEBSITE_URL,
            status="active",
            payload={"type": "content_audit", "website_url": WEBSITE_URL},
        )
        db.add(dup)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

        rows = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id,
            AdvertoolsTask.task_type == "content_audit",
        ).all()
        assert len(rows) == 1
