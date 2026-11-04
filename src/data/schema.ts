import { z } from "zod";
import { WeatherCitySchema } from "./weather";

/** Version of the persisted document. Bump it and add a migration in migrate.ts. */
export const SCHEMA_VERSION = 1;

export const MAX_TITLE_LENGTH = 200;
export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_URL_LENGTH = 2048;

export const LinkSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  url: z.string().min(1).max(MAX_URL_LENGTH),
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(MAX_GROUP_NAME_LENGTH),
  links: z.array(LinkSchema),
});

export const ClockSchema = z.object({
  id: z.string().min(1),
  /** IANA time zone, e.g. "Europe/London". */
  zone: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(40),
});

export const SettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  density: z.enum(["comfortable", "compact"]),
  favicons: z.enum(["quiet", "color"]),
  timeTint: z.boolean(),
  language: z.enum(["auto", "en", "zh-CN"]),
  singleKeyShortcuts: z.boolean(),
  /** Sections that can be hidden from the new tab page. */
  showFrequent: z.boolean(),
  showLater: z.boolean(),
  showClosed: z.boolean(),
  showNotes: z.boolean(),
  showWeather: z.boolean(),
  clocks: z.array(ClockSchema).max(8),
  weatherCity: WeatherCitySchema.nullable(),
  weatherUnit: z.enum(["c", "f"]),
  bgSource: z.enum(["off", "local", "urls", "json"]),
  bgRotate: z.enum(["open", "hourly", "daily", "manual"]),
  bgVeil: z.number().min(0).max(1),
  /** https image URLs for the "urls" source. */
  bgUrls: z.array(z.string().url().startsWith("https://")).max(500),
  /** Endpoint for the "json" source; empty when unset. */
  bgJsonUrl: z.union([z.literal(""), z.string().url().startsWith("https://")]),
});

export const DataSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  groups: z.array(GroupSchema),
  settings: SettingsSchema,
  updatedAt: z.number(),
});

export type Link = z.infer<typeof LinkSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Clock = z.infer<typeof ClockSchema>;
export type DayportData = z.infer<typeof DataSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  density: "comfortable",
  favicons: "quiet",
  timeTint: true,
  language: "auto",
  singleKeyShortcuts: true,
  showFrequent: true,
  showLater: true,
  showClosed: true,
  showNotes: true,
  showWeather: true,
  clocks: [],
  weatherCity: null,
  weatherUnit: "c",
  bgSource: "off",
  bgRotate: "daily",
  bgVeil: 0.86,
  bgUrls: [],
  bgJsonUrl: "",
};

export function emptyData(now = Date.now()): DayportData {
  return { version: SCHEMA_VERSION, groups: [], settings: { ...DEFAULT_SETTINGS }, updatedAt: now };
}
