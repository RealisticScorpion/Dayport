import { z } from "zod";
import type { Codec } from "./storage";

// Background images (docs/design.md, Backgrounds). Sources are local images,
// an explicit list of image URLs, or a JSON endpoint in the documented shape
// below. Responses are data only: every entry is validated and anything that
// is not an https image URL is dropped.

export const MAX_REMOTE_IMAGES = 500;
export const MAX_LOCAL_IMAGES = 50;
export const MAX_LOCAL_BYTES = 15 * 1024 * 1024;
/**
 * The veil's lowest opacity that keeps `ink-muted` text at 4.5:1 in the worst
 * case: 0.85 gives 5.2:1 over a black image in light mode and 4.7:1 over a
 * white image in dark mode.
 */
export const VEIL_MIN = 0.85;
export const VEIL_MAX = 0.95;
export const VEIL_DEFAULT = 0.86;

export type BackgroundSource = "off" | "local" | "urls" | "json";
export type Rotation = "open" | "hourly" | "daily" | "manual";

export interface RemoteImage {
  url: string;
  credit?: string;
  link?: string;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function webUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** One https URL per line; blank lines and anything else are skipped. */
export function parseUrlList(text: string): { images: RemoteImage[]; rejected: number } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const images = lines.flatMap((line) => {
    const url = httpsUrl(line);
    return url ? [{ url }] : [];
  });
  return {
    images: dedupe(images).slice(0, MAX_REMOTE_IMAGES),
    rejected: lines.length - images.length,
  };
}

/**
 * The documented JSON source shape. Either a bare array of image URLs, or
 * `{ "images": [{ "url": "https://…", "credit": "Name", "link": "https://…" }] }`.
 */
export function parseJsonSource(raw: unknown): RemoteImage[] | null {
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { images?: unknown }).images)
      ? (raw as { images: unknown[] }).images
      : null;
  if (!entries) return null;
  const images = entries.flatMap((entry): RemoteImage[] => {
    if (typeof entry === "string") {
      const url = httpsUrl(entry);
      return url ? [{ url }] : [];
    }
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const url = httpsUrl(record.url);
    if (!url) return [];
    const credit =
      typeof record.credit === "string" && record.credit.trim()
        ? record.credit.trim().slice(0, 120)
        : undefined;
    const link = webUrl(record.link) ?? undefined;
    return [{ url, ...(credit ? { credit } : {}), ...(link ? { link } : {}) }];
  });
  return dedupe(images).slice(0, MAX_REMOTE_IMAGES);
}

function dedupe(images: RemoteImage[]): RemoteImage[] {
  const seen = new Set<string>();
  return images.filter((image) => !seen.has(image.url) && Boolean(seen.add(image.url)));
}

const PERIOD: Record<Rotation, number> = {
  open: 0,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  manual: Infinity,
};

const StateSchema = z.object({
  version: z.literal(1),
  /** Which source and list the index refers to; a change starts over at 0. */
  sourceKey: z.string(),
  index: z.number().int().min(0),
  shownAt: z.number(),
  paused: z.boolean(),
  /** The last image that loaded, shown while a replacement loads or after failures. */
  lastGood: z
    .object({ url: z.string(), credit: z.string().optional(), link: z.string().optional() })
    .nullable(),
  /** JSON source results, so a failed fetch keeps the previous list. */
  jsonImages: z
    .object({ url: z.string(), fetchedAt: z.number(), images: z.array(z.custom<RemoteImage>()) })
    .nullable(),
});

export type BackgroundState = z.infer<typeof StateSchema>;

export const emptyBackgroundState = (): BackgroundState => ({
  version: 1,
  sourceKey: "",
  index: 0,
  shownAt: 0,
  paused: false,
  lastGood: null,
  jsonImages: null,
});

export const backgroundCodec: Codec<BackgroundState> = {
  read: (raw) => {
    const parsed = StateSchema.safeParse(raw);
    return parsed.success ? parsed.data : emptyBackgroundState();
  },
  write: (state) => state,
};

/**
 * Decides which image to show when a page opens. Rotation is checked against
 * elapsed time on open, so a device that slept just switches on the next
 * open. Pausing or manual rotation keeps the current image.
 */
export function advance(
  state: BackgroundState,
  sourceKey: string,
  count: number,
  rotation: Rotation,
  now: number,
): BackgroundState {
  if (count === 0) return { ...state, sourceKey, index: 0 };
  if (state.sourceKey !== sourceKey) return { ...state, sourceKey, index: 0, shownAt: now };
  const index = state.index % count;
  if (state.paused || now - state.shownAt < PERIOD[rotation]) return { ...state, index };
  return { ...state, index: (index + 1) % count, shownAt: now };
}

/** Skip always moves on, whatever the rotation setting. */
export function skip(state: BackgroundState, count: number, now: number): BackgroundState {
  return count === 0 ? state : { ...state, index: (state.index + 1) % count, shownAt: now };
}

/** Clamps a stored veil strength into the readable range. */
export function veilOpacity(value: number): number {
  return Math.min(VEIL_MAX, Math.max(VEIL_MIN, value));
}
