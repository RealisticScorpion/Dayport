import type { Group } from "./schema";

export interface SearchResult {
  linkId: string;
  title: string;
  url: string;
  groupName: string;
  /** Matched range in `title`, or null when only the URL matched. */
  match: [start: number, end: number] | null;
}

const MAX_RESULTS = 8;

/**
 * Local search over saved links. Ranks title-prefix matches first, then
 * word-start and substring title matches, then URL matches. Runs entirely in
 * the page; nothing is sent anywhere.
 */
export function searchLinks(groups: Group[], query: string): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const scored: { score: number; order: number; result: SearchResult }[] = [];
  let order = 0;
  for (const group of groups) {
    for (const link of group.links) {
      order += 1;
      const title = link.title.toLowerCase();
      const at = title.indexOf(needle);
      let score: number;
      if (at === 0) score = 0;
      else if (at > 0 && /[\s\-_./·]/.test(title[at - 1]!)) score = 1;
      else if (at > 0) score = 2;
      else if (link.url.toLowerCase().includes(needle)) score = 3;
      else continue;
      scored.push({
        score,
        order,
        result: {
          linkId: link.id,
          title: link.title,
          url: link.url,
          groupName: group.name,
          match: at >= 0 ? [at, at + needle.length] : null,
        },
      });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.result);
}
