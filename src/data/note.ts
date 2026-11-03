import { z } from "zod";
import type { Codec } from "./storage";

// One note, deliberately (docs/design.md, Tools): a single document keeps
// concurrent editing between open new tab pages simple and visible.

export const MAX_NOTE_LENGTH = 100_000;

const NoteSchema = z.object({
  version: z.literal(1),
  text: z.string().max(MAX_NOTE_LENGTH),
  updatedAt: z.number(),
  /** Id of the page that saved it, so a page can tell its own writes from others'. */
  writer: z.string(),
});

export type Note = z.infer<typeof NoteSchema>;

export const emptyNote = (): Note => ({ version: 1, text: "", updatedAt: 0, writer: "" });

export const noteCodec: Codec<Note> = {
  read: (raw) => {
    const parsed = NoteSchema.safeParse(raw);
    return parsed.success ? parsed.data : emptyNote();
  },
  write: (note) => note,
};

/** Imported text is appended below the current note unless it is already there. */
export function mergeNoteText(current: string, incoming: string): string {
  const mine = current.trimEnd();
  const theirs = incoming.trim();
  if (!theirs || mine.includes(theirs)) return current;
  if (!mine) return theirs;
  return `${mine}\n\n---\n\n${theirs}`.slice(0, MAX_NOTE_LENGTH);
}

export function noteFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `dayport-note-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.md`;
}
