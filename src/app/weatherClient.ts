import {
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parseGeocode,
  type Conditions,
  type WeatherCity,
} from "../data/weather";

const TIMEOUT_MS = 8000;

/** No cookies or referrer go to the provider; only the URL's query is sent. */
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchConditions(city: WeatherCity): Promise<Conditions> {
  const conditions = parseForecast(await getJson(forecastUrl(city)));
  if (!conditions) throw new Error("Unexpected forecast response");
  return conditions;
}

export async function searchCities(query: string, language: string): Promise<WeatherCity[]> {
  return parseGeocode(await getJson(geocodeUrl(query, language)));
}
