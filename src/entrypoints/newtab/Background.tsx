import { useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { JSON_REFRESH_MS, fetchJsonSource, hasOrigin } from "../../app/backgroundClient";
import { useI18n } from "../../app/i18n";
import { listImages, watchImages, type LocalImage } from "../../app/imageStore";
import { useStored } from "../../app/useStored";
import {
  advance,
  backgroundCodec,
  skip,
  veilOpacity,
  type RemoteImage,
} from "../../data/background";
import type { Settings } from "../../data/schema";
import { KEYS } from "../../data/storage";

interface Shown {
  key: string;
  src: string;
  position: string;
  credit?: string;
  link?: string;
  remote: boolean;
}

/** How many following images to try when one fails to load. */
const MAX_FALLBACK_TRIES = 5;

/**
 * The background layer and its corner control (docs/design.md, Backgrounds).
 * The last image that loaded stays visible while a replacement loads and
 * after failures; the page itself never waits for an image.
 */
export function Background({
  settings,
  onOpenSettings,
}: {
  settings: Settings;
  onOpenSettings: () => void;
}) {
  const { t } = useI18n();
  const state = useStored(KEYS.background, backgroundCodec);
  const source = settings.bgSource;
  const [local, setLocal] = useState<LocalImage[] | null>(null);
  const [failures, setFailures] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const advanced = useRef(false);

  // Local images: object URLs for this page, revoked when replaced.
  useEffect(() => {
    if (source !== "local") return;
    let cancelled = false;
    const load = () =>
      listImages().then(
        (images) => !cancelled && setLocal(images),
        () => setLocal([]),
      );
    void load();
    const stop = watchImages(() => void load());
    return () => {
      cancelled = true;
      stop();
    };
  }, [source]);
  const localUrls = useMemo(
    () => new Map(local?.map((image) => [image.id, URL.createObjectURL(image.blob)]) ?? []),
    [local],
  );
  useEffect(() => () => localUrls.forEach((url) => URL.revokeObjectURL(url)), [localUrls]);

  // JSON source: refresh the stored list when stale and the site is allowed.
  useEffect(() => {
    const url = settings.bgJsonUrl;
    if (source !== "json" || !url || !state.loaded) return;
    const cached = state.value?.jsonImages;
    if (cached?.url === url && Date.now() - cached.fetchedAt < JSON_REFRESH_MS) return;
    void (async () => {
      if (!(await hasOrigin(url).catch(() => false))) return;
      try {
        const images = await fetchJsonSource(url);
        await state.update((current) => ({
          ...current,
          jsonImages: { url, fetchedAt: Date.now(), images },
        }));
      } catch {
        // Keep the previous list and the last image that loaded.
      }
    })();
    // Only on load and when the source changes, not after our own write.
  }, [source, settings.bgJsonUrl, state.loaded]);

  const items: Shown[] = useMemo(() => {
    if (source === "local") {
      return (local ?? []).map((image) => ({
        key: `local:${image.id}`,
        src: localUrls.get(image.id) ?? "",
        position: `${image.focalX}% ${image.focalY}%`,
        remote: false,
      }));
    }
    const remote: RemoteImage[] =
      source === "urls"
        ? settings.bgUrls.map((url) => ({ url }))
        : source === "json" && state.value?.jsonImages?.url === settings.bgJsonUrl
          ? state.value.jsonImages.images
          : [];
    return remote.map((image) => ({
      key: image.url,
      src: image.url,
      position: "50% 50%",
      credit: image.credit,
      link: image.link,
      remote: true,
    }));
  }, [source, local, localUrls, settings.bgUrls, settings.bgJsonUrl, state.value?.jsonImages]);

  const sourceKey = `${source}:${source === "json" ? settings.bgJsonUrl : ""}`;
  const ready = state.loaded && (source !== "local" || local !== null);

  // Rotate once per page open, by elapsed time (docs/design.md, Backgrounds).
  useEffect(() => {
    if (!ready || advanced.current || source === "off" || items.length === 0) return;
    advanced.current = true;
    void state.update((current) =>
      advance(current, sourceKey, items.length, settings.bgRotate, Date.now()),
    );
  }, [ready, items.length]);

  // Failures count from the stored image, so start over whenever it changes.
  const storedIndex = state.value?.index ?? 0;
  useEffect(() => setFailures(0), [storedIndex]);

  const index = items.length ? (storedIndex + failures) % items.length : 0;
  // Nothing loads before the stored state does, or a failure could be counted twice.
  const current =
    ready && failures < Math.min(items.length, MAX_FALLBACK_TRIES) ? items[index] : undefined;
  const lastGood = state.value?.lastGood ?? null;
  const fallback =
    source !== "local" && lastGood && lastGood.url !== current?.src ? lastGood : null;
  const showing = Boolean((current && loadedKey === current.key) || fallback);

  // Text sits on veils only while an image is actually showing.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.bg = source !== "off" && showing ? "on" : "off";
    root.style.setProperty("--veil", String(veilOpacity(settings.bgVeil)));
  }, [source, showing, settings.bgVeil]);

  if (source === "off") return null;

  const credit =
    current && loadedKey === current.key
      ? current
      : fallback
        ? { ...fallback, remote: true }
        : null;
  const paused = state.value?.paused ?? false;

  return (
    <>
      <div className="bg-layer" aria-hidden="true">
        {fallback && <img className="bg-image" src={fallback.url} alt="" />}
        {current && (
          <img
            key={current.key}
            className={`bg-image${loadedKey === current.key ? " shown" : ""}`}
            src={current.src}
            alt=""
            style={{ objectPosition: current.position }}
            onLoad={() => {
              setLoadedKey(current.key);
              if (current.remote && lastGood?.url !== current.src) {
                void state.update((value) => ({
                  ...value,
                  lastGood: { url: current.src, credit: current.credit, link: current.link },
                }));
              }
            }}
            onError={() => setFailures((count) => count + 1)}
          />
        )}
      </div>
      {items.length > 0 && (
        <div className="bg-control" tabIndex={-1}>
          {credit?.credit &&
            (credit.link ? (
              <a href={credit.link} target="_blank" rel="noreferrer">
                {credit.credit}
              </a>
            ) : (
              <span>{credit.credit}</span>
            ))}
          <button
            type="button"
            className="btn"
            onClick={() => {
              // Count from the image on screen, which may be past broken ones.
              setFailures(0);
              void state.update((value) => skip({ ...value, index }, items.length, Date.now()));
            }}
          >
            {t("bgSkip")}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={paused}
            onClick={() => void state.update((value) => ({ ...value, paused: !value.paused }))}
          >
            {paused ? t("bgResume") : t("bgPause")}
          </button>
          <button type="button" className="btn" onClick={onOpenSettings}>
            {t("settings")}
          </button>
        </div>
      )}
    </>
  );
}

/** Opens the options page at the background card. */
export function openBackgroundOptions() {
  void browser.tabs.create({ url: browser.runtime.getURL("/options.html#background") });
}
