import { useEffect, useMemo, useState } from "react";
import { fetchJsonSource, requestOrigin } from "../../app/backgroundClient";
import { useI18n } from "../../app/i18n";
import { CloseIcon, ErrorIcon } from "../../app/icons";
import {
  addImages,
  listImages,
  removeImage,
  updateImage,
  watchImages,
  type LocalImage,
} from "../../app/imageStore";
import type { DayportStore } from "../../app/useDayport";
import {
  MAX_LOCAL_BYTES,
  MAX_LOCAL_IMAGES,
  backgroundCodec,
  parseUrlList,
} from "../../data/background";
import { newId, updateSettings } from "../../data/ops";
import type { Settings } from "../../data/schema";
import { KEYS, mutateKey } from "../../data/storage";

type Message = { tone: "ok" | "error"; text: string } | null;

/** Background sources (docs/design.md, Backgrounds): local images, a URL list, and a JSON source. */
export function BackgroundCard({
  settings,
  apply,
}: {
  settings: Settings;
  apply: DayportStore["apply"];
}) {
  const { t } = useI18n();
  const [images, setImages] = useState<LocalImage[]>([]);
  const [localMessage, setLocalMessage] = useState<Message>(null);
  const [links, setLinks] = useState(settings.bgUrls.join("\n"));
  const [linksMessage, setLinksMessage] = useState<Message>(null);
  const [jsonUrl, setJsonUrl] = useState(settings.bgJsonUrl);
  const [jsonMessage, setJsonMessage] = useState<Message>(null);

  useEffect(() => {
    const load = () => listImages().then(setImages, () => setImages([]));
    void load();
    return watchImages(() => void load());
  }, []);
  const urls = useMemo(
    () => new Map(images.map((image) => [image.id, URL.createObjectURL(image.blob)])),
    [images],
  );
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  const onFiles = async (files: File[]) => {
    const notes: string[] = [];
    const room = MAX_LOCAL_IMAGES - images.length;
    const accepted = files.filter((file) => {
      if (!file.type.startsWith("image/")) notes.push(t("bgNotImage", { name: file.name }));
      else if (file.size > MAX_LOCAL_BYTES) notes.push(t("bgTooLarge", { name: file.name }));
      else return true;
      return false;
    });
    if (accepted.length > room) notes.push(t("bgTooMany"));
    const now = Date.now();
    try {
      await addImages(
        accepted.slice(0, Math.max(0, room)).map((file, i) => ({
          id: newId(),
          name: file.name,
          blob: file,
          focalX: 50,
          focalY: 50,
          addedAt: now + i,
        })),
      );
      setImages(await listImages());
      setLocalMessage(notes.length ? { tone: "error", text: notes.join(" ") } : null);
    } catch {
      setLocalMessage({ tone: "error", text: t("saveFailed") });
    }
  };

  const saveLinks = async () => {
    const { images: parsed, rejected } = parseUrlList(links);
    const ok = await apply((current) =>
      updateSettings(current, { bgUrls: parsed.map((image) => image.url) }),
    );
    setLinks(parsed.map((image) => image.url).join("\n"));
    setLinksMessage(
      ok
        ? { tone: "ok", text: t("bgLinksSaved", { count: parsed.length, skipped: rejected }) }
        : { tone: "error", text: t("saveFailed") },
    );
  };

  const saveJson = async () => {
    let url: string;
    try {
      url = new URL(jsonUrl.trim()).href;
      if (!url.startsWith("https://")) throw new Error();
    } catch {
      setJsonMessage({ tone: "error", text: t("bgJsonFailed", { reason: "https" }) });
      return;
    }
    if (!(await requestOrigin(url))) {
      setJsonMessage({ tone: "error", text: t("bgJsonDenied") });
      return;
    }
    try {
      const found = await fetchJsonSource(url);
      await mutateKey(KEYS.background, backgroundCodec, (state) => ({
        ...state,
        jsonImages: { url, fetchedAt: Date.now(), images: found },
      }));
      await apply((current) => updateSettings(current, { bgJsonUrl: url }));
      setJsonUrl(url);
      setJsonMessage({ tone: "ok", text: t("bgJsonOk", { count: found.length }) });
    } catch (error) {
      setJsonMessage({
        tone: "error",
        text: t("bgJsonFailed", { reason: error instanceof Error ? error.message : "?" }),
      });
    }
  };

  const message = (value: Message) =>
    value &&
    (value.tone === "ok" ? (
      <p className="success" role="status">
        {value.text}
      </p>
    ) : (
      <p className="banner" role="alert">
        <ErrorIcon />
        {value.text}
      </p>
    ));

  return (
    <section className="card" id="background" aria-labelledby="background-title">
      <h2 id="background-title">{t("bgTitle")}</h2>
      <p className="body">{t("bgBody")}</p>

      <h3 className="heading">{t("bgLocal")}</h3>
      {images.length > 0 && (
        <>
          <p className="meta">{t("bgFocal")}</p>
          <ul className="thumbs">
            {images.map((image) => (
              <li key={image.id}>
                <button
                  type="button"
                  className="thumb"
                  aria-label={image.name}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const focalX = Math.round(((event.clientX - rect.left) / rect.width) * 100);
                    const focalY = Math.round(((event.clientY - rect.top) / rect.height) * 100);
                    void updateImage(image.id, { focalX, focalY });
                  }}
                >
                  <img src={urls.get(image.id)} alt="" />
                  <span
                    className="focal"
                    style={{ left: `${image.focalX}%`, top: `${image.focalY}%` }}
                  />
                </button>
                <button
                  type="button"
                  className="btn btn-icon thumb-remove"
                  aria-label={t("remove", { name: image.name })}
                  onClick={() => void removeImage(image.id)}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="file">
        <span className="btn btn-lg">{t("bgAdd")}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          aria-label={t("bgAdd")}
          onChange={(event) => {
            void onFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </label>
      {message(localMessage)}

      <h3 className="heading">{t("bgLinksTitle")}</h3>
      <p className="meta">{t("bgLinksHelp")}</p>
      <textarea
        className="field area"
        rows={4}
        aria-label={t("bgLinksTitle")}
        placeholder="https://"
        value={links}
        onChange={(event) => setLinks(event.target.value)}
      />
      <div>
        <button type="button" className="btn btn-lg" onClick={() => void saveLinks()}>
          {t("save")}
        </button>
      </div>
      {message(linksMessage)}

      <h3 className="heading">{t("bgJsonTitle")}</h3>
      <p className="meta">{t("bgJsonHelp")}</p>
      <div className="row-wrap">
        <input
          className="field wide"
          type="url"
          aria-label={t("bgJsonTitle")}
          placeholder="https://"
          value={jsonUrl}
          onChange={(event) => setJsonUrl(event.target.value)}
        />
        <button type="button" className="btn btn-lg" onClick={() => void saveJson()}>
          {t("bgJsonSave")}
        </button>
      </div>
      {message(jsonMessage)}
    </section>
  );
}
