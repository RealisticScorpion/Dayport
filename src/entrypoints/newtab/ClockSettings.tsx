import { useState } from "react";
import { useI18n } from "../../app/i18n";
import { CloseIcon } from "../../app/icons";
import { MAX_CLOCKS, formatOffset, offsetMinutes, searchZones } from "../../data/clocks";
import { newId } from "../../data/ops";
import type { Clock } from "../../data/schema";

/** The Clocks section of the settings drawer: current cities, remove, and add by search. */
export function ClockSettings({
  clocks,
  onChange,
}: {
  clocks: Clock[];
  onChange: (clocks: Clock[]) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const taken = new Set(clocks.map((clock) => clock.zone));
  const matches = searchZones(query, locale).filter((match) => !taken.has(match.zone));

  return (
    <section aria-label={t("clocks")}>
      <h3 className="heading">{t("clocks")}</h3>
      {clocks.length === 0 && <p className="meta">{t("clocksEmpty")}</p>}
      {clocks.length > 0 && (
        <ul className="clock-list">
          {clocks.map((clock) => (
            <li key={clock.id}>
              <span className="label">{clock.label}</span>
              <span className="meta">{formatOffset(offsetMinutes(clock.zone, now))}</span>
              <button
                type="button"
                className="btn btn-icon"
                aria-label={t("remove", { name: clock.label })}
                onClick={() => onChange(clocks.filter((item) => item.id !== clock.id))}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {clocks.length >= MAX_CLOCKS ? (
        <p className="meta">{t("clocksFull")}</p>
      ) : adding ? (
        <div className="clock-add">
          <input
            className="field"
            autoFocus
            aria-label={t("clockSearch")}
            placeholder={t("clockSearch")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setAdding(false);
              }
              if (event.key === "Enter" && matches[0]) {
                onChange([
                  ...clocks,
                  { id: newId(), zone: matches[0].zone, label: matches[0].label },
                ]);
                setQuery("");
              }
            }}
          />
          <div className="clock-matches" role="list">
            {matches.map((match) => (
              <button
                key={match.zone}
                type="button"
                role="listitem"
                className="menu-item"
                onClick={() => {
                  onChange([...clocks, { id: newId(), zone: match.zone, label: match.label }]);
                  setQuery("");
                }}
              >
                {match.label}
                <span className="meta">
                  {" "}
                  · {match.zone} · {formatOffset(offsetMinutes(match.zone, now))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" className="link-button" onClick={() => setAdding(true)}>
          + {t("addClock")}
        </button>
      )}
    </section>
  );
}
