import { describe, expect, it } from "vitest";
import {
  VEIL_MIN,
  advance,
  backgroundCodec,
  emptyBackgroundState,
  parseJsonSource,
  parseUrlList,
  skip,
  veilOpacity,
} from "./background";

const HOUR = 60 * 60 * 1000;

describe("background sources", () => {
  it("keeps only https image URLs from a pasted list", () => {
    const { images, rejected } = parseUrlList(
      "https://img.test/a.jpg\n\nhttp://img.test/b.jpg\njavascript:alert(1)\nhttps://img.test/a.jpg\n https://img.test/c.png ",
    );
    expect(images.map((image) => image.url)).toEqual([
      "https://img.test/a.jpg",
      "https://img.test/c.png",
    ]);
    expect(rejected).toBe(2);
  });

  it("accepts both documented JSON shapes and treats responses as data", () => {
    expect(parseJsonSource(["https://img.test/a.jpg", 42, "data:image/png;base64,x"])).toEqual([
      { url: "https://img.test/a.jpg" },
    ]);
    expect(
      parseJsonSource({
        images: [
          { url: "https://img.test/b.jpg", credit: "  Ana  ", link: "https://ana.test/" },
          { url: "https://img.test/c.jpg", credit: "<script>", link: "javascript:alert(1)" },
          { link: "https://no-url.test/" },
        ],
      }),
    ).toEqual([
      { url: "https://img.test/b.jpg", credit: "Ana", link: "https://ana.test/" },
      { url: "https://img.test/c.jpg", credit: "<script>" },
    ]);
    expect(parseJsonSource({ photos: [] })).toBeNull();
    expect(parseJsonSource("nope")).toBeNull();
  });
});

describe("background rotation", () => {
  const base = { ...emptyBackgroundState(), sourceKey: "urls", index: 1, shownAt: 0 };

  it("rotates by elapsed time, on open, or not at all", () => {
    expect(advance(base, "urls", 3, "hourly", HOUR - 1).index).toBe(1);
    expect(advance(base, "urls", 3, "hourly", HOUR).index).toBe(2);
    expect(advance(base, "urls", 3, "daily", 23 * HOUR).index).toBe(1);
    expect(advance(base, "urls", 3, "open", 1).index).toBe(2);
    expect(advance({ ...base, index: 2 }, "urls", 3, "open", 1).index).toBe(0);
    expect(advance(base, "urls", 3, "manual", 1e12).index).toBe(1);
  });

  it("holds while paused and restarts when the source changes", () => {
    expect(advance({ ...base, paused: true }, "urls", 3, "open", 1).index).toBe(1);
    expect(advance(base, "local", 3, "open", 5)).toMatchObject({
      sourceKey: "local",
      index: 0,
      shownAt: 5,
    });
    expect(advance({ ...base, index: 7 }, "urls", 3, "manual", 1).index).toBe(1);
  });

  it("skips even when paused, and clamps the veil", () => {
    expect(skip({ ...base, paused: true }, 3, 9)).toMatchObject({ index: 2, shownAt: 9 });
    expect(veilOpacity(0.2)).toBe(VEIL_MIN);
    expect(veilOpacity(2)).toBe(0.95);
    expect(backgroundCodec.read({ version: 1 })).toEqual(emptyBackgroundState());
  });
});
