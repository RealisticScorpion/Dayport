import { describe, expect, it } from "vitest";
import {
  buildHighlights,
  checkReply,
  isWereadKey,
  parseNotebooks,
  parseReviews,
  pickHighlight,
  type Book,
} from "./highlights";

// Shapes follow github.com/Tencent/WeChatReading skills/notes.md.

describe("WeRead parsing", () => {
  it("reads notebooks and their pagination", () => {
    expect(
      parseNotebooks({
        books: [
          {
            bookId: "b1",
            book: { title: "三体", author: "刘慈欣" },
            noteCount: 3,
            reviewCount: 1,
            sort: 170,
          },
          { book: { title: "No id" } },
        ],
        hasMore: 1,
      }),
    ).toEqual({
      books: [{ bookId: "b1", title: "三体", author: "刘慈欣", sort: 170, count: 4 }],
      hasMore: true,
    });
  });

  it("joins highlights with thoughts and keeps thought-only excerpts", () => {
    const { reviews } = parseReviews({
      reviews: [
        {
          review: {
            reviewId: "r1",
            content: "Well put.",
            abstract: "A",
            range: "10-20",
            createTime: 3,
          },
        },
        {
          review: {
            reviewId: "r2",
            content: "On a passage I didn't mark.",
            abstract: "C",
            createTime: 5,
            chapterName: "Two",
          },
        },
        { review: { reviewId: "r3", content: "Whole-book review", createTime: 6 } },
        { review: { reviewId: "", content: "broken" } },
      ],
      hasMore: 0,
      synckey: 9,
    });
    const highlights = buildHighlights(
      {
        updated: [
          { bookmarkId: "m1", markText: "A", range: "10-20", chapterUid: 1, createTime: 1 },
          { bookmarkId: "m2", markText: "B", chapterUid: 2, createTime: 2 },
          { bookmarkId: "m3", markText: "" },
        ],
        chapters: [
          { chapterUid: 1, title: "One" },
          { chapterUid: 2, title: "Two" },
        ],
      },
      reviews,
    );
    expect(highlights).toEqual([
      { id: "m1", text: "A", note: "Well put.", chapter: "One", createdAt: 1000 },
      { id: "m2", text: "B", chapter: "Two", createdAt: 2000 },
      {
        id: "review:r2",
        text: "C",
        note: "On a passage I didn't mark.",
        chapter: "Two",
        createdAt: 5000,
      },
    ]);
  });

  it("stops on upgrade requests, rejected keys, and errors", () => {
    expect(checkReply(200, { upgrade_info: { message: "Update to 1.0.6" } })).toEqual({
      ok: false,
      problem: { kind: "upgrade", message: "Update to 1.0.6" },
    });
    expect(checkReply(401, { errcode: -2010, errmsg: "用户不存在" })).toEqual({
      ok: false,
      problem: { kind: "rejected" },
    });
    expect(checkReply(200, { errcode: -1, errmsg: "busy" })).toMatchObject({
      ok: false,
      problem: { kind: "error", message: "busy" },
    });
    expect(checkReply(200, { books: [] }).ok).toBe(true);
  });

  it("validates keys and picks a stable highlight per day", () => {
    expect(isWereadKey("wrk-abcdefgh12")).toBe(true);
    expect(isWereadKey("sk-abcdefgh12")).toBe(false);
    const books: Book[] = [
      {
        bookId: "1",
        title: "T",
        author: "",
        highlights: [1, 2, 3].map((n) => ({ id: `${n}`, text: `${n}`, createdAt: n })),
      },
    ];
    const day = new Date(2026, 10, 4, 9);
    expect(pickHighlight(books, "daily", day)).toEqual(
      pickHighlight(books, "daily", new Date(2026, 10, 4, 22)),
    );
    expect(pickHighlight(books, "open", day, () => 0.99)?.highlight.id).toBe("3");
    expect(pickHighlight([], "daily", day)).toBeNull();
  });
});
