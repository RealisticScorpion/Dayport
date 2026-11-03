import { describe, expect, it } from "vitest";
import { createBackup, mergeImport, parseBackup, previewImport, replaceImport } from "./backup";
import { migrate } from "./migrate";
import {
  addGroup,
  addLink,
  deleteGroup,
  deleteLink,
  moveLink,
  nudgeLink,
  renameGroup,
} from "./ops";
import { emptyData, type DayportData } from "./schema";
import { searchLinks } from "./search";
import { normalizeUrl, titleFromUrl, urlKey } from "./url";

let counter = 0;
const seqId = () => `id-${++counter}`;

function sample(): DayportData {
  let data = emptyData(0);
  data = addGroup(data, "Work", "g1");
  data = addGroup(data, "Docs", "g2");
  data = addLink(data, "g1", { title: "GitHub", url: "https://github.com/" }, "l1");
  data = addLink(data, "g1", { title: "Linear", url: "https://linear.app/" }, "l2");
  data = addLink(
    data,
    "g2",
    { title: "MDN Web Docs", url: "https://developer.mozilla.org/" },
    "l3",
  );
  return data;
}

describe("normalizeUrl", () => {
  it("adds https to bare hosts and keeps path and query", () => {
    expect(normalizeUrl("github.com/a?b=1")).toEqual({ ok: true, url: "https://github.com/a?b=1" });
    expect(normalizeUrl("localhost:3000")).toEqual({ ok: true, url: "https://localhost:3000/" });
  });
  it("accepts http, https, and chrome schemes", () => {
    expect(normalizeUrl("http://example.com").ok).toBe(true);
    expect(normalizeUrl("chrome://settings").ok).toBe(true);
  });
  it("rejects dangerous or empty input", () => {
    expect(normalizeUrl("javascript:alert(1)")).toEqual({ ok: false, reason: "scheme" });
    expect(normalizeUrl("data:text/html,hi")).toEqual({ ok: false, reason: "scheme" });
    expect(normalizeUrl("   ")).toEqual({ ok: false, reason: "empty" });
    expect(normalizeUrl("not a url")).toEqual({ ok: false, reason: "invalid" });
  });
  it("derives titles and duplicate keys", () => {
    expect(titleFromUrl("https://www.github.com/x")).toBe("github.com");
    expect(urlKey("https://www.a.com/p/?q=1#h")).toBe(urlKey("https://a.com/p?q=1"));
    expect(urlKey("https://a.com/p?q=1")).not.toBe(urlKey("https://a.com/p?q=2"));
  });
});

describe("ops", () => {
  it("adds, renames, and deletes", () => {
    let data = sample();
    data = renameGroup(data, "g1", "Team");
    data = deleteLink(data, "l2");
    expect(data.groups[0]).toMatchObject({ name: "Team", links: [{ id: "l1" }] });
    expect(deleteGroup(data, "g1").groups.map((g) => g.id)).toEqual(["g2"]);
  });
  it("moves links within and across groups", () => {
    const data = sample();
    expect(moveLink(data, "l1", "g1", 1).groups[0]!.links.map((l) => l.id)).toEqual(["l2", "l1"]);
    const moved = moveLink(data, "l1", "g2", 0);
    expect(moved.groups[0]!.links.map((l) => l.id)).toEqual(["l2"]);
    expect(moved.groups[1]!.links.map((l) => l.id)).toEqual(["l1", "l3"]);
  });
  it("nudges with the keyboard and stops at edges", () => {
    const data = sample();
    expect(nudgeLink(data, "l1", "up").groups[0]!.links.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(nudgeLink(data, "l2", "right").groups[1]!.links.map((l) => l.id)).toEqual(["l3", "l2"]);
    expect(nudgeLink(data, "l1", "left")).toBe(data);
  });
});

describe("searchLinks", () => {
  it("ranks prefix, word-start, substring, then URL matches", () => {
    const data = sample();
    expect(searchLinks(data.groups, "docs").map((r) => r.linkId)).toEqual(["l3"]);
    expect(searchLinks(data.groups, "mozilla")).toMatchObject([{ linkId: "l3", match: null }]);
    expect(searchLinks(data.groups, "li")).toMatchObject([{ linkId: "l2", match: [0, 2] }]);
    expect(searchLinks(data.groups, "  ")).toEqual([]);
  });
});

describe("migrate", () => {
  it("starts empty when nothing is stored", () => {
    expect(migrate(undefined)).toMatchObject({ ok: true, fresh: true, data: { groups: [] } });
  });
  it("fills missing settings with defaults", () => {
    const stored = { ...sample(), settings: { theme: "dark", density: "nonsense" } };
    const result = migrate(stored);
    expect(result.ok && result.data.settings).toMatchObject({
      theme: "dark",
      density: "comfortable",
    });
  });
  it("keeps valid groups when one group is damaged", () => {
    const stored = { ...sample(), groups: [...sample().groups, { id: "bad" }] };
    const result = migrate(stored);
    expect(result.ok && result.data.groups.map((g) => g.id)).toEqual(["g1", "g2"]);
  });
  it("refuses unknown versions instead of overwriting them", () => {
    expect(migrate({ version: 99 })).toEqual({ ok: false });
    expect(migrate("garbage")).toEqual({ ok: false });
  });
});

describe("backup import", () => {
  it("round-trips an export", () => {
    const data = sample();
    const file = JSON.stringify(createBackup(data, { links: true, settings: true }));
    const parsed = parseBackup(file, seqId);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.groups.flatMap((g) => g.links.map((l) => l.url))).toEqual(
      data.groups.flatMap((g) => g.links.map((l) => l.url)),
    );
    expect(parsed.rejected).toEqual([]);
  });
  it("rejects files that are not Dayport backups", () => {
    expect(parseBackup("{", seqId)).toEqual({ ok: false, error: "json" });
    expect(parseBackup('{"format":"other"}', seqId)).toEqual({ ok: false, error: "format" });
    expect(parseBackup('{"format":"dayport-backup","version":9,"groups":[]}', seqId)).toEqual({
      ok: false,
      error: "version",
    });
  });
  it("skips unsafe links and reports them", () => {
    const file = JSON.stringify({
      format: "dayport-backup",
      version: 1,
      groups: [
        {
          name: "Tools",
          links: [
            { title: "Bad", url: "javascript:alert(1)" },
            { title: "", url: "" },
            { url: "example.com" },
          ],
        },
      ],
    });
    const parsed = parseBackup(file, seqId);
    expect(parsed.ok && parsed.rejected.map((r) => r.reason)).toEqual(["scheme", "empty"]);
    expect(parsed.ok && parsed.groups[0]!.links).toMatchObject([
      { title: "example.com", url: "https://example.com/" },
    ]);
  });
  it("merges without duplicating links and keeps current settings", () => {
    const current = sample();
    const incoming = parseBackup(
      JSON.stringify({
        format: "dayport-backup",
        version: 1,
        settings: { theme: "dark" },
        groups: [
          {
            name: "work",
            links: [
              { title: "GitHub again", url: "https://www.github.com" },
              { title: "Figma", url: "figma.com" },
            ],
          },
          { name: "New", links: [{ title: "Vite", url: "vite.dev" }] },
        ],
      }),
      seqId,
    );
    if (!incoming.ok) throw new Error("parse failed");
    expect(previewImport(current, incoming)).toEqual({
      groups: 2,
      links: 3,
      duplicateLinks: 1,
      hasSettings: true,
    });
    const merged = mergeImport(current, incoming);
    expect(merged.groups.map((g) => g.name)).toEqual(["Work", "Docs", "New"]);
    expect(merged.groups[0]!.links.map((l) => l.title)).toEqual(["GitHub", "Linear", "Figma"]);
    expect(merged.settings.theme).toBe("system");
    const replaced = replaceImport(current, incoming);
    expect(replaced.groups.map((g) => g.name)).toEqual(["work", "New"]);
    expect(replaced.settings.theme).toBe("dark");
  });
});
