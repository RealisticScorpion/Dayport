import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { useAppearance } from "../../app/appearance";
import { I18nContext, type Translate } from "../../app/i18n";
import { ErrorIcon, SettingsIcon } from "../../app/icons";
import { ToastProvider, useToast } from "../../app/Toasts";
import { useDayport, type DayportStore } from "../../app/useDayport";
import { addGroup, newId } from "../../data/ops";
import { useStored } from "../../app/useStored";
import { laterCodec } from "../../data/later";
import { KEYS } from "../../data/storage";
import { ContinueLater } from "./ContinueLater";
import { Frequent } from "./Frequent";
import { Navigation } from "./Navigation";
import { RecentlyClosed } from "./RecentlyClosed";
import { Clocks } from "./Clocks";
import { Notes } from "./Notes";
import { Weather } from "./Weather";
import { SearchBox, type SearchHandle } from "./SearchBox";
import { SettingsDrawer } from "./SettingsDrawer";

export function App() {
  const store = useDayport();
  const i18n = useAppearance(store.data?.settings);
  return (
    <I18nContext.Provider value={i18n}>
      <ToastProvider>
        <NewTab store={store} t={i18n.t} locale={i18n.locale} />
      </ToastProvider>
    </I18nContext.Provider>
  );
}

function NewTab({ store, t, locale }: { store: DayportStore; t: Translate; locale: string }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<SearchHandle>(null);
  const later = useStored(KEYS.later, laterCodec);
  const { data, status, apply, retry } = store;
  const settings = data?.settings;
  const singleKey = data?.settings.singleKeyShortcuts ?? true;

  // A failed write keeps the change on screen and offers a retry.
  const guardedApply: DayportStore["apply"] = async (edit) => {
    const ok = await apply(edit);
    if (!ok) {
      toast({
        tone: "error",
        text: t("saveFailed"),
        action: { label: t("retry"), run: () => void guardedRetry() },
      });
    }
    return ok;
  };
  const guardedRetry = async () => {
    if (!(await retry()))
      toast({
        tone: "error",
        text: t("saveFailed"),
        action: { label: t("retry"), run: () => void guardedRetry() },
      });
  };

  // "/" focuses search from anywhere outside a text field.
  useEffect(() => {
    if (!singleKey) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [singleKey]);

  const date = new Date();
  // Chinese reads "11月3日 星期二"; other locales use their own full date order.
  const dateText =
    locale === "zh-CN"
      ? `${new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(date)} ${new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date)}`
      : new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(
          date,
        );

  // Clicking empty page space focuses search (docs/design.md, Keyboard and focus).
  const onBackgroundMouseDown = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).dataset.emptySpace === "true") {
      event.preventDefault();
      searchRef.current?.focus();
    }
  };

  const startFirstLink = () => {
    const id = newId();
    void guardedApply((current) => addGroup(current, t("defaultGroupName"), id));
    setEditing(true);
    setAddingGroupId(id);
  };

  return (
    <div className="page" data-empty-space="true" onMouseDown={onBackgroundMouseDown}>
      <div className="container" data-empty-space="true">
        <header className="masthead" data-empty-space="true">
          <h1 className="date">{dateText}</h1>
          <div className="masthead-end">
            <Clocks clocks={settings?.clocks ?? []} />
            <button
              type="button"
              className="btn btn-icon"
              aria-label={t("settings")}
              disabled={!data}
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </button>
          </div>
        </header>

        {status === "unreadable" && (
          <p className="banner" role="alert">
            <ErrorIcon />
            {t("loadFailed")}
          </p>
        )}

        <SearchBox
          ref={searchRef}
          groups={data?.groups ?? []}
          later={settings?.showLater === false ? [] : (later.value ?? [])}
          showSlashHint={singleKey}
        />

        {data && (
          <div className="workspace" data-empty-space="true">
            <div className="nav-column" data-empty-space="true">
              {data.groups.length === 0 && !editing ? (
                <section className="first-run" aria-labelledby="first-run-title">
                  <h2 id="first-run-title">{t("firstRunTitle")}</h2>
                  <p>{t("firstRunBody")}</p>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={startFirstLink}
                    >
                      {t("firstRunAdd")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-lg"
                      onClick={() =>
                        void browser.tabs.create({
                          url: browser.runtime.getURL("/options.html#bookmarks"),
                        })
                      }
                    >
                      {t("firstRunImport")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-lg"
                      onClick={() => void browser.runtime.openOptionsPage()}
                    >
                      {t("firstRunRestore")}
                    </button>
                  </div>
                </section>
              ) : (
                <Navigation
                  data={data}
                  apply={guardedApply}
                  editing={editing}
                  setEditing={setEditing}
                  addingGroupId={addingGroupId}
                  setAddingGroupId={setAddingGroupId}
                />
              )}
              {(data.settings.showFrequent || data.settings.showLater) && (
                <div className="auto-sections" data-empty-space="true">
                  {data.settings.showFrequent && <Frequent data={data} apply={guardedApply} />}
                  {data.settings.showLater && <ContinueLater />}
                </div>
              )}
            </div>
            {(data.settings.showWeather || data.settings.showNotes) && (
              <aside className="tools" data-empty-space="true">
                {data.settings.showWeather && (
                  <Weather settings={data.settings} apply={guardedApply} />
                )}
                {data.settings.showNotes && <Notes />}
              </aside>
            )}
          </div>
        )}
      </div>
      <footer className="footer" data-empty-space="true">
        {settings?.showClosed && <RecentlyClosed />}
        <span>{t("localOnly")}</span>
      </footer>
      {settingsOpen && data && (
        <SettingsDrawer
          settings={data.settings}
          apply={guardedApply}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
