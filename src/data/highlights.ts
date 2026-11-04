import { z } from "zod";
import type { Codec } from "./storage";

// WeRead highlights, synced with the user's own WeRead Skill API key through
// Tencent's official Agent API gateway (github.com/Tencent/WeChatReading,
// skills/notes.md). Responses are untrusted: every field is validated and
// rendered as plain text.

export const GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
/** Sent with every request, as the gateway requires; it answers with upgrade_info when outdated. */
export const SKILL_VERSION = "1.0.5";
export const MAX_TEXT = 2000;
export const MAX_HIGHLIGHTS = 20_000;

export interface Highlight {
  id: string;
  text: string;
  /** The user's own thought on this passage, if any. */
  note?: string;
  chapter?: string;
  createdAt: number;
}

export interface Book {
  bookId: string;
  title: string;
  author: string;
  highlights: Highlight[];
}

const HighlightSchema = z.object({
  id: z.string(),
  text: z.string(),
  note: z.string().optional(),
  chapter: z.string().optional(),
  createdAt: z.number(),
});

const LibrarySchema = z.object({
  version: z.literal(1),
  syncedAt: z.number(),
  books: z.array(
    z.object({
      bookId: z.string(),
      title: z.string(),
      author: z.string(),
      highlights: z.array(HighlightSchema),
    }),
  ),
});

export type Library = z.infer<typeof LibrarySchema>;

export const libraryCodec: Codec<Library | null> = {
  read: (raw) => {
    const parsed = LibrarySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  write: (value) => value,
};

const AccountSchema = z.object({ version: z.literal(1), apiKey: z.string() });
export type Account = z.infer<typeof AccountSchema>;

export const accountCodec: Codec<Account | null> = {
  read: (raw) => {
    const parsed = AccountSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  write: (value) => value,
};

export const isWereadKey = (value: string) => /^wrk-[A-Za-z0-9_-]{8,200}$/.test(value.trim());

// Gateway response shapes, reduced to the fields Dayport uses.

const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface NotebookEntry {
  bookId: string;
  title: string;
  author: string;
  sort: number;
  count: number;
}

/** One page of `/user/notebooks`. */
export function parseNotebooks(raw: unknown): { books: NotebookEntry[]; hasMore: boolean } {
  const body = record(raw);
  const books = list(body.books).flatMap((entry): NotebookEntry[] => {
    const item = record(entry);
    const book = record(item.book);
    const bookId = text(item.bookId ?? book.bookId);
    if (!bookId) return [];
    return [
      {
        bookId,
        title: text(book.title) || bookId,
        author: text(book.author),
        sort: num(item.sort),
        count: num(item.noteCount) + num(item.reviewCount),
      },
    ];
  });
  return { books, hasMore: body.hasMore === 1 || body.hasMore === true };
}

export interface RawReview {
  id: string;
  content: string;
  abstract: string;
  range: string;
  chapter: string;
  createdAt: number;
}

/** One page of `/review/list/mine`. */
export function parseReviews(raw: unknown): {
  reviews: RawReview[];
  hasMore: boolean;
  synckey: number;
} {
  const body = record(raw);
  const reviews = list(body.reviews).flatMap((entry): RawReview[] => {
    const review = record(record(entry).review);
    const id = text(review.reviewId);
    const content = text(review.content);
    if (!id || !content) return [];
    return [
      {
        id,
        content,
        abstract: text(review.abstract),
        range: text(review.range),
        chapter: text(review.chapterName),
        createdAt: num(review.createTime) * 1000,
      },
    ];
  });
  return {
    reviews,
    hasMore: body.hasMore === 1 || body.hasMore === true,
    synckey: num(body.synckey),
  };
}

/**
 * Joins `/book/bookmarklist` highlights with the user's thoughts. A thought
 * attached to a highlighted passage becomes that highlight's note; a thought
 * on a passage that wasn't highlighted becomes its own excerpt; book-level
 * reviews without a passage are left out.
 */
export function buildHighlights(bookmarkList: unknown, reviews: RawReview[]): Highlight[] {
  const body = record(bookmarkList);
  const chapters = new Map(
    list(body.chapters).map((entry) => {
      const chapter = record(entry);
      return [num(chapter.chapterUid), text(chapter.title)] as const;
    }),
  );
  const byRange = new Map(
    reviews.filter((review) => review.range).map((review) => [review.range, review]),
  );
  const used = new Set<string>();

  const highlights = list(body.updated).flatMap((entry): Highlight[] => {
    const mark = record(entry);
    const markText = text(mark.markText);
    const id = text(mark.bookmarkId);
    if (!markText || !id) return [];
    const range = text(mark.range);
    const thought =
      (range && byRange.get(range)) ||
      reviews.find((review) => review.abstract && review.abstract === markText);
    if (thought) used.add(thought.id);
    const chapter = chapters.get(num(mark.chapterUid)) || undefined;
    return [
      {
        id,
        text: markText,
        ...(thought ? { note: thought.content } : {}),
        ...(chapter ? { chapter } : {}),
        createdAt: num(mark.createTime) * 1000,
      },
    ];
  });

  const extra = reviews
    .filter((review) => review.abstract && !used.has(review.id))
    .map((review) => ({
      id: `review:${review.id}`,
      text: review.abstract,
      note: review.content,
      ...(review.chapter ? { chapter: review.chapter } : {}),
      createdAt: review.createdAt,
    }));

  return [...highlights, ...extra].sort((a, b) => a.createdAt - b.createdAt);
}

/** Error categories the options page explains. */
export type GatewayProblem =
  { kind: "upgrade"; message: string } | { kind: "rejected" } | { kind: "error"; message: string };

/** Reads a gateway reply: returns the body, or a problem to stop the sync on. */
export function checkReply(
  status: number,
  raw: unknown,
): { ok: true; body: unknown } | { ok: false; problem: GatewayProblem } {
  const body = record(raw);
  const upgrade = record(body.upgrade_info);
  if (Object.keys(upgrade).length > 0) {
    return { ok: false, problem: { kind: "upgrade", message: text(upgrade.message) || "upgrade" } };
  }
  if (status === 401 || status === 403) return { ok: false, problem: { kind: "rejected" } };
  const errcode = num(body.errcode);
  if (status >= 400 || errcode !== 0) {
    return {
      ok: false,
      problem: { kind: "error", message: text(body.errmsg) || `HTTP ${status}` },
    };
  }
  return { ok: true, body: raw };
}

/** A highlight for today that stays the same all day, or a fresh one per open. */
export function pickHighlight(
  books: Book[],
  mode: "open" | "daily",
  now: Date,
  random: () => number = Math.random,
): { book: Book; highlight: Highlight } | null {
  const all = books.flatMap((book) => book.highlights.map((highlight) => ({ book, highlight })));
  if (all.length === 0) return null;
  if (mode === "open") return all[Math.floor(random() * all.length)]!;
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let hash = 0;
  for (const char of day) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return all[hash % all.length]!;
}
