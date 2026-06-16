import dns from "dns";
import net from "net";

/**
 * Validates a URL against Server-Side Request Forgery (SSRF) vulnerabilities.
 * Resolves the URL host to all its IP addresses and blocks local/private ranges.
 */
export async function isSafeUrl(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    // Direct IP validation
    if (net.isIP(hostname)) {
      return isSafeIp(hostname);
    }

    // Resolve domain to all IP addresses
    const addresses = await new Promise<dns.LookupAddress[]>((resolve, reject) => {
      dns.lookup(hostname, { all: true }, (err, addrs) => {
        if (err) reject(err);
        else resolve(addrs);
      });
    });

    for (const addr of addresses) {
      if (!isSafeIp(addr.address)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if an IP address is in a safe (public) range.
 * Blocks private, loopback, link-local, multicast, and unspecified addresses.
 */
function isSafeIp(ip: string): boolean {
  // IPv4 Checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    
    // Loopback: 127.0.0.0/8
    if (parts[0] === 127) return false;
    
    // Private Network Range Class A: 10.0.0.0/8
    if (parts[0] === 10) return false;
    
    // Private Network Range Class B: 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    
    // Private Network Range Class C: 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return false;
    
    // Link-local / Auto-config (e.g. AWS Instance Metadata): 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return false;
    
    // Broadcast / Local Net: 0.0.0.0 or 255.255.255.255
    if (ip === "0.0.0.0" || ip === "255.255.255.255") return false;

    return true;
  }

  // IPv6 Checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase().replace(/^(?:0+:)+/, ":"); // basic normalization
    
    // Loopback: ::1
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return false;
    
    // Unspecified: ::
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return false;
    
    // Unique Local Address (ULA): fc00::/7 (starts with fc or fd)
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) {
      return false;
    }
    
    // Link-Local: fe80::/10
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || ip.toLowerCase().startsWith("fe80")) {
      return false;
    }

    return true;
  }

  return false;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipCache = new Map<string, RateLimitRecord>();

/**
 * Simple in-memory IP rate limiter.
 * Returns information about whether the request is rate-limited.
 */
export function rateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): { isBlocked: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  let record = ipCache.get(ip);

  // If no record or reset window has passed, reset record
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    ipCache.set(ip, record);
    return { isBlocked: false, remaining: limit - 1, resetTime: record.resetTime };
  }

  record.count++;
  const isBlocked = record.count > limit;
  const remaining = Math.max(0, limit - record.count);

  return { isBlocked, remaining, resetTime: record.resetTime };
}
