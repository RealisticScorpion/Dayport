import { browser } from "wxt/browser";
import { parseJsonSource, type RemoteImage } from "../data/background";

/** Refetch a JSON source after this long; a failure keeps the previous list. */
export const JSON_REFRESH_MS = 6 * 60 * 60 * 1000;

export const originPattern = (url: string) => `${new URL(url).origin}/*`;

export function hasOrigin(url: string): Promise<boolean> {
  return browser.permissions.contains({ origins: [originPattern(url)] });
}

/** Must run from a click: Chrome asks the user to allow this one site. */
export async function requestOrigin(url: string): Promise<boolean> {
  try {
    return await browser.permissions.request({ origins: [originPattern(url)] });
  } catch {
    return false;
  }
}

/** Reads a JSON source. The response is data only; see parseJsonSource. */
export async function fetchJsonSource(url: string): Promise<RemoteImage[]> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get("content-length") ?? 0) > 2_000_000) throw new Error("Too large");
  const images = parseJsonSource(await response.json());
  if (!images) throw new Error("Unsupported format");
  return images;
}
