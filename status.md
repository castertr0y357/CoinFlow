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

## Recent Fixes (v2.2)
- **Amazon Item Duplication**: Resolved a critical bug where `items` was leaked as a global variable, causing item accumulation.
- **Cross-Layer Deduplication**: Implemented item title/price deduplication in both the scraper and the backend API.
- **Resolved $0 Total Extraction**: Added targeted selectors and "Grand Total:" label search for Amazon Order Details.
- **Item Deduplication**: Consolidated overlapping selectors to prevent items from being counted twice.
- **ID Standardization**: Implemented strict sanitization to strip "ORDER #" prefixes consistently across all pages.
- **Database Maintenance**: Ran reconciliation scripts to merge duplicate order records and restore broken transaction links.
- **Preserved Logs**: Removed automatic page reload after sync to enable easier debugging.
- **Deployment Infrastructure**: Added `entrypoint.sh` to handle automated database migrations on startup.

## Pending Verification
- [ ] Verify Amazon Deep Sync precision on complex multi-item orders.
- [ ] Confirm Walmart TC# extraction accuracy in varied regional layouts.
- [ ] Monitor Lowe's "Transaction #" extraction for potential selector drift.

## Technical Details
- **Version**: 2.2
- **Core Files**:
  - `manifest.json`: Versioning and script mapping.
  - `background.js`: Sync engine, retry logic, and API communication.
  - `utils.js`: UI components, storage management, and price/date parsing.
  - `content-scripts/amazon.js`: Precision-hardened Amazon scraper.
  - `src/app/api/v1/external-orders/sync/route.ts`: Hardened matching logic.
