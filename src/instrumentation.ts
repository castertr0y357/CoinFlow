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
    
    console.log('Initializing background sync worker...');
    
    // Run every 6 hours
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
  }
}
