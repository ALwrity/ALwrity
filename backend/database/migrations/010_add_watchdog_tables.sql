-- Industry Watchdog tables (Phase 2.1: DB persistence)

CREATE TABLE IF NOT EXISTS watchdog_industries (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    search_queries TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_watchdog_industries_user
    ON watchdog_industries (user_id, name);

CREATE TABLE IF NOT EXISTS watchdog_companies (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT,
    industry_tag VARCHAR(255),
    search_queries TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_watchdog_companies_user
    ON watchdog_companies (user_id, name);

CREATE TABLE IF NOT EXISTS watchdog_people (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    company VARCHAR(255),
    linkedin_url TEXT,
    search_queries TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_watchdog_people_user
    ON watchdog_people (user_id, name);

CREATE TABLE IF NOT EXISTS watchdog_updates (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    category VARCHAR(16) NOT NULL,
    reference_id VARCHAR(64) NOT NULL,
    reference_name VARCHAR(255) NOT NULL,
    title VARCHAR(512) NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    source VARCHAR(255),
    published_date VARCHAR(64),
    is_read BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_watchdog_updates_user_cat_created
    ON watchdog_updates (user_id, category, created_at);
