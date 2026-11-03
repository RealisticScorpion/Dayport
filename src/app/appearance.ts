import { useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import type { Settings } from "../data/schema";
import { makeTranslate, resolveLocale } from "./i18n";

function useSystemDark(): boolean {
  const query = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [dark, setDark] = useState(query.matches);
  useEffect(() => {
    const listener = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [query]);
  return dark;
}

/** Time-of-day ground tint, chosen once when the page opens (docs/design.md, Color). */
function tintForHour(hour: number): "dawn" | "day" | "dusk" {
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "day";
  return "dusk";
}

const openedAtTint = tintForHour(new Date().getHours());

/** Applies theme, density, tint, and icon style to <html>; returns the active translation. */
export function useAppearance(settings: Settings | undefined) {
  const systemDark = useSystemDark();
  const theme = settings?.theme ?? "system";
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const locale = resolveLocale(settings?.language ?? "auto");

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.density = settings?.density ?? "comfortable";
    root.dataset.favicons = settings?.favicons ?? "quiet";
    root.dataset.tint = settings?.timeTint === false ? "day" : openedAtTint;
    root.lang = locale;
  }, [resolved, settings?.density, settings?.favicons, settings?.timeTint, locale]);

  return useMemo(() => ({ t: makeTranslate(locale), locale }), [locale]);
}

export function openLink(url: string, options: { background?: boolean } = {}) {
  if (options.background) {
    void browser.tabs.create({ url, active: false });
  } else if (url.startsWith("chrome:")) {
    // Pages may not navigate to chrome:// URLs directly; the tabs API may.
    void browser.tabs.update({ url });
  } else {
    window.location.assign(url);
  }
}
