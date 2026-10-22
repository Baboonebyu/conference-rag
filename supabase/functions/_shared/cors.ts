const allowedOrigins = new Set([
  "https://baboonebyu.github.io",
  "http://localhost:5500",
]);

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.has(origin);
}

export function getCorsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });

  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}
