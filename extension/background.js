chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`CoinFlow [Background]: Received message type/action: ${request.action || request.type} from ${request.source || 'unknown'}`);
  
  if (request.action === 'syncOrders') {
    syncOrders(request.source, request.orders)
      .then(data => {
        console.log(`CoinFlow [Background]: Sync successful for ${request.source}`);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error(`CoinFlow [Background]: Sync failed for ${request.source}:`, error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true; 
  }
  
  console.warn(`CoinFlow [Background]: Unknown message received:`, request);
});

async function syncOrders(source, orders) {
  const settings = await chrome.storage.local.get(['apiUrl', 'apiKey']);
  
  if (!settings.apiUrl || !settings.apiKey) {
    const err = "API URL or API Key not configured. Please check extension settings.";
    console.error(`CoinFlow [Background]: ${err}`);
    throw new Error(err);
  }

  const baseUrl = settings.apiUrl.replace(/\/$/, "");
  const syncUrl = `${baseUrl}/api/v1/external-orders/sync`;
  
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`CoinFlow [Background]: Sync Attempt ${attempt}/3 to ${syncUrl}`);
      console.log(`CoinFlow [Background]: Syncing ${orders.length} orders from ${source}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`CoinFlow [Background]: Request timeout (15s) reached for attempt ${attempt}`);
        controller.abort();
      }, 15000); 

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': settings.apiKey
        },
        body: JSON.stringify({ source, orders }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`CoinFlow [Background]: Server responded with status ${response.status}`);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `Server responded with ${response.status}`;
          console.error(`CoinFlow [Background]: Server Error Body:`, errorData);
        } catch (e) {
          errorMessage = `Server responded with ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`CoinFlow [Background]: Sync result:`, result);
      return result;
    } catch (error) {
      lastError = error;
      const isAbort = error.name === 'AbortError';
      console.warn(`CoinFlow [Background]: Attempt ${attempt} failed${isAbort ? ' (Timeout)' : ''}:`, error.message);
      
      if (attempt < 3) {
        const delay = 1000 * attempt;
        console.log(`CoinFlow [Background]: Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Sync failed after 3 attempts: ${lastError.message}`);
}
