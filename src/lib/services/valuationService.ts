import prisma from "../prisma";

export async function scrapeHomeValue(url: string, provider: string): Promise<number | null> {
  try {
    const cheerio = await import("cheerio");
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    const $ = cheerio.load(text);

    let value = 0;
    
    if (url.includes('zillow.com')) {
      // 1. Try common text selectors
      const selectors = [
        '[data-testid="zestimate-value"]',
        'span[data-testid="zestimate-text"]',
        '.zestimate-value',
        'span:contains("Zestimate") + span',
        'div:contains("Zestimate") span'
      ];
      
      for (const s of selectors) {
        const el = $(s).first();
        if (el.length) {
          const val = el.text().replace(/[^0-9]/g, '');
          if (val && val.length > 3) { // Ensure it's a realistic number
            value = parseInt(val);
            break;
          }
        }
      }

      // 2. Try JSON-LD fallback
      if (value === 0) {
        $('script[type="application/ld+json"]').each((i, el) => {
          try {
            const json = JSON.parse($(el).html() || '{}');
            if (json.name === "Zestimate" || json.description?.includes("Zestimate")) {
              const val = json.value || json.offers?.price;
              if (val) value = parseInt(String(val).replace(/[^0-9]/g, ''));
            }
          } catch (e) {}
        });
      }
    } else if (url.includes('redfin.com')) {
      const selectors = [
        '.DPRedfinEstimateSection .price',
        'div.RedfinEstimateValueHeader div.price',
        '[data-rf-test-id="avm-price"] .statsValue',
        '.statsValue'
      ];
      
      for (const s of selectors) {
        const el = $(s).first();
        if (el.length) {
          const val = el.text().replace(/[^0-9]/g, '');
          if (val && val.length > 3) {
            value = parseInt(val);
            break;
          }
        }
      }
    } else if (url.includes('realtor.com')) {
      // 1. Try DOM selectors
      const selectors = [
        '[data-testid="price-value"]',
        '.PropertyPrice',
        '.price-value',
        '[data-label="property-price"]',
        '.price',
        'span:contains("Estimate") + span',
        'div:contains("Estimate") span'
      ];
      
      for (const s of selectors) {
        const el = $(s).first();
        if (el.length) {
          const val = el.text().replace(/[^0-9]/g, '');
          if (val && val.length > 3) {
            value = parseInt(val);
            break;
          }
        }
      }

      // 2. Try __NEXT_DATA__ fallback
      if (value === 0) {
        const nextDataScript = $('#__NEXT_DATA__');
        if (nextDataScript.length) {
          try {
            const nextData = JSON.parse(nextDataScript.html() || '{}');
            // Try to extract price or estimate from different possible locations in Next.js pageProps
            const property = nextData.props?.pageProps?.propertyData || nextData.props?.pageProps?.initialProperties;
            if (property) {
              const val = property.price || property.home_value || property.estimate || property.listPrice;
              if (val) value = parseInt(String(val).replace(/[^0-9]/g, ''));
            }
            
            if (value === 0) {
              const state = nextData.props?.pageProps?.initialReduxState || nextData.props?.pageProps?.initialState;
              const propDetails = state?.propertyDetails || state?.property;
              if (propDetails) {
                const val = propDetails.price || propDetails.value || propDetails.estimatePrice;
                if (val) value = parseInt(String(val).replace(/[^0-9]/g, ''));
              }
            }
          } catch (e) {}
        }
      }
    }

    return value > 0 ? value : null;
  } catch (error) {
    console.error(`Scraping error for ${provider}:`, error);
    return null;
  }
}

export async function syncAllValuations(mortgageId: string) {
  const providers = await prisma.homeValueProvider.findMany({
    where: { mortgageId }
  });

  let total = 0;
  let count = 0;

  for (const provider of providers) {
    const value = await scrapeHomeValue(provider.url, provider.name);
    if (value) {
      await prisma.homeValueProvider.update({
        where: { id: provider.id },
        data: { lastValue: value, lastSync: new Date() }
      });
      total += value;
      count++;
    }
  }

  if (count > 0) {
    const average = total / count;
    await prisma.mortgageDetail.update({
      where: { id: mortgageId },
      data: { homeValue: average }
    });
    return average;
  }

  return null;
}
