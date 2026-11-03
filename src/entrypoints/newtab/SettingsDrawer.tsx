import { useEffect, useRef } from "react";
import { browser } from "wxt/browser";
import { useI18n, type MessageKey } from "../../app/i18n";
import { CloseIcon } from "../../app/icons";
import type { DayportStore } from "../../app/useDayport";
import { updateSettings } from "../../data/ops";
import type { Settings } from "../../data/schema";

type Choice<K extends keyof Settings> = {
  key: K;
  label: MessageKey;
  options: [Settings[K], string][];
};

export function SettingsDrawer({
  settings,
  apply,
  onClose,
}: {
  settings: Settings;
  apply: DayportStore["apply"];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus();
  }, []);

  const set = (patch: Partial<Settings>) => void apply((data) => updateSettings(data, patch));

  const choices = [
    {
      key: "theme",
      label: "theme",
      options: [
        ["system", t("themeSystem")],
        ["light", t("themeLight")],
        ["dark", t("themeDark")],
      ],
    } satisfies Choice<"theme">,
    {
      key: "density",
      label: "density",
      options: [
        ["comfortable", t("densityComfortable")],
        ["compact", t("densityCompact")],
      ],
    } satisfies Choice<"density">,
    {
      key: "favicons",
      label: "favicons",
      options: [
        ["quiet", t("faviconsQuiet")],
        ["color", t("faviconsColor")],
      ],
    } satisfies Choice<"favicons">,
    {
      key: "language",
      label: "language",
      options: [
        ["auto", t("languageAuto")],
        ["zh-CN", "中文"],
        ["en", "English"],
      ],
    } satisfies Choice<"language">,
  ];

  // Keep Tab inside the drawer while it is open.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const focusable = [...ref.current.querySelectorAll<HTMLElement>("button, input")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <aside
        ref={ref}
        className="drawer on-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dayport-settings-title"
        onKeyDown={onKeyDown}
      >
        <div className="setting-row">
          <h2 id="dayport-settings-title">{t("settings")}</h2>
          <button
            type="button"
            className="btn btn-icon"
            aria-label={t("closeSettings")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <section aria-label={t("appearance")}>
          <h3 className="heading">{t("appearance")}</h3>
          {choices.map((choice) => (
            <div className="setting-row" key={choice.key}>
              <span id={`setting-${choice.key}`}>{t(choice.label)}</span>
              <div className="segmented" role="group" aria-labelledby={`setting-${choice.key}`}>
                {choice.options.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={settings[choice.key] === value}
                    onClick={() => set({ [choice.key]: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="check">
            <input
              type="checkbox"
              checked={settings.timeTint}
              onChange={(e) => set({ timeTint: e.target.checked })}
            />
            {t("timeTint")}
          </label>
        </section>

        <section aria-label={t("shortcuts")}>
          <h3 className="heading">{t("shortcuts")}</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.singleKeyShortcuts}
              onChange={(e) => set({ singleKeyShortcuts: e.target.checked })}
            />
            {t("singleKey")}
          </label>
          <p className="meta" style={{ margin: 0 }}>
            {t("shortcutsNote")}
          </p>
        </section>

        <section>
          <button
            type="button"
            className="link-button"
            onClick={() => void browser.runtime.openOptionsPage()}
          >
            {t("dataLink")}
          </button>
        </section>
      </aside>
    </>
  );
}
