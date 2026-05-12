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
3. **Log Audit**: Run `docker-compose logs --tail 100 web` and search for:
   - `error` (case-insensitive)
   - `500` status codes
   - Prisma exception traces (`P2022`, etc.)
   - Next.js hydration errors or runtime crashes.
4. **Visual Handoff**: Since visual verification is now the user's responsibility, notify the user that technical checks passed and ask them to verify the UI.

## Constraints
- **Speed First**: Use `curl` or `read_url_content` (without JS) to check status codes. Do NOT use `browser_subagent` unless explicitly requested for a deep visual bug.
- **Fail Early**: If any `curl` returns a non-200 status or the API returns an error object, consider it a regression.
- **Autonomous Fix**: If a 500 error is found in logs, attempt one autonomous fix based on the stack trace. If it fails, notify the user.
