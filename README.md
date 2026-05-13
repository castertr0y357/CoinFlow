# CoinFlow 💎🏦

CoinFlow is a premium, self-hosted financial automation hub designed for those who want institutional-grade insights with 100% privacy. Built with a "Carbonated Glass" aesthetic, it combines bank-sync automation with local AI to transform cryptic transaction data into a clear financial strategy.

## 🚀 Core Pillar Features

### 🧠 Local AI Intelligence
- **Memory-Driven Categorization**: The system learns your habits. After a few manual tweaks, it mirrors your logic for future transactions.
- **Merchant Humanizer**: Automatically cleans cryptic bank memos (e.g., `SQ * JOES 123`) into readable names (`Joe's Coffee`).
- **Smart Splitting**: Instant AI analysis for complex receipts (like Amazon) to allocate items into the correct budget buckets.

### 🏠 Mortgage Mastery & Equity Tracking
- **Multi-Source Valuation**: Scrapes live estimates from **Zillow** and **Redfin** to provide a "Smart Average" of your home's value.
- **Payoff Accelerator**: Interactive slider to visualize how extra principal payments shave years and thousands of dollars off your loan.
- **Liquidity Health**: Real-time comparison of bank cash vs. budget obligations.

### 🛒 Precision E-Commerce Sync (Browser Extension)
- **Deep Sync Engine**: Automatically fetches granular order details from Amazon, Walmart, and Lowe's.
- **Itemized Breakdown**: Converts bulk e-commerce totals into line-by-line transaction splits.
- **Smart Matching**: Proactively matches purchase data to bank transactions within a rolling 13-day window.
- **Deduplication v2**: Hardened logic to prevent redundant syncing of overlapping order data.

### 📈 Reports & Data Portability
- **Yearly Deep-Dives**: Historical spending analysis with AI-powered trend spotting.
- **Surplus Rollover**: Intelligently carry over unspent funds from one calendar year to the next.
- **Data Vault**: One-click JSON backup and restore. Your data moves with you.

### 🛡️ Fortress Security
- **JWT Authentication**: Secured with a master password and encrypted session tokens.
- **Middleware Gating**: All pages and APIs are protected by default.
- **Self-Hosted**: You own your database. No third-party tracking.

## 🛠️ Tech Stack
- **Framework**: Next.js 16+ (Turbopack)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Vanilla CSS with Glassmorphism Design System
- **Automation**: SimpleFIN Bridge for bank sync
- **Extension**: CoinFlow Sync (Manifest v3) for deep e-commerce scraping
- **AI**: Local LLM Integration (Ollama/Gemma compatible)

## 🏁 Setup Instructions

1.  **Environment Setup**:
    ```bash
    cp .env.example .env
    # Fill in your DATABASE_URL, SIMPLEFIN_TOKEN, and APP_PASSWORD
    ```

2.  **Install & Build**:
    ```bash
    npm install
    npx prisma db push
    npm run build
    ```

3.  **Run**:
    ```bash
    npm run start
    ```

5.  **Extension Setup**:
    - Open Chrome Extensions (`chrome://extensions`).
    - Enable "Developer mode".
    - Click "Load unpacked" and select the `extension` folder in this repository.
    - Click the Sync button on supported retailer pages (Amazon, Walmart, Lowe's).

6.  **Automate**:
    Set up a CRON job to call `/api/v1/sync/background` with your internal API key to keep your data live.

---
*Built for the privacy-conscious optimizer.*
