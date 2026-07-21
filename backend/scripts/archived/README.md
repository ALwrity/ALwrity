# Archived Scripts

These scripts are one-time migration/init scripts that are superseded by the SSOT in
`backend/services/subscription/pricing_service.py::initialize_default_plans()`
and `initialize_default_pricing()`.

| Script | Reason Archived |
|---|---|
| `init_alpha_subscription_tiers.py` | Stale alpha test values; SSOT drives plan seeding. Gated behind `ENABLE_ALPHA`. |
| `update_image_edit_limits.py` | Wrong limits vs SSOT (Free=10 vs SSOT=5). `schema_utils.py` handles new column defaults. |
| `cleanup_alpha_plans.py` | Stale per-provider limits that differ from SSOT. Plan cleanup done via seed. |

Do NOT re-run these. Update `pricing_service.py` instead.
