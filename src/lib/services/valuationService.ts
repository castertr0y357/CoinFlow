import prisma from "../prisma";
import { logger } from "../logger";
import { isMockMode, getMockRentCastValue, getMockRentCastTaxValue } from "./mockService";
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
      logger.info("Valuation", `Skipping unsupported web-scraper provider "${provider.name}". Use RentCast or Manual Home Value.`);
      value = null;
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
