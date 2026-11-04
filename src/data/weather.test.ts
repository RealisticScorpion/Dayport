import { describe, expect, it } from "vitest";
import {
  cityKey,
  conditionOf,
  forecastUrl,
  isStale,
  needsRefresh,
  parseForecast,
  parseGeocode,
  toUnit,
  weatherCodec,
  type WeatherCity,
} from "./weather";

// Trimmed from a real Open-Meteo response.
const forecast = {
  current: {
    time: "2026-11-04T12:15",
    temperature_2m: 18.6,
    apparent_temperature: 20.6,
    weather_code: 51,
    is_day: 1,
    precipitation_probability: 99,
  },
  daily: {
    time: ["2026-11-04", "2026-11-05", "2026-11-06"],
    weather_code: [81, 3, 3],
    temperature_2m_max: [19.6, 21.9, 18.1],
    temperature_2m_min: [15.3, 15.0, 13.8],
    precipitation_probability_max: [100, 3, null],
  },
};

const city: WeatherCity = {
  name: "Hangzhou",
  detail: "Zhejiang, China",
  latitude: 30.29365,
  longitude: 120.16142,
};

describe("weather", () => {
  it("parses a forecast and rejects unexpected payloads", () => {
    expect(parseForecast(forecast)).toMatchObject({
      temperature: 18.6,
      feelsLike: 20.6,
      code: 51,
      isDay: true,
      rain: 99,
      days: [
        { date: "2026-11-04", code: 81, max: 19.6, min: 15.3, rain: 100 },
        { date: "2026-11-05", code: 3 },
        { date: "2026-11-06", rain: null },
      ],
    });
    expect(parseForecast({ error: true, reason: "Bad" })).toBeNull();
    expect(parseForecast("<html>")).toBeNull();
  });

  it("sends only rounded coordinates", () => {
    const url = new URL(forecastUrl(city));
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("30.29");
    expect(url.searchParams.get("longitude")).toBe("120.16");
    expect(url.search).not.toContain("Hangzhou");
  });

  it("reads geocoding results and skips malformed places", () => {
    expect(
      parseGeocode({
        results: [
          { name: "杭州", latitude: 30.29, longitude: 120.16, country: "中国", admin1: "浙江" },
          { name: "Nowhere", latitude: 200, longitude: 0 },
        ],
      }),
    ).toEqual([{ name: "杭州", detail: "浙江, 中国", latitude: 30.29, longitude: 120.16 }]);
    expect(parseGeocode({})).toEqual([]);
  });

  it("refreshes after 30 minutes or a city change, and labels results older than 3 hours", () => {
    const now = 10 * 60 * 60 * 1000;
    const cache = {
      version: 1 as const,
      key: cityKey(city),
      fetchedAt: now - 20 * 60 * 1000,
      conditions: parseForecast(forecast)!,
    };
    expect(needsRefresh(cache, city, now)).toBe(false);
    expect(needsRefresh(cache, city, now + 11 * 60 * 1000)).toBe(true);
    expect(needsRefresh(cache, { ...city, latitude: 31.23 }, now)).toBe(true);
    expect(needsRefresh(null, city, now)).toBe(true);
    expect(isStale(cache, now)).toBe(false);
    expect(isStale(cache, now + 3 * 60 * 60 * 1000)).toBe(true);
    expect(weatherCodec.read({ version: 2 })).toBeNull();
  });

  it("converts units and names conditions", () => {
    expect(toUnit(18.6, "c")).toBe(19);
    expect(toUnit(18.6, "f")).toBe(65);
    expect(toUnit(-40, "f")).toBe(-40);
    expect([0, 2, 45, 51, 61, 66, 73, 81, 86, 95].map(conditionOf)).toEqual([
      "clear",
      "partlyCloudy",
      "fog",
      "drizzle",
      "rain",
      "freezingRain",
      "snow",
      "showers",
      "snowShowers",
      "thunderstorm",
    ]);
  });
});
