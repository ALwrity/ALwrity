# Open-Core Dual-Repository Setup

This document explains how ALwrity's two repositories work together, which one to push to, and how to keep them in sync.

## Repositories

| Repo | URL | Visibility | Purpose |
|------|-----|-----------|---------|
| **Public (open source)** | `https://github.com/ALwrity/ALwrity` | Public | Open-source core. All work that can be open-sourced lives here. |
| **Prod (enterprise)** | `https://github.com/ALwrity/ALwrity-prod` | Private | Enterprise fork. Public core + proprietary features that ship to paying customers. |

We follow the **open-core** model: the public repo is the source of truth for everything that is not enterprise-only. The prod repo is a strict superset.

## Remotes in the local clone

Every contributor's local clone has **two remotes**:

- `origin` -> `https://github.com/ALwrity/ALwrity.git` (public)
- `prod`  -> `https://github.com/ALwrity/ALwrity-prod.git` (private)

Verify with:

```bash
git remote -v
```

You should see both. If `prod` is missing, add it:

```bash
git remote add prod https://github.com/ALwrity/ALwrity-prod.git
```

## Branch naming convention

| Prefix | Repo | Meaning |
|--------|------|---------|
| `feat/*`, `fix/*`, `chore/*`, `docs/*` | public | Open-source work. May be promoted to public after review. |
| `enterprise/*` | prod only | Proprietary work. **Never** push to public. |
| `main` | both | Always kept in sync. Prod main = public main + merged enterprise branches. |

The `enterprise/*` prefix is a soft guardrail. Combined with branch protection rules on GitHub (recommended below), it stops anyone from accidentally landing a prod-only feature on public.

## Day-to-day workflows

### A. Catch up local main with the latest public changes

```bash
git fetch origin
git checkout main
git merge origin/main
git push prod main   # mirror public main to prod
```

Run this once a day or whenever the public main has new commits.

### B. New public feature (rare — most work is prod-only)

```bash
git fetch origin
git checkout -b feat/<short-name> origin/main
# ... work, commit ...
git push origin feat/<short-name>
gh pr create --repo ALwrity/ALwrity --base main --head feat/<short-name>
```

### C. New enterprise/prod feature (the common case)

```bash
git fetch prod
git checkout -b enterprise/<short-name> prod/main
# ... work, commit ...
git push prod enterprise/<short-name>
gh pr create --repo ALwrity/ALwrity-prod --base main --head enterprise/<short-name>
```

### D. Sync an enterprise feature into the public repo (open-sourcing)

Occasionally, a feature that started in prod becomes worth open-sourcing.

```bash
git fetch origin
git checkout -b open-source/<short-name> origin/main
# Cherry-pick the commit(s) you want to open-source
git cherry-pick <sha>
# Resolve any conflicts (usually around enterprise-only imports / env vars)
git push origin open-source/<short-name>
gh pr create --repo ALwrity/ALwrity --base main --head open-source/<short-name>
```

Treat the cherry-picked commit as a *new* PR — the public review will need to scrutinise it without the surrounding prod context.

### E. Hotfix in prod that should also go to public

If you fix a bug in prod and the same bug exists in public, do two PRs: one against each repo. Don't try to push a single branch to both — they have different histories.

## What "prod-only" means in practice

Code that **must not** be public typically includes:

- Customer-specific configuration and credentials
- Paid-tier feature flags and paywall logic
- Internal analytics and telemetry endpoints
- SSO / enterprise auth flows
- Per-tenant data partitioning
- Branded assets for paying customers
- Anything with a non-MIT license dependency

If you're unsure, ask. Default to public.

## Recommended GitHub branch protection

On `ALwrity/ALwrity` (public):

- Protect `main`. Require PR + 1 review.
- Add a **branch name pattern** restriction: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `open-source/*`. Reject any push or PR that contains `enterprise/*`.

On `ALwrity/ALwrity-prod` (private):

- Protect `main`. Require PR + 1 review.
- Add a **branch name pattern** restriction: `enterprise/*`, `feat/*`, `fix/*`. Reject `open-source/*` (those go to public).

These two rules together make accidental cross-publishes impossible at the GitHub layer, in addition to the naming convention.

## Initial seeding (already done)

The prod repo was empty on day one. To seed it, we pushed `main` from public directly:

```bash
git push prod main
```

After that, every enterprise feature is branched from `prod/main` and merged via PR.

## Current state (as of setup)

- `prod/main` is at the same SHA as `origin/main` (`4fcf5b12`).
- First enterprise feature (`enterprise/linkedin-optimize-profile-usability`) is open as PR #1 on `ALwrity-prod`. It adds deep-links, per-section scores, and re-check verification to the LinkedIn Studio Optimize Profile flow.
- Working tree on local main has uncommitted changes that are **not** part of the enterprise branch. They will be committed and PR'd separately when ready.

## FAQ

**Q: I accidentally pushed a prod-only branch to `origin`. What do I do?**
Delete the branch on origin immediately (`git push origin --delete <branch>`) and any open PRs. Then push it to `prod` correctly. If the commit already contains secrets, consider them compromised and rotate.

**Q: I have a `feat/*` branch with a public feature, but I also need a small prod-only tweak. How do I split?**
Open two PRs: one `feat/*` against public with just the open-source parts, one `enterprise/*` against prod with the prod-only extension. The prod branch can rebase/merge the public branch in.

**Q: Can I cherry-pick from a `feat/*` branch into an `enterprise/*` branch?**
Yes. The direction is open-source -> enterprise is free. Going the other way is `open-source/*` and needs a clean cherry-pick.

**Q: Why two repos instead of one repo with two branches?**
Because we want GitHub-native access control, separate PR queues, separate issue tracking, and protection rules. Two repos is the standard open-core pattern (GitLab, Sentry, Supabase, Elastic all do this).

**Q: Where do issues live?**
Public repo for anything a community member could see / fix. Prod repo for internal-only work, customer escalations, and enterprise roadmap.

## Quick reference

```bash
# What remotes do I have?
git remote -v

# What branch am I on? Is it enterprise/*?
git branch --show-current

# Push to public
git push origin <branch>

# Push to prod
git push prod <branch>

# Open a PR against the correct repo
gh pr create --repo ALwrity/ALwrity ...        # public
gh pr create --repo ALwrity/ALwrity-prod ...   # prod
```

If you remember nothing else: **`enterprise/*` -> `prod`, everything else -> `origin`**.
