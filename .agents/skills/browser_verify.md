# Skill: Automated Service Verification (Technical)
 
 ## Trigger
 - Execute this skill immediately after a successful Docker build (from `docker_autofix`).
 - Execute when the user reports a "blank page" or potential runtime bug.
 
 ## Actions
 1. **Endpoint Health Check**: Verify key routes return HTTP 200 using `curl -I`.
    - Dashboard: `http://localhost:3000/`
    - Transactions: `http://localhost:3000/transactions`
    - Settings: `http://localhost:3000/settings/general`
 2. **API Integrity Check**: Verify the core API is responding correctly.
    - Budget Tally: `curl -s http://localhost:3000/api/v1/budget/tally` (Check for valid JSON/200 status).
 3. **UI Integrity Check (Hydration & CSS)**: If the change affects frontend files (`.tsx`, `.ts` under components or app, or `.css`), initiate a browser check using `browser_subagent`:
    - Navigate to `http://localhost:3000/` and check for visual rendering.
    - Query browser logs to ensure no `React Hydration Mismatch` or uncaught exceptions occur.
 4. **Log Audit**: Run `docker-compose logs --tail 100 web` and search for:
    - `error` (case-insensitive)
    - `500` status codes
    - Prisma exception traces (`P2022`, etc.)
    - Next.js hydration errors or runtime crashes.
 5. **Visual Handoff**: Notify the user that technical checks passed and summarize the verification state.
 
 ## Constraints
 - **Smart Execution**: Rely on fast `curl` checks for pure backend, database, or worker modifications. Use `browser_subagent` **only** for UI-facing modifications to capture hydration or visual bugs early while keeping execution speed and token cost optimized.
 - **Fail Early**: If any `curl` returns a non-200 status or the API returns an error object, consider it a regression.
 - **Autonomous Fix**: If a 500 error is found in logs, attempt one autonomous fix based on the stack trace. If it fails, notify the user.
