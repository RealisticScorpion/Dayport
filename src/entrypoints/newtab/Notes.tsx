import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../app/i18n";
import { CloseIcon, ErrorIcon, MoreIcon } from "../../app/icons";
import { Menu } from "../../app/Menu";
import { MAX_NOTE_LENGTH, noteCodec, noteFileName, type Note } from "../../data/note";
import { newId } from "../../data/ops";
import { KEYS, loadKey, saveKey, watchKey } from "../../data/storage";

/** Identifies this page's own writes, so they are not mistaken for another tab's. */
const WRITER = newId();
const AUTOSAVE_MS = 600;

type Status = "idle" | "saving" | "saved" | "failed";

/**
 * One autosaved note (docs/design.md, Tools). If another tab saves while this
 * page has unsaved typing, a banner offers "Load latest" or "Keep mine" and
 * autosave pauses; the two versions are never merged silently.
 */
export function Notes() {
  const { t } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [conflict, setConflict] = useState<Note | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dirty = useRef(false);
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const conflictRef = useRef<Note | null>(null);
  conflictRef.current = conflict;

  useEffect(() => {
    let cancelled = false;
    loadKey(KEYS.note).then(
      (raw) => {
        if (cancelled) return;
        latest.current = noteCodec.read(raw).text;
        setText(latest.current);
      },
      () => !cancelled && setText(""),
    );
    const stop = watchKey(KEYS.note, (raw) => {
      const note = noteCodec.read(raw);
      if (note.writer === WRITER) return;
      if (dirty.current) {
        setConflict(note);
      } else {
        latest.current = note.text;
        setText(note.text);
      }
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (conflictRef.current) return;
    const value = latest.current;
    setStatus("saving");
    try {
      await saveKey(
        KEYS.note,
        noteCodec.write({ version: 1, text: value, updatedAt: Date.now(), writer: WRITER }),
      );
      // Typing during the write keeps the note dirty for the next save.
      if (latest.current === value) dirty.current = false;
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }, []);

  // Don't lose the last keystrokes when the tab closes or navigates.
  useEffect(() => {
    const flush = () => {
      if (dirty.current) void save();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [save]);

  if (text === null) return null;

  const onChange = (value: string) => {
    latest.current = value;
    dirty.current = true;
    setText(value);
    setStatus("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  };

  const exportMarkdown = () => {
    const blob = new Blob([latest.current], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = noteFileName();
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const statusLine =
    status === "failed" ? (
      <span className="note-status failed" role="alert">
        <ErrorIcon />
        {t("noteFailed")} ·{" "}
        <button type="button" className="link-button" onClick={() => void save()}>
          {t("retry")}
        </button>
      </span>
    ) : (
      <span className="note-status meta" aria-live="polite">
        {status === "saving" ? t("noteSaving") : status === "saved" ? t("noteSaved") : ""}
      </span>
    );

  const banner = conflict && (
    <div className="note-conflict" role="alert">
      <p>{t("noteConflict")}</p>
      <button
        type="button"
        className="btn btn-accent"
        onClick={() => {
          latest.current = conflict.text;
          dirty.current = false;
          setText(conflict.text);
          setConflict(null);
        }}
      >
        {t("loadLatest")}
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          conflictRef.current = null;
          setConflict(null);
          void save();
        }}
      >
        {t("keepMine")}
      </button>
    </div>
  );

  const editor = (big: boolean) => (
    <textarea
      className={`note-text${big ? " big" : ""}`}
      aria-label={t("notes")}
      placeholder={t("notePlaceholder")}
      maxLength={MAX_NOTE_LENGTH}
      value={text}
      autoFocus={big}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => dirty.current && void save()}
    />
  );

  return (
    <section className="tool" aria-labelledby="dayport-note">
      <div className="section-bar">
        <h2 id="dayport-note" className="heading">
          {t("notes")}
        </h2>
        <div className="tool-actions">
          {statusLine}
          <button type="button" className="btn" onClick={() => setExpanded(true)}>
            {t("expand")}
          </button>
          <Menu
            label={t("noteActions")}
            icon={<MoreIcon />}
            items={[{ label: t("noteExport"), run: exportMarkdown }]}
          />
        </div>
      </div>
      {banner}
      {!expanded && editor(false)}
      {expanded && (
        <>
          <div className="scrim" aria-hidden="true" onClick={() => setExpanded(false)} />
          <div
            className="note-overlay surface-overlay on-surface"
            role="dialog"
            aria-modal="true"
            aria-label={t("notes")}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setExpanded(false);
              }
            }}
          >
            <div className="section-bar">
              <h2 className="heading">{t("notes")}</h2>
              <div className="tool-actions">
                {statusLine}
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("close")}
                  onClick={() => setExpanded(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            {banner}
            {editor(true)}
          </div>
        </>
      )}
    </section>
  );
}
