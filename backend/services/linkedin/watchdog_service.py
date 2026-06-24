import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse
from loguru import logger

from models.linkedin_watchdog_models import (
    WatchdogIndustry, WatchdogCompany, WatchdogPerson, WatchdogUpdate,
    WatchdogIndustryCreate, WatchdogCompanyCreate, WatchdogPersonCreate,
)
from models.linkedin_watchdog_db_models import (
    WatchdogIndustryDB, WatchdogCompanyDB, WatchdogPersonDB, WatchdogUpdateDB,
    WatchdogMonitorDB,
)
from services.database import get_session_for_user


class WatchdogService:
    """Manages industry, company, and people watchlists with Exa polling,
    persisted in SQLite, with optional Exa Monitor integration."""

    def __init__(self):
        self._exa_provider = None
        self._exa_monitors = None

    @property
    def exa(self):
        if self._exa_provider is None:
            from services.research.exa_content_research import get_exa_content_provider
            self._exa_provider = get_exa_content_provider()
        return self._exa_provider

    @property
    def exa_monitor_client(self):
        if self._exa_monitors is None:
            from services.research.exa_monitors import get_exa_monitor_client
            self._exa_monitors = get_exa_monitor_client()
        return self._exa_monitors

    # ── Query defaults ──────────────────────────────────────────────

    def _default_industry_queries(self, name: str) -> List[str]:
        return [f"{name} industry news", f"{name} trends developments"]

    def _default_company_queries(self, name: str) -> List[str]:
        return [f"{name} news product launches partnerships", f"{name} funding earnings"]

    def _default_person_queries(self, name: str, title: Optional[str] = None, company: Optional[str] = None) -> List[str]:
        parts = [name]
        if title:
            parts.append(title)
        if company:
            parts.append(company)
        base = " ".join(parts)
        return [f"{base} interview keynote", f"{base} insight opinion"]

    # ── Helpers ─────────────────────────────────────────────────────

    def _get_db(self, user_id: str):
        return get_session_for_user(user_id)

    @staticmethod
    def _industry_to_pydantic(db: WatchdogIndustryDB) -> WatchdogIndustry:
        return WatchdogIndustry(
            id=db.id, user_id=db.user_id, name=db.name,
            search_queries=db.get_search_queries(),
            created_at=db.created_at.isoformat() if db.created_at else datetime.utcnow().isoformat(),
            updated_at=db.updated_at.isoformat() if db.updated_at else datetime.utcnow().isoformat(),
        )

    @staticmethod
    def _company_to_pydantic(db: WatchdogCompanyDB) -> WatchdogCompany:
        return WatchdogCompany(
            id=db.id, user_id=db.user_id, name=db.name,
            url=db.url, industry_tag=db.industry_tag,
            search_queries=db.get_search_queries(),
            created_at=db.created_at.isoformat() if db.created_at else datetime.utcnow().isoformat(),
            updated_at=db.updated_at.isoformat() if db.updated_at else datetime.utcnow().isoformat(),
        )

    @staticmethod
    def _person_to_pydantic(db: WatchdogPersonDB) -> WatchdogPerson:
        return WatchdogPerson(
            id=db.id, user_id=db.user_id, name=db.name,
            title=db.title, company=db.company, linkedin_url=db.linkedin_url,
            search_queries=db.get_search_queries(),
            created_at=db.created_at.isoformat() if db.created_at else datetime.utcnow().isoformat(),
            updated_at=db.updated_at.isoformat() if db.updated_at else datetime.utcnow().isoformat(),
        )

    @staticmethod
    def _update_to_pydantic(db: WatchdogUpdateDB) -> WatchdogUpdate:
        return WatchdogUpdate(
            id=db.id, user_id=db.user_id, category=db.category,
            reference_id=db.reference_id, reference_name=db.reference_name,
            title=db.title, url=db.url, summary=db.summary or "",
            source=db.source or "",
            published_date=db.published_date,
            is_read=db.is_read,
            created_at=db.created_at.isoformat() if db.created_at else datetime.utcnow().isoformat(),
        )

    # ── Exa Monitor lifecycle ───────────────────────────────────────

    async def _ensure_monitor(self, user_id: str, category: str,
                              reference_id: str, reference_name: str,
                              search_query: str, webhook_url: str,
                              trigger_period: str = "1d") -> Optional[str]:
        """Create an Exa Monitor for a search query, returning the monitor ID.
        Returns None on failure (logged, not raised)."""
        try:
            result = await self.exa_monitor_client.create_monitor(
                name=f"{category}: {reference_name[:60]}",
                query=search_query,
                webhook_url=webhook_url,
                num_results=5,
                trigger_period=trigger_period,
                metadata={
                    "user_id": user_id,
                    "category": category,
                    "reference_id": reference_id,
                    "reference_name": reference_name,
                },
                user_id=user_id,
            )
            monitor_id = result.get("id")
            webhook_secret = result.get("webhookSecret")

            if monitor_id:
                db = self._get_db(user_id)
                try:
                    row = WatchdogMonitorDB(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        exa_monitor_id=monitor_id,
                        category=category,
                        reference_id=reference_id,
                        search_query=search_query,
                        trigger_period=trigger_period,
                        status="active",
                        webhook_secret=webhook_secret,
                    )
                    db.add(row)
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.warning(f"[Watchdog] Failed to persist monitor mapping for {monitor_id}")
                finally:
                    db.close()

            return monitor_id
        except Exception as e:
            logger.error(f"[Watchdog] Failed to create Exa Monitor for '{search_query[:60]}': {e}")
            return None

    async def _delete_monitors_for(self, user_id: str, category: str, reference_id: str):
        """Delete all Exa Monitors associated with a watched item."""
        db = self._get_db(user_id)
        try:
            rows = db.query(WatchdogMonitorDB).filter(
                WatchdogMonitorDB.user_id == user_id,
                WatchdogMonitorDB.category == category,
                WatchdogMonitorDB.reference_id == reference_id,
            ).all()

            for row in rows:
                try:
                    await self.exa_monitor_client.delete_monitor(
                        row.exa_monitor_id, user_id=user_id
                    )
                except Exception as e:
                    logger.warning(f"[Watchdog] Failed to delete Exa Monitor {row.exa_monitor_id}: {e}")
                db.delete(row)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    async def _create_monitors_for(self, user_id: str, category: str,
                                   reference_id: str, reference_name: str,
                                   search_queries: List[str],
                                   webhook_url: str):
        """Create Exa Monitors for each search query of a watched item."""
        for query in search_queries:
            await self._ensure_monitor(
                user_id=user_id, category=category,
                reference_id=reference_id, reference_name=reference_name,
                search_query=query, webhook_url=webhook_url,
            )

    async def sync_monitors(self, user_id: str, webhook_url: str):
        """Ensure all watched items have active Exa Monitors.

        Creates monitors for any item missing one. Does not create
        duplicates for items that already have active monitors.
        """
        db = self._get_db(user_id)
        try:
            # Get existing monitor query set
            existing = {
                (r.category, r.reference_id, r.search_query)
                for r in db.query(WatchdogMonitorDB).filter(
                    WatchdogMonitorDB.user_id == user_id,
                    WatchdogMonitorDB.status == "active",
                ).all()
            }

            counts = {"industries": 0, "companies": 0, "people": 0}

            for industry in db.query(WatchdogIndustryDB).filter(
                    WatchdogIndustryDB.user_id == user_id).all():
                for query in industry.get_search_queries():
                    if ("industry", industry.id, query) not in existing:
                        await self._ensure_monitor(
                            user_id, "industry", industry.id, industry.name,
                            query, webhook_url,
                        )
                        counts["industries"] += 1

            for company in db.query(WatchdogCompanyDB).filter(
                    WatchdogCompanyDB.user_id == user_id).all():
                for query in company.get_search_queries():
                    if ("company", company.id, query) not in existing:
                        await self._ensure_monitor(
                            user_id, "company", company.id, company.name,
                            query, webhook_url,
                        )
                        counts["companies"] += 1

            for person in db.query(WatchdogPersonDB).filter(
                    WatchdogPersonDB.user_id == user_id).all():
                for query in person.get_search_queries():
                    if ("person", person.id, query) not in existing:
                        await self._ensure_monitor(
                            user_id, "person", person.id, person.name,
                            query, webhook_url,
                        )
                        counts["people"] += 1

            logger.info(f"[Watchdog] Sync complete for {user_id}: {counts}")
            return counts
        finally:
            db.close()

    async def trigger_all_monitors(self, user_id: str) -> int:
        """Manually trigger all active Exa Monitors. Returns count triggered."""
        db = self._get_db(user_id)
        try:
            rows = db.query(WatchdogMonitorDB).filter(
                WatchdogMonitorDB.user_id == user_id,
                WatchdogMonitorDB.status == "active",
            ).all()
            triggered = 0
            for row in rows:
                try:
                    await self.exa_monitor_client.trigger_run(
                        row.exa_monitor_id, user_id=user_id
                    )
                    row.last_run_at = datetime.utcnow()
                    triggered += 1
                except Exception as e:
                    logger.warning(f"[Watchdog] Trigger failed for monitor {row.exa_monitor_id}: {e}")
            db.commit()
            logger.info(f"[Watchdog] Triggered {triggered}/{len(rows)} monitors for {user_id}")
            return triggered
        except Exception:
            db.rollback()
            return 0
        finally:
            db.close()

    async def poll_monitor_results(self, user_id: str) -> List[WatchdogUpdate]:
        """Poll Exa Monitor runs for new results since last poll.

        Checks the most recent completed run for each active monitor
        and stores any new results as WatchdogUpdate rows.
        """
        db = self._get_db(user_id)
        try:
            existing_urls = {
                row.url for row in db.query(WatchdogUpdateDB.url).filter(
                    WatchdogUpdateDB.user_id == user_id
                ).all()
            }
            new_updates = []

            monitors = db.query(WatchdogMonitorDB).filter(
                WatchdogMonitorDB.user_id == user_id,
                WatchdogMonitorDB.status == "active",
            ).all()

            for monitor in monitors:
                try:
                    runs = await self.exa_monitor_client.list_runs(
                        monitor.exa_monitor_id, limit=1, user_id=user_id
                    )
                    if not runs:
                        continue
                    latest_run = runs[0]
                    run_id = latest_run.get("id")
                    if not run_id:
                        continue

                    monitor.last_run_at = datetime.utcnow()

                    # Resolve reference name from the appropriate watchlist table
                    ref_name = ""
                    if monitor.category == "industry":
                        ref_row = db.query(WatchdogIndustryDB).filter(
                            WatchdogIndustryDB.id == monitor.reference_id,
                            WatchdogIndustryDB.user_id == user_id,
                        ).first()
                        if ref_row:
                            ref_name = ref_row.name
                    elif monitor.category == "company":
                        ref_row = db.query(WatchdogCompanyDB).filter(
                            WatchdogCompanyDB.id == monitor.reference_id,
                            WatchdogCompanyDB.user_id == user_id,
                        ).first()
                        if ref_row:
                            ref_name = ref_row.name
                    elif monitor.category == "person":
                        ref_row = db.query(WatchdogPersonDB).filter(
                            WatchdogPersonDB.id == monitor.reference_id,
                            WatchdogPersonDB.user_id == user_id,
                        ).first()
                        if ref_row:
                            ref_name = ref_row.name

                    results = await self.exa_monitor_client.get_run_results(
                        monitor.exa_monitor_id, run_id, user_id=user_id
                    )
                    for result in results:
                        url = result.get("url", "")
                        if url and url not in existing_urls:
                            existing_urls.add(url)
                            new_updates.append(WatchdogUpdate(
                                id=str(uuid.uuid4()), user_id=user_id,
                                category=monitor.category,
                                reference_id=monitor.reference_id,
                                reference_name=ref_name,
                                title=result.get("title", "Untitled"),
                                url=url,
                                summary=(result.get("text") or "")[:300],
                                source=result.get("author", "") or self._extract_domain(url),
                                published_date=result.get("publishedDate"),
                            ))

                except Exception as e:
                    logger.warning(
                        f"[Watchdog] Poll failed for monitor {monitor.exa_monitor_id}: {e}"
                    )

            # Persist new updates
            for update in new_updates:
                row = WatchdogUpdateDB(
                    id=update.id, user_id=update.user_id,
                    category=update.category, reference_id=update.reference_id,
                    reference_name=update.reference_name,
                    title=update.title, url=update.url,
                    summary=update.summary, source=update.source,
                    published_date=update.published_date,
                    is_read=update.is_read,
                    created_at=datetime.utcnow(),
                )
                db.add(row)
            db.commit()

            logger.info(f"[Watchdog] Polled monitor results for {user_id}: {len(new_updates)} new")
            return new_updates
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def _process_webhook_results(self, user_id: str, category: str,
                                 reference_id: str, reference_name: str,
                                 results: List[Dict[str, Any]]) -> int:
        """Process webhook-delivered monitor results, store as WatchdogUpdate rows.
        Returns count of new updates stored."""
        db = self._get_db(user_id)
        try:
            existing_urls = {
                row.url for row in db.query(WatchdogUpdateDB.url).filter(
                    WatchdogUpdateDB.user_id == user_id
                ).all()
            }
            count = 0
            for result in results:
                url = result.get("url", "")
                if url and url not in existing_urls:
                    existing_urls.add(url)
                    row = WatchdogUpdateDB(
                        id=str(uuid.uuid4()), user_id=user_id,
                        category=category, reference_id=reference_id,
                        reference_name=reference_name,
                        title=result.get("title", "Untitled"),
                        url=url,
                        summary=(result.get("text") or "")[:300],
                        source=result.get("author", "") or self._extract_domain(url),
                        published_date=result.get("publishedDate"),
                    )
                    db.add(row)
                    count += 1
            db.commit()
            logger.info(f"[Watchdog] Webhook stored {count} new updates for {user_id}")
            return count
        except Exception:
            db.rollback()
            return 0
        finally:
            db.close()

    # ── CRUD: Industries ────────────────────────────────────────────

    async def create_industry(self, user_id: str, data: WatchdogIndustryCreate,
                              webhook_url: str = "") -> WatchdogIndustry:
        db = self._get_db(user_id)
        try:
            row = WatchdogIndustryDB(
                id=str(uuid.uuid4()), user_id=user_id, name=data.name,
            )
            row.set_search_queries(data.search_queries or self._default_industry_queries(data.name))
            db.add(row)
            db.commit()
            db.refresh(row)
            pydantic = self._industry_to_pydantic(row)

            # Create Exa Monitors in background
            if webhook_url:
                await self._create_monitors_for(
                    user_id, "industry", row.id, row.name,
                    pydantic.search_queries, webhook_url,
                )

            return pydantic
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def get_industries(self, user_id: str) -> List[WatchdogIndustry]:
        db = self._get_db(user_id)
        try:
            rows = db.query(WatchdogIndustryDB).filter(
                WatchdogIndustryDB.user_id == user_id
            ).order_by(WatchdogIndustryDB.created_at.desc()).all()
            return [self._industry_to_pydantic(r) for r in rows]
        finally:
            db.close()

    async def update_industry(self, user_id: str, industry_id: str, data,
                              webhook_url: str = "") -> Optional[WatchdogIndustry]:
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogIndustryDB).filter(
                WatchdogIndustryDB.id == industry_id,
                WatchdogIndustryDB.user_id == user_id,
            ).first()
            if not row:
                return None
            if data.name is not None:
                row.name = data.name
            if data.search_queries is not None:
                row.set_search_queries(data.search_queries)
            row.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(row)
            pydantic = self._industry_to_pydantic(row)

            # Re-sync monitors if queries changed
            if data.search_queries is not None and webhook_url:
                await self._delete_monitors_for(user_id, "industry", row.id)
                await self._create_monitors_for(
                    user_id, "industry", row.id, row.name,
                    pydantic.search_queries, webhook_url,
                )

            return pydantic
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def delete_industry(self, user_id: str, industry_id: str) -> bool:
        await self._delete_monitors_for(user_id, "industry", industry_id)
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogIndustryDB).filter(
                WatchdogIndustryDB.id == industry_id,
                WatchdogIndustryDB.user_id == user_id,
            ).first()
            if not row:
                return False
            db.delete(row)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # ── CRUD: Companies ─────────────────────────────────────────────

    async def create_company(self, user_id: str, data: WatchdogCompanyCreate,
                             webhook_url: str = "") -> WatchdogCompany:
        db = self._get_db(user_id)
        try:
            row = WatchdogCompanyDB(
                id=str(uuid.uuid4()), user_id=user_id, name=data.name,
                url=data.url, industry_tag=data.industry_tag,
            )
            row.set_search_queries(data.search_queries or self._default_company_queries(data.name))
            db.add(row)
            db.commit()
            db.refresh(row)
            pydantic = self._company_to_pydantic(row)

            if webhook_url:
                await self._create_monitors_for(
                    user_id, "company", row.id, row.name,
                    pydantic.search_queries, webhook_url,
                )

            return pydantic
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def get_companies(self, user_id: str) -> List[WatchdogCompany]:
        db = self._get_db(user_id)
        try:
            rows = db.query(WatchdogCompanyDB).filter(
                WatchdogCompanyDB.user_id == user_id
            ).order_by(WatchdogCompanyDB.created_at.desc()).all()
            return [self._company_to_pydantic(r) for r in rows]
        finally:
            db.close()

    async def update_company(self, user_id: str, company_id: str, data,
                             webhook_url: str = "") -> Optional[WatchdogCompany]:
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogCompanyDB).filter(
                WatchdogCompanyDB.id == company_id,
                WatchdogCompanyDB.user_id == user_id,
            ).first()
            if not row:
                return None
            if data.name is not None:
                row.name = data.name
            if data.url is not None:
                row.url = data.url
            if data.industry_tag is not None:
                row.industry_tag = data.industry_tag
            if data.search_queries is not None:
                row.set_search_queries(data.search_queries)
            row.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(row)
            pydantic = self._company_to_pydantic(row)

            if data.search_queries is not None and webhook_url:
                await self._delete_monitors_for(user_id, "company", row.id)
                await self._create_monitors_for(
                    user_id, "company", row.id, row.name,
                    pydantic.search_queries, webhook_url,
                )

            return pydantic
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def delete_company(self, user_id: str, company_id: str) -> bool:
        await self._delete_monitors_for(user_id, "company", company_id)
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogCompanyDB).filter(
                WatchdogCompanyDB.id == company_id,
                WatchdogCompanyDB.user_id == user_id,
            ).first()
            if not row:
                return False
            db.delete(row)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # ── CRUD: People ────────────────────────────────────────────────

    async def create_person(self, user_id: str, data: WatchdogPersonCreate,
                            webhook_url: str = "") -> WatchdogPerson:
        db = self._get_db(user_id)
        try:
            row = WatchdogPersonDB(
                id=str(uuid.uuid4()), user_id=user_id, name=data.name,
                title=data.title, company=data.company, linkedin_url=data.linkedin_url,
            )
            row.set_search_queries(
                data.search_queries or self._default_person_queries(data.name, data.title, data.company)
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            pydantic = self._person_to_pydantic(row)

            if webhook_url:
                await self._create_monitors_for(
                    user_id, "person", row.id, row.name,
                    pydantic.search_queries, webhook_url,
                )

            return pydantic
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def get_people(self, user_id: str) -> List[WatchdogPerson]:
        db = self._get_db(user_id)
        try:
            rows = db.query(WatchdogPersonDB).filter(
                WatchdogPersonDB.user_id == user_id
            ).order_by(WatchdogPersonDB.created_at.desc()).all()
            return [self._person_to_pydantic(r) for r in rows]
        finally:
            db.close()

    async def update_person(self, user_id: str, person_id: str, data,
                            webhook_url: str = "") -> Optional[WatchdogPerson]:
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogPersonDB).filter(
                WatchdogPersonDB.id == person_id,
                WatchdogPersonDB.user_id == user_id,
            ).first()
            if not row:
                return None
            if data.name is not None:
                row.name = data.name
            if data.title is not None:
                row.title = data.title
            if data.company is not None:
                row.company = data.company
            if data.linkedin_url is not None:
                row.linkedin_url = data.linkedin_url
            if data.search_queries is not None:
                row.set_search_queries(data.search_queries)
            row.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(row)
            pydantic = self._person_to_pydantic(row)

            if data.search_queries is not None and webhook_url:
                await self._delete_monitors_for(user_id, "person", row.id)
                await self._create_monitors_for(
                    user_id, "person", row.id, row.name,
                    pydantic.search_queries, webhook_url,
                )

            return pydantic
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def delete_person(self, user_id: str, person_id: str) -> bool:
        await self._delete_monitors_for(user_id, "person", person_id)
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogPersonDB).filter(
                WatchdogPersonDB.id == person_id,
                WatchdogPersonDB.user_id == user_id,
            ).first()
            if not row:
                return False
            db.delete(row)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # ── Discovery via Exa ───────────────────────────────────────────

    async def discover_companies(self, query: str, num_results: int = 5, user_id: str = None) -> List[Dict[str, Any]]:
        return await self.exa.company_search(query, num_results=num_results, user_id=user_id)

    async def discover_people(self, query: str, num_results: int = 5, user_id: str = None) -> List[Dict[str, Any]]:
        return await self.exa.people_search(query, num_results=num_results, user_id=user_id)

    # ── Polling / Refresh (legacy on-demand Exa search) ─────────────

    async def poll_updates(self, user_id: str) -> List[WatchdogUpdate]:
        """Legacy on-demand Exa search polling. Also triggers monitors
        and polls their results for a hybrid refresh."""
        upgrades = await self.poll_monitor_results(user_id)
        return upgrades

    # ── Updates ─────────────────────────────────────────────────────

    def get_updates(self, user_id: str, category: Optional[str] = None, since: Optional[str] = None) -> List[WatchdogUpdate]:
        db = self._get_db(user_id)
        try:
            q = db.query(WatchdogUpdateDB).filter(WatchdogUpdateDB.user_id == user_id)
            if category:
                q = q.filter(WatchdogUpdateDB.category == category)
            if since:
                try:
                    since_dt = datetime.fromisoformat(since)
                    q = q.filter(WatchdogUpdateDB.created_at > since_dt)
                except ValueError:
                    pass
            rows = q.order_by(WatchdogUpdateDB.created_at.desc()).all()
            return [self._update_to_pydantic(r) for r in rows]
        finally:
            db.close()

    def mark_update_read(self, user_id: str, update_id: str) -> bool:
        db = self._get_db(user_id)
        try:
            row = db.query(WatchdogUpdateDB).filter(
                WatchdogUpdateDB.id == update_id,
                WatchdogUpdateDB.user_id == user_id,
            ).first()
            if not row:
                return False
            row.is_read = True
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def get_unread_count(self, user_id: str) -> int:
        db = self._get_db(user_id)
        try:
            return db.query(WatchdogUpdateDB).filter(
                WatchdogUpdateDB.user_id == user_id,
                WatchdogUpdateDB.is_read == False,
            ).count()
        finally:
            db.close()

    def get_all_watched(self, user_id: str) -> dict:
        industries = self.get_industries(user_id)
        companies = self.get_companies(user_id)
        people = self.get_people(user_id)
        return {
            "industries": [i.dict() for i in industries],
            "companies": [c.dict() for c in companies],
            "people": [p.dict() for p in people],
        }

    def get_monitor_status(self, user_id: str) -> List[dict]:
        """Return monitoring status summary for all watched items."""
        db = self._get_db(user_id)
        try:
            rows = db.query(WatchdogMonitorDB).filter(
                WatchdogMonitorDB.user_id == user_id
            ).all()
            return [
                {
                    "id": r.id,
                    "exa_monitor_id": r.exa_monitor_id,
                    "category": r.category,
                    "reference_id": r.reference_id,
                    "status": r.status,
                    "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
        finally:
            db.close()

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path
            return domain.replace("www.", "")
        except Exception:
            return url


# Global singleton
watchdog_service = WatchdogService()
