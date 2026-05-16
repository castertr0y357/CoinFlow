# Project Status: CoinFlow Browser Extension (v2.2)

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

## Recent Fixes (v2.3)
- **Production Auth Loop**: Resolved 401 Unauthorized errors by implementing automated `admin@webbudget.local` user provisioning upon login.
- **Invisible Categories**: Fixed a "Catch-22" bug where unconfigured categories were hidden from the UI, making them impossible to set up.
- **Data Export Precision**: Updated the backup system to include `BudgetYear` and `YearlyCategory` tables, ensuring full budget settings are preserved.
- **Unique Backups**: Added ISO timestamps to backup filenames to prevent browser overwrites.
- **Session Reliability**: Forced full page reloads on login to ensure browsers reliably commit the session cookie.

## Pending Verification
- [ ] Verify full data restoration using a v1.1 timestamped backup file.
- [ ] Monitor Nginx logs for any remaining session cookie rejection under high-load/multiple tabs.

## Technical Details
- **Version**: 2.3
- **Core Files**:
  - `src/lib/auth.ts`: Session encryption, security toggles, and self-healing user provisioning.
  - `src/middleware.ts`: JWT-based session protection and protocol normalization.
  - `src/app/api/v1/data/export/route.ts`: Comprehensive v1.1 backup generator.
  - `src/lib/services/budgetService.ts`: Categorization and tally logic (now with universal visibility).
