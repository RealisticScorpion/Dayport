import { browser } from "wxt/browser";
import type { DayportData } from "./schema";

/**
 * Storage keys. The main document holds links and settings. Continue later and
 * discovery preferences live under their own keys because the toolbar popup and
 * the background worker write them too, and a whole-document write from one
 * page must never drop an item another context just saved.
 */
export const KEYS = {
  data: "dayport",
  later: "dayport-later",
  discovery: "dayport-discovery",
  note: "dayport-note",
  weather: "dayport-weather",
  background: "dayport-background",
  weread: "dayport-weread",
  highlights: "dayport-highlights",
} as const;

export async function loadKey(key: string): Promise<unknown> {
  const result = await browser.storage.local.get(key);
  return result[key];
}

export async function saveKey(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

/** Calls `onChange` when any page or the background worker writes `key`. */
export function watchKey(key: string, onChange: (raw: unknown) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === "local" && key in changes) onChange(changes[key]!.newValue);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export interface Codec<T> {
  read: (raw: unknown) => T;
  write: (value: T) => unknown;
}

const chains = new Map<string, Promise<unknown>>();

/**
 * Read-modify-write against the stored value, not an in-memory copy, so writes
 * from several contexts each start from the latest saved state. Writes from one
 * context run one at a time. Resolves with the saved value; rejects if the
 * write failed, in which case nothing changed.
 */
export function mutateKey<T>(key: string, codec: Codec<T>, edit: (value: T) => T): Promise<T> {
  const run = (chains.get(key) ?? Promise.resolve()).then(async () => {
    const next = edit(codec.read(await loadKey(key)));
    await saveKey(key, codec.write(next));
    return next;
  });
  chains.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

export const loadRaw = () => loadKey(KEYS.data);
export const save = (data: DayportData) => saveKey(KEYS.data, data);
export const watch = (onChange: (raw: unknown) => void) => watchKey(KEYS.data, onChange);
