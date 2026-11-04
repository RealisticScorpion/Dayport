import { z } from "zod";
import type { Codec } from "./storage";

// Weather from Open-Meteo (docs/design.md, Tools). Only the chosen city's
// coordinates are sent; the response is cached so the tool works offline and
// a failed refresh keeps the last result.

export const PROVIDER = { name: "Open-Meteo", url: "https://open-meteo.com/" } as const;

/** Refresh when the cached result is older than this. */
export const REFRESH_AFTER_MS = 30 * 60 * 1000;
/** Label the result "Cached" when it is older than this (docs/design.md). */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export const WeatherCitySchema = z.object({
  name: z.string().min(1).max(80),
  /** Region and country, for telling same-named places apart. */
  detail: z.string().max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type WeatherCity = z.infer<typeof WeatherCitySchema>;

const ForecastSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
    precipitation_probability: z.number().nullable().optional(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
  }),
});

export interface DayForecast {
  /** Local calendar date at the city, "2026-11-04". */
  date: string;
  code: number;
  max: number;
  min: number;
  rain: number | null;
}

/** Temperatures are stored in °C and converted for display. */
export interface Conditions {
  temperature: number;
  feelsLike: number;
  code: number;
  isDay: boolean;
  rain: number | null;
  days: DayForecast[];
}

const CacheSchema = z.object({
  version: z.literal(1),
  /** Coordinates the result belongs to, so a city change never shows stale data. */
  key: z.string(),
  fetchedAt: z.number(),
  conditions: z.custom<Conditions>((value) => typeof value === "object" && value !== null),
});

export type WeatherCache = z.infer<typeof CacheSchema>;

export const weatherCodec: Codec<WeatherCache | null> = {
  read: (raw) => {
    const parsed = CacheSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  write: (value) => value,
};

export const cityKey = (city: WeatherCity) =>
  `${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}`;

export function forecastUrl(city: WeatherCity): string {
  const params = new URLSearchParams({
    latitude: city.latitude.toFixed(2),
    longitude: city.longitude.toFixed(2),
    current: "temperature_2m,apparent_temperature,weather_code,is_day,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "4",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function geocodeUrl(query: string, language: string): string {
  const params = new URLSearchParams({
    name: query.trim(),
    count: "6",
    language: language.startsWith("zh") ? "zh" : "en",
    format: "json",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

/** Validates a forecast response; returns null for anything unexpected. */
export function parseForecast(raw: unknown): Conditions | null {
  const parsed = ForecastSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { current, daily } = parsed.data;
  const days = daily.time.flatMap((date, i): DayForecast[] => {
    const code = daily.weather_code[i];
    const max = daily.temperature_2m_max[i];
    const min = daily.temperature_2m_min[i];
    if (code === undefined || max === undefined || min === undefined) return [];
    return [{ date, code, max, min, rain: daily.precipitation_probability_max[i] ?? null }];
  });
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    code: current.weather_code,
    isDay: current.is_day === 1,
    rain: current.precipitation_probability ?? null,
    days,
  };
}

const GeocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
});

export function parseGeocode(raw: unknown): WeatherCity[] {
  const parsed = GeocodeSchema.safeParse(raw);
  if (!parsed.success) return [];
  return (parsed.data.results ?? []).flatMap((place) => {
    const city = WeatherCitySchema.safeParse({
      name: place.name,
      detail: [place.admin1, place.country].filter(Boolean).join(", "),
      latitude: place.latitude,
      longitude: place.longitude,
    });
    return city.success ? [city.data] : [];
  });
}

export function toUnit(celsius: number, unit: "c" | "f"): number {
  return Math.round(unit === "f" ? celsius * 1.8 + 32 : celsius);
}

/** WMO weather interpretation codes, grouped into the conditions the tool names. */
export type Condition =
  | "clear"
  | "mostlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "freezingRain"
  | "rain"
  | "snow"
  | "showers"
  | "snowShowers"
  | "thunderstorm";

export function conditionOf(code: number): Condition {
  if (code === 0) return "clear";
  if (code === 1) return "mostlyClear";
  if (code === 2) return "partlyCloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code === 56 || code === 57 || code === 66 || code === 67) return "freezingRain";
  if (code >= 61 && code <= 65) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code === 85 || code === 86) return "snowShowers";
  if (code >= 95) return "thunderstorm";
  return "overcast";
}

export function needsRefresh(cache: WeatherCache | null, city: WeatherCity, now: number): boolean {
  return !cache || cache.key !== cityKey(city) || now - cache.fetchedAt > REFRESH_AFTER_MS;
}

export function isStale(cache: WeatherCache, now: number): boolean {
  return now - cache.fetchedAt > STALE_AFTER_MS;
}
