(function() {
  const { CoinFlowUtils } = window;
  console.log("CoinFlow: Walmart Scraper Active");

  function scrapeDetailsFromDoc(doc, orderIdHint) {
    try {
      let orderId = orderIdHint;
      if (!orderId) {
        const tcStr = doc.querySelector('.bill-order-payment-section span.pb1')?.innerText;
        if (tcStr && tcStr.includes('TC#')) {
          orderId = tcStr.replace('TC#', '').replace(/-/g, '').trim();
        }
      }
      
      const dateStr = doc.querySelector('h2.ld_E4, [data-automation-id="order-date"]')?.innerText.trim();
      const totalElements = Array.from(doc.querySelectorAll('span.ld_Eg.ld_Ei.b, .StyledText_large__afIjH'));
      let totalEl = totalElements.find(el => el.innerText.includes('$') && el.closest('.bill-order-total-payment'));
      let totalStr = totalEl?.innerText || totalElements[totalElements.length - 1]?.innerText;
      
      const totalAmount = CoinFlowUtils.parsePrice(totalStr);
      const date = CoinFlowUtils.parseDate(dateStr);

      const items = [];
      const itemStacks = doc.querySelectorAll('[data-testid="itemtile-stack"]');
      
      if (itemStacks.length > 0) {
        itemStacks.forEach(stack => {
          const title = stack.querySelector('[data-testid="productName"] span')?.innerText.trim();
          const qtyStr = stack.querySelector('.bill-item-quantity')?.innerText.trim();
          const priceStr = stack.querySelector('[data-testid="line-price"] span')?.innerText.trim();
          
          if (title) {
            items.push({
              title,
              price: CoinFlowUtils.parsePrice(priceStr),
              quantity: parseInt(qtyStr?.replace(/[^0-9]/g, '') || "1")
            });
          }
        });
      } else {
        const itemEls = doc.querySelectorAll('ul[data-testid="collapsedItemList"] li img');
        itemEls.forEach(img => {
          const title = img.getAttribute('alt')?.trim();
          const qtyBadge = img.closest('li')?.querySelector('[data-testid="badge-section"]')?.innerText;
          if (title) items.push({ title, price: 0, quantity: parseInt(qtyBadge || "1") });
        });
      }

      if (orderId) {
        console.log(`CoinFlow [Walmart]: Scraped details for ${orderId}: $${totalAmount}, Items: ${items.length}`);
        return { orderId, date, totalAmount, items };
      } else {
        console.warn("CoinFlow [Walmart]: Details scrape failed - No Order ID found in doc");
      }
    } catch (e) {
      console.error("CoinFlow [Walmart]: Error in scrapeDetailsFromDoc", e);
    }
    return null;
  }

  async function scrapeOrders() {
    const orders = [];
    const syncedOrders = await CoinFlowUtils.getSyncedOrders();
    
    if (window.location.pathname.includes('/orders/') && !window.location.pathname.endsWith('/orders')) {
      const order = scrapeDetailsFromDoc(document);
      if (order) orders.push(order);
      return orders;
    }

    const orderCards = document.querySelectorAll('[data-testid^="order-"]');
    console.log(`CoinFlow: Found ${orderCards.length} potential Walmart order cards.`);
    
    for (const card of orderCards) {
      try {
        const detailsBtn = card.querySelector('[data-automation-id^="view-order-details-link-"]');
        const orderId = detailsBtn?.getAttribute('data-automation-id')?.replace('view-order-details-link-', '');
        
        if (!orderId) {
          console.log("CoinFlow: Skipping Walmart card - No Order ID found", card);
          continue;
        }

        if (syncedOrders[orderId]) {
          console.log(`CoinFlow: Skipping ${orderId} - Already synced`);
          card.style.opacity = '0.5';
          card.style.borderLeft = '4px solid #10b981';
          continue;
        }

        console.log(`CoinFlow: Deep Syncing Walmart order ${orderId}...`);
        let order;
        try {
          const detailsUrl = `https://www.walmart.com/orders/${orderId}`;
          const response = await fetch(detailsUrl);
          if (response.ok) {
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            order = scrapeDetailsFromDoc(doc, orderId);
          }
        } catch (err) {
          console.warn(`CoinFlow: Deep Sync failed for ${orderId}, falling back to card.`, err);
        }

        if (!order) {
          const totalEl = card.querySelector('.StyledText_large__afIjH, [data-automation-id="order-total"], span.b');
          const dateEl = card.querySelector('h2, [data-automation-id="order-date"]');
          
          const totalStr = totalEl?.innerText.trim();
          const dateStr = dateEl?.innerText.trim();

          if (orderId && totalStr) {
            console.log(`CoinFlow [Walmart]: Falling back to card summary for ${orderId}: ${totalStr}`);
            const items = [];
            card.querySelectorAll('ul[data-testid="collapsedItemList"] li img').forEach(img => {
              const title = img.getAttribute('alt')?.trim();
              const qtyBadge = img.closest('li')?.querySelector('[data-testid="badge-section"]')?.innerText;
              if (title) items.push({ title, price: 0, quantity: parseInt(qtyBadge || "1") });
            });

            order = {
              orderId,
              date: CoinFlowUtils.parseDate(dateStr),
              totalAmount: CoinFlowUtils.parsePrice(totalStr),
              items
            };
          } else {
            console.warn(`CoinFlow [Walmart]: Failed to extract basic data for ${orderId}. Total found: ${!!totalStr}, Date found: ${!!dateStr}`);
          }
        }

        if (order) {
          console.log(`CoinFlow [Walmart]: Scraped Walmart order ${orderId}`, order);
          orders.push(order);
          card.style.borderLeft = '4px solid #6366f1';
        }
      } catch (e) {
        console.error("CoinFlow: Error scraping Walmart card", e);
      }
    }

    return orders;
  }

  CoinFlowUtils.createSyncButton(async (btn) => {
    const orders = await scrapeOrders();
    if (orders.length === 0) {
      CoinFlowUtils.notify("No new orders found to sync.", "info");
      return;
    }

    const totalToSync = orders.length;
    let successCount = 0;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      btn.querySelector('.cf-text').innerText = `Syncing ${i + 1}/${totalToSync}...`;

      try {
        const response = await new Promise(resolve => {
          chrome.runtime.sendMessage({ 
            action: 'syncOrders', 
            source: 'WALMART', 
            orders: [order] 
          }, resolve);
        });

        if (response && response.success) {
          successCount++;
          await CoinFlowUtils.markOrderSynced(order.orderId);
        }
      } catch (err) {
        console.error(`CoinFlow: Failed to sync Walmart order ${order.orderId}`, err);
      }
    }

    if (successCount > 0) {
      CoinFlowUtils.notify(`Successfully synced ${successCount} Walmart orders!`);
      const textEl = btn.querySelector('.cf-text');
      if (textEl) textEl.innerText = 'Synced!';
      setTimeout(() => location.reload(), 1500);
    } else {
      CoinFlowUtils.notify("Sync failed. Check console for details.", "error");
      const textEl = btn.querySelector('.cf-text');
      if (textEl) textEl.innerText = 'Sync Failed';
    }
  });
})();
