import { MAX_URL_LENGTH } from "./schema";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "chrome:"]);

export type UrlCheck =
  { ok: true; url: string } | { ok: false; reason: "empty" | "invalid" | "scheme" | "length" };

/**
 * Turns user input into a link URL. A bare host such as "github.com" gets
 * https://. Only http, https, and chrome URLs are accepted, so imported data
 * can never smuggle javascript: or data: links into the page.
 */
export function normalizeUrl(input: string): UrlCheck {
  const value = input.trim();
  if (!value) return { ok: false, reason: "empty" };
  if (value.length > MAX_URL_LENGTH) return { ok: false, reason: "length" };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  // "localhost:3000" parses as scheme "localhost:", so treat host:port as schemeless.
  const looksLikeHostPort = /^[^\s/:]+:\d+(\/|$)/.test(value);
  const candidate = hasScheme && !looksLikeHostPort ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return { ok: false, reason: "scheme" };
  if (
    parsed.protocol !== "chrome:" &&
    !parsed.hostname.includes(".") &&
    parsed.hostname !== "localhost"
  ) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, url: parsed.href };
}

/** Default label for a new link: the host without a leading "www.". */
export function titleFromUrl(url: string): string {
  try {
    const { hostname, protocol, pathname } = new URL(url);
    if (protocol === "chrome:") return `chrome://${hostname}${pathname === "/" ? "" : pathname}`;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Key used to detect the same destination saved twice. Keeps path and query. */
export function urlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ""}${path}${parsed.search}`;
  } catch {
    return url;
  }
}
