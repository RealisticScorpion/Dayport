import { expect, test, type BrowserContext } from "@playwright/test";
import { launch, newProfileDir, newTabUrl } from "./extension";

// Milestone 3b weather acceptance: cached content works offline, and a failed
// provider request never blocks navigation. Open-Meteo is stubbed.

const geocode = {
  results: [
    { name: "杭州", latitude: 30.29365, longitude: 120.16142, country: "中国", admin1: "浙江" },
  ],
};
const forecast = {
  current: {
    time: "2026-11-04T12:15",
    temperature_2m: 18.6,
    apparent_temperature: 20.6,
    weather_code: 51,
    is_day: 1,
    precipitation_probability: 40,
  },
  daily: {
    time: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"],
    weather_code: [81, 3, 0, 61],
    temperature_2m_max: [19.6, 21.9, 18.1, 20.6],
    temperature_2m_min: [15.3, 15.0, 13.8, 14.0],
    precipitation_probability_max: [100, 3, 10, 82],
  },
};

async function stubOpenMeteo(
  context: BrowserContext,
  state: { fail: boolean; requests: string[] },
) {
  await context.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, (route) => {
    const url = route.request().url();
    state.requests.push(url);
    if (state.fail) return route.fulfill({ status: 503, body: "unavailable" });
    const body = url.includes("geocoding") ? geocode : forecast;
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
}

const weather = (page: import("@playwright/test").Page) =>
  page.locator('[aria-labelledby="dayport-weather"]');

test("weather shows a chosen city and keeps cached results when refresh fails", async () => {
  const state = { fail: false, requests: [] as string[] };
  const context = await launch(newProfileDir());
  await stubOpenMeteo(context, state);
  const page = await context.newPage();
  await page.goto(newTabUrl);

  // Nothing is requested until a city is chosen.
  await expect(weather(page)).toContainText("sends only that city’s coordinates to Open-Meteo");
  expect(state.requests).toEqual([]);

  await weather(page).getByRole("button", { name: "Choose a city" }).click();
  await page.getByLabel("Search for a city").fill("hang");
  await page.getByRole("listitem").filter({ hasText: "浙江, 中国" }).click();
  await expect(weather(page)).toContainText("19°");
  await expect(weather(page)).toContainText("Drizzle");
  await expect(weather(page)).toContainText("Feels like 21° · Rain 40%");
  await expect(weather(page).getByRole("link", { name: "Open-Meteo" })).toBeVisible();
  const forecastRequest = state.requests.find((url) => url.includes("/v1/forecast"))!;
  expect(new URL(forecastRequest).searchParams.get("latitude")).toBe("30.29");

  // Units switch without another request.
  const before = state.requests.length;
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "°F" }).click();
  await page.keyboard.press("Escape");
  await expect(weather(page)).toContainText("65°");
  expect(state.requests.length).toBe(before);

  // An old result with the provider down: the last result stays, marked as cached.
  await page.evaluate(async () => {
    const { "dayport-weather": cache } = await chrome.storage.local.get("dayport-weather");
    await chrome.storage.local.set({
      "dayport-weather": { ...cache, fetchedAt: Date.now() - 4 * 60 * 60 * 1000 },
    });
  });
  state.fail = true;
  await page.reload();
  await expect(weather(page)).toContainText("65°");
  await expect(weather(page)).toContainText("Cached");
  await expect(weather(page)).toContainText("Couldn’t refresh");
  await context.close();
});

test("a failed weather request never blocks navigation", async () => {
  const state = { fail: true, requests: [] as string[] };
  const context = await launch(newProfileDir());
  await stubOpenMeteo(context, state);
  const page = await context.newPage();
  await page.goto(newTabUrl);
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      dayport: {
        version: 1,
        updatedAt: Date.now(),
        groups: [
          {
            id: "g",
            name: "Work",
            links: [{ id: "l", title: "Example", url: "https://example.com/" }],
          },
        ],
        settings: {
          weatherCity: { name: "Hangzhou", detail: "", latitude: 30.29, longitude: 120.16 },
        },
      },
    });
  });
  await page.reload();
  await expect(weather(page).getByRole("alert")).toContainText("Couldn’t load weather.");
  await page.getByRole("link", { name: "Example" }).click();
  await page.waitForURL("https://example.com/");
  await context.close();
});
