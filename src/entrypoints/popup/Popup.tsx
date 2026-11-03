import { useEffect, useState } from "react";
import { browser, type Browser } from "wxt/browser";
import { useAppearance } from "../../app/appearance";
import { Favicon } from "../../app/Favicon";
import { I18nContext, useI18n } from "../../app/i18n";
import { CheckIcon, ErrorIcon } from "../../app/icons";
import { hasPermissions, requestPermissions } from "../../app/permissions";
import { useDayport } from "../../app/useDayport";
import { addToLater, laterCodec, saveableUrl } from "../../data/later";
import { KEYS, mutateKey } from "../../data/storage";

export function Popup() {
  const store = useDayport();
  const i18n = useAppearance(store.data?.settings);
  return (
    <I18nContext.Provider value={i18n}>
      <SaveTabs />
    </I18nContext.Provider>
  );
}

type Tab = Browser.tabs.Tab;
type Phase = "choose" | "saving" | "saved" | "failed";

/**
 * Continue later from the toolbar (docs/design.md): choose tabs, save them,
 * and only after the write is confirmed offer to close them. A failed save
 * shows the error and no close action.
 */
function SaveTabs() {
  const { t } = useI18n();
  const [tabs, setTabs] = useState<Tab[] | null>(null);
  const [canListAll, setCanListAll] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>("choose");
  const [saved, setSaved] = useState<Tab[]>([]);

  const load = async () => {
    const [all, listAll] = await Promise.all([
      browser.tabs.query({ currentWindow: true }),
      hasPermissions(["tabs"]),
    ]);
    // Without `tabs`, only the tab the toolbar button was clicked on (activeTab)
    // has an address. Pages that can't be saved, such as new tabs, are left out.
    const visible = all.filter((tab) => saveableUrl(tab));
    setCanListAll(listAll);
    setTabs(visible);
    setSelected(
      (current) =>
        new Set([
          ...current,
          ...visible.filter((tab) => tab.active || tab.highlighted).map((tab) => tab.id!),
        ]),
    );
  };

  useEffect(() => {
    void load();
  }, []);

  if (!tabs) return null;
  const chosen = tabs.filter((tab) => selected.has(tab.id!));

  const save = async () => {
    setPhase("saving");
    try {
      await mutateKey(KEYS.later, laterCodec, (items) => addToLater(items, chosen));
      setSaved(chosen);
      setPhase("saved");
    } catch {
      setPhase("failed");
    }
  };

  if (phase === "saved") {
    return (
      <main className="popup">
        <h1 className="popup-title" role="status">
          <CheckIcon />
          {t("popupSaved")}
        </h1>
        <ul className="popup-list">
          {saved.map((tab) => (
            <li key={tab.id} className="popup-tab">
              <Favicon url={tab.url!} title={tab.title ?? ""} />
              <span className="label">{tab.title || tab.url}</span>
            </li>
          ))}
        </ul>
        <div className="popup-actions">
          <button type="button" className="btn btn-lg" onClick={() => window.close()}>
            {t("popupKeep")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={async () => {
              await browser.tabs.remove(saved.map((tab) => tab.id!));
              window.close();
            }}
          >
            {saved.length === 1 ? t("popupCloseOne") : t("popupClose", { count: saved.length })}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="popup">
      <h1 className="popup-title">{t("continueLater")}</h1>
      {tabs.length === 0 ? (
        <p className="meta">{t("popupNothing")}</p>
      ) : (
        <ul className="popup-list">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <label className="popup-tab check">
                <input
                  type="checkbox"
                  disabled={phase === "saving"}
                  checked={selected.has(tab.id!)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(tab.id!);
                      else next.delete(tab.id!);
                      return next;
                    })
                  }
                />
                <Favicon url={tab.url!} title={tab.title ?? ""} />
                <span className="label">{tab.title || tab.url}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {!canListAll && (
        <button
          type="button"
          className="link-button"
          onClick={async () => {
            if (await requestPermissions(["tabs"])) await load();
          }}
        >
          {t("popupMoreTabs")}
        </button>
      )}
      {phase === "failed" && (
        <p className="banner" role="alert">
          <ErrorIcon />
          {t("popupFailed")}
        </p>
      )}
      <div className="popup-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={chosen.length === 0 || phase === "saving"}
          onClick={() => void save()}
        >
          {chosen.length === 1 ? t("popupSaveOne") : t("popupSave", { count: chosen.length })}
        </button>
      </div>
    </main>
  );
}
