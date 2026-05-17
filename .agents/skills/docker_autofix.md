# Skill: Docker Build & Self-Heal Loop
 
 ## Trigger
 - Execute this skill immediately after any file modification or when a "build" is requested.
 
 ## Actions
 1. **Rebuild**: Run `docker-compose down && docker-compose up --build -d` in the project root.
 2. **Synchronization**: Immediately run `docker exec webbudget-web-1 prisma db push` to ensure database alignment.
 3. **Wait for Completion**: You MUST NOT return to the user until the build command has finished. Use `command_status` to monitor the background process.
 4. **Log Analysis & Self-Heal**: 
    - Monitor `docker logs --tail 50 webbudget-web-1`.
    - If errors (like P2022) appear, apply a fix and restart this loop.
 5. **Final Check**: Verify the service is "Ready" (Next.js log) before informing the user.
 
 ## Constraints
 - Do not stop until the containers are 'Up', 'Healthy', and 'Ready'.
 - Never tell the user a task is complete while a build is still running in the background.
 - If a fix fails three times, pause and summarize the blockage to the user.
 - **Migration Compliance**: If `prisma/schema.prisma` was modified, verify that a migration file has been created via `npx prisma migrate dev`. Avoid pushing direct schema changes in production-simulated environments.