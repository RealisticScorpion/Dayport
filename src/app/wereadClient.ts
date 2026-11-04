import {
  GATEWAY,
  MAX_HIGHLIGHTS,
  SKILL_VERSION,
  buildHighlights,
  checkReply,
  parseNotebooks,
  parseReviews,
  type Book,
  type GatewayProblem,
  type Library,
  type RawReview,
} from "../data/highlights";

export const GATEWAY_ORIGIN = "https://i.weread.qq.com/*";
const CONCURRENCY = 3;
const MAX_PAGES = 50;

export class SyncProblem extends Error {
  constructor(readonly problem: GatewayProblem) {
    super(problem.kind === "rejected" ? "rejected" : problem.message);
  }
}

/** One gateway call: the key goes only in the Authorization header, to WeRead. */
async function call(apiKey: string, apiName: string, params: Record<string, unknown> = {}) {
  let response: Response;
  try {
    response = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ api_name: apiName, ...params, skill_version: SKILL_VERSION }),
      signal: AbortSignal.timeout(15_000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch (error) {
    throw new SyncProblem({
      kind: "error",
      message: error instanceof Error ? error.message : "network",
    });
  }
  const raw: unknown = await response.json().catch(() => null);
  const reply = checkReply(response.status, raw);
  if (!reply.ok) throw new SyncProblem(reply.problem);
  return reply.body;
}

/**
 * Fetches every book with notes, then each book's highlights and thoughts.
 * Builds the whole library in memory; the caller saves it only on success,
 * so a failed sync leaves the previous highlights untouched.
 */
export async function syncLibrary(
  apiKey: string,
  onProgress: (done: number, total: number) => void,
): Promise<Library> {
  const entries = [];
  let lastSort: number | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { books, hasMore } = parseNotebooks(
      await call(apiKey, "/user/notebooks", { count: 100, ...(lastSort ? { lastSort } : {}) }),
    );
    entries.push(...books);
    if (!hasMore || books.length === 0) break;
    lastSort = books.at(-1)!.sort;
  }

  const withNotes = entries.filter((entry) => entry.count > 0);
  const books: Book[] = [];
  let done = 0;
  onProgress(0, withNotes.length);
  const queue = [...withNotes];
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const bookmarks = await call(apiKey, "/book/bookmarklist", { bookId: entry.bookId });
      const reviews: RawReview[] = [];
      let synckey = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = parseReviews(
          await call(apiKey, "/review/list/mine", { bookid: entry.bookId, synckey, count: 50 }),
        );
        reviews.push(...result.reviews);
        if (!result.hasMore || result.synckey === synckey) break;
        synckey = result.synckey;
      }
      const highlights = buildHighlights(bookmarks, reviews);
      if (highlights.length > 0) {
        books.push({ bookId: entry.bookId, title: entry.title, author: entry.author, highlights });
      }
      onProgress(++done, withNotes.length);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Most recently noted books first, as WeRead orders them; cap the total.
  const order = new Map(withNotes.map((entry, index) => [entry.bookId, index]));
  books.sort((a, b) => order.get(a.bookId)! - order.get(b.bookId)!);
  let room = MAX_HIGHLIGHTS;
  const capped = books.map((book) => {
    const highlights = book.highlights.slice(0, Math.max(0, room));
    room -= highlights.length;
    return { ...book, highlights };
  });
  return {
    version: 1,
    syncedAt: Date.now(),
    books: capped.filter((book) => book.highlights.length),
  };
}
