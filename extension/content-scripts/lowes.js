(function() {
  const { CoinFlowUtils } = window;
  console.log("CoinFlow: Lowe's Scraper Active");

  async function scrapeOrders() {
    const orders = [];
    const syncedOrders = await CoinFlowUtils.getSyncedOrders();
    
    const dateHeaders = document.querySelectorAll('h2.order-list-date');
    console.log(`CoinFlow [Lowes]: Scanning ${dateHeaders.length} Lowe's orders...`);

    for (const dateHeader of dateHeaders) {
      try {
        const headerRow = dateHeader.closest('.GridStyles__GridRow-sc-1ejksnu-1');
        const orderIdEl = headerRow?.querySelector('.order-list-price-number.border-left');
        const orderId = orderIdEl?.innerText.replace('Order #', '').trim();
        
        if (!orderId) {
          console.log("CoinFlow [Lowes]: Skipping Lowe's group - No Order ID found", headerRow);
          continue;
        }

        if (syncedOrders[orderId]) {
          console.log(`CoinFlow [Lowes]: Skipping ${orderId} - Already synced`);
          if (headerRow) headerRow.style.opacity = '0.5';
          continue;
        }

        console.log(`CoinFlow [Lowes]: Processing Lowe's order ${orderId}...`);
        const dateStr = dateHeader.innerText.replace('Order Date:', '').trim();
        const totalStr = headerRow.querySelector('.order-list-price-number:not(.border-left)')?.innerText.trim();
        
        let itemsContainer = headerRow.nextElementSibling;
        if (itemsContainer?.tagName === 'HR') itemsContainer = itemsContainer.nextElementSibling;
        
        const items = [];
        if (itemsContainer && itemsContainer.classList.contains('issYm')) {
          itemsContainer.querySelectorAll('.product-link').forEach(itemEl => {
            const itemRow = itemEl.closest('.GridStyles__GridRow-sc-1ejksnu-1');
            const qtyPill = itemRow?.querySelector('.pill');
            items.push({
              title: itemEl.innerText.trim(),
              price: 0, 
              quantity: parseInt(qtyPill?.innerText || "1")
            });
          });
        }

        const order = {
          orderId,
          date: CoinFlowUtils.parseDate(dateStr),
          totalAmount: CoinFlowUtils.parsePrice(totalStr),
          items
        };

        if (orderId && totalStr) {
          console.log(`CoinFlow [Lowes]: Scraped Lowe's order ${orderId}`, order);
          orders.push(order);
          if (headerRow) headerRow.style.borderLeft = '4px solid #6366f1';
          if (itemsContainer) itemsContainer.style.borderLeft = '4px solid #6366f1';
        } else {
          console.warn(`CoinFlow [Lowes]: Failed to extract basic data for ${orderId}. Total found: ${!!totalStr}, Date found: ${!!dateStr}`);
        }
      } catch (e) {
        console.error("CoinFlow [Lowes]: Error scraping Lowe's order group", e);
      }
    }

    return orders;
  }

  function scrapeDetailsFromDoc(doc) {
    const orderId = doc.querySelector('.orderNumberMOW')?.innerText.replace('Transaction #', '').trim();
    const dateStr = doc.querySelector('h3.variant--h3, h5.variant--h5')?.innerText.replace('Placed', '').trim();
    const totalAmount = CoinFlowUtils.parsePrice(doc.querySelector('.price-divider, h6.align--right')?.innerText);
    
    const items = [];
    const itemRows = doc.querySelectorAll('.print-no-break .GridStyles__GridRow-sc-1ejksnu-1');
    
    itemRows.forEach(row => {
      const titleEl = row.querySelector('p.bold');
      const priceEl = row.querySelector('p.hShTQt'); 
      const qtyEl = row.querySelector('p:not(.bold):not(.hShTQt)'); 
      
      if (titleEl && priceEl) {
        items.push({
          title: titleEl.innerText.trim(),
          price: CoinFlowUtils.parsePrice(priceEl.innerText.split('/')[0]),
          quantity: parseInt(qtyEl?.innerText.replace('QTY', '').trim() || "1")
        });
      }
    });

    if (orderId && totalAmount > 0) {
      console.log(`CoinFlow [Lowes]: Scraped details for ${orderId}: $${totalAmount}, Items: ${items.length}`);
      return {
        orderId,
        date: CoinFlowUtils.parseDate(dateStr),
        totalAmount,
        items: items.length > 0 ? items : null
      };
    }
    return null;
  }

  if (document.location.href.includes('/mylowes/orders')) {
    CoinFlowUtils.createSyncButton(async (btn) => {
      const orders = await scrapeOrders();
      if (orders.length === 0) {
        CoinFlowUtils.notify('No new orders found on this page.', 'info');
        return;
      }

      let successCount = 0;
      const totalToSync = orders.length;

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        btn.querySelector('.cf-text').innerText = `Syncing ${i + 1}/${totalToSync}...`;

        try {
          const detailsLink = document.querySelector(`a[href*="${order.orderId}"]`)?.href;
          if (detailsLink) {
            const resp = await fetch(detailsLink);
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const details = scrapeDetailsFromDoc(doc);
            
            if (details.items) {
              order.items = details.items;
              order.totalAmount = details.totalAmount || order.totalAmount;
            }
          }

          const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ 
              action: 'syncOrders', 
              source: 'LOWES', 
              orders: [order] 
            }, resolve);
          });

          if (response && response.success) {
            successCount++;
            await CoinFlowUtils.markOrderSynced(order.orderId);
          }
        } catch (err) {
          console.error(`CoinFlow: Failed to sync Lowe's order ${order.orderId}`, err);
        }

        await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
      }

      if (successCount > 0) {
        CoinFlowUtils.notify(`Successfully synced ${successCount} Lowe's orders!`);
        const textEl = btn.querySelector('.cf-text');
        if (textEl) textEl.innerText = 'Synced!';
        setTimeout(() => location.reload(), 1500);
      } else {
        CoinFlowUtils.notify("Sync failed. Check console for details.", "error");
        const textEl = btn.querySelector('.cf-text');
        if (textEl) textEl.innerText = 'Sync Failed';
      }
    });
  }
})();
