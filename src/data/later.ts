import { z } from "zod";
import { newId, type NewId } from "./ops";
import { MAX_TITLE_LENGTH, MAX_URL_LENGTH } from "./schema";
import type { Codec } from "./storage";
import { normalizeUrl, titleFromUrl, urlKey } from "./url";

// Continue later (docs/design.md). Tabs saved together share a `batch` id and
// show as one row on the new tab page.

const LaterItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1).max(MAX_URL_LENGTH),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  savedAt: z.number(),
  batch: z.string().min(1),
});

export type LaterItem = z.infer<typeof LaterItemSchema>;

/** Keeps every valid item; a damaged item is dropped rather than losing the list. */
export const laterCodec: Codec<LaterItem[]> = {
  read: (raw) => {
    const items = (raw as { items?: unknown } | undefined)?.items;
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      const parsed = LaterItemSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  write: (items) => ({ version: 1, items }),
};

export interface TabInfo {
  url?: string;
  title?: string;
}

/** A tab can be saved when its address passes the same check as a pinned link. */
export function saveableUrl(tab: TabInfo): string | null {
  if (!tab.url) return null;
  const checked = normalizeUrl(tab.url);
  return checked.ok && !checked.url.startsWith("chrome://newtab") ? checked.url : null;
}

/**
 * Adds tabs as one batch. A page that was already saved moves to the new batch
 * instead of appearing twice.
 */
export function addToLater(
  items: LaterItem[],
  tabs: TabInfo[],
  now = Date.now(),
  batch = newId(),
  makeId: NewId = newId,
): LaterItem[] {
  const added: LaterItem[] = [];
  const keys = new Set<string>();
  for (const tab of tabs) {
    const url = saveableUrl(tab);
    if (!url || keys.has(urlKey(url))) continue;
    keys.add(urlKey(url));
    const title = (tab.title?.trim() || titleFromUrl(url)).slice(0, MAX_TITLE_LENGTH);
    added.push({ id: makeId(), url, title, savedAt: now, batch });
  }
  return [...items.filter((item) => !keys.has(urlKey(item.url))), ...added];
}

export function removeFromLater(items: LaterItem[], ids: string[]): LaterItem[] {
  const remove = new Set(ids);
  return items.filter((item) => !remove.has(item.id));
}

/** Undo: puts removed items back unless they were saved again meanwhile. */
export function restoreToLater(items: LaterItem[], restored: LaterItem[]): LaterItem[] {
  const ids = new Set(items.map((item) => item.id));
  const keys = new Set(items.map((item) => urlKey(item.url)));
  const back = restored.filter((item) => !ids.has(item.id) && !keys.has(urlKey(item.url)));
  return [...back, ...items].sort((a, b) => a.savedAt - b.savedAt);
}

export interface LaterEntry {
  batch: string;
  savedAt: number;
  items: LaterItem[];
}

/** Entries newest first; items keep the order they were saved in. */
export function laterEntries(items: LaterItem[]): LaterEntry[] {
  const entries = new Map<string, LaterEntry>();
  for (const item of items) {
    const entry = entries.get(item.batch);
    if (entry) {
      entry.items.push(item);
      entry.savedAt = Math.max(entry.savedAt, item.savedAt);
    } else {
      entries.set(item.batch, { batch: item.batch, savedAt: item.savedAt, items: [item] });
    }
  }
  return [...entries.values()].sort((a, b) => b.savedAt - a.savedAt);
}
