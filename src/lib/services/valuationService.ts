import prisma from "../prisma";
import * as cheerio from "cheerio";
import { logger } from "../logger";
import { isMockMode, getMockRentCastValue, getMockRentCastTaxValue } from "./mockService";

export async function scrapeHomeValue(url: string, provider: string): Promise<number | null> {
  try {
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
          } catch {}
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
          } catch {}
        }
      }
    }

    return value > 0 ? value : null;
  } catch (error) {
    logger.error("Valuation/Scrape", `Scraping error for ${provider}`, error);
    return null;
  }
}

export async function fetchRentCastValue(address: string, apiKey: string): Promise<number | null> {
  if (isMockMode()) {
    return getMockRentCastValue(address).price;
  }
  try {
    const url = `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Valuation/RentCast", `HTTP error! status: ${response.status} message: ${errorText}`);
      return null;
    }

    const data = await response.json();
    if (data && typeof data.price === 'number') {
      return data.price;
    }

    logger.warn("Valuation/RentCast", `No price returned in RentCast response: ${JSON.stringify(data)}`);
    return null;
  } catch (error) {
    logger.error("Valuation/RentCast", "Error fetching RentCast valuation", error);
    return null;
  }
}

export async function fetchRentCastTaxValue(address: string, apiKey: string): Promise<number | null> {
  if (isMockMode()) {
    return getMockRentCastTaxValue(address).totalValue;
  }
  try {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Valuation/RentCastTax", `HTTP error! status: ${response.status} message: ${errorText}`);
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const property = data[0];
      if (property.taxAssessment && typeof property.taxAssessment.totalValue === 'number') {
        return property.taxAssessment.totalValue;
      } else if (typeof property.lastSalePrice === 'number') {
        logger.info(
          "Valuation/RentCastTax", 
          `Tax assessment missing. Falling back to lastSalePrice: ${property.lastSalePrice}`
        );
        return property.lastSalePrice;
      }
    }

    logger.warn("Valuation/RentCastTax", `No tax assessment value returned in RentCast response: ${JSON.stringify(data)}`);
    return null;
  } catch (error) {
    logger.error("Valuation/RentCastTax", "Error fetching RentCast tax valuation", error);
    return null;
  }
}

export async function syncAllValuations(mortgageId: string) {
  const mortgage = await prisma.mortgageDetail.findUnique({
    where: { id: mortgageId },
    include: { providers: true }
  });

  if (!mortgage) return null;

  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  const rentcastApiKey = settings?.rentcastApiKey || process.env.RENTCAST_API_KEY;

  let total = 0;
  let count = 0;

  for (const provider of mortgage.providers) {
    let value: number | null = null;

    if (provider.name.toLowerCase() === "rentcast") {
      if (mortgage.address && rentcastApiKey) {
        value = await fetchRentCastValue(mortgage.address, rentcastApiKey);
      } else {
        logger.warn(
          "Valuation/RentCast", 
          `Skipping RentCast sync: missing address (hasAddress: ${!!mortgage.address}) or API key (hasApiKey: ${!!rentcastApiKey})`
        );
      }
    } else if (provider.name.toLowerCase() === "rentcast tax assessment") {
      if (mortgage.address && rentcastApiKey) {
        value = await fetchRentCastTaxValue(mortgage.address, rentcastApiKey);
      } else {
        logger.warn(
          "Valuation/RentCastTax", 
          `Skipping RentCast Tax sync: missing address (hasAddress: ${!!mortgage.address}) or API key (hasApiKey: ${!!rentcastApiKey})`
        );
      }
    } else {
      value = await scrapeHomeValue(provider.url, provider.name);
    }

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
