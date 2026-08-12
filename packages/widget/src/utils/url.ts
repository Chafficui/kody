/**
 * True when `url` is safe to send identity-bearing headers to.
 *
 * Two cases pass:
 *  - HTTPS — production, public origin.
 *  - Explicit loopback over HTTP — `localhost`, `127.0.0.1`, `::1`.
 *    The IIFE auto-init path uses this to keep local development
 *    frictionless while still refusing to forward identity data to
 *    any other plain-HTTP host. ESM consumers go through
 *    `KodyApiClient`, which applies the same rule at the request
 *    layer.
 *
 * Anything else — plain HTTP, unparseable strings, opaque hosts —
 * returns false.
 */
export function isTrustedServerUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  if (parsed.protocol === "http:") {
    // URL parsers vary on whether the IPv6 literal retains its
    // brackets in `.hostname`; accept either form so the loopback
    // dev exception works across browsers and Node versions.
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
  }
  return false;
}
