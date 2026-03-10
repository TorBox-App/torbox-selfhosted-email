const BOT_UA_PATTERNS = [
  // Email security gateways
  /barracuda/i,
  /mimecast/i,
  /proofpoint/i,
  /fireeye/i,
  /symantec/i,
  /fortinet|fortiguard/i,
  /sophos/i,
  /trendmicro/i,
  /messagelabs/i,
  /ironport/i,
  /cisco\s+email/i,
  /forcepoint/i,

  // Email image proxies
  /GoogleImageProxy/i,
  /YahooMailProxy/i,

  // Generic bot patterns
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scanner/i,
  /prefetch/i,
  /preview/i,

  // Programmatic HTTP clients
  /wget/i,
  /curl/i,
  /python-requests/i,
  /java\//i,
  /Go-http-client/i,
  /node-fetch/i,
];

export function isBotOpen(userAgent: string | undefined | null): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isOpenEventBot(additionalData: string | undefined): boolean {
  if (!additionalData) return false;
  try {
    const data = JSON.parse(additionalData);
    return isBotOpen(data.userAgent);
  } catch {
    return false;
  }
}
