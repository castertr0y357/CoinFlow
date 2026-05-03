# Skill: Automated Regression Testing

## Trigger
- Execute this skill immediately after a successful Docker build (from `docker_autofix`).
- Execute when the user reports a "blank page" or UI bug.

## Actions
1. **Health Check**: Run a `curl` against `http://localhost:3000/api/health` (if available) or the root `/` to ensure the server is responding.
2. **Visual Verification**: Use the `browser_subagent` to:
   - Visit the Dashboard (`/`).
   - Check for the presence of the `CategorySpreadsheet` and the `ForecastCard`.
   - Verify that account balances are rendering as numbers (not `NaN` or `$0` if data is expected).
3. **Navigation Check**: Briefly click through to `/transactions` and `/commitments` to ensure routes are not throwing 404s or 500s.
4. **Log Correlation**: If any page fails to render, immediately run `docker-compose logs web` to correlate the UI failure with a server-side stack trace.

## Constraints
- Do not modify data during verification.
- If a regression is found, attempt one autonomous fix. If it fails, revert the last code change and notify the user.
