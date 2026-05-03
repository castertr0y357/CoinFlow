import { syncSimpleFin as performSimpleFinSync } from "../simplefin";
import { processAmazonCsv as performAmazonSync } from "../amazon";

export async function syncSimpleFin() {
  // In a more complex app, this would queue a job in the background.
  // For now, we perform it and return the result.
  return performSimpleFinSync();
}

export async function syncAmazon(csvContent: string) {
  return performAmazonSync(csvContent);
}
