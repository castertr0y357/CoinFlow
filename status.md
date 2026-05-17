# Project Status: CoinFlow Browser Extension (v2.5)

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

## Recent Fixes (v2.7.1)
- **Extension Version Page Label**: Changed the hardcoded 'v1.0.0' label to the actual 'v1.9' version to align the webapp settings dashboard with the Chrome manifest.
- **Amazon CSV Button Removal**: Deleted the obsolete and non-functional Amazon CSV file upload button, hidden input ref, isUploading state, and handleAmazonClick/handleFileChange handlers to clean up the frontend code.
- **Styled-JSX Scope Isolation Bug**: Fixed a styled-jsx compiler scoping issue under nested dynamic map blocks where Turbopack was unable to inject scoping classes onto inner items, causing unstyled toggles and plain text balances. Resolved by migrating sidebar items and buttons styling rules into the main global stylesheet `globals.css`.
- **Negative Balance Color Warning**: Standardized all negative balances in the sidebar using the main theme's `--danger` color combined with `!important` to override default container values.
- **Database Backup Permission Fix**: Resolved container `EACCES` file write errors by updating the `Dockerfile` to create `/app/backups` and dynamically chown permissions to the non-root `nextjs` user.
- **Import Transaction Timeout**: Extended the Prisma transaction timeout to 60 seconds (up from 5s) to guarantee large imports complete successfully without query expiration.
- **Improved Backup UI flow**: Replaced the cluttered layout with an elegant kebab dropdown menu next to each snapshot providing instant Server Restore or Download.
- **Type-safe Next.js 15+ Dynamic Params**: Fixed dynamic API parameters within `[filename]` route handler to comply with Next.js 15+ `Promise` standard.

## Pending Verification
- [ ] Monitor Nginx logs for any remaining session cookie rejection under high-load/multiple tabs.

## Technical Details
- **Version**: 2.7.1
- **Core Files**:
  - `src/app/settings/extension/page.tsx`: Configuration and installation guide dashboard for manual Chrome Developer extension setup.
  - `src/app/globals.css`: Holds global theme values, layout variables, and the newly migrated sidebar item and account toggle styles.
  - `src/components/Sidebar.tsx`: Navigation sidebar rendering logic, dynamic partitions, and self-cleaning local style declarations.
  - `src/lib/auth.ts`: Session encryption, security toggles, and self-healing user provisioning.
  - `src/middleware.ts`: JWT-based session protection and protocol normalization.
  - `src/lib/services/backupService.ts`: Central snapshot creator, pre-import safety mechanism, and automatic retention-based rotation.
  - `src/app/api/v1/data/backups/route.ts`: API handler for listing and manually creating server snapshots.
  - `src/app/api/v1/data/backups/[filename]/route.ts`: Endpoint for fast secure downloads of snapshots from server volume.
  - `src/app/api/v1/data/backups/restore/route.ts`: Endpoint executing high-performance clean restorations on the server side.
  - `src/app/settings/BackupManager.tsx`: Glassmorphism-style list and actions layout supporting automatic refresh.
