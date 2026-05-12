/**
 * CoinFlow Browser Extension Utilities
 */

window.CoinFlowUtils = {
  /**
   * Clean and parse price strings to numbers
   */
  parsePrice: (priceStr) => {
    if (!priceStr) return 0;
    const clean = priceStr.replace(/[^\d.]/g, '');
    const price = parseFloat(clean);
    return isNaN(price) ? 0 : price;
  },

  /**
   * Normalize date strings
   */
  parseDate: (dateStr) => {
    if (!dateStr) return new Date().toISOString();
    // Remove common prefixes
    const clean = dateStr
      .replace(/Order placed|Ordered on|Picked up on|Delivered on|purchase/gi, '')
      .trim();
    let date = new Date(clean);
    if (isNaN(date.getTime())) {
      // Fallback for weird formats or relative dates
      date = new Date();
    }
    return date.toISOString();
  },

  /**
   * Create a premium floating sync button
   */
  createSyncButton: (onSync) => {
    const btn = document.createElement('button');
    btn.id = 'coinflow-sync-btn';
    btn.innerHTML = `
      <span class="cf-icon">🔄</span>
      <span class="cf-text">Sync to CoinFlow</span>
    `;
    
    // Apply premium glassmorphism styles
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      zIndex: '2147483647',
      padding: '12px 24px',
      background: 'rgba(99, 102, 241, 0.85)',
      backdropFilter: 'blur(12px)',
      webkitBackdropFilter: 'blur(12px)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '16px',
      cursor: 'pointer',
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      fontWeight: '600',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });

    // Hover effects
    btn.onmouseover = () => {
      btn.style.transform = 'translateY(-4px) scale(1.02)';
      btn.style.boxShadow = '0 12px 40px 0 rgba(31, 38, 135, 0.45)';
      btn.style.background = 'rgba(99, 102, 241, 0.95)';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.37)';
      btn.style.background = 'rgba(99, 102, 241, 0.85)';
    };

    btn.onclick = async (e) => {
      console.log("CoinFlow [Utils]: Sync button clicked");
      // DEBUG: Alt + Click to clear sync cache
      if (e.altKey) {
        console.log("CoinFlow [Utils]: Alt key detected, clearing sync cache");
        if (confirm('CoinFlow: Clear sync cache for testing?')) {
          await chrome.storage.local.set({ syncedOrders: {} });
          console.log("CoinFlow [Utils]: Sync cache cleared via Alt+Click");
          CoinFlowUtils.notify('Sync cache cleared!', 'info');
          location.reload();
        }
        return;
      }

      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
      const originalText = btn.querySelector('.cf-text').innerText;
      btn.querySelector('.cf-text').innerText = 'Scanning...';
      
      try {
        console.log("CoinFlow [Utils]: Initiating onSync callback");
        await onSync(btn);
      } catch (err) {
        console.error("CoinFlow [Utils]: Sync error in callback", err);
        btn.querySelector('.cf-text').innerText = 'Failed - Try Again';
        btn.style.background = 'rgba(239, 68, 68, 0.85)';
        setTimeout(() => {
          btn.querySelector('.cf-text').innerText = originalText;
          btn.style.background = 'rgba(99, 102, 241, 0.85)';
        }, 3000);
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    };

    document.body.appendChild(btn);
    return btn;
  },

  /**
   * Track synced orders to prevent duplicates
   */
  getSyncedOrders: async () => {
    const data = await chrome.storage.local.get(['syncedOrders']);
    console.log("CoinFlow [Utils]: Fetched synced orders from storage", data.syncedOrders || {});
    return data.syncedOrders || {};
  },

  markOrderSynced: async (orderId) => {
    const synced = await CoinFlowUtils.getSyncedOrders();
    synced[orderId] = new Date().toISOString();
    await chrome.storage.local.set({ syncedOrders: synced });
    console.log(`CoinFlow [Utils]: Marked order ${orderId} as synced`);
  },

  /**
   * Show a temporary notification
   */
  notify: (message, type = 'success') => {
    console.log(`CoinFlow [Utils]: Showing ${type} notification: ${message}`);
    const toast = document.createElement('div');
    toast.innerText = message;
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      padding: '12px 24px',
      background: type === 'success' ? '#10b981' : '#ef4444',
      color: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontWeight: '500',
      animation: 'cf-fade-in 0.3s ease-out'
    });

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes cf-fade-in { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }
};
