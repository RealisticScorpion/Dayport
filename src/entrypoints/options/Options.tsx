import { useEffect, useState } from "react";
import { useAppearance } from "../../app/appearance";
import { I18nContext, useI18n } from "../../app/i18n";
import { ErrorIcon } from "../../app/icons";
import { useDayport, type DayportStore } from "../../app/useDayport";
import {
  backupFileName,
  createBackup,
  mergeImport,
  parseBackup,
  previewImport,
  replaceImport,
  type ParsedBackup,
} from "../../data/backup";
import { mergeNoteText, noteCodec } from "../../data/note";
import { emptyData, type DayportData } from "../../data/schema";
import { KEYS, mutateKey } from "../../data/storage";
import { useStored } from "../../app/useStored";
import { BackgroundCard } from "./BackgroundCard";
import { WeReadCard } from "./WeReadCard";
import { BookmarksCard, ExcludedCard, PermissionsCard } from "./Discovery";

export function Options() {
  const store = useDayport();
  const i18n = useAppearance(store.data?.settings);
  const note = useStored(KEYS.note, noteCodec);
  const noteText = note.value?.text ?? "";
  const ready = store.data !== null;

  // Links such as options.html#bookmarks scroll to their card once it exists.
  useEffect(() => {
    if (ready && location.hash) document.querySelector(location.hash)?.scrollIntoView();
  }, [ready]);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="options">
        <h1 className="options-title">{i18n.t("optionsTitle")}</h1>
        {store.status === "unreadable" && (
          <p className="banner" role="alert">
            <ErrorIcon />
            {i18n.t("loadFailed")}
          </p>
        )}
        {store.data && (
          <>
            <ExportCard data={store.data} noteText={noteText} />
            <ImportCard data={store.data} apply={store.apply} noteText={noteText} />
            <BookmarksCard data={store.data} apply={store.apply} />
            <BackgroundCard settings={store.data.settings} apply={store.apply} />
            <WeReadCard />
          </>
        )}
        <PermissionsCard />
        <ExcludedCard />
        {store.status !== "loading" && (
          <ResetCard apply={store.apply} unreadable={store.status === "unreadable"} />
        )}
        <section className="card">
          <h2>{i18n.t("privacyTitle")}</h2>
          <p className="body">{i18n.t("privacyBody")}</p>
        </section>
      </div>
    </I18nContext.Provider>
  );
}

/** Imported notes go through the note's own key, like edits from a new tab page. */
async function writeNote(edit: (text: string) => string): Promise<boolean> {
  try {
    await mutateKey(KEYS.note, noteCodec, (note) => ({
      ...note,
      text: edit(note.text),
      updatedAt: Date.now(),
      writer: "options",
    }));
    return true;
  } catch {
    return false;
  }
}

function download(data: DayportData, noteText: string) {
  const file = createBackup(data, { links: true, settings: true, note: noteText });
  downloadJson(file, backupFileName());
}

function downloadJson(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportCard({ data, noteText }: { data: DayportData; noteText: string }) {
  const { t } = useI18n();
  const [links, setLinks] = useState(true);
  const [settings, setSettings] = useState(true);
  const [note, setNote] = useState(true);
  const hasNote = noteText.trim().length > 0;
  return (
    <section className="card" aria-labelledby="export-title">
      <h2 id="export-title">{t("exportTitle")}</h2>
      <div className="row-wrap">
        <label className="check">
          <input type="checkbox" checked={links} onChange={(e) => setLinks(e.target.checked)} />
          {t("exportLinks")}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings}
            onChange={(e) => setSettings(e.target.checked)}
          />
          {t("exportSettings")}
        </label>
        {hasNote && (
          <label className="check">
            <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} />
            {t("exportNotes")}
          </label>
        )}
      </div>
      <p className="meta">{t("exportNote")}</p>
      <div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!links && !settings && !(hasNote && note)}
          onClick={() =>
            downloadJson(
              createBackup(data, { links, settings, note: hasNote && note ? noteText : "" }),
              backupFileName(),
            )
          }
        >
          {t("exportButton", { file: backupFileName() })}
        </button>
      </div>
    </section>
  );
}

type ImportState =
  | { step: "idle" }
  | { step: "error"; message: string }
  | { step: "preview"; fileName: string; parsed: Extract<ParsedBackup, { ok: true }> }
  | { step: "confirm"; fileName: string; parsed: Extract<ParsedBackup, { ok: true }> }
  | { step: "done"; message: string };

function ImportCard({
  data,
  apply,
  noteText,
}: {
  data: DayportData;
  apply: DayportStore["apply"];
  noteText: string;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<ImportState>({ step: "idle" });
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setState({ step: "error", message: t("error_read") });
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) setState({ step: "error", message: t(`error_${parsed.error}`) });
    else setState({ step: "preview", fileName: file.name, parsed });
  };

  const runMerge = async (parsed: Extract<ParsedBackup, { ok: true }>) => {
    const before = data.groups.reduce((sum, group) => sum + group.links.length, 0);
    const next = mergeImport(data, parsed);
    const incoming = parsed.note;
    const ok =
      (await apply(() => next)) &&
      (incoming === null || (await writeNote((text) => mergeNoteText(text, incoming))));
    const after = next.groups.reduce((sum, group) => sum + group.links.length, 0);
    setState({
      step: ok ? "done" : "error",
      message: ok
        ? t("merged", { links: after - before, groups: next.groups.length })
        : t("saveFailed"),
    });
  };

  const runReplace = async (parsed: Extract<ParsedBackup, { ok: true }>) => {
    const incoming = parsed.note;
    const ok =
      (await apply((current) => replaceImport(current, parsed))) &&
      (incoming === null || (await writeNote(() => incoming)));
    setState({ step: ok ? "done" : "error", message: ok ? t("replaced") : t("saveFailed") });
  };

  const parsed = state.step === "preview" || state.step === "confirm" ? state.parsed : null;
  const preview = parsed ? previewImport(data, parsed) : null;

  return (
    <section className="card" aria-labelledby="import-title">
      <h2 id="import-title">{t("importTitle")}</h2>
      <label className="file">
        <span className="btn btn-lg">{t("importChoose")}</span>
        <input
          type="file"
          accept="application/json,.json"
          aria-label={t("importChoose")}
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {parsed && (
          <span className="meta">
            {t("importChosen", { file: (state as { fileName: string }).fileName })}
          </span>
        )}
      </label>

      {state.step === "error" && (
        <p className="banner" role="alert">
          <ErrorIcon />
          {state.message}
        </p>
      )}
      {state.step === "done" && (
        <p className="success" role="status">
          {state.message}
        </p>
      )}

      {parsed && preview && (
        <>
          <div>
            <h3 className="heading">{t("importPreview")}</h3>
            <dl className="preview">
              <dt>{t("previewGroups")}</dt>
              <dd>{preview.groups}</dd>
              <dt>{t("previewLinks")}</dt>
              <dd>
                {t("previewLinksDetail", { count: preview.links, dup: preview.duplicateLinks })}
              </dd>
              <dt>{t("previewSettings")}</dt>
              <dd>{preview.hasSettings ? t("previewSettingsYes") : t("previewSettingsNo")}</dd>
              <dt>{t("previewNote")}</dt>
              <dd>{preview.hasNote ? t("previewSettingsYes") : t("previewSettingsNo")}</dd>
            </dl>
          </div>
          {parsed.rejected.length > 0 && (
            <div>
              <h3 className="heading danger">{t("skipped", { count: parsed.rejected.length })}</h3>
              <ul className="rejected">
                {parsed.rejected.map((item, index) => (
                  <li key={index}>
                    {item.label}: {t(`reason_${item.reason}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <fieldset className="modes">
            <legend className="sr-only">{t("importTitle")}</legend>
            {(["merge", "replace"] as const).map((value) => (
              <label key={value} className={`mode${mode === value ? " on" : ""}`}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    setState({
                      step: "preview",
                      fileName: (state as { fileName: string }).fileName,
                      parsed,
                    });
                  }}
                />
                <span>
                  <strong>{t(value === "merge" ? "modeMerge" : "modeReplace")}</strong>
                  <br />
                  <span className="body">
                    {t(value === "merge" ? "modeMergeBody" : "modeReplaceBody")}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {state.step === "confirm" ? (
            <div className="confirm" role="alertdialog" aria-label={t("confirmReplaceButton")}>
              <p>{t("confirmReplace")}</p>
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => setState({ ...state, step: "preview" })}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-lg"
                onClick={() => void runReplace(parsed)}
              >
                {t("confirmReplaceButton")}
              </button>
            </div>
          ) : (
            <div className="actions">
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => setState({ step: "idle" })}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  if (mode === "merge") void runMerge(parsed);
                  else {
                    download(data, noteText);
                    setState({
                      ...(state as { fileName: string; parsed: typeof parsed }),
                      step: "confirm",
                    });
                  }
                }}
              >
                {t(mode === "merge" ? "importMerge" : "importReplace")}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ResetCard({ apply, unreadable }: { apply: DayportStore["apply"]; unreadable: boolean }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <section className="card" aria-labelledby="reset-title">
      <h2 id="reset-title">{t("resetTitle")}</h2>
      <p className="body">{t("resetBody")}</p>
      {done && (
        <p className="success" role="status">
          {t("resetDone")}
        </p>
      )}
      {confirming ? (
        <div className="confirm" role="alertdialog" aria-label={t("resetConfirmButton")}>
          <p>{t("resetConfirm")}</p>
          <button type="button" className="btn btn-lg" onClick={() => setConfirming(false)}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-lg"
            onClick={async () => {
              // An unreadable document has no in-memory copy, so write a fresh one directly.
              const ok = unreadable ? await resetStorage() : await apply(() => emptyData());
              // The note, saved tabs, and suggestion preferences live under their own keys.
              if (ok) await clearCollections();
              setConfirming(false);
              setDone(ok);
            }}
          >
            {t("resetConfirmButton")}
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="btn btn-lg" onClick={() => setConfirming(true)}>
            {t("resetButton")}
          </button>
        </div>
      )}
    </section>
  );
}

async function clearCollections(): Promise<void> {
  const { browser } = await import("wxt/browser");
  await browser.storage.local
    .remove([
      KEYS.later,
      KEYS.discovery,
      KEYS.note,
      KEYS.weather,
      KEYS.background,
      KEYS.weread,
      KEYS.highlights,
    ])
    .catch(() => undefined);
  await browser.permissions.remove({ origins: ["https://i.weread.qq.com/*"] }).catch(() => false);
  const { clearImages } = await import("../../app/imageStore");
  await clearImages().catch(() => undefined);
}

async function resetStorage(): Promise<boolean> {
  const { save } = await import("../../data/storage");
  try {
    await save(emptyData());
    await clearCollections();
    location.reload();
    return true;
  } catch {
    return false;
  }
}
