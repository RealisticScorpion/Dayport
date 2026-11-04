import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, type MessageKey } from "../../app/i18n";
import { ErrorIcon } from "../../app/icons";
import type { DayportStore } from "../../app/useDayport";
import { useStored } from "../../app/useStored";
import { fetchConditions, searchCities } from "../../app/weatherClient";
import { updateSettings } from "../../data/ops";
import type { Settings } from "../../data/schema";
import { KEYS } from "../../data/storage";
import {
  PROVIDER,
  cityKey,
  conditionOf,
  isStale,
  needsRefresh,
  toUnit,
  weatherCodec,
  type WeatherCity,
} from "../../data/weather";

/**
 * Weather for one manually chosen city (docs/design.md, Tools). Cached
 * results render first; a refresh runs when they are older than 30 minutes
 * and a failed refresh keeps the last result with its time.
 */
export function Weather({ settings, apply }: { settings: Settings; apply: DayportStore["apply"] }) {
  const { t, locale } = useI18n();
  const cache = useStored(KEYS.weather, weatherCodec);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const city = settings.weatherCity;
  const unit = settings.weatherUnit;
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (target: WeatherCity) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const conditions = await fetchConditions(target);
        await cache.update(() => ({
          version: 1,
          key: cityKey(target),
          fetchedAt: Date.now(),
          conditions,
        }));
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        inFlight.current = false;
      }
    },
    [cache.update],
  );

  useEffect(() => {
    if (!city || !cache.loaded) return;
    if (needsRefresh(cache.value, city, Date.now())) void refresh(city);
    const onOnline = () => void refresh(city);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // Refresh on load and when the city changes, not on every cache write.
  }, [city?.latitude, city?.longitude, cache.loaded]);

  const choose = (next: WeatherCity) => {
    setPicking(false);
    setFailed(false);
    void apply((current) => updateSettings(current, { weatherCity: next }));
  };

  const data = city && cache.value?.key === cityKey(city) ? cache.value : null;
  const deg = (celsius: number) => `${toUnit(celsius, unit)}°`;
  const time = (ms: number) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(ms);
  const weekday = (date: string, index: number) =>
    index === 0
      ? t("today")
      : new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
          new Date(`${date}T12:00:00Z`),
        );
  const conditionText = (code: number) => t(`cond_${conditionOf(code)}` as MessageKey);

  let body: React.ReactNode;
  if (picking || !city) {
    body = picking ? (
      <CityPicker onChoose={choose} onCancel={() => setPicking(false)} />
    ) : (
      <div className="permission-row">
        <p>{t("weatherAsk")}</p>
        <div className="permission-actions">
          <button type="button" className="btn btn-accent" onClick={() => setPicking(true)}>
            {t("chooseCity")}
          </button>
        </div>
      </div>
    );
  } else if (!data) {
    body = failed ? (
      <p className="weather-error" role="alert">
        <ErrorIcon />
        {t("weatherFailed")}{" "}
        <button type="button" className="link-button" onClick={() => void refresh(city)}>
          {t("retry")}
        </button>
      </p>
    ) : (
      <p className="meta">{t("weatherLoading")}</p>
    );
  } else {
    const now = data.conditions;
    const stale = failed || isStale(data, Date.now()) || !navigator.onLine;
    body = (
      <>
        <div className="weather-now">
          <span className="weather-temp">{deg(now.temperature)}</span>
          <span className="weather-summary">
            <span>{conditionText(now.code)}</span>
            <span className="meta">
              {t("feelsLike", { temp: deg(now.feelsLike) })}
              {now.rain !== null && ` · ${t("rainChance", { percent: now.rain })}`}
            </span>
          </span>
        </div>
        <ul className="weather-days">
          {now.days.map((day, index) => (
            <li key={day.date}>
              <span className="meta">{weekday(day.date, index)}</span>
              <span className="weather-day-cond">{conditionText(day.code)}</span>
              <span className="weather-range">
                {deg(day.max)} <span className="meta">{deg(day.min)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="meta weather-meta">
          {stale && <span className="tag">{t("weatherCached")}</span>}{" "}
          {t("weatherUpdated", { time: time(data.fetchedAt) })}
          {failed && ` · ${t("weatherRefreshFailed")}`} ·{" "}
          {t("weatherData", { provider: "" }).trim()}{" "}
          <a href={PROVIDER.url} target="_blank" rel="noreferrer">
            {PROVIDER.name}
          </a>
        </p>
      </>
    );
  }

  return (
    <section className="tool" aria-labelledby="dayport-weather">
      <div className="section-bar">
        <h2 id="dayport-weather" className="heading">
          {t("weather")}
        </h2>
        {city && !picking && (
          <button
            type="button"
            className="btn"
            aria-label={t("changeCity", { name: city.name })}
            title={city.detail}
            onClick={() => setPicking(true)}
          >
            {city.name}
          </button>
        )}
      </div>
      {body}
    </section>
  );
}

function CityPicker({
  onChoose,
  onCancel,
}: {
  onChoose: (city: WeatherCity) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherCity[] | null>(null);
  const [error, setError] = useState(false);

  // Search after typing pauses, so each keystroke isn't a request.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCities(query, locale).then(
        (found) => {
          if (cancelled) return;
          setResults(found);
          setError(false);
        },
        () => !cancelled && setError(true),
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, locale]);

  return (
    <div className="clock-add">
      <input
        className="field"
        autoFocus
        aria-label={t("citySearch")}
        placeholder={t("citySearch")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && results?.[0]) onChoose(results[0]);
        }}
      />
      {error && <p className="meta">{t("citySearchFailed")}</p>}
      {results?.length === 0 && <p className="meta">{t("cityNone")}</p>}
      <div className="clock-matches" role="list">
        {results?.map((city) => (
          <button
            key={`${city.latitude},${city.longitude}`}
            type="button"
            role="listitem"
            className="menu-item"
            onClick={() => onChoose(city)}
          >
            {city.name}
            {city.detail && <span className="meta"> · {city.detail}</span>}
          </button>
        ))}
      </div>
      <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={onCancel}>
        {t("cancel")}
      </button>
    </div>
  );
}
