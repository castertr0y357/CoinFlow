# Project Status: CoinFlow Browser Extension (v2.8.0)

## Current Progress
- [x] **Unified Scraper Framework**: Standardized Amazon, Walmart, and Lowe's scrapers using `CoinFlowUtils`.
- [x] **Deep Sync Engine**: Implemented cross-site order detail fetching for high-precision itemized data.
- [x] **Robust Messaging**: Unified background communication using `{ action: 'syncOrders' }`.
- [x] **Hardened Error Handling**: 3-attempt retry logic with exponential backoff and 15s request timeouts.
- [x] **Premium UI**: Integrated glassmorphism-themed sync buttons and notifications.
- [x] **Duplicate Prevention**: Implemented `chrome.storage.local` tracking to prevent redundant syncs.
- [x] **Standardized Logging**: Implemented `CoinFlow [Component]:` tagging across all scripts for instant debugging.
- [x] **Hardened Matching (v2.0)**: Broadened transaction matching window to 13 days (-3/+10) with boundary normalization.
- [x] **Scraper Precision (v2.2)**: Fixed Amazon `items` scope leak and implemented multi-layer deduplication.
- [x] **Automated Migrations**: Integrated `prisma migrate deploy` into the container entrypoint for seamless deployment.
- [x] **Auth Security**: Implemented environment-based `Secure` cookie toggle and automated user provisioning to resolve production auth loops.
- [x] **Universal Category Visibility**: Removed "configs-only" filtering to ensure all categories are visible and configurable.
- [x] **Timestamped Backups (v1.1)**: Updated export/import to include yearly configs and use unique timestamped filenames.
- [x] **Automated Backup System (v2.4)**: Integrated a version-independent background JSON backup rotation, persistent Docker backup volume, and user-configurable retention limits.
- [x] **Safety Pre-Snapshot**: Automated DB pre-import safety backups (snapshots) before overwriting data, allowing full instant recovery.
- [x] **Advanced Backup UI (v2.4)**: Restructured BackupManager UI with interactive list, kebab menus (`⋮`), server-side restore, and fast file downloads.
- [x] **Navigation Restructuring & Styling (v2.6)**: Fully partitioned account lists into Assets and Debts subgroups under On-Budget and Off-Budget sections, restored inline inclusion/exclusion (`✓`/`✕`) and cash/debt (`D`) toggle buttons, and styled negative balances in warning red.
- [x] **Amazon Button Cleanup (v2.7)**: Completely removed the non-functional "Amazon CSV" button and its underlying handlers from the sidebar navigation pane to keep the interface clean.
- [x] **Extension Version Page Update (v2.7.1)**: Updated the browser extension settings page to show the actual Chrome extension version '1.9' matching its manifest.
- [x] **Database Migration Alignment (v2.7.2)**: Created missing SQL migration for `backupRetentionDays` to resolve drift between local development (`db push`) and production (`migrate deploy`).
- [x] **Agent Rules & Skills Hardening (v2.8.0)**: Fully decoupled and hardened database, visual, and audit pipelines to eliminate runtime regressions and registry dependency bottlenecks.

## Recent Fixes (v2.8.0)
- **Zero-Network Global Prisma Container Execution**: Fixed a severe container startup issue where `npx prisma` was unable to resolve the package locally within Next.js standalone container files, causing NPM to try and fetch `prisma@7.8.0` online on startup (failing offline and causing version mismatch bugs). Resolved by baking `npm install -g prisma@6.19.3` directly into the multi-stage `Dockerfile` and calling `prisma migrate deploy` directly, rendering the build 100% network-independent and offline-ready.
- **Dual-Path Client Hydration Safeguard**: Optimized `browser_verify` with an automated dual-path execution rule: backend or config changes use fast `curl` commands, while frontend/UI changes (CSS, TSX) spin up `browser_subagent` checks to catch silent client-side hydration mismatch and style scope regressions before task handoff.
- **Prisma Schema Safeguard**: Hardened `AGENTS.md` and `docker_autofix.md` to force generating migration SQL files via `migrate dev` for all database schema adjustments, completely preventing schema drift between development containers and production containers.
- **Production Focused Audits**: Configured `security_sentinel` to run `npm audit --omit=dev`, eliminating false positive vulnerabilities in development tools like ESLint or typescript compilation packages that never touch production.

## Pending Verification
- [ ] Monitor Nginx logs for any remaining session cookie rejection under high-load/multiple tabs.

## Technical Details
- **Version**: 2.8.0
- **Core Files**:
  - `AGENTS.md`: Defines Prisma Schema Safeguards and continuous status.md session-end context logging.
  - `.agents/skills/docker_autofix.md`: Utilizes local `prisma` container executables and mandates migration compliance.
  - `.agents/skills/browser_verify.md`: Dual-path logic enabling automated visual and JS console hydration checking for UI files.
  - `.agents/skills/security_sentinel.md`: Limits security auditing to production runtime files to prevent agent noise.
  - `Dockerfile`: Implements Docker-cached global `prisma@6.19.3` installation for zero-network boot-ups.
  - `entrypoint.sh`: Invokes global cached `prisma migrate deploy` natively.

