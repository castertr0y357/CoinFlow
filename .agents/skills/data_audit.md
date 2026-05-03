# Skill: Data Quality Audit

## Trigger
- Execute after any successful bank synchronization (`/api/v1/sync/simplefin`).
- Execute when the user asks "How does my data look?".

## Actions
1. **Consistency Check**: Query the database for transactions with the same amount, date, and payee within a 24-hour window (potential duplicates).
2. **Orphan Search**: Identify transactions that have been imported but have no category assigned for more than 7 days.
3. **Audit Alignment**: Check if the sum of all `Category` balances for a specific `tiedAccountId` exceeds the current `Account` balance.
4. **Summary Report**: Provide a concise summary of findings to the user:
   - "X new transactions found."
   - "Y potential duplicates detected."
   - "Z categories are over-allocated."

## Constraints
- Do not delete transactions automatically.
- Report anomalies but wait for user confirmation before performing mass deletions or re-categorizations.
