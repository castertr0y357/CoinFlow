export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('@/lib/logger');
    // Validate required environment variables
    const requiredEnv = ['DATABASE_URL', 'APP_PASSWORD', 'NEXTAUTH_SECRET'];
    const missingEnv = requiredEnv.filter(envVar => !process.env[envVar]);
    
    if (missingEnv.length > 0) {
      logger.error('Startup', `Missing required environment variables: ${missingEnv.join(', ')}`, undefined, {
        action: 'startup.validation',
        context: { missing: missingEnv },
      });
      process.exit(1);
    }

    // We only want to run this in the Node.js environment, not Edge
    const { syncSimpleFin } = await import('@/lib/services/syncService');
    const { default: prisma } = await import('@/lib/prisma');
    const { createBackupSnapshot } = await import('@/lib/services/backupService');
    
    // Pre-flight database connection check with retries and exponential backoff
    logger.info('Startup', 'Running pre-flight database connection check...', { action: 'startup.db_check' });
    let dbConnected = false;
    let retryDelay = 1000;
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info('Startup', 'Database connection established successfully.', {
          action: 'startup.db_check',
          context: { attempt },
        });
        dbConnected = true;
        break;
      } catch (error) {
        logger.warn('Startup', `Database connection failed (attempt ${attempt}/5), retrying in ${retryDelay}ms...`, {
          action: 'startup.db_check',
          context: { attempt, retryDelay, error: String(error) },
        });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
      }
    }

    if (!dbConnected) {
      logger.error('Startup', 'Database connection failed critically after 5 attempts. Exiting process.', undefined, {
        action: 'startup.db_check',
      });
      process.exit(1);
    }

    logger.info('Startup', 'Initializing background sync worker and scheduler...', { action: 'startup.workers' });
    
    // Run SimpleFIN sync every 6 hours
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        logger.info('Scheduler', 'Running scheduled SimpleFIN sync...', { action: 'cron.simplefin_sync' });
        await syncSimpleFin();
        logger.info('Scheduler', 'Scheduled SimpleFIN sync completed successfully.', { action: 'cron.simplefin_sync' });
      } catch (error) {
        logger.error('Scheduler', 'Scheduled SimpleFIN sync failed', error, { action: 'cron.simplefin_sync' });
      }
    }, SIX_HOURS);

    // Run compressed backup snapshot every 24 hours (daily backup)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        logger.info('Scheduler', 'Running scheduled database backup...', { action: 'cron.backup' });
        const filename = await createBackupSnapshot('auto');
        if (filename) {
          logger.info('Scheduler', `Scheduled backup created successfully: ${filename}`, {
            action: 'cron.backup',
            context: { filename },
          });
        } else {
          logger.error('Scheduler', 'Scheduled backup execution returned null.', undefined, { action: 'cron.backup' });
        }
      } catch (error) {
        logger.error('Scheduler', 'Scheduled database backup failed', error, { action: 'cron.backup' });
      }
    }, ONE_DAY);
  }
}
