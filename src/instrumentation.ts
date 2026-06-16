export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required environment variables
    const requiredEnv = ['DATABASE_URL', 'APP_PASSWORD', 'NEXTAUTH_SECRET'];
    const missingEnv = requiredEnv.filter(envVar => !process.env[envVar]);
    
    if (missingEnv.length > 0) {
      console.error(`[Startup] - Error - Missing required environment variables: ${missingEnv.join(', ')}`);
      process.exit(1);
    }

    // We only want to run this in the Node.js environment, not Edge
    const { syncSimpleFin } = await import('@/lib/services/syncService');
    const { default: prisma } = await import('@/lib/prisma');
    const { createBackupSnapshot } = await import('@/lib/services/backupService');
    
    // Pre-flight database connection check with retries and exponential backoff
    console.log('Running pre-flight database connection check...');
    let dbConnected = false;
    let retryDelay = 1000;
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('[Startup] - Database - Connection established successfully.');
        dbConnected = true;
        break;
      } catch (error) {
        console.warn(`[Startup] - Database - Connection failed (attempt ${attempt}/5), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
      }
    }

    if (!dbConnected) {
      console.error('[Startup] - Database - Connection failed critically after 5 attempts. Exiting process.');
      process.exit(1);
    }

    console.log('Initializing background sync worker...');
    
    // Run SimpleFIN sync every 6 hours
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        console.log('Running scheduled SimpleFIN sync...');
        await syncSimpleFin();
        console.log('Scheduled sync completed successfully.');
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    }, SIX_HOURS);

    // Run compressed backup snapshot every 24 hours (daily backup)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        console.log('Running scheduled database backup...');
        const filename = await createBackupSnapshot('auto');
        if (filename) {
          console.log(`Scheduled backup created successfully: ${filename}`);
        } else {
          console.error('Scheduled backup execution returned null.');
        }
      } catch (error) {
        console.error('Scheduled database backup failed:', error);
      }
    }, ONE_DAY);
  }
}
