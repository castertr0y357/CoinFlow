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

### 🐳 Deploying with Docker Compose (Recommended)

The easiest way to run CoinFlow is using Docker Compose, which boots the Next.js application and the PostgreSQL database together:

1. Copy the environment template to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and configure your credentials (e.g., your master `APP_PASSWORD`, SimpleFIN token, and local/remote AI API configurations).
3. Start the containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
4. Access the web dashboard at `http://localhost:3000`. Your transaction sync worker will automatically run in the background every 6 hours.

---

### 💻 Local Development Setup (Manual)

If you prefer to run the application outside of Docker:

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

## 🤖 AI Provider Integration Guide

CoinFlow uses the OpenAI SDK to interact with AI completions. Because of this, it can connect to **any** OpenAI-compatible API endpoint (local or cloud-hosted). Configure your environment variables in `.env` depending on your provider:

### 1. Local LLM (Ollama)
Perfect for 100% private, free, and local processing.
- **`OPENAI_BASE_URL`**: `http://host.docker.internal:11434/v1` (if running inside Docker) or `http://localhost:11434/v1` (if running manually)
- **`OPENAI_API_KEY`**: `sk-placeholder` (or any string)
- **`AI_MODEL`**: The name of the model you pulled (e.g., `gemma4:e4b`, `llama3`, `mistral`, or `qwen2.5`)

### 2. Standard OpenAI
Provides high accuracy and fast response times.
- **`OPENAI_BASE_URL`**: `https://api.openai.com/v1` (or leave empty to default)
- **`OPENAI_API_KEY`**: Your OpenAI API key (`sk-proj-...`)
- **`AI_MODEL`**: `gpt-4o-mini` (highly recommended for cost/speed) or `gpt-4o`

### 3. Google Gemini (via OpenAI Compatibility)
Excellent performance, large context windows, and low cost.
- **`OPENAI_BASE_URL`**: `https://generativelanguage.googleapis.com/v1beta/openai`
- **`OPENAI_API_KEY`**: Your Gemini API key from Google AI Studio.
- **`AI_MODEL`**: `gemini-1.5-flash` or `gemini-2.0-flash`

### 4. Anthropic Claude (via OpenRouter proxy)
Anthropic's models are accessible through OpenAI-compatible aggregators like OpenRouter.
- **`OPENAI_BASE_URL`**: `https://openrouter.ai/api/v1`
- **`OPENAI_API_KEY`**: Your OpenRouter API key.
- **`AI_MODEL`**: `anthropic/claude-3.5-sonnet` or `anthropic/claude-3-haiku`

### 5. Groq (High-Speed Cloud Llama/Mixtral)
Ultra-fast API response times.
- **`OPENAI_BASE_URL`**: `https://api.groq.com/openai/v1`
- **`OPENAI_API_KEY`**: Your Groq API key.
- **`AI_MODEL`**: `llama-3.3-70b-versatile` or `mixtral-8x7b-32768`

---
*Built for the privacy-conscious optimizer.*
