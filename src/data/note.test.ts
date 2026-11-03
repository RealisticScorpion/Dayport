import { describe, expect, it } from "vitest";
import { createBackup, parseBackup, previewImport } from "./backup";
import { emptyNote, mergeNoteText, noteCodec } from "./note";
import { emptyData } from "./schema";

describe("note", () => {
  it("appends imported text once, below the current note", () => {
    expect(mergeNoteText("", "Imported")).toBe("Imported");
    expect(mergeNoteText("Mine\n", "Imported")).toBe("Mine\n\n---\n\nImported");
    expect(mergeNoteText("Mine\n\n---\n\nImported", "Imported")).toBe("Mine\n\n---\n\nImported");
    expect(mergeNoteText("Mine", "  ")).toBe("Mine");
  });

  it("reads damaged storage as an empty note", () => {
    expect(noteCodec.read({ version: 1, text: 42 })).toEqual(emptyNote());
  });

  it("travels in backups and counts as content on its own", () => {
    const file = createBackup(emptyData(0), { links: false, settings: false, note: "Hello" });
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.note).toBe("Hello");
    expect(parsed.ok && previewImport(emptyData(0), parsed).hasNote).toBe(true);
    const without = createBackup(emptyData(0), { links: true, settings: false, note: "" });
    expect(without).not.toHaveProperty("note");
  });
});
