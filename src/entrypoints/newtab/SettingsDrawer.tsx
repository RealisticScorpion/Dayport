import { browser } from "wxt/browser";
import { useI18n, type MessageKey } from "../../app/i18n";
import { Drawer } from "../../app/Drawer";
import { VEIL_MAX, VEIL_MIN, veilOpacity } from "../../data/background";
import { openBackgroundOptions } from "./Background";
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
    {
      key: "weatherUnit",
      label: "temperatureUnit",
      options: [
        ["c", "°C"],
        ["f", "°F"],
      ],
    } satisfies Choice<"weatherUnit">,
    {
      key: "bgSource",
      label: "background",
      options: [
        ["off", t("bgOff")],
        ["local", t("bgLocal")],
        ["urls", t("bgUrls")],
        ["json", t("bgJson")],
      ],
    } satisfies Choice<"bgSource">,
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
        {settings.bgSource !== "off" && (
          <>
            <div className="setting-row">
              <span id="setting-bgRotate">{t("bgRotate")}</span>
              <div className="segmented" role="group" aria-labelledby="setting-bgRotate">
                {(
                  [
                    ["open", t("rotOpen")],
                    ["hourly", t("rotHourly")],
                    ["daily", t("rotDaily")],
                    ["manual", t("rotManual")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={settings.bgRotate === value}
                    onClick={() => set({ bgRotate: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="setting-row">
              <span>{t("bgVeil")}</span>
              <input
                type="range"
                className="range"
                min={VEIL_MIN}
                max={VEIL_MAX}
                step={0.01}
                value={veilOpacity(settings.bgVeil)}
                onChange={(event) => set({ bgVeil: Number(event.target.value) })}
              />
            </label>
            <button type="button" className="link-button" onClick={openBackgroundOptions}>
              {t("bgManage")}
            </button>
          </>
        )}
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
            ["showWeather", "weather"],
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
