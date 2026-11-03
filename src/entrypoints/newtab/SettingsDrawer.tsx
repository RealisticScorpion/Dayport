import { browser } from "wxt/browser";
import { useI18n, type MessageKey } from "../../app/i18n";
import { Drawer } from "../../app/Drawer";
import { ClockSettings } from "./ClockSettings";
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

  return (
    <Drawer title={t("settings")} closeLabel={t("closeSettings")} onClose={onClose}>
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

      <ClockSettings clocks={settings.clocks} onChange={(clocks) => set({ clocks })} />

      <section aria-label={t("sections")}>
        <h3 className="heading">{t("sections")}</h3>
        {(
          [
            ["showFrequent", "frequent"],
            ["showLater", "continueLater"],
            ["showClosed", "recentlyClosed"],
            ["showNotes", "notes"],
          ] as const
        ).map(([key, label]) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => set({ [key]: e.target.checked })}
            />
            {t(label)}
          </label>
        ))}
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
          {t("shortcutsNote")} {t("modeShortcuts")}
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
    </Drawer>
  );
}
