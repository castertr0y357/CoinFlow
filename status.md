# Project Status: CoinFlow Browser Extension (v2.16.0)

## Current Progress
- [x] **Category Obligations & Commitments Audit (v2.15.0)**: Connected recurring commitments directly to budget categories, rendering monthly-equivalent obligation summaries, active underfunded warning flags, average monthly spend averages (YTD divided by elapsed months), and left-sidebar "Tied Commitments" detail cards while removing fixed costs from the month-end surplus math to prevent double-counting.
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

## Recent Fixes & Features (v2.16.0)
- **Total Assets & Debts Navigation Widget**: Calculated and displayed global total assets and total debts in a clean, glassmorphic layout card on the left navigation panel, regardless of whether accounts are on or off budget.
- **Precision Payee Scraper Matching**: Standardized external sync transaction matching by comparing transaction payee names against the source platform. Restricted matching for Amazon (contains "amazon" or "amzn"), Walmart (contains "walmart", "wal-mart", "wm supercenter", "wm.com", or starts with "wm "), and Lowe's (contains "lowes" or "lowe's") to prevent incorrect matches.
- **Click-to-Show Note Section**: Added click-activated transaction-level note editing directly under the payee on the transactions page, matching the category page behavior. Upgraded the note field to a larger, dedicated stacked textarea form entry field that supports keyboard navigation (Enter to save, Shift+Enter for newlines, Escape to cancel) and glassmorphic styling.
- **Conditional Split Amount Display**: Omitted rendering split amounts for transactions that are not split (i.e. only have one split) to eliminate visual noise and duplication of the total transaction amount.

## Recent Fixes & Features (v2.15.0)
- **Commitment Categories Linking**: Modified the inline commitments editor in `CommitmentsClient.tsx` with a dual-row responsive grid incorporating a Category selector, enabling users to link recurring obligations directly to dynamic budget categories.
- **Spent Column Monthly Average**: Updated `budgetService.ts` to calculate an elapsed-months divisor based on the current calendar date (e.g. 5 for May 2026). Display the category's monthly average spend YTD in the dashboard spreadsheet rather than the cumulative sum.
- **Pulsing Underfunded Warning Badges**: Added a pulsing amber/red `⚠️` warning next to budgeted amounts in `CategorySpreadsheet.tsx` and a detailed alert banner in `CategoryDetailClient.tsx` if the monthly provision budget is less than its linked committed obligations.
- **Double-Counting Surplus Resolution**: Removed "Next Month Fixed Costs" subtraction and rows from both `budgetService.ts` and `ForecastCard.tsx` to prevent double-counting.
- **Category Details Sidebar Obligations**: Added a beautiful "Tied Commitments" card under the category sidebar details showing linked obligations, their individual scaled monthly-equivalents, and the collective total obligations.
- **Goals Page Financial Stats**: Added "Total Category Balances" and "Available to Fund" stat cards to the top of the goals dashboard, comparing total obligations and global unassigned surplus so users can easily identify available money to assign towards new goals.

## Recent Fixes & Features (v2.14.0)
- **Buffer-Based Next-Month Calculations**: Added a next-month forecasting model that computes rolled-over month-end buffer funds and matches them against next-month category limits and scaling-adjusted commitments.
- **Commitments Frequency Scaling**: Wrote robust frequency-scaling helpers in `budgetService.ts` to convert yearly, semi-annual, quarterly, and monthly commitments to monthly-equivalents automatically.
- **Glassmorphic Card UI Redesign**: Updated `ForecastCard.tsx` layout to title "Next-Month Funding", render premium status badges ("FUNDED" vs "DEFICIT"), display detailed next-month obligations breakdown, and prevent hydration mismatch warnings.

## Recent Fixes & Features (v2.12.0)
- **Savings Goals Workspace & Milestones**: Implemented a chronological horizontal roadmap track, dynamic progress meters with responsive HSL-colored bottom glow styles, and manual funding positive/negative adjuster inputs.
- **Auto-Provisioned Budget Mappings**: Enabled dynamic, on-the-fly budget category creation and seeding during savings goal setups, allowing automatic progress tracking linked to dynamic category balances.

## Pending Verification
- [ ] Monitor Nginx logs for any remaining session cookie rejection under high-load/multiple tabs.
- [ ] Test the newly added Realtor.com scraper with a live active-listing URL.

## Technical Details
- **Version**: 2.16.0
- **Core Files**:
  - `src/components/Sidebar.tsx`: Rendered total assets and debts cards with custom styles on the left navigation bar.
  - `src/lib/external-orders.ts`: Implemented `getPayeeFilterForSource` and updated Amazon CSV processing to check for payee match.
  - `src/app/api/v1/external-orders/sync/route.ts`: Integrated payee checking during transaction sync matching.
  - `src/app/transactions/TransactionRow.tsx` & `actions.ts`: Added click-to-show transaction-level memo form and `updateTransactionMemo` action.
  - `src/app/transactions/Transactions.css`: Styled payee-text click areas and memo form elements.
  - `src/types/index.ts`: Added missing `memo` property to `Transaction` interface for type safety.
