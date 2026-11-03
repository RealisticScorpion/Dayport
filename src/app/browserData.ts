import { browser } from "wxt/browser";
import type { BookmarkNode } from "../data/bookmarks";
import { RECURRING, recurringPages, type Suggestion } from "../data/discovery";

// Reads from optional browser APIs. Callers check the permission first; every
// read stays on this device.

const DAY_MS = 24 * 60 * 60 * 1000;
/** Only the most-visited history entries are examined visit by visit. */
const MAX_HISTORY_PAGES = 150;

export async function topSites(): Promise<Suggestion[]> {
  const sites = await browser.topSites.get();
  return sites.map((site) => ({ url: site.url, title: site.title }));
}

export async function historyRecurring(now = Date.now()): Promise<Suggestion[]> {
  const items = await browser.history.search({
    text: "",
    startTime: now - RECURRING.windowDays * DAY_MS,
    maxResults: 1000,
  });
  const candidates = items
    .filter(
      (item) =>
        item.url && /^https?:/.test(item.url) && (item.visitCount ?? 0) >= RECURRING.minDays,
    )
    .sort((a, b) => (b.visitCount ?? 0) - (a.visitCount ?? 0))
    .slice(0, MAX_HISTORY_PAGES);
  const pages = await Promise.all(
    candidates.map(async (item) => {
      const visits = await browser.history.getVisits({ url: item.url! });
      return {
        url: item.url!,
        title: item.title ?? "",
        visitTimes: visits.flatMap((visit) => (visit.visitTime ? [visit.visitTime] : [])),
      };
    }),
  );
  return recurringPages(pages, now);
}

export async function bookmarkTree(): Promise<BookmarkNode[]> {
  return (await browser.bookmarks.getTree()) as BookmarkNode[];
}

export type ClosedEntry =
  | { kind: "tab"; sessionId: string; url: string; title: string; closedAt: number }
  | { kind: "window"; sessionId: string; tabs: number; title: string; closedAt: number };

export async function recentlyClosed(): Promise<ClosedEntry[]> {
  const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 25 });
  const own = browser.runtime.getURL("/");
  return sessions.flatMap((session): ClosedEntry[] => {
    // lastModified is in seconds.
    const closedAt = session.lastModified * 1000;
    const { tab, window } = session;
    if (
      tab?.sessionId &&
      tab.url &&
      !tab.url.startsWith(own) &&
      !tab.url.startsWith("chrome://newtab")
    ) {
      return [
        {
          kind: "tab",
          sessionId: tab.sessionId,
          url: tab.url,
          title: tab.title || tab.url,
          closedAt,
        },
      ];
    }
    if (window?.sessionId) {
      const tabs = window.tabs ?? [];
      return [
        {
          kind: "window",
          sessionId: window.sessionId,
          tabs: tabs.length,
          title: tabs
            .map((item) => item.title)
            .filter(Boolean)
            .slice(0, 3)
            .join(" · "),
          closedAt,
        },
      ];
    }
    return [];
  });
}

export function watchRecentlyClosed(onChange: () => void): () => void {
  browser.sessions.onChanged.addListener(onChange);
  return () => browser.sessions.onChanged.removeListener(onChange);
}

export async function restoreSession(sessionId: string): Promise<void> {
  await browser.sessions.restore(sessionId);
}
