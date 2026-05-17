# Skill: Security Sentinel
 
 ## Trigger
 - Execute once at the start of every new session.
 - Execute whenever `package.json` is modified.
 
 ## Actions
 1. **Audit**: Run `npm audit --omit=dev` to check for known vulnerabilities in dependencies, avoiding noise from development-only tooling.
 2. **Outdated Check**: Run `npm outdated` to identify critical security patches for core frameworks (Next.js, Prisma, Tailwind).
 3. **Environment Scan**: Verify that no `.env` files or sensitive keys have been accidentally committed to the repository (check `.gitignore`).
 4. **Base Image Review**: Check `Dockerfile` for the use of "latest" tags or outdated Node.js base images and recommend specific versions.
 
 ## Constraints
 - Do not run `npm audit fix` without a prior backup or git commit.
 - Always run `browser_verify` after updating any dependency to ensure no breaking changes were introduced.
