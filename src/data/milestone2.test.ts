import { describe, expect, it } from "vitest";
import { mergeImport, previewImport } from "./backup";
import { bookmarkFolders, bookmarksToImport, type BookmarkNode } from "./bookmarks";
import {
  buildSuggestions,
  discoveryCodec,
  dismiss,
  domainOf,
  emptyDiscovery,
  exclude,
  recurringPages,
  unexclude,
} from "./discovery";
import {
  addToLater,
  laterCodec,
  laterEntries,
  removeFromLater,
  restoreToLater,
  saveableUrl,
} from "./later";
import { addGroup, addLink } from "./ops";
import { emptyData } from "./schema";

let counter = 0;
const seqId = () => `id-${++counter}`;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 3, 12);

describe("recurringPages", () => {
  const page = (url: string, daysAgo: number[]) => ({
    url,
    title: url,
    visitTimes: daysAgo.map((days) => NOW - days * DAY),
  });

  it("needs visits on three distinct days within two weeks", () => {
    const result = recurringPages(
      [
        page("https://a.test/three-days", [0, 1, 2]),
        page("https://a.test/same-day", [0, 0, 0, 0, 0]),
        page("https://a.test/too-old", [0, 1, 15]),
        page("https://a.test/edge", [0, 7, 14]),
      ],
      NOW,
    );
    expect(result.map((item) => item.url)).toEqual([
      "https://a.test/three-days",
      "https://a.test/edge",
    ]);
  });

  it("ranks by distinct days, then visits, then recency", () => {
    const result = recurringPages(
      [
        page("https://a.test/few", [1, 2, 3]),
        page("https://a.test/many-days", [0, 1, 2, 3, 4]),
        page("https://a.test/busy", [1, 1, 1, 2, 3]),
        page("https://a.test/recent", [0, 2, 3]),
      ],
      NOW,
    );
    expect(result.map((item) => item.url)).toEqual([
      "https://a.test/many-days",
      "https://a.test/busy",
      "https://a.test/recent",
      "https://a.test/few",
    ]);
  });
});

describe("buildSuggestions", () => {
  const s = (url: string, title = "") => ({ url, title });

  it("groups pages by domain but keeps different paths as separate pages", () => {
    const rows = buildSuggestions(
      [
        s("https://github.com/a/repo", "Repo"),
        s("https://news.test/", "News"),
        s("https://www.github.com/a/repo/pulls?q=open", "Pulls"),
        s("https://github.com/a/repo#readme", "Repo again"),
      ],
      [],
      emptyDiscovery(),
    );
    expect(rows).toEqual([
      {
        kind: "domain",
        domain: "github.com",
        pages: [
          s("https://github.com/a/repo", "Repo"),
          s("https://www.github.com/a/repo/pulls?q=open", "Pulls"),
        ],
      },
      { kind: "page", domain: "news.test", page: s("https://news.test/", "News") },
    ]);
  });

  it("leaves out pinned, dismissed, excluded, and non-web pages", () => {
    let prefs = dismiss(emptyDiscovery(), "https://b.test/dismissed");
    prefs = exclude(prefs, "excluded.test");
    const rows = buildSuggestions(
      [
        s("https://pinned.test/"),
        s("https://b.test/dismissed"),
        s("https://b.test/kept"),
        s("https://mail.excluded.test/"),
        s("chrome://settings/"),
        s("file:///tmp/a.html"),
      ],
      ["https://www.pinned.test"],
      prefs,
    );
    expect(rows).toEqual([
      { kind: "page", domain: "b.test", page: s("https://b.test/kept", "b.test") },
    ]);
    expect(
      buildSuggestions([s("https://mail.excluded.test/")], [], unexclude(prefs, "excluded.test")),
    ).toHaveLength(1);
  });

  it("shows at most eight rows", () => {
    const many = Array.from({ length: 12 }, (_, i) => s(`https://site${i}.test/`));
    expect(buildSuggestions(many, [], emptyDiscovery())).toHaveLength(8);
  });

  it("persists only valid preferences", () => {
    expect(discoveryCodec.read({ version: 1, dismissed: "x" })).toEqual(emptyDiscovery());
    const prefs = exclude(emptyDiscovery(), "a.test");
    expect(discoveryCodec.read(discoveryCodec.write(prefs))).toEqual(prefs);
    expect(domainOf("https://www.a.test/x")).toBe("a.test");
    expect(domainOf("chrome://history")).toBeNull();
  });
});

describe("continue later", () => {
  it("saves supported tabs as one batch and moves pages saved again", () => {
    let items = addToLater(
      [],
      [
        { url: "https://a.test/1", title: "One" },
        { url: "chrome://newtab/", title: "New Tab" },
        { url: "chrome-extension://abc/newtab.html", title: "Dayport" },
        { url: "https://b.test/", title: "" },
        {},
      ],
      1000,
      "batch-1",
      seqId,
    );
    expect(items.map((item) => [item.title, item.batch])).toEqual([
      ["One", "batch-1"],
      ["b.test", "batch-1"],
    ]);
    items = addToLater(
      items,
      [{ url: "https://a.test/1#top", title: "One" }],
      2000,
      "batch-2",
      seqId,
    );
    expect(laterEntries(items).map((entry) => [entry.batch, entry.items.length])).toEqual([
      ["batch-2", 1],
      ["batch-1", 1],
    ]);
  });

  it("removes and restores with undo", () => {
    const items = addToLater(
      [],
      [{ url: "https://a.test/" }, { url: "https://b.test/" }],
      1,
      "b",
      seqId,
    );
    const removed = removeFromLater(items, [items[0]!.id]);
    expect(removed).toHaveLength(1);
    expect(restoreToLater(removed, [items[0]!])).toEqual(items);
  });

  it("drops damaged items but keeps valid ones", () => {
    const items = addToLater([], [{ url: "https://a.test/" }], 1, "b", seqId);
    const raw = laterCodec.write(items) as { items: unknown[] };
    expect(laterCodec.read({ ...raw, items: [...raw.items, { url: "javascript:x" }] })).toEqual(
      items,
    );
    expect(laterCodec.read("garbage")).toEqual([]);
    expect(saveableUrl({ url: "javascript:alert(1)" })).toBeNull();
  });
});

describe("bookmark import", () => {
  const tree: BookmarkNode[] = [
    {
      id: "0",
      title: "",
      children: [
        {
          id: "1",
          title: "Bookmarks bar",
          children: [
            { id: "10", title: "GitHub", url: "https://github.com/" },
            { id: "11", title: "", url: "https://linear.app/" },
            { id: "12", title: "Bad", url: "javascript:alert(1)" },
            {
              id: "2",
              title: "Docs",
              children: [{ id: "20", title: "MDN", url: "https://developer.mozilla.org/" }],
            },
            { id: "3", title: "Empty", children: [] },
          ],
        },
      ],
    },
  ];

  it("lists folders that directly hold bookmarks", () => {
    expect(bookmarkFolders(tree)).toEqual([
      { id: "1", title: "Bookmarks bar", path: [], links: 3 },
      { id: "2", title: "Docs", path: ["Bookmarks bar"], links: 1 },
    ]);
  });

  it("turns chosen folders into groups and merges without duplicates", () => {
    const parsed = bookmarksToImport(tree, ["1", "2"], "Bookmarks", seqId);
    expect(
      parsed.groups.map((group) => [group.name, group.links.map((link) => link.title)]),
    ).toEqual([
      ["Bookmarks bar", ["GitHub", "linear.app"]],
      ["Docs", ["MDN"]],
    ]);
    expect(parsed.rejected).toEqual([{ kind: "link", label: "Bad", reason: "scheme" }]);

    let data = addGroup(emptyData(0), "Work", "g1");
    data = addLink(data, "g1", { title: "GitHub", url: "https://github.com" }, "l1");
    expect(previewImport(data, parsed)).toMatchObject({ groups: 2, links: 3, duplicateLinks: 1 });
    const merged = mergeImport(data, parsed);
    expect(merged.groups.map((group) => group.links.length)).toEqual([1, 1, 1]);
  });
});
