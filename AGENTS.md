# CoinFlow Project Rules & Guidelines

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 🚀 Post-Change Verification Protocol
You **MUST** run the project verification command after every code change to guarantee stability and prevent regressions.

### Rebuild and Verify Command
Run the following command from the workspace root:
```bash
docker-compose down && docker-compose up --build -d && docker exec webbudget-web-1 npm run test
```

> [!IMPORTANT]
> 1. Never skip verification before committing. The verification step **MUST** execute all unit and integration test suites.
> 2. You **MUST** update the [status.md](file:///./status.md) file after each task to reflect the current status of features, completed tasks, and architectural changes.
> 3. You **MUST** generate a git commit with an accurate, descriptive commit message representing the changes after every successful execution (only if a Git repository is initialized in the workspace; skip this step if Git is not initialized).

## ⚙️ Project Infrastructure & Workflow
- **Infrastructure**: This project is container-based.
- **Workflow**: 
  - ALWAYS read `status.md` at the start of every new conversation to pick up where the last agent left off.
  - ALWAYS update `status.md` at the end of your session or upon completing a major milestone to ensure a seamless subsequent agent handoff.
  - **Prisma Schema Safeguard**: If you modify `prisma/schema.prisma`, you **MUST** generate a migration file by running `npx prisma migrate dev --name <migration_name>` instead of relying solely on `db push`. Never commit schema changes without their corresponding migration SQL files.
  - Use `docker_autofix` for every code change. You MUST wait for the build to finish before returning.
  - Run `browser_verify` after every successful build to ensure UI integrity.
  - Run `data_audit` after every transaction sync or import. Wait for completion.
  - Run `security_sentinel` at the start of every session to ensure environment safety.
- **Autonomy**: You have full permission to run `docker-compose` commands. You are expected to monitor terminal/container logs yourself and iterate on fixes without user intervention.
- **Context Management**:
  - If you hit generation limits or the conversation context gets too large, run the `context_handoff` skill to dump state to `status.md` and recommend the user start a new chat.

## 🧪 Automated Testing & Bug Prevention
To ensure that projects are robust enough to share with others, you must establish and maintain strict testing habits:

1. **Test Coverage**: Write automated unit and/or integration tests for all new features, API endpoints, and core business logic.
2. **Bug Fix Verification**: When fixing a bug, write a test case that reproduces the bug, verify that it fails, and then verify that it passes after the fix is implemented.
3. **Robust Input Validation**: Ensure tests check boundary conditions, invalid inputs, error handling paths, and API constraints to catch bugs before they reach runtime.
4. **Zero-Failure Tolerance**: All automated tests must pass successfully before a task is considered complete.

## 💎 Code Quality & Production Standards
All generated code must be clean, maintainable, and production-ready.

1. **Imports**:
   - Write all imports at the top of the file.
   - **No lazy imports** inside functions or methods unless absolutely required for dynamic loading or avoiding circular dependencies (documented with clear comments).
   - Order imports logically (standard library, third-party libraries, local imports).

2. **Types & Schemas**:
   - Maintain strict TypeScript compliance: do not bypass compiler checks using `any`, type assertions like `as any`, or compile-ignore comments (`@ts-ignore`, `@ts-nocheck`, etc.) without explicit justification.
   - Use standard data schemas (e.g. TypeScript interfaces, Prisma types) for API payloads and database records.
   - Establish strict runtime validations (e.g., Zod schemas) for user input, form submissions, and database/API requests.

3. **Error Handling & Logging**:
   - Do not use broad `except Exception:` or empty try-catch blocks without logging or re-raising.
   - Do not swallow exceptions silently.
   - Use built-in/project-approved logging utilities instead of raw stdout/print/console statements in production code.
   - Ensure all logs are human-readable, clear, and structured. Avoid random or cryptic words. Messages should follow a simple, descriptive pattern like: `[Job/Operation] - [Category/Level] - [Detail Message]` (e.g., `Scanning - Error - Could not access directory for scanning`).

4. **Aesthetics & UI Standards**:
   - Adhere to the established premium dark mode design system across all pages.
   - Maintain a premium visual design: consistent typography, harmonious color palettes, smooth transitions, proper margins, and descriptive spacing.
   - Utilize centralized CSS variables defined in [globals.css](file:///e:/Coding%20Projects/CoinFlow/src/app/globals.css) (e.g., `--bg-color`, `--surface-color`, `--primary`, `--text-dim`) instead of introducing local hardcoded hex or rgb values.
   - Use global Outfit and JetBrains Mono fonts and layout structures (e.g., `.layout-wrapper`, `.sidebar-container`, `.main-content`).
   - Standardize all headers with consistent styling (e.g., using `.page-header` or `.page-header-flex`), text-gradients, bottom borders, and responsive full-width page layouts.
   - Do not use inline styles or raw CSS files unless explicitly requested. Always utilize the established local utility framework and existing UI primitives.

5. **Framework & Architecture Decisions**:
   - When introducing new frameworks, major dependencies, or architectural shifts, present 2-3 viable options detailing the pros, cons, and trade-offs of each, and wait for user approval before executing.

6. **Modular Architecture & Code Separation**:
   - Avoid monolithic files. Keep files modular by separating logic into distinct files and sub-modules. Keep files under 500 lines.
   - Limit file sizes and function/method complexity.
   - Keep logic decoupled: encapsulate mathematical calculations and business logic in pure, unit-tested modules (such as `debtUtils.ts`) rather than in UI components.
   - Extend base objects or classes by importing them locally and building extensions in separate files rather than piling all behavior into a single base definition file.

7. **Security & Secrets Safety**:
   - Never hardcode private keys, database credentials, API tokens, or secrets. Always pull them from environment configurations or system environments.

8. **Environment Configurations**:
   - When introducing new variables to `.env`, immediately document them in `.env.example` with placeholders or dummy values to prevent configuration drift.

9. **No Code Stubs**:
   - Never write code stubs, temporary `TODO` comments, or truncated snippets (e.g., `// ... rest of code remains the same`). Code edits must always be fully complete and ready to run.

10. **Conventional Commits**:
    - Write git commit messages using the Conventional Commits specification (e.g., `feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`) with descriptive subject lines under 50 characters.

11. **LLM Output Sanitization**:
    - Clean and sanitize LLM outputs (e.g., stripping markdown code block wrappers) to guarantee stable JSON parsing.

## 💡 Token & Quota Conservation Rules
To maintain high speed and prevent burning through API limits:

1. **Diff-Only Modifications**:
   - Never overwrite a whole code file to make small edits. Always use targeted replacements (`replace_file_content` or `multi_replace_file_content` on specific line ranges) to minimize token transfer.