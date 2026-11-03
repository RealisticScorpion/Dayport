import { z } from "zod";
import type { Codec } from "./storage";
import { urlKey } from "./url";

// Frequent pages (docs/design.md, Navigation behavior). Suggestions are
// computed on every page load from browser data and never written into the
// user's pinned groups; only the user's dismiss and exclude choices persist.

export const MAX_SUGGESTION_ROWS = 8;
const MAX_PAGES_PER_DOMAIN = 5;

/** A page qualifies as recurring when visited on this many distinct days within the window. */
export const RECURRING = { windowDays: 14, minDays: 3 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const DiscoverySchema = z.object({
  version: z.literal(1),
  /** urlKey of each dismissed page. */
  dismissed: z.array(z.string()),
  /** Excluded hosts, without "www.". A domain also excludes its subdomains. */
  excluded: z.array(z.string()),
});

export type DiscoveryPrefs = z.infer<typeof DiscoverySchema>;

export const emptyDiscovery = (): DiscoveryPrefs => ({ version: 1, dismissed: [], excluded: [] });

export const discoveryCodec: Codec<DiscoveryPrefs> = {
  read: (raw) => {
    const parsed = DiscoverySchema.safeParse(raw);
    return parsed.success ? parsed.data : emptyDiscovery();
  },
  write: (value) => value,
};

export function dismiss(prefs: DiscoveryPrefs, url: string): DiscoveryPrefs {
  const key = urlKey(url);
  return prefs.dismissed.includes(key) ? prefs : { ...prefs, dismissed: [...prefs.dismissed, key] };
}

export function undismiss(prefs: DiscoveryPrefs, url: string): DiscoveryPrefs {
  const key = urlKey(url);
  return { ...prefs, dismissed: prefs.dismissed.filter((item) => item !== key) };
}

export function exclude(prefs: DiscoveryPrefs, domain: string): DiscoveryPrefs {
  return prefs.excluded.includes(domain)
    ? prefs
    : { ...prefs, excluded: [...prefs.excluded, domain] };
}

export function unexclude(prefs: DiscoveryPrefs, domain: string): DiscoveryPrefs {
  return { ...prefs, excluded: prefs.excluded.filter((item) => item !== domain) };
}

/** Host without a leading "www.", or null for anything that isn't an http(s) page. */
export function domainOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function isExcluded(domain: string, excluded: string[]): boolean {
  return excluded.some((item) => domain === item || domain.endsWith(`.${item}`));
}

export interface PageVisits {
  url: string;
  title: string;
  visitTimes: number[];
}

export interface Suggestion {
  url: string;
  title: string;
}

/**
 * Recurring pages from local history: visited on at least `minDays` distinct
 * local days within the last `windowDays`. Ranked by distinct days, then
 * visit count, then most recent visit.
 */
export function recurringPages(pages: PageVisits[], now: number): Suggestion[] {
  const start = now - RECURRING.windowDays * DAY_MS;
  const ranked = pages.flatMap((page) => {
    const times = page.visitTimes.filter((time) => time >= start && time <= now);
    const days = new Set(times.map((time) => new Date(time).toDateString())).size;
    if (days < RECURRING.minDays) return [];
    return [{ page, days, visits: times.length, last: Math.max(...times) }];
  });
  ranked.sort((a, b) => b.days - a.days || b.visits - a.visits || b.last - a.last);
  return ranked.map(({ page }) => ({ url: page.url, title: page.title }));
}

export type SuggestionRow =
  | { kind: "page"; domain: string; page: Suggestion }
  | { kind: "domain"; domain: string; pages: Suggestion[] };

/**
 * Turns candidates (top sites first, then recurring pages) into at most
 * `limit` rows. Pages already pinned, dismissed, or on an excluded domain are
 * left out. Pages share a row when they share a domain; different paths stay
 * separate pages rather than being merged into the host.
 */
export function buildSuggestions(
  candidates: Suggestion[],
  pinnedUrls: string[],
  prefs: DiscoveryPrefs,
  limit = MAX_SUGGESTION_ROWS,
): SuggestionRow[] {
  const skip = new Set([...pinnedUrls.map(urlKey), ...prefs.dismissed]);
  const byDomain = new Map<string, Suggestion[]>();
  for (const candidate of candidates) {
    const domain = domainOf(candidate.url);
    if (!domain || isExcluded(domain, prefs.excluded)) continue;
    const key = urlKey(candidate.url);
    if (skip.has(key)) continue;
    skip.add(key);
    const pages = byDomain.get(domain) ?? [];
    if (pages.length >= MAX_PAGES_PER_DOMAIN) continue;
    pages.push({ url: candidate.url, title: candidate.title.trim() || domain });
    byDomain.set(domain, pages);
  }
  return [...byDomain.entries()]
    .slice(0, limit)
    .map(([domain, pages]) =>
      pages.length === 1
        ? { kind: "page", domain, page: pages[0]! }
        : { kind: "domain", domain, pages },
    );
}
