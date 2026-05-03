export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
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
