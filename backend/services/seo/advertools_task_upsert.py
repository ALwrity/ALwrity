"""
Atomic upsert for AdvertoolsTask rows.

The canonical, single home for creating-or-updating an ``AdvertoolsTask`` row
keyed by ``(user_id, website_url, task_type)``.

History / why this exists:
    Duplicate ``AdvertoolsTask`` rows were produced by a mix of call sites that
    each did a raw ``db.add()`` or a SELECT-then-INSERT that is race-prone.
    Every duplicate row became due and ran the full sitemap/content pipeline
    concurrently, amplifying origin HTTP 429s.

    A DB-level UNIQUE constraint on ``(user_id, website_url, task_type)`` now
    makes duplicates impossible to persist. This helper is the single code path
    every caller goes through; it is also ``IntegrityError``-safe so a
    concurrent create racing for the same key degrades to an update instead of
    crashing.
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from loguru import logger


def upsert_advertools_task(
    db: Session,
    user_id: str,
    website_url: str,
    task_type: str,
    defaults: dict,
) -> "object":
    """Insert-or-update an AdvertoolsTask keyed by (user, site, type).

    Returns the (possibly pre-existing) row. ``defaults`` is a dict of column
    values applied on create **and** on update. A ``payload`` key inside
    ``defaults`` is merged with the type identity rather than passed twice.

    Race-safety: the SELECT-then-INSERT is protected by catching
    ``IntegrityError`` from the DB unique constraint and re-selecting — so two
    concurrent callers for the same key collapse onto one row.
    """
    from models.advertools_monitoring_models import AdvertoolsTask

    def _apply(row, d):
        for key, value in d.items():
            setattr(row, key, value)
        new_payload = {"type": task_type, "website_url": website_url}
        new_payload.update(defaults.get("payload") or {})
        row.payload = new_payload
        row.task_type = task_type
        return row

    # 1) Fast path: existing row.
    existing = db.query(AdvertoolsTask).filter(
        AdvertoolsTask.user_id == user_id,
        AdvertoolsTask.website_url == website_url,
        AdvertoolsTask.task_type == task_type,
    ).first()
    if existing is not None:
        _apply(existing, defaults)
        db.add(existing)
        return existing

    # 2) Create. Race-safe against a concurrent insert for the same key.
    construct_defaults = {k: v for k, v in defaults.items() if k != "payload"}
    row = AdvertoolsTask(
        user_id=user_id,
        website_url=website_url,
        task_type=task_type,
        payload={"type": task_type, "website_url": website_url},
        **construct_defaults,
    )
    _apply(row, defaults)
    db.add(row)
    try:
        # begin_nested() = SAVEPOINT, so an IntegrityError rolls back only the
        # failed INSERT — never the caller's other pending session changes.
        with db.begin_nested():
            db.flush()
        return row
    except IntegrityError:
        logger.info(
            f"[advertools_upsert] IntegrityError on create; re-selecting existing "
            f"row for user={user_id} site={website_url} type={task_type}"
        )
        existing = db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id,
            AdvertoolsTask.website_url == website_url,
            AdvertoolsTask.task_type == task_type,
        ).first()
        if existing is not None:
            _apply(existing, defaults)
            db.add(existing)
            return existing
        raise
    return row
