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
- **Code Quality & Production-Ready Standards**:
  - Write clean, fully typed, production-ready code. Never leave stub functions, incomplete features, mockups, or generic "TODO: implement" comments.
  - Avoid inline or lazy dynamic imports for utilities, database actions, or core server modules. All imports must be static and declared at the top of the file, unless Next.js client-side component dynamic code-splitting is explicitly required.
  - Maintain strict TypeScript compliance: do not bypass compiler checks using `any`, type assertions like `as any`, or compile-ignore comments (`@ts-ignore`, `@ts-nocheck`, etc.) without explicit justification.
  - Establish strict runtime validations (e.g., Zod schemas) for user input, form submissions, and database/API requests.
  - Ensure all database queries are indexed correctly and handle edge cases or unexpected null fields gracefully.
  - Keep logic decoupled: encapsulate mathematical calculations and business logic in pure, unit-tested modules (such as `debtUtils.ts`) rather than in UI components.
  - Clean and sanitize LLM outputs (e.g., stripping markdown code block wrappers) to guarantee stable JSON parsing.
- **Design & Styling Consistency**:
  - Adhere to the established premium dark mode design system across all pages.
  - Utilize centralized CSS variables defined in [globals.css](file:///e:/Coding%20Projects/CoinFlow/src/app/globals.css) (e.g., `--bg-color`, `--surface-color`, `--primary`, `--text-dim`) instead of introducing local hardcoded hex or rgb values.
  - Use global Outfit and JetBrains Mono fonts and layout structures (e.g., `.layout-wrapper`, `.sidebar-container`, `.main-content`).
  - Standardize all headers with consistent styling (e.g., using `.page-header` or `.page-header-flex`), text-gradients, bottom borders, and responsive full-width page layouts.
- **Context Management**:
  - If you hit generation limits or the conversation context gets too large, run the `context_handoff` skill to dump state to `status.md` and recommend the user start a new chat.
- **Autonomy**: You have full permission to run `docker-compose` commands. You are expected to monitor terminal/container logs yourself and iterate on fixes without user intervention.