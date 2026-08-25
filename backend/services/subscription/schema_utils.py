"""
Schema utilities for subscription-related tables.

NOTE: The runtime PRAGMA/ALTER TABLE guards that previously lived here
(ensure_subscription_plan_columns, ensure_usage_summaries_columns,
ensure_api_usage_logs_columns) have been removed.  All columns are now
managed exclusively by Alembic migrations.  This module is retained as
an import target for backward compatibility but is intentionally empty.
"""
