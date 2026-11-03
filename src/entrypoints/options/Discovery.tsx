import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { bookmarkTree } from "../../app/browserData";
import { useI18n, type MessageKey } from "../../app/i18n";
import { ErrorIcon } from "../../app/icons";
import {
  OPTIONAL_PERMISSIONS,
  hasPermissions,
  requestPermissions,
  revokePermissions,
  type OptionalPermission,
} from "../../app/permissions";
import type { DayportStore } from "../../app/useDayport";
import { useStored } from "../../app/useStored";
import { mergeImport, previewImport } from "../../data/backup";
import {
  bookmarkFolders,
  bookmarksToImport,
  type BookmarkFolder,
  type BookmarkNode,
} from "../../data/bookmarks";
import { discoveryCodec, unexclude } from "../../data/discovery";
import type { DayportData } from "../../data/schema";
import { KEYS } from "../../data/storage";

type BookmarkState =
  | { step: "idle" }
  | { step: "denied" }
  | { step: "choose"; tree: BookmarkNode[]; folders: BookmarkFolder[] }
  | { step: "done"; message: string }
  | { step: "error"; message: string };

/** Bookmark import (docs/design.md, Data portability): each chosen folder becomes a group. */
export function BookmarksCard({
  data,
  apply,
}: {
  data: DayportData;
  apply: DayportStore["apply"];
}) {
  const { t } = useI18n();
  const [state, setState] = useState<BookmarkState>({ step: "idle" });
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const choose = async () => {
    if (!(await requestPermissions(["bookmarks"]))) return setState({ step: "denied" });
    try {
      const tree = await bookmarkTree();
      const folders = bookmarkFolders(tree);
      setChosen(new Set(folders.map((folder) => folder.id)));
      setState({ step: "choose", tree, folders });
    } catch {
      setState({ step: "error", message: t("error_read") });
    }
  };

  const parsed =
    state.step === "choose"
      ? bookmarksToImport(state.tree, [...chosen], t("bookmarksFallback"))
      : null;
  const preview = parsed ? previewImport(data, parsed) : null;

  const runImport = async () => {
    if (!parsed) return;
    const before = data.groups.reduce((sum, group) => sum + group.links.length, 0);
    const next = mergeImport(data, parsed);
    const ok = await apply(() => next);
    const after = next.groups.reduce((sum, group) => sum + group.links.length, 0);
    setState(
      ok
        ? {
            step: "done",
            message: t("merged", { links: after - before, groups: next.groups.length }),
          }
        : { step: "error", message: t("saveFailed") },
    );
  };

  return (
    <section className="card" id="bookmarks" aria-labelledby="bookmarks-title">
      <h2 id="bookmarks-title">{t("bookmarksTitle")}</h2>
      <p className="body">{t("bookmarksBody")}</p>
      {state.step === "denied" && <p className="meta">{t("notAllowed")}</p>}
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
      {state.step === "choose" ? (
        state.folders.length === 0 ? (
          <p className="meta">{t("bookmarksNone")}</p>
        ) : (
          <>
            <fieldset className="folders">
              <legend className="sr-only">{t("bookmarksTitle")}</legend>
              {state.folders.map((folder) => (
                <label className="check folder" key={folder.id}>
                  <input
                    type="checkbox"
                    checked={chosen.has(folder.id)}
                    onChange={(event) =>
                      setChosen((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(folder.id);
                        else next.delete(folder.id);
                        return next;
                      })
                    }
                  />
                  <span className="label">
                    {folder.path.length > 0 && (
                      <span className="meta">{folder.path.join(" / ")} / </span>
                    )}
                    {folder.title || t("bookmarksFallback")}
                  </span>
                  <span className="meta host">{t("bookmarksLinks", { count: folder.links })}</span>
                </label>
              ))}
            </fieldset>
            {preview && (
              <dl className="preview">
                <dt>{t("previewGroups")}</dt>
                <dd>{preview.groups}</dd>
                <dt>{t("previewLinks")}</dt>
                <dd>
                  {t("previewLinksDetail", { count: preview.links, dup: preview.duplicateLinks })}
                </dd>
              </dl>
            )}
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
                disabled={chosen.size === 0}
                onClick={() => void runImport()}
              >
                {t("bookmarksImport", { count: chosen.size })}
              </button>
            </div>
          </>
        )
      ) : (
        <div>
          <button type="button" className="btn btn-lg" onClick={() => void choose()}>
            {t("bookmarksChoose")}
          </button>
        </div>
      )}
    </section>
  );
}

/** Granted optional permissions with Enable and Revoke (docs/design.md, Settings). */
export function PermissionsCard() {
  const { t } = useI18n();
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const check = async () => {
      const entries = await Promise.all(
        OPTIONAL_PERMISSIONS.map(async (name) => [name, await hasPermissions([name])] as const),
      );
      setGranted(Object.fromEntries(entries));
    };
    void check();
    browser.permissions.onAdded.addListener(check);
    browser.permissions.onRemoved.addListener(check);
    return () => {
      browser.permissions.onAdded.removeListener(check);
      browser.permissions.onRemoved.removeListener(check);
    };
  }, []);

  const toggle = async (name: OptionalPermission) => {
    if (granted[name]) await revokePermissions([name]);
    else await requestPermissions([name]);
    setGranted({ ...granted, [name]: await hasPermissions([name]) });
  };

  return (
    <section className="card" aria-labelledby="permissions-title">
      <h2 id="permissions-title">{t("permissionsTitle")}</h2>
      <p className="body">{t("permissionsBody")}</p>
      <ul className="list">
        {OPTIONAL_PERMISSIONS.map((name) => (
          <li key={name}>
            <span className="label">{t(`perm_${name}` as MessageKey)}</span>
            <span className="meta">{granted[name] ? t("allowed") : t("notAllowedShort")}</span>
            <button type="button" className="btn" onClick={() => void toggle(name)}>
              {granted[name] ? t("revoke") : t("enable")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Excluded domains and hidden pages from frequent suggestions. */
export function ExcludedCard() {
  const { t } = useI18n();
  const prefs = useStored(KEYS.discovery, discoveryCodec);
  const [confirming, setConfirming] = useState(false);
  if (!prefs.value) return null;
  const { excluded, dismissed } = prefs.value;

  return (
    <section className="card" aria-labelledby="excluded-title">
      <h2 id="excluded-title">{t("excludedTitle")}</h2>
      {excluded.length === 0 ? (
        <p className="body">{t("excludedNone")}</p>
      ) : (
        <ul className="list">
          {excluded.map((domain) => (
            <li key={domain}>
              <span className="label">{domain}</span>
              <button
                type="button"
                className="btn"
                aria-label={t("excludedRemove", { domain })}
                onClick={() => void prefs.update((value) => unexclude(value, domain))}
              >
                {t("remove", { name: "" }).trim()}
              </button>
            </li>
          ))}
        </ul>
      )}
      {dismissed.length > 0 &&
        (confirming ? (
          <div className="confirm" role="alertdialog" aria-label={t("clearDismissedButton")}>
            <p>{t("clearDismissedConfirm")}</p>
            <button type="button" className="btn btn-lg" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-lg"
              onClick={async () => {
                await prefs.update((value) => ({ ...value, dismissed: [] }));
                setConfirming(false);
              }}
            >
              {t("clearDismissedButton")}
            </button>
          </div>
        ) : (
          <div className="row-wrap">
            <span className="meta">{t("dismissedCount", { count: dismissed.length })}</span>
            <button type="button" className="link-button" onClick={() => setConfirming(true)}>
              {t("clearDismissed")}
            </button>
          </div>
        ))}
    </section>
  );
}
