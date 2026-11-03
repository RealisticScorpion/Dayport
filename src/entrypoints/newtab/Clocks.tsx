import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../app/i18n";
import {
  MASTHEAD_CLOCKS,
  dayDelta,
  formatOffset,
  formatTime,
  hourIn,
  offsetMinutes,
} from "../../data/clocks";
import type { Clock } from "../../data/schema";

const HOUR = 60 * 60 * 1000;
const STEP = 30 * 60 * 1000;
/** Hours shown before the reference time on the comparison strip. */
const LEAD_HOURS = 8;

/** The current time, updated on each minute boundary. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return now;
}

/**
 * Masthead clocks: up to four cities as one line; more collapse into "+N".
 * Clicking opens the comparison popover (docs/design.md, Tools).
 */
export function Clocks({ clocks }: { clocks: Clock[] }) {
  const { t, locale } = useI18n();
  const now = useMinute();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  if (clocks.length === 0) return null;

  const shown = clocks.slice(0, MASTHEAD_CLOCKS);
  const extra = clocks.length - shown.length;

  return (
    <div className="clocks-root" ref={rootRef}>
      <button
        type="button"
        className="clocks"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("compareTitle")}
        onClick={() => setOpen((value) => !value)}
      >
        {shown.map((clock) => (
          <span className="clock" key={clock.id}>
            {clock.label} <span className="clock-time">{formatTime(clock.zone, now, locale)}</span>
          </span>
        ))}
        {extra > 0 && <span className="clock">{t("moreClocks", { count: extra })}</span>}
      </button>
      {open && <Compare clocks={clocks} rootRef={rootRef} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Compare({
  clocks,
  rootRef,
  onClose,
}: {
  clocks: Clock[];
  rootRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [ref, setRef] = useState(() => new Date());
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; ref: number } | null>(null);
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows = [{ id: "here", zone: localZone, label: t("here") }, ...clocks];

  useEffect(() => {
    stripRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [rootRef, onClose]);

  // The strip shows 24 whole hours, starting a few hours before the reference.
  const start = Math.floor(ref.getTime() / HOUR) * HOUR - LEAD_HOURS * HOUR;
  const markerLeft = ((ref.getTime() - start) / (24 * HOUR)) * 100;
  const move = (ms: number) => setRef((current) => new Date(current.getTime() + ms));

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, ref: ref.getTime() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !stripRef.current) return;
    const width = stripRef.current.querySelector(".strip")?.clientWidth ?? 1;
    // Dragging left moves later in time, like scrolling a timeline.
    const delta = ((drag.current.x - event.clientX) / width) * 24 * HOUR;
    setRef(new Date(Math.round((drag.current.ref + delta) / STEP) * STEP));
  };

  return (
    <div
      className="compare surface-overlay on-surface"
      role="dialog"
      aria-label={t("compareTitle")}
    >
      <div className="compare-head">
        <h2 className="heading">{t("compareTitle")}</h2>
        <button type="button" className="btn" onClick={() => setRef(new Date())}>
          {t("resetNow")}
        </button>
      </div>
      <div
        ref={stripRef}
        className="compare-rows"
        role="slider"
        tabIndex={0}
        aria-label={t("compareTitle")}
        aria-valuemin={0}
        aria-valuemax={0}
        aria-valuenow={0}
        aria-valuetext={`${t("here")} ${formatTime(localZone, ref, locale)}`}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -STEP : STEP);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
      >
        {rows.map((row) => {
          const delta = dayDelta(row.zone, ref, localZone);
          return (
            <div className="compare-row" key={row.id}>
              <span className="compare-label label">{row.label}</span>
              <span className="compare-time">
                {formatTime(row.zone, ref, locale)}
                {delta !== 0 && (
                  <span className="day-tag">{delta > 0 ? t("tomorrow") : t("yesterday")}</span>
                )}
              </span>
              <span className="compare-offset meta">
                {formatOffset(offsetMinutes(row.zone, ref))}
              </span>
              <div className="strip" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = Math.floor(hourIn(row.zone, new Date(start + i * HOUR)));
                  const kind =
                    hour >= 9 && hour < 18 ? "work" : hour >= 7 && hour < 22 ? "day" : "night";
                  return (
                    <span key={i} className={`cell ${kind}`}>
                      {hour % 3 === 0 ? hour : ""}
                    </span>
                  );
                })}
                <span className="marker" style={{ left: `${markerLeft}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="meta compare-hint">{t("compareHint")}</p>
    </div>
  );
}
