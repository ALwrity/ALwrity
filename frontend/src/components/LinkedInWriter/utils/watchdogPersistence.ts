import type {
  WatchdogIndustry,
  WatchdogCompany,
  WatchdogPerson,
  WatchdogUpdate,
} from '../../../services/linkedInWatchdogApi';

const STORAGE_PREFIX = 'alwrity-watchdog-';

const KEYS = {
  INDUSTRIES: `${STORAGE_PREFIX}industries`,
  COMPANIES: `${STORAGE_PREFIX}companies`,
  PEOPLE: `${STORAGE_PREFIX}people`,
  UPDATES: `${STORAGE_PREFIX}updates`,
  LAST_REFRESH: `${STORAGE_PREFIX}last-refresh`,
} as const;

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[WatchdogPersistence] Failed to write', key, e);
  }
}

export class WatchdogPersistenceManager {
  private static instance: WatchdogPersistenceManager;

  static getInstance(): WatchdogPersistenceManager {
    if (!this.instance) {
      this.instance = new WatchdogPersistenceManager();
    }
    return this.instance;
  }

  // ── Industries ────────────────────────────────────────────────

  saveIndustries(items: WatchdogIndustry[]): void {
    safeSet(KEYS.INDUSTRIES, items);
  }

  loadIndustries(): WatchdogIndustry[] {
    return safeGet<WatchdogIndustry[]>(KEYS.INDUSTRIES, []);
  }

  // ── Companies ─────────────────────────────────────────────────

  saveCompanies(items: WatchdogCompany[]): void {
    safeSet(KEYS.COMPANIES, items);
  }

  loadCompanies(): WatchdogCompany[] {
    return safeGet<WatchdogCompany[]>(KEYS.COMPANIES, []);
  }

  // ── People ────────────────────────────────────────────────────

  savePeople(items: WatchdogPerson[]): void {
    safeSet(KEYS.PEOPLE, items);
  }

  loadPeople(): WatchdogPerson[] {
    return safeGet<WatchdogPerson[]>(KEYS.PEOPLE, []);
  }

  // ── Updates ───────────────────────────────────────────────────

  saveUpdates(items: WatchdogUpdate[]): void {
    safeSet(KEYS.UPDATES, items);
  }

  loadUpdates(): WatchdogUpdate[] {
    return safeGet<WatchdogUpdate[]>(KEYS.UPDATES, []);
  }

  // ── Refresh timestamp ─────────────────────────────────────────

  saveLastRefresh(ts: string): void {
    safeSet(KEYS.LAST_REFRESH, ts);
  }

  loadLastRefresh(): string | null {
    return safeGet<string | null>(KEYS.LAST_REFRESH, null);
  }

  // ── Bulk save / load ──────────────────────────────────────────

  saveAll(state: {
    industries: WatchdogIndustry[];
    companies: WatchdogCompany[];
    people: WatchdogPerson[];
    updates: WatchdogUpdate[];
  }): void {
    this.saveIndustries(state.industries);
    this.saveCompanies(state.companies);
    this.savePeople(state.people);
    this.saveUpdates(state.updates);
  }

  loadAll(): {
    industries: WatchdogIndustry[];
    companies: WatchdogCompany[];
    people: WatchdogPerson[];
    updates: WatchdogUpdate[];
  } {
    return {
      industries: this.loadIndustries(),
      companies: this.loadCompanies(),
      people: this.loadPeople(),
      updates: this.loadUpdates(),
    };
  }

  clearAll(): void {
    Object.values(KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch { /* ignore */ }
    });
  }
}
