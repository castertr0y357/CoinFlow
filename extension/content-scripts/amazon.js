(function() {
  const { CoinFlowUtils } = window;
  console.log("CoinFlow: Amazon Scraper Active");

  function sanitizeOrderId(id) {
    if (!id) return null;
    return id.replace(/ORDER #\s*/gi, '').replace(/Order #\s*/gi, '').trim();
  }

  function scrapeDetailsFromDoc(doc) {
    const items = [];
    try {
      const orderId = doc.querySelector('[data-component="orderId"], .order-date-invoice-item bdi, #order-id')?.innerText.trim();
      const dateStr = doc.querySelector('[data-component="orderDate"], .order-date-invoice-item, .a-color-secondary.value')?.innerText.replace('Order placed', '').trim();
      
      const cleanOrderId = sanitizeOrderId(orderId);
      const date = CoinFlowUtils.parseDate(dateStr);
      
      // Improved Total Price Extraction
      let totalAmount = 0;
      const totalSelectors = [
        '.od-line-item-row-content.a-span-last .a-text-bold',
        '.a-column.a-span5.od-line-item-row-content .a-text-bold',
        '#orderSummaryPrimary .a-color-base.a-text-bold',
        '.ot-price',
        '#order-total',
        '.a-color-base.a-text-bold'
      ];

      for (const selector of totalSelectors) {
        const el = doc.querySelector(selector);
        const val = CoinFlowUtils.parsePrice(el?.innerText);
        if (val > 0) {
          totalAmount = val;
          console.log(`CoinFlow [Amazon]: Scraped Total via selector "${selector}": $${totalAmount}`);
          break;
        }
      }

      // Text-based fallback for "Grand Total" label
      if (totalAmount === 0) {
        const labelEl = Array.from(doc.querySelectorAll('span, div, b, td'))
          .find(el => el.innerText.trim() === 'Grand Total:');
        if (labelEl) {
          const row = labelEl.closest('.a-row, .a-fixed-left-grid, .od-line-item-row-label')?.parentElement;
          const valEl = row?.querySelector('.od-line-item-row-content, .a-span5, .a-text-right');
          totalAmount = CoinFlowUtils.parsePrice(valEl?.innerText);
          if (totalAmount > 0) console.log(`CoinFlow [Amazon]: Scraped Total via text label match: $${totalAmount}`);
        }
      }
      
      // Consolidate Item Selection to prevent double-counting
      let itemContainers = Array.from(doc.querySelectorAll('[data-component="purchasedItemsRightGrid"]'));
      
      // Fallback to generic grid if the high-precision one isn't found
      if (itemContainers.length === 0) {
        itemContainers = Array.from(doc.querySelectorAll('.a-fixed-left-grid-col.a-col-right'));
      }

      // Final fallback if still nothing
      if (itemContainers.length === 0) {
        itemContainers = Array.from(doc.querySelectorAll('.yohtmlc-item, .a-box.group'));
      }
      
      const excludedTitles = [
        'view order invoice', 
        'track package', 
        'return or replace', 
        'share gift receipt', 
        'write a product review', 
        'get product support',
        'buy it again',
        'view your item'
      ];

      // Deduplicate containers if they are nested
      itemContainers = itemContainers.filter((el, index, self) => 
        !self.some((other, otherIndex) => otherIndex !== index && other.contains(el))
      );

      itemContainers.forEach(container => {
        const titleEl = container.querySelector('[data-component="itemTitle"] a, .a-link-normal, .a-text-bold');
        const title = titleEl?.innerText.trim();
        
        const priceStr = container.querySelector('[data-component="unitPrice"] .a-offscreen, .a-color-price, .a-size-small.a-color-price')?.innerText.trim();
        const qtyStr = container.querySelector('.item-view-qty, .a-size-small.a-color-secondary, .a-button-text')?.innerText.trim();
        
        const price = CoinFlowUtils.parsePrice(priceStr);
        const quantity = parseInt(qtyStr?.replace(/[^0-9]/g, '') || "1");

        if (title) {
          const isExcluded = excludedTitles.some(ex => title.toLowerCase().includes(ex));
          if (!isExcluded) {
            console.log(`CoinFlow [Amazon]: Scraped Item: "${title}" @ $${price} x ${quantity}`);
            items.push({ title, price, quantity });
          } else {
            console.log(`CoinFlow [Amazon]: Skipping excluded element: "${title}"`);
          }
        }
      });

      // Fallback: Sum items if total is still 0
      if (totalAmount === 0 && items.length > 0) {
        totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (totalAmount > 0) console.log(`CoinFlow [Amazon]: Calculated Total from item sum: $${totalAmount}`);
      }

      if (cleanOrderId) {
        // Skip cancelled orders
        if (dateStr?.toLowerCase().includes('cancelled') || totalAmount === 0) {
          console.warn(`CoinFlow [Amazon]: Skipping order ${cleanOrderId} - ${dateStr?.includes('Cancelled') ? 'Cancelled' : 'No Total Found'}`);
          return null;
        }
        
        // Deduplicate items to handle mobile/desktop overlapping elements
        const finalItems = items.filter((item, index, self) =>
          index === self.findIndex((t) => (
            t.title.toLowerCase() === item.title.toLowerCase() && t.price === item.price
          ))
        );

        console.log(`CoinFlow [Amazon]: Final details for ${cleanOrderId}: $${totalAmount}, Items: ${finalItems.length}`);
        return { orderId: cleanOrderId, date, totalAmount, items: finalItems };
      } else {
        const preview = doc.body?.innerText?.substring(0, 200) || "Empty body";
        console.warn(`CoinFlow [Amazon]: Details scrape failed for doc. Preview: ${preview}`);
      }
    } catch (e) {
      console.error("CoinFlow [Amazon]: Error in scrapeDetailsFromDoc", e);
    }
    return null;
  }

  async function scrapeOrders() {
    console.log("CoinFlow [v1.9] [Amazon]: Starting scrapeOrders...");
    const orders = [];
    const processedOrderIds = new Set();
    const syncedOrders = await CoinFlowUtils.getSyncedOrders();
    const isDetailsPage = !!document.querySelector('[data-component="orderDetailsTitle"], #orderDetails, .order-details, [id^="order-details"]');

    if (isDetailsPage) {
      console.log("CoinFlow [Amazon]: Scraping Order Details Page (Direct)");
      const order = scrapeDetailsFromDoc(document);
      if (order) orders.push(order);
    } else {
      const orderCards = document.querySelectorAll('.order-card, .js-order-card, .order, [id^="orderCard"], .a-box-group.a-spacing-base');
      console.log(`CoinFlow [Amazon]: Found ${orderCards.length} potential order containers.`);
      
      for (const card of orderCards) {
        try {
          const orderIdEl = card.querySelector('.yohtmlc-order-id, .order-info .value, .a-color-secondary bdi, .a-link-normal.bdi, bdi');
          const orderId = sanitizeOrderId(orderIdEl?.innerText.trim() || card.getAttribute('data-orderid'));
          
          if (!orderId || processedOrderIds.has(orderId)) {
            continue;
          }
          processedOrderIds.add(orderId);

          if (syncedOrders[orderId]) {
            console.log(`CoinFlow [Amazon]: Order ${orderId} already synced. Allowing re-sync.`);
            card.style.borderLeft = '4px solid #10b981'; // Green border for already synced
          }

          console.log(`CoinFlow [Amazon]: Processing ${orderId}...`);
          
          // Attempt Deep Sync
          const detailsLink = card.querySelector('a[href*="order-details"], a[href*="order-history/item-view"], a[href*="vieworder"]');
          if (detailsLink && detailsLink.href) {
            try {
              console.log(`CoinFlow [Amazon]: Fetching deep details for ${orderId}...`);
              await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
              
              const response = await fetch(detailsLink.href);
              const html = await response.text();
              const doc = new DOMParser().parseFromString(html, "text/html");
              const order = scrapeDetailsFromDoc(doc);
              if (order) {
                orders.push(order);
                card.style.borderLeft = '4px solid #6366f1';
                continue;
              }
            } catch (fetchErr) {
              console.warn(`CoinFlow [Amazon]: Deep Fetch failed for ${orderId}`, fetchErr);
            }
          }

          // Fallback to card summary
          const totalEl = card.querySelector('.yohtmlc-order-total .value, .a-column.a-span-2 .value, .a-color-secondary.value, .a-text-bold');
          const dateEl = card.querySelector('.yohtmlc-order-date .value, .a-column.a-span-3 .value, .a-color-secondary.value');
          
          const totalStr = totalEl?.innerText.trim();
          const dateStr = dateEl?.innerText.trim();

          if (orderId && totalStr) {
            console.log(`CoinFlow [Amazon]: Falling back to card summary for ${orderId}: ${totalStr} on ${dateStr}`);
            orders.push({
              orderId,
              date: CoinFlowUtils.parseDate(dateStr),
              totalAmount: CoinFlowUtils.parsePrice(totalStr),
              items: [] 
            });
            card.style.borderLeft = '4px solid #6366f1';
          } else {
            console.warn(`CoinFlow [Amazon]: Failed to extract basic data for ${orderId}. Total found: ${!!totalStr}, Date found: ${!!dateStr}`);
          }
        } catch (e) {
          console.error(`CoinFlow [Amazon]: Error processing card ${orderId}`, e);
        }
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
            source: 'AMAZON', 
            orders: [order] 
          }, resolve);
        });

        if (response && response.success) {
          successCount++;
          await CoinFlowUtils.markOrderSynced(order.orderId);
        }
      } catch (err) {
        console.error(`CoinFlow: Failed to sync Amazon order ${order.orderId}`, err);
      }
    }

    if (successCount > 0) {
      CoinFlowUtils.notify(`Successfully synced ${successCount} Amazon orders!`);
      const textEl = btn.querySelector('.cf-text');
      if (textEl) textEl.innerText = 'Synced!';
      // Removed location.reload() to preserve console logs for debugging
    } else {
      CoinFlowUtils.notify("Sync failed. Check console for details.", "error");
      const textEl = btn.querySelector('.cf-text');
      if (textEl) textEl.innerText = 'Sync Failed';
    }
  });
})();
