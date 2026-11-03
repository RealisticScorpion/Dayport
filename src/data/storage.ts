import { browser } from "wxt/browser";
import type { DayportData } from "./schema";

const KEY = "dayport";

export async function loadRaw(): Promise<unknown> {
  const result = await browser.storage.local.get(KEY);
  return result[KEY];
}

export async function save(data: DayportData): Promise<void> {
  await browser.storage.local.set({ [KEY]: data });
}

/** Calls `onChange` when another new tab page (or the options page) writes the document. */
export function watch(onChange: (raw: unknown) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === "local" && KEY in changes) onChange(changes[KEY]!.newValue);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
