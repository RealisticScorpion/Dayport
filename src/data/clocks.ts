// World clocks (docs/design.md, Tools). All time-zone math goes through Intl
// with IANA zone names, so daylight saving changes follow the platform's
// time-zone database instead of fixed offsets.

export const MAX_CLOCKS = 8;
export const MASTHEAD_CLOCKS = 4;

export interface City {
  zone: string;
  en: string;
  zh: string;
}

/** A short list offered first in the picker; any IANA zone can still be added by name. */
export const CITIES: City[] = [
  { zone: "Asia/Shanghai", en: "Beijing", zh: "北京" },
  { zone: "Asia/Hong_Kong", en: "Hong Kong", zh: "香港" },
  { zone: "Asia/Taipei", en: "Taipei", zh: "台北" },
  { zone: "Asia/Tokyo", en: "Tokyo", zh: "东京" },
  { zone: "Asia/Seoul", en: "Seoul", zh: "首尔" },
  { zone: "Asia/Singapore", en: "Singapore", zh: "新加坡" },
  { zone: "Asia/Bangkok", en: "Bangkok", zh: "曼谷" },
  { zone: "Asia/Kolkata", en: "Mumbai", zh: "孟买" },
  { zone: "Asia/Dubai", en: "Dubai", zh: "迪拜" },
  { zone: "Europe/Moscow", en: "Moscow", zh: "莫斯科" },
  { zone: "Europe/Istanbul", en: "Istanbul", zh: "伊斯坦布尔" },
  { zone: "Europe/Berlin", en: "Berlin", zh: "柏林" },
  { zone: "Europe/Paris", en: "Paris", zh: "巴黎" },
  { zone: "Europe/Amsterdam", en: "Amsterdam", zh: "阿姆斯特丹" },
  { zone: "Europe/London", en: "London", zh: "伦敦" },
  { zone: "Atlantic/Reykjavik", en: "Reykjavík", zh: "雷克雅未克" },
  { zone: "America/Sao_Paulo", en: "São Paulo", zh: "圣保罗" },
  { zone: "America/New_York", en: "New York", zh: "纽约" },
  { zone: "America/Toronto", en: "Toronto", zh: "多伦多" },
  { zone: "America/Chicago", en: "Chicago", zh: "芝加哥" },
  { zone: "America/Denver", en: "Denver", zh: "丹佛" },
  { zone: "America/Los_Angeles", en: "San Francisco", zh: "旧金山" },
  { zone: "America/Vancouver", en: "Vancouver", zh: "温哥华" },
  { zone: "Pacific/Honolulu", en: "Honolulu", zh: "檀香山" },
  { zone: "Australia/Sydney", en: "Sydney", zh: "悉尼" },
  { zone: "Australia/Perth", en: "Perth", zh: "珀斯" },
  { zone: "Pacific/Auckland", en: "Auckland", zh: "奥克兰" },
  { zone: "UTC", en: "UTC", zh: "UTC" },
];

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** "America/Los_Angeles" → "Los Angeles". */
export function cityFromZone(zone: string): string {
  return (zone.split("/").at(-1) ?? zone).replace(/_/g, " ");
}

/** Default label for a zone: the curated city name, else the last part of the zone. */
export function defaultLabel(zone: string, locale: string): string {
  const city = CITIES.find((item) => item.zone === zone);
  if (city) return locale.startsWith("zh") ? city.zh : city.en;
  return cityFromZone(zone);
}

/** Minutes east of UTC in `zone` at `date`, e.g. 480 for Beijing, -240 for New York in July. */
export function offsetMinutes(zone: string, date: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** "UTC+8", "UTC+5:30", "UTC−4" (with a real minus sign), or "UTC". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

function calendarDay(zone: string | undefined, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000;
}

/** -1, 0, or 1: the calendar date in `zone` relative to the date in `localZone` (default: this device). */
export function dayDelta(zone: string, date: Date, localZone?: string): number {
  return Math.sign(calendarDay(zone, date) - calendarDay(localZone, date));
}

/** Hour of day (0–23, fractional) in `zone`. */
export function hourIn(zone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return get("hour") + get("minute") / 60;
}

export function formatTime(zone: string | undefined, date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Every IANA zone this browser knows, for adding a city that isn't in the short list. */
export function allZones(): string[] {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
}

/** Picker matches: curated cities first, then raw zones, by name in either language or zone id. */
export function searchZones(
  query: string,
  locale: string,
  limit = 8,
): { zone: string; label: string }[] {
  const needle = query.trim().toLowerCase();
  const curated = needle
    ? CITIES.filter((city) =>
        [city.en, city.zh, city.zone].some((value) => value.toLowerCase().includes(needle)),
      )
    : CITIES;
  const known = new Set(curated.map((city) => city.zone));
  const raw = needle
    ? allZones().filter(
        (zone) => !known.has(zone) && zone.toLowerCase().replace(/_/g, " ").includes(needle),
      )
    : [];
  return [...curated.map((city) => city.zone), ...raw]
    .slice(0, limit)
    .map((zone) => ({ zone, label: defaultLabel(zone, locale) }));
}
