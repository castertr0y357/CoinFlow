# Project Status: CoinFlow Browser Extension (v2.25.5)

## Current Progress
- [x] **Project Standards Audit & Integrity Alignment (v2.25.5)**: Implemented startup configuration validation checks for required environment variables. Defined explicit deletion behaviors and added missing performance indexes on all database foreign key columns in `schema.prisma`. Copied `eslint.config.mjs` to the Docker runner stage to enable containerized linter verification.
- [x] **Logo Image Optimization & Rules Sync (v2.25.4)**: Fixed the `400 (Bad Request)` error when loading the CoinFlow logo image by adding the `unoptimized` prop to the Next.js `Image` component. Synchronized local workspace rules files with the latest global developer standards.
- [x] **Isolated AI Settings Tab (v2.25.3)**: Separated the AI configuration settings into a dedicated "AI Assistant" settings tab page at `/settings/ai`, cleaning up the general settings page inputs and updating settings navigation links accordingly.
- [x] **Dynamic AI Settings Integration (v2.25.2)**: Migrated AI configuration settings from static environment variables to the database Settings table. Exposed settings controls on the General Settings page to allow enabling/disabling AI features, enabling/disabling thinking, and adjusting thinking effort level. Implemented conditional visibility across the Transactions page, Tools page, and Reports page to hide all AI buttons and sections when AI is turned off. Updated `aiService.ts` and `doctor.ts` to support database-driven settings with safe fallback structures.
- [x] **Manual Home Valuation Isolation (v2.25.1)**: Added a dedicated `manualHomeValue` database field to the `MortgageDetail` model to separate user-configured values from synced provider averages. Updated the Net Worth calculation and mortgage page UI to calculate equity and render trajectories using `manualHomeValue` when configured, preventing RentCast or scraped AVM updates from overwriting manual entries.
- [x] **RentCast Integration & Multi-Mortgage Selection (v2.25.0)**: Added support for tracking multiple mortgages and properties. Refactored the backend loader to fetch all mortgage details. Added a dynamic dropdown selector in the header to switch active property datasets. Integrated RentCast AVM API to query real-time property value estimates using street addresses. Added a RentCast API key input field under Settings integrations.
- [x] **Project Standards Compliance Audit & Diagnostic Tooling (v2.24.2)**: Completed full audit against global standards. Implemented a workspace diagnostic utility (`scripts/doctor.ts`) with prisma migration validation, network loop verification, and SimpleFIN/AI integration diagnostics. Formulated a dynamic route scanner test (`src/app/routeScanner.test.ts`) utilizing Vitest to perform GET response sanity checks. Refactored server-side files to standardize logging under the centralized structured logger.
- [x] **Workspace Standards Sync & Category Page Mobile Responsiveness (v2.24.1)**: Synchronized local rules files (AGENTS.md, CLAUDE.md, .cursorrules, .windsurfrules) with updated global standard templates. Resolved mobile styling regressions on dynamic Category Details views (/categories/[id]) by implementing stacked vertical details lists, stacked form inputs, and responsive layout wraps.
- [x] **Premium Mobile Viewport Responsiveness (v2.24.0)**: Enhanced mobile browser experience by refactoring layouts and styles. Replaced the hidden sidebar on mobile with a collapsible sliding glassmorphic drawer toggled via a new fixed top header bar. Restructured transaction ledger row contents into stacked grid layouts (checkbox/date/amount on first tier, payee on second, category dropdowns occupying full width below) to eliminate content cutoff. Configured cash health calculator layouts to wrap vertically on narrow viewports with rotated formula symbols.
- [x] **Codebase Audit & Standardisation (v2.23.0)**: Resolved 146 lint and TypeScript compilation issues across the entire codebase, including converting `any` casts, removing unused variables/imports, and correcting React mounting warnings. Centralized logging by introducing a formatted structured logger mapping to `[Job/Operation] - [Category/Level] - [Detail Message]` format. Configured Docker container pipeline to preserve source test files, enabling successful containerized verification testing via the Vitest runner.
- [x] **Manual Accounts & Debts Creation (v2.22.2)**: Integrated support for creating and managing manual accounts and debts that are not synced from SimpleFIN, including tracking remaining payments. Created database migrations to add `remainingPayments` to the `DebtDetail` model, updated server actions `createManualAccountAction`, `saveDebtDetailAction`, and `deleteAccountAction`, and built toggleable creation form cards, inline name/balance editors, and remaining payment inputs into `/accounts` and `/debts` configuration views with responsive layout styles.
- [x] **Agent Rules Hardening & Styling Consistency Guidelines (v2.22.1)**: Formulated strict guidelines in [AGENTS.md](file:///e:/Coding%20Projects/CoinFlow/AGENTS.md) to prioritize production-ready code (preventing lazy/inline imports, banning type system evasion via `any` or `@ts-ignore`, requiring full TypeScript typing, runtime Zod validations, decoupled business logic, and LLM output sanitization) and styling/layout consistency (using root variables in [globals.css](file:///e:/Coding%20Projects/CoinFlow/src/app/globals.css) and global header templates).
- [x] **Code Solidification, Testing Suite, & API Hardening (v2.22.0)**: Upgraded Next.js to 16.2.6 to patch security vulnerabilities. Installed Vitest and established unit test suites for `debtUtils.ts` calculations and `mortgageService.ts` amortization. Installed Zod and added strict runtime schema validation and session guards to debts Server Actions. Added performance search indexes to the `Transaction` table (`accountId` and `payee`) and generated migrations to keep the database optimal. Appended a detailed self-hosting guide in the README, covering Docker Compose setups and multi-provider AI model configurations (Ollama, OpenAI, Gemini, Claude, Groq).
- [x] **Comprehensive Styling Unification & Global Variables Alignment (v2.21.0)**: Loaded premium fonts (Outfit and JetBrains Mono) globally via CSS imports. Added a unified page-header-flex layout and subpage descriptions on the main Dashboard to mirror the rest of the application. Replaced all hardcoded hex values in page-specific stylesheets (Settings, Mortgage, and Debts) with responsive root variables to ensure total consistency and theming compatibility.
- [x] **Unified Full-Width Layout, Gradient Headers & Collapsible Sidebar Tools (v2.20.0)**: Centralized page headers in global styles with standard text-gradients, bottom dividers, and expanded page content widths across Transactions, Goals, Settings, Mortgage, Debts, and Fire Drill views to match the Accounts Configuration page styling. Integrated a collapsible "Tools" dropdown list in the navigation sidebar to avoid crowding, dynamically defaulting to open when navigating to any tool sub-link, and automatically collapsing when navigating to primary pages. Supported sub-route path prefix matching (e.g., settings subpages) in active route checks.
- [x] **Debt Optimizer Layout Width & Interactive Settings Panel (v2.19.2)**: Centralized debt and liquid cash account configurations in a toggled header settings card with real-time graph recalculations and full-viewport width expansion on `/debts` view.
- [x] **Premium Cross-Browser Slider Layout Optimization (v2.19.1)**: Solved range input slider compression ("smushing") by using high-specificity selectors, cross-browser pseudoclass track/thumb alignments, and explicit box-model sizing definitions across `/fire-drill`, `/debts`, and `/mortgage` views.
- [x] **Financial Fire Drill, Debt Optimizer, & Refund Matching (v2.19.0)**: Added visual cash runway crisis simulator, Avalanche/Snowball strategy optimizer with interest leak notifications, and inline transaction refund matching tool.
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

## Recent Fixes & Features (v2.25.5)
- **Startup Config Validation**:
  - Implemented environment variable startup validation in `src/instrumentation.ts` to log error and exit process if required settings (`DATABASE_URL`, `APP_PASSWORD`, `NEXTAUTH_SECRET`) are missing.
- **Database Relationships & Indexing**:
  - Modified `prisma/schema.prisma` to explicitly set `onDelete: SetNull` or `onDelete: Cascade` on database relationships.
  - Added indexes on all missing foreign key columns including `tiedAccountId` in `Category`, `externalOrderId` in `ExternalOrderItem`, and `userId` in `ApiKey`.
  - Created and applied Prisma migration SQL files.
- **Docker & Linter Conformance**:
  - Updated `Dockerfile` to copy `eslint.config.mjs` to the runner stage.
  - Resolved lint errors in `scripts/doctor.ts`, `src/app/routeScanner.test.ts`, and `src/app/mortgage/MortgageClient.tsx` to achieve a clean lint run.

## Recent Fixes & Features (v2.25.4)
- **Logo Image Optimization Fix**:
  - Added the `unoptimized` prop to Next.js `Image` components in `Sidebar.tsx` to fix `400 (Bad Request)` error.
  - Resolved loading failure caused by Next.js standalone server failing to run image optimization in Docker without native `sharp` binary dependencies.
- **Workspace Rules Synchronization**:
  - Synchronized rules in `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and `.windsurfrules` with the latest global project rules template, adding guidelines for SPA UX, Coolify production volume mounts, and reverse-proxy CSRF/SSL termination.

## Recent Fixes & Features (v2.25.3)
- **AI Settings Dedicated Tab**:
  - Isolated the AI configuration settings into a dedicated settings subpage `/settings/ai`.
  - Removed all AI settings forms, server actions, and markup from the general settings page `/settings/general`.
  - Added an "AI Assistant" navigation link under Settings sidebar navigation `SettingsNav.tsx`.

## Recent Fixes & Features (v2.25.2)
- **Dynamic AI Settings & Visibility Toggle**:
  - Added AI settings fields (`aiEnabled`, `aiBaseUrl`, `aiApiKey`, `aiModel`, `aiChatId`, `aiThinkingEnabled`, `aiThinkingEffort`) to Settings schema and executed PostgreSQL migration.
  - Updated `aiService.ts` to retrieve and build AI configuration dynamically, verifying `aiEnabled` status to disable API requests if toggle is off.
  - Implemented form inputs and persistence inside Settings General page.
  - Implemented prop-driven conditional rendering for AI buttons on Transactions page, Tools settings view, and Reports dashboard, completely hiding all AI options when disabled.
  - Refactored `scripts/doctor.ts` to retrieve database settings for AI health checks.

## Recent Fixes & Features (v2.25.1)
- **Manual Home Valuation Isolation**:
  - Added `manualHomeValue` Decimal field to `MortgageDetail` model and created database migration.
  - Updated `updateMortgageDetails` server action to write manual inputs to `manualHomeValue` instead of overwriting synced averages.
  - Refactored `netWorthService.ts` to sum the effective home value (`manualHomeValue ?? homeValue`) across all active mortgages.
  - Updated `MortgageClient.tsx` state and forms to use `manualHomeValue`.
  - Refactored UI cards and progress bars to show manual valuations as the primary display when set, while displaying the synced averages in the subtext for comparison.

## Recent Fixes & Features (v2.25.0)
- **Multi-Mortgage Support**:
  - Refactored `src/app/mortgage/page.tsx` page loader to retrieve all mortgages.
  - Implemented dropdown select dropdown in the `MortgageClient.tsx` header for switching active mortgages.
  - Reset payoff extra payment variables and lump sums when switching active mortgages to keep calculations clean.
  - Added a `➕ Add Mortgage` button to toggle the setup card and select new accounts.
- **RentCast API Integration**:
  - Implemented `fetchRentCastValue` in `src/lib/services/valuationService.ts` querying the RentCast AVM value endpoint with street addresses.
  - Added password input field for `rentcastApiKey` in general settings page (`src/app/settings/general/page.tsx`).
  - Added `address` street address field to `MortgageDetail` model and setup form.
  - Automatically seed a `"RentCast"` provider in the `HomeValueProvider` table when saving a mortgage details card with a street address.

## Recent Fixes & Features (v2.24.2)
- **Workspace Diagnostics**:
  - Implemented `scripts/doctor.ts` execution check validating env configs, database connectivity, database migrations status, local ports (3000/5433), and AI integration reachability.
  - Added npm shortcut run script `"doctor": "ts-node scripts/doctor.ts"` inside `package.json`.
- **Dynamic Route Sanity Scanning**:
  - Implemented `src/app/routeScanner.test.ts` to fetch and verify that route handlers compile cleanly and behave as expected under Vitest.
  - Added a `vitest.config.ts` path alias resolver mapping `@/` to `./src/` for correct TypeScript resolution inside Vitest, and configured Dockerfile runner stage to copy it and the diagnostics scripts.
- **Log Standardization**:
  - Replaced remaining raw `console.log` statements in server code (`scrapingService.ts`, `api-utils.ts`, `auth/login`, `sync/background`, and `external-orders/sync`) to utilize the centralized structured `logger`.

## Recent Fixes & Features (v2.24.1)
- **Workspace Standards Sync**:
  - Synced local rules files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`) with the latest global developers standards template.
  - Formulated and synchronised rules covering sanity checks, test configurations, and environment configurations.
- **Category Detail Page Mobile Responsiveness**:
  - Added CSS media queries in `CategoryDetail.css` for viewports `<= 768px` and `<= 500px`.
  - Stacking transaction details, reclassification selectors, and action buttons vertically.
  - Stacked form input fields inside row and inline split elements.
  - Offset sticky headers to avoid overlap with the mobile top bar layout.

## Recent Fixes & Features (v2.24.0)
- **Premium Mobile Viewport Responsiveness**:
  - Restored responsive navigation by converting the hidden mobile sidebar into a slide-out drawer layout (`transform: translateX(-100%)`) with a glassmorphic look, and adding a fixed top header bar with a hamburger menu button.
  - Implemented vertical stacking grid system for transaction rows on viewports `<= 768px` using CSS Grid to arrange checkbox, date, and amount above the payee, and full-width category selectors below.
  - Set `min-width: 0` on transaction split select dropdown inputs to resolve overflow cutoffs.
  - Offset the sticky transaction actions header to `top: 59px` on mobile screens to keep it accessible beneath the mobile header.
  - Redesigned reports lists and rollover components into stacked grid layouts on smaller viewports.
  - Refactored cash health banner to render detail blocks in a column layout on screens `<= 600px`, rotating math symbols (`−`) by `90deg` to point down.

## Recent Fixes & Features (v2.23.0)
- **Codebase Audit & Standardisation**:
  - Audited and resolved 146 TypeScript compilation and ESLint issues.
  - Eliminated unsafe `any` casts and unused variables/imports across auth, simplefin, external orders, and AI services.
  - Corrected React rendering and mount state-cascade issues in `Sidebar.tsx` and `DebtsClient.tsx`.
  - Replaced the sidebar's LCP logo image with the Next.js `Image` component.
  - Centralized logs under a formatted, structured logger (`src/lib/logger.ts`) using the standard pattern: `[Job/Operation] - [Category/Level] - [Detail Message]`.
  - Configured the Docker production runner image stage to copy test files and configurations, enabling clean containerized `npm run test` execution.

## Recent Fixes & Features (v2.19.0)
- **Financial Fire Drill (Crisis Runway Simulator)**:
  - Built an interactive calculator route at `/fire-drill` that lets users adjust sliders for income loss and discretionary spending cuts.
  - Generates custom SVG remaining cash trajectory curves over 12 months, highlighting the exact date of cash exhaustion.
  - Dynamically lists discretionary categories with potential runway extensions (in days) if eliminated.
  - Provides survival classification toggles for budget categories, defaulting to Essential if tied to commitments.
- **Debt Snowball & Avalanche Payoff Command Center**:
  - Generalised debt acceleration modeling by establishing a `/debts` dashboard route.
  - Linked database schema via a new `DebtDetail` model to store custom APRs and minimum monthly payments.
  - Renders trajectory curves comparing Avalanche, Snowball, and Minimum-only payment options on a custom interactive SVG chart.
  - Features an **Interest Leak Detector** alert recommending users apply idle cash reserves (above emergency buffer thresholds) to liquidate high-APR liabilities.
  - Provides a step-by-step payoff checklist detail for the current month.
- **Smart Refund & Return Matcher**:
  - Implemented backend queries checking inflow transactions against previous outflows (last 90 days) for identical/similar payees.
  - Created a badge/trigger button **"🔍 Match"** next to positive inflow transactions on the transactions table.
  - Selecting a match links the refund split to the category of the original purchase, netting out category spending and keeping financial reports clean.
  - Exposed matching candidates through `/api/v1/transactions/refund-matches` endpoint.

## Recent Fixes & Features (v2.18.0)
- **Premium Mortgage Mastery & Historical Analysis Revamp**:
  - **Historical Analysis & Original Loan Amount**: Added `originalBalance` field to the database model and setup form. The chart now computes actual balance decay from your original loan amount and start date up to today (historical phase), combining it with future standard/accelerated balance projections from today (future phase), making the start date and original amount directly update the chart timeline and balance coordinates.
  - **Color-Coded Segments & Today Marker**: Colored historical paid balance in success-green (with gradient fill), future standard projections in dashed slate, and accelerated projections in solid purple. Positioned a vertical dashed line and glowing marker badge labeled "TODAY" to indicate exact progress. Improved Today Marker to render at index 0 even when `historyLength === 0`.
  - **Amortization Engine Upgrades**: Enhanced calculation helper in `mortgageService.ts` to accept a custom start date and compute monthly, annual, and custom date-locked lump-sum extra payments.
  - **Interactive Payoff Accelerator controls**: Implemented dual-sliders coupled with manual numeric inputs (monthly recurring extra and annual recurring extra) alongside a date-locked lump-sum manager.
  - **Payoff Trajectory SVG Chart & Hover Tooltip**: Built a beautiful custom dual-curve SVG chart illustrating standard vs. accelerated balance reduction with X-axis calendar years and Y-axis balance. Implemented an interactive mouse-over tooltip that tracks coordinates, correcting client-to-SVG viewBox scaling ratio, and displays standard/accelerated balance details and equity savings difference at the hovered point.
  - **Milestones Comparison Panel**: Created a strategy comparison grid showing Interest Tipping Point, total loan cost, interest savings, and 20%/50%/100% equity dates.
  - **Toggleable Amortization Details**: Added a toggle to switch between a calendar Year-by-Year Summary table and a scrollable Monthly Details table.
  - **Core Mortgage Form Inputs**: Completed the edit/setup form by adding fields to edit the Mortgage Start Date, Original Loan Amount, and Mortgage Term (Months) and correctly persist them.
  - **Restructured Page Header & Action Hierarchy**: Relocated the "Edit Core Details" button to the top-right of the page header (next to the title), making it highly visible and accessible. Styled the page header using Vanilla CSS (eliminating Tailwind class dependencies) to ensure correct flex alignment across all browser rendering pipelines. Cleaned up the sidebar card by removing the old duplicate button and expanding the "Sync Live Values" button to a full-width action.
  - **Docker Environment Alignment**: Appended `COMPOSE_PROJECT_NAME=webbudget` to `.env` to prevent Docker Compose project volume naming mismatch and keep database sessions active.

## Recent Fixes & Features (v2.17.2)
- **Retroactive Payee Normalization**: Implemented a bulk action button **"🧹 Normalize Payees"** on the Transactions page. Users can select specific transactions using checkboxes (or run on the entire view) to clean raw bank merchant descriptions into clean, human-readable payee names. Added `getCleanMerchantNamesBatch` inside `aiService.ts` to perform batch processing of raw payees in a single AI request, and created a new API route `/api/v1/ai/normalize-payees` to handle the batch processing and database updates.

## Recent Fixes & Features (v2.17.1)
- **Universal OpenAI-Compatible Fallback**: Implemented a session-wide capability cache and try-catch retry mechanism in the centralized completions wrapper in `aiService.ts`. If standard APIs (like OpenAI, Groq, or DeepSeek) throw a 400 Bad Request error due to custom parameters like `chat_id` (originally added for Open WebUI session persistence), the service automatically logs a warning, strips `chat_id` from the request payload, immediately retries the completion call, and disables `chat_id` for the rest of the server session.

## Recent Fixes & Features (v2.17.0)
- **Dashboard Inbox Transactions Banner**: Built a high-visibility, glassmorphic feedback banner directly on the main dashboard layout page above the Category Overview table. The banner shows the count of pending (uncategorized) transactions waiting in the user's inbox, along with their total summed balance (automatically hiding when the inbox is clean). Features a pulsing indicator dot, hover micro-animations, and an interactive review link redirecting to the `/transactions` Inbox page.

## Recent Fixes & Features (v2.16.0)
- **Dedicated Accounts Configuration Page**: Built a dedicated `/accounts` page route, client view (`AccountsClient.tsx`), and styles (`Accounts.css`) for centralizing all account-specific custom settings: inline renaming (stored as `displayName` in the database to prevent SimpleFIN resync overwrites, defaulting to the SimpleFin bank name if cleared), show/hide in the sidebar, asset/debt calculation inclusion, type classification (Cash/Debt), transaction visibility (`showTransactions`), and surplus status (renamed to "On Budget" and linked with "Show in Sidebar" so that hiding an account from the sidebar automatically sets it off-budget and disables the toggle switch in the UI). Cleaned up the left navigation sidebar by removing all inline toggles (`✓`/`✕`/`D`), filtering accounts based on these settings, and ensuring sidebar asset/debt totals only calculate for accounts currently shown in the sidebar.
- **Sidebar & Navbar Link Reordering**: Reordered the main layout navigation links to the user's structured order: Dashboard, Transactions (Inbox), Goals, Commitments, Accounts (inserted after Commitments), Mortgage, Net Worth, Reports, and Settings.
- **Total Assets & Debts Navigation Widget**: Calculated and displayed global total assets and total debts in a clean, glassmorphic layout card on the left navigation panel, regardless of whether accounts are on or off budget.
- **Precision Payee Scraper Matching**: Standardized external sync transaction matching by comparing transaction payee names against the source platform. Restricted matching for Amazon (contains "amazon" or "amzn"), Walmart (contains "walmart", "wal-mart", "wm supercenter", "wm.com", or starts with "wm "), and Lowe's (contains "lowes" or "lowe's") to prevent incorrect matches.
- **Click-to-Show Note Section**: Added click-activated transaction-level note editing directly under the payee on the transactions page, matching the category page behavior. Upgraded the note field to a larger, dedicated stacked textarea form entry field that supports keyboard navigation (Enter to save, Shift+Enter for newlines, Escape to cancel) and glassmorphic styling.
- **Conditional Split Amount Display**: Omitted rendering split amounts for transactions that are not split (i.e. only have one split) to eliminate visual noise and duplication of the total transaction amount.
- **Automatic HTTPS Promotion for OpenAI BaseURL**: Added logic in `aiService.ts` to automatically upgrade configured base URLs from `http://` to `https://` when pointing to remote domain names. This prevents 301 HTTP-to-HTTPS redirects from converting POST requests to GET requests, which was causing `405 Method Not Allowed` errors when communicating with remote Ollama/AI APIs.
- **Open WebUI Chat ID Integration**: Wrapped all AI calls through a centralized request handler in `aiService.ts` to pass the stateful `chat_id` request body parameter. Automatically defaults to `"webbudget-session-id"` when detecting `ollama` or `webui` endpoints, and supports custom overrides using the `OPENAI_CHAT_ID` or `AI_CHAT_ID` environment variables.
- **Overall Net Worth & Wealth Tracking Dashboard**: Built a dedicated `/net-worth` page route, client view, and service (`netWorthService.ts`) providing total asset and debt aggregation (including checking, savings, property valuation, loans, and credit card balances). Features a custom SVG area chart tracking historical net worth trend lines over the last 6 months via mathematical transaction-level balance reconstruction, with inline options to toggle account exclusion from the dashboard surplus and mark accounts as asset/debt.
- **Dashboard Category Overview Column Reordering**: Reordered the category spreadsheet columns on the homepage dashboard to Category, Budgeted, Balance, and Average Spending (in that order). Renamed the "Spent" column header to "Average Spending" to align the UI with the calculated monthly average spending.
- **Reports Layout & Rollover Engine Improvements**: Reordered columns on the Reports page category performance table to match Category, Spent, Avgg monthly, and Current balance, removing the overall annual budgeted column to clean up visual density. Recalculated the "Current balance" column to show the actual current category balance instead of the projected year-end balance. Pre-populated the Rollover Engine sidebar inputs with actual current category balances (defaulting negative balances/deficits to $0) and updated the backend settings action (`closeYearAndStartNext`) to enforce `rollover = max(0, surplus)` using actual category balance to protect against negative deficit rollovers into the next year.
- **Code Audit & Dynamic Import Optimizations**: Audited the codebase for bad programming patterns and replaced lazy dynamic imports with clean static imports at the top of the files in `actions.ts`, `valuationService.ts`, and `importService.ts`. Resolved multiple compiler and ESLint warnings by cleaning up unused variables and unused props in `ForecastCard.tsx` and `DashboardClient.tsx`.


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
- [ ] Test the Refund Matcher UI with positive synced transaction flows.
- [ ] Verify Debt payoff calculation checklist on active debt schedules.
- [ ] Monitor Nginx logs for any remaining session cookie rejection under high-load/multiple tabs.
- [ ] Test the newly added Realtor.com scraper with a live active-listing URL.

## Technical Details
- **Version**: 2.25.4
- **Core Files**:
  - `src/lib/services/aiService.ts`: Central completions loader and wrapper supporting settings toggles and fallback modes.
  - `src/app/settings/ai/page.tsx`: Isolated AI Assistant settings page.
  - `src/app/settings/general/page.tsx`: General settings page clean of AI settings.
  - `src/app/settings/SettingsNav.tsx`: Settings navigation bar mapping to the new tab.
  - `src/app/transactions/page.tsx`: Transactions page retrieving and passing active AI state.
  - `src/components/transactions/TransactionsClient.tsx`, `TransactionList.tsx`, `TransactionRow.tsx`: Prop-driven AI button rendering.
  - `src/app/settings/tools/page.tsx`: Settings tools view conditionally rendering AI-dependent features.
  - `src/app/reports/page.tsx` and `ReportsClient.tsx`: Insight reports view conditionally showing analysis options.
  - `scripts/doctor.ts`: Diagnostic runner utilizing DB settings.
  - `prisma/schema.prisma`: Config schema containing AI attributes.
  - `src/lib/services/scrapingService.ts`: Standardized logging.
  - `src/lib/api-utils.ts`: Standardized logging.
  - `src/app/api/v1/external-orders/sync/route.ts`: Standardized logging.
  - `src/app/api/v1/sync/background/route.ts`: Standardized logging.
  - `src/app/api/v1/auth/login/route.ts`: Standardized logging.
  - `src/app/categories/[id]/CategoryDetail.css`: Mobile styling media queries.
  - `AGENTS.md`: Workspace rules file synchronized with global template.
  - `CLAUDE.md`: Workspace rules file synchronized with global template.
  - `.cursorrules`: Workspace rules file synchronized with global template.
  - `.windsurfrules`: Workspace rules file synchronized with global template.
  - `src/app/debts/DebtsClient.tsx`: Added remaining payments column and inline inputs.
  - `src/app/debts/actions.ts`: Added schema validations and save actions for remaining payments.
  - `src/lib/services/debtService.ts`: Added getter/setter database support for remaining payments.
  - `src/app/accounts/AccountsClient.tsx`: Added form card and inline balance editors.
  - `src/app/accounts/Accounts.css`: Form styles and layout modifiers.
  - `src/app/categories/actions.ts`: Added create, update, and delete actions for manual accounts.
  - `src/components/Sidebar.tsx`: Grouped secondary links into a collapsible Tools dropdown.
  - `src/app/globals.css`: Added global header and title styling rules.
  - `src/app/transactions/Transactions.css`: Removed max-width layout constraint and local page-header overrides.
  - `src/app/settings/Settings.css`: Removed max-width layout constraint and local page-header overrides.
  - `src/app/goals/Goals.css`: Removed max-width layout constraint and local page-header overrides.
  - `src/app/mortgage/Mortgage.css`: Removed local page-header overrides.
  - `src/app/debts/Debts.css`: Removed local page-header overrides.
  - `src/app/fire-drill/FireDrill.css`: Removed local page-header overrides.
  - `prisma/schema.prisma`: Added `DebtDetail` model and generated database migration files.
  - `src/lib/debtUtils.ts`: Pure JS calculations for Avalanche, Snowball, and Minimums simulations.
  - `src/lib/services/debtService.ts`: Database getters and setters for the Debt Optimizer features.
  - `src/app/debts/`: Renders `/debts` page, stylesheet, and Server Actions to persist custom debt details.
  - `src/app/fire-drill/`: Renders `/fire-drill` crisis runway pages, CSS, and interactive slider logic.
  - `src/app/api/v1/transactions/refund-matches/route.ts`: API route exposing refund matching candidates.
  - `src/app/transactions/TransactionRow.tsx`: Integrated inline refund search results, badge controls, and matcher linking.
  - `src/components/Sidebar.tsx`: Added navigation links for Debts and Fire Drill.

