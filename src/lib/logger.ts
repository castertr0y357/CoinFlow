export const logger = {
  info: (job: string, message: string) => {
    console.log(`[${job}] - Info - ${message}`);
  },
  warn: (job: string, message: string) => {
    console.warn(`[${job}] - Warning - ${message}`);
  },
  error: (job: string, message: string, error?: unknown) => {
    const detail = error instanceof Error ? error.message : String(error || "");
    console.error(`[${job}] - Error - ${message}${detail ? `: ${detail}` : ""}`);
  }
};
