-- Industry Watchdog Exa Monitors mapping table (Phase 2.2)

CREATE TABLE IF NOT EXISTS watchdog_monitors (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    exa_monitor_id VARCHAR(128) NOT NULL UNIQUE,
    category VARCHAR(16) NOT NULL,
    reference_id VARCHAR(64) NOT NULL,
    search_query TEXT NOT NULL,
    trigger_period VARCHAR(8) NOT NULL DEFAULT '1d',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    webhook_secret VARCHAR(255),
    last_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_watchdog_monitors_exa_id
    ON watchdog_monitors (exa_monitor_id);

CREATE INDEX IF NOT EXISTS ix_watchdog_monitors_user_ref
    ON watchdog_monitors (user_id, category, reference_id);

CREATE INDEX IF NOT EXISTS ix_watchdog_monitors_status
    ON watchdog_monitors (status);
