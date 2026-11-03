import { useEffect, useState } from "react";
import {
  recentlyClosed,
  restoreSession,
  watchRecentlyClosed,
  type ClosedEntry,
} from "../../app/browserData";
import { Drawer } from "../../app/Drawer";
import { Favicon } from "../../app/Favicon";
import { formatSavedAt, useI18n } from "../../app/i18n";
import { PermissionRow } from "../../app/PermissionRow";
import { usePermissions } from "../../app/permissions";

/**
 * The footer line "Recently closed 12" and its drawer. Reading closed tabs
 * needs `sessions`, and their titles and addresses need `tabs`.
 */
export function RecentlyClosed() {
  const { t, locale } = useI18n();
  const permission = usePermissions("sessions", "tabs");
  const [entries, setEntries] = useState<ClosedEntry[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (permission.state !== "granted") return;
    let cancelled = false;
    const load = () =>
      recentlyClosed().then(
        (list) => !cancelled && setEntries(list),
        () => !cancelled && setEntries([]),
      );
    void load();
    const stop = watchRecentlyClosed(() => void load());
    return () => {
      cancelled = true;
      stop();
    };
  }, [permission.state]);

  const label =
    permission.state === "granted" && entries && entries.length > 0
      ? t("recentlyClosedCount", { count: entries.length })
      : t("recentlyClosed");

  return (
    <>
      <button
        type="button"
        className="footer-button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <Drawer title={t("recentlyClosed")} onClose={() => setOpen(false)}>
          {permission.state !== "granted" ? (
            permission.state !== "checking" && (
              <PermissionRow
                text={t("closedAsk")}
                state={permission.state}
                onEnable={() => void permission.request()}
              />
            )
          ) : entries && entries.length === 0 ? (
            <p className="meta">{t("closedEmpty")}</p>
          ) : (
            <ul className="closed-list">
              {entries?.map((entry) => (
                <li key={entry.sessionId}>
                  <button
                    type="button"
                    className="row closed-row"
                    onClick={() => void restoreSession(entry.sessionId)}
                  >
                    {entry.kind === "tab" ? (
                      <>
                        <Favicon url={entry.url} title={entry.title} />
                        <span className="label">{entry.title}</span>
                      </>
                    ) : (
                      <span className="label">
                        {t("closedWindow", { count: entry.tabs })}
                        {entry.title && <span className="meta"> · {entry.title}</span>}
                      </span>
                    )}
                    <span className="meta host">{formatSavedAt(entry.closedAt, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Drawer>
      )}
    </>
  );
}
