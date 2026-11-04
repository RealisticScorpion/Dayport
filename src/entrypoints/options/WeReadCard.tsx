import { useState } from "react";
import { browser } from "wxt/browser";
import { useI18n } from "../../app/i18n";
import { ErrorIcon } from "../../app/icons";
import { useStored } from "../../app/useStored";
import { GATEWAY_ORIGIN, SyncProblem, syncLibrary } from "../../app/wereadClient";
import { accountCodec, isWereadKey, libraryCodec } from "../../data/highlights";
import { KEYS } from "../../data/storage";

type Status =
  | { step: "idle" }
  | { step: "syncing"; done: number; total: number }
  | { step: "error"; text: string };

/**
 * Connects WeRead with the user's own Skill API key. The key stays in this
 * browser and goes only to WeRead's gateway, whose one origin is requested
 * as an optional host permission.
 */
export function WeReadCard() {
  const { t, locale } = useI18n();
  const account = useStored(KEYS.weread, accountCodec);
  const library = useStored(KEYS.highlights, libraryCodec);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [confirming, setConfirming] = useState(false);
  const savedKey = account.value?.apiKey ?? "";

  const sync = async (apiKey: string) => {
    if (!isWereadKey(apiKey)) return setStatus({ step: "error", text: t("wereadKeyFormat") });
    const allowed = await browser.permissions
      .request({ origins: [GATEWAY_ORIGIN] })
      .catch(() => false);
    if (!allowed) return setStatus({ step: "error", text: t("wereadDenied") });
    if (apiKey !== savedKey) await account.update(() => ({ version: 1, apiKey }));
    setStatus({ step: "syncing", done: 0, total: 0 });
    try {
      const result = await syncLibrary(apiKey, (done, total) =>
        setStatus({ step: "syncing", done, total }),
      );
      if (!(await library.update(() => result))) throw new Error(t("saveFailed"));
      setKey("");
      setStatus({ step: "idle" });
    } catch (error) {
      const problem = error instanceof SyncProblem ? error.problem : null;
      setStatus({
        step: "error",
        text:
          problem?.kind === "rejected"
            ? t("wereadRejected")
            : problem?.kind === "upgrade"
              ? t("wereadUpgrade", { message: problem.message })
              : t("wereadFailed", { reason: error instanceof Error ? error.message : "?" }),
      });
    }
  };

  const books = library.value?.books ?? [];
  const count = books.reduce((sum, book) => sum + book.highlights.length, 0);
  const syncedAt = library.value?.syncedAt;
  const syncing = status.step === "syncing";

  return (
    <section className="card" id="weread" aria-labelledby="weread-title">
      <h2 id="weread-title">{t("wereadTitle")}</h2>
      <p className="body">{t("wereadBody")}</p>

      <label className="stack-field">
        <span className="heading">{t("wereadKey")}</span>
        <div className="row-wrap">
          <input
            className="field wide"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={savedKey ? "wrk-••••••••" : "wrk-"}
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={syncing || !key.trim()}
            onClick={() => void sync(key.trim())}
          >
            {t("wereadSave")}
          </button>
        </div>
      </label>
      <p className="meta">{t("wereadKeyHelp")}</p>

      {savedKey && (
        <div className="row-wrap">
          <span className="meta" role="status">
            {syncing
              ? t("wereadSyncing", { done: status.done, total: status.total })
              : syncedAt
                ? t("wereadSynced", {
                    books: books.length,
                    highlights: count,
                    time: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(syncedAt),
                  })
                : t("wereadNever")}
          </span>
          <button
            type="button"
            className="btn"
            disabled={syncing}
            onClick={() => void sync(savedKey)}
          >
            {t("wereadSync")}
          </button>
        </div>
      )}

      {status.step === "error" && (
        <p className="banner" role="alert">
          <ErrorIcon />
          {status.text}
        </p>
      )}

      {savedKey &&
        (confirming ? (
          <div className="confirm" role="alertdialog" aria-label={t("wereadDisconnectButton")}>
            <p>{t("wereadDisconnectConfirm")}</p>
            <button type="button" className="btn btn-lg" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-lg"
              onClick={async () => {
                await browser.storage.local.remove([KEYS.weread, KEYS.highlights]);
                await browser.permissions.remove({ origins: [GATEWAY_ORIGIN] }).catch(() => false);
                setConfirming(false);
                setStatus({ step: "idle" });
              }}
            >
              {t("wereadDisconnectButton")}
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="link-button" onClick={() => setConfirming(true)}>
              {t("wereadDisconnect")}
            </button>
          </div>
        ))}
    </section>
  );
}
