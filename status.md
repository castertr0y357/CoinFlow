# Project Status: CoinFlow Browser Extension (v2.14.0)

## Current Progress
- [x] **Next-Month Funding Forecast Engine (v2.14.0)**: Built buffer-based next-month forecasting combining current paycheck inflows with next-month budget limits and monthly-scaled fixed commitments.
- [x] **Paycheck-Based Month-End Forecasting (v2.13.0)**: Built full paycheck schedule evaluation, transaction-level deposit matching (with ±1 day tolerance), visual timeline tracking, and client-side mount guards.
- [x] **Savings Goals & Timelines Tracker (v2.12.0)**: Built full CRUD, visual chronological roadmap tracks, recommended monthly saving rates, and category auto-provisioning.
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
- [x] **Chronological Split Ordering (v2.8.1)**: Enforced strict chronological sorting of splits in backend queries and frontend rendering to completely resolve split math and display misalignment errors.
- [x] **Split Deletion Capabilities (v2.9.0)**: Built full database and interface systems allowing users to delete transaction splits, automatically merging unallocated amounts back into the main uncategorized remainder pool while honoring single-split safety guards.
- [x] **AI Category & Split Mapping (v2.10.0)**: Fully resolved the "Suggest Categories" and "Smart Split" bugs by mapping unmapped AI category names back to database category IDs, ensuring proper transaction signs for splits, and mathematically balancing split totals to match transaction totals exactly.
- [x] **Subscription Detective Alignment (v2.10.0)**: Corrected unmapped keys (`monthlyCost`, `reason`) and wrapped the JSON response array inside an object matching frontend specifications.
- [x] **LLM Markdown Wrapper Protection (v2.11.0)**: Added global `cleanJsonContent` JSON parsing sanitizers to protect all AI endpoints against Ollama's tendency to wrap responses in markdown backticks, fully restoring category suggestions and itemized order splits.
- [x] **Remote HTTPS LLM Routing (v2.11.0)**: Corrected protocol and port bindings for remote AI hosting, ensuring secure, connection-error-free HTTPS communication.

## Recent Fixes & Features (v2.14.0)
- **Buffer-Based Next-Month Calculations**: Added a next-month forecasting model that computes rolled-over month-end buffer funds and matches them against next-month category limits and scaling-adjusted commitments.
- **Commitments Frequency Scaling**: Wrote robust frequency-scaling helpers in `budgetService.ts` to convert yearly, semi-annual, quarterly, and monthly commitments to monthly-equivalents automatically.
- **Glassmorphic Card UI Redesign**: Updated `ForecastCard.tsx` layout to title "Next-Month Funding", render premium status badges ("FUNDED" vs "DEFICIT"), display detailed next-month obligations breakdown, and prevent hydration mismatch warnings.

## Recent Fixes & Features (v2.13.0)
- **Paycheck-Based Forecasting Engine**: Replaced flat monthly assumptions with a dynamic scheduled paycheck calculator that anchor-references past or upcoming payroll cycles.
- **Transaction Deposit Matching**: Created a high-efficiency scanning algorithm that checks inflow transactions within a ±1 day window to automatically detect early and matched paycheck deposits.
- **Visual Paycheck Timeline**: Designed a glassmorphic chronological timeline on the main dashboard showing Received vs Pending paychecks with custom glowing status indicators.
- **General Settings Form UI**: Expanded general settings with intuitive toggle switches, frequency selections, net amounts, and reference date fields.

## Recent Fixes & Features (v2.12.0)
- **Realtor.com Scraper & Premium Source Deletion**: Designed a dual-action Realtor.com scraper using DOM selectors and Next.js `__NEXT_DATA__` JSON parsing fallbacks, restructured home valuation provider elements into a clean header-body card system, and integrated Realtor into the select dashboard dropdown.
- **Savings Goals Workspace & Milestones**: Implemented a chronological horizontal roadmap track, dynamic progress meters with responsive HSL-colored bottom glow styles, and manual funding positive/negative adjuster inputs.
- **Auto-Provisioned Budget Mappings**: Enabled dynamic, on-the-fly budget category creation and seeding during savings goal setups, allowing automatic progress tracking linked to dynamic category balances.
- **Dashboard Savings Summary Widget**: Integrated a beautiful, real-time savings summary card in a new responsive 3-column layout on the main dashboard homepage.

## Recent Fixes & Features (v2.11.0)
- **Ollama Response Sanitization**: Designed and deployed a robust `cleanJsonContent` utility in `aiService.ts`. This filters out markdown syntax code blocks (e.g. ` ```json ` and ` ``` `) from model outputs before parsing, completely eliminating silent backend JSON syntax failures and allowing the category suggestions to load flawlessly in the UI.
- **Secure Remote Ollama Endpoint Integration**: Reconfigured Next.js and Docker environment variables (`OPENAI_BASE_URL`) to natively target the remote secure Ollama server (`https://ollama.castertr0y357.net/v1`), establishing correct HTTPS TLS/SSL handshakes and resolving connection refused (`ECONNREFUSED`) issues.

## Recent Fixes & Features (v2.10.0)
- **AI Category Mapping**: Fixed the "Suggest Categories" button by mapping the LLM's suggested category names back to their respective database Category UUIDs in the `/api/v1/ai/categorize` endpoint, allowing the UI to display suggestions, style the select elements, and execute bulk categorization successfully.
- **Smart Split Normalization**: Re-aligned the `/api/v1/ai/suggest-splits` endpoint to map raw LLM split payloads into backend-compatible schema structures. Added transaction sign inheritance (matching expense signs) and a rounding-and-tax balancer that dynamically scales split items to equal the transaction total exactly.
- **Subscription Detective Fix**: Restructured `/api/v1/ai/subscriptions` to return a `{ subscriptions }` object rather than a raw array to prevent client-side parsing failures, and updated the LLM prompt to include `monthlyCost` and `reason` tags matching the settings dashboard requirements.

## Recent Fixes & Features (v2.9.0)
- **Delete Splits & Balance Restoration**: Added full visual and database support for deleting splits. Deleting a split merges its balance back into the oldest uncategorized remainder split (or creates a new uncategorized split for the balance if none exists), maintaining the transaction's overall math. Leveraged custom responsive CSS classes for micro-interactions (red glow hover effect) and implemented single-split safety rules (hiding the delete button once only one split remains).
- **Chronological Transaction Splitting & Stable Render**: Resolved a severe transaction splitting bug where sequential splits resulted in incorrect calculations (e.g. `$0` splits) and misaligned layouts. Fixed by enforcing a strict `createdAt: 'asc'` sort order inside all backend Prisma query includes (ensuring the server correctly targets the oldest remainder split for calculations) and on the client side (guaranteeing stable, clean, alphabetical-fallback chronological rendering).
- **Zero-Network Global Prisma Container Execution**: Fixed a severe container startup issue where `npx prisma` was unable to resolve the package locally within Next.js standalone container files, causing NPM to try and fetch `prisma@7.8.0` online on startup (failing offline and version mismatch bugs). Resolved by baking `npm install -g prisma@6.19.3` directly into the multi-stage `Dockerfile` and calling `prisma migrate deploy` directly, rendering the build 100% network-independent and offline-ready.
- **Dual-Path Client Hydration Safeguard**: Optimized `browser_verify` with an automated dual-path execution rule: backend or config changes use fast `curl` commands, while frontend/UI changes (CSS, TSX) spin up `browser_subagent` checks to catch silent client-side hydration mismatch and style scope regressions before task handoff.
- **Prisma Schema Safeguard**: Hardened `AGENTS.md` and `docker_autofix.md` to force generating migration SQL files via `migrate dev` for all database schema adjustments, completely preventing schema drift between development containers and production containers.
- **Production Focused Audits**: Configured `security_sentinel` to run `npm audit --omit=dev`, eliminating false positive vulnerabilities in development tools like ESLint or typescript compilation packages that never touch production.

## Pending Verification
- [ ] Monitor Nginx logs for any remaining session cookie rejection under high-load/multiple tabs.
- [ ] Test the newly added Realtor.com scraper with a live active-listing URL.

## Technical Details
- **Version**: 2.12.0
- **Core Files**:
  - `src/lib/services/goalService.ts`: Core savings goal calculator, category mapping linker, and auto-provisioning engine.
  - `src/app/goals/page.tsx` & `GoalsClient.tsx`: Glassmorphism-themed workspaces, chronological roadmaps, stats cards, and manual fund adjusters.
  - `src/components/dashboard/GoalsSummaryCard.tsx`: Real-time SWR-driven homepage dashboard widget.
  - `src/app/goals/Goals.css`: Premium layout timeline roadmap track styles and bottom-border progress HSL fills.
  - `prisma/schema.prisma`: Defines target amounts, timelines, and category link constraints for savings goals.
  - `entrypoint.sh`: Invokes global cached `prisma migrate deploy` natively.

