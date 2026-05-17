<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Rules
- **Infrastructure**: This project is container-based.
- **Workflow**: 
  - ALWAYS read `status.md` at the start of every new conversation to pick up where the last agent left off.
  - ALWAYS update `status.md` at the end of your session or upon completing a major milestone to ensure a seamless subsequent agent handoff.
  - **Prisma Schema Safeguard**: If you modify `prisma/schema.prisma`, you **MUST** generate a migration file by running `npx prisma migrate dev --name <migration_name>` instead of relying solely on `db push`. Never commit schema changes without their corresponding migration SQL files.
  - Use `docker_autofix` for every code change. You MUST wait for the build to finish before returning.
  - Run `browser_verify` after every successful build to ensure UI integrity.
  - Run `data_audit` after every transaction sync or import. Wait for completion.
  - Run `security_sentinel` at the start of every session to ensure environment safety.
- **Context Management**:
  - If you hit generation limits or the conversation context gets too large, run the `context_handoff` skill to dump state to `status.md` and recommend the user start a new chat.
- **Autonomy**: You have full permission to run `docker-compose` commands. You are expected to monitor terminal/container logs yourself and iterate on fixes without user intervention.