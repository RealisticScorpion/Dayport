import { useEffect, useMemo, useState } from "react";
import { historyRecurring, topSites } from "../../app/browserData";
import { Favicon } from "../../app/Favicon";
import { useI18n } from "../../app/i18n";
import { ChevronIcon, CloseIcon, MoreIcon, PinIcon } from "../../app/icons";
import { Menu } from "../../app/Menu";
import { PermissionRow } from "../../app/PermissionRow";
import { usePermissions } from "../../app/permissions";
import { useToast } from "../../app/Toasts";
import type { DayportStore } from "../../app/useDayport";
import { useStored } from "../../app/useStored";
import {
  buildSuggestions,
  discoveryCodec,
  dismiss,
  exclude,
  undismiss,
  unexclude,
  type Suggestion,
} from "../../data/discovery";
import { addGroup, addLink, deleteGroup, deleteLink, newId, updateSettings } from "../../data/ops";
import type { DayportData } from "../../data/schema";
import { KEYS } from "../../data/storage";

/**
 * Frequent pages: an automatic list kept visibly apart from pinned groups
 * (secondary ink, an "auto" tag, no drag handles). Suggestions are rebuilt
 * from browser data on each load and never rewrite the user's pins.
 */
export function Frequent({ data, apply }: { data: DayportData; apply: DayportStore["apply"] }) {
  const { t } = useI18n();
  const toast = useToast();
  const top = usePermissions("topSites");
  const history = usePermissions("history");
  const prefs = useStored(KEYS.discovery, discoveryCodec);
  const [candidates, setCandidates] = useState<{ top: Suggestion[]; history: Suggestion[] }>({
    top: [],
    history: [],
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (top.state !== "granted") return;
    let cancelled = false;
    topSites().then(
      (sites) => !cancelled && setCandidates((current) => ({ ...current, top: sites })),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [top.state]);

  useEffect(() => {
    if (history.state !== "granted") return;
    let cancelled = false;
    historyRecurring().then(
      (pages) => !cancelled && setCandidates((current) => ({ ...current, history: pages })),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [history.state]);

  const pinnedUrls = useMemo(
    () => data.groups.flatMap((group) => group.links.map((link) => link.url)),
    [data.groups],
  );
  const rows = useMemo(
    () =>
      prefs.value
        ? buildSuggestions(
            [
              ...(top.state === "granted" ? candidates.top : []),
              ...(history.state === "granted" ? candidates.history : []),
            ],
            pinnedUrls,
            prefs.value,
          )
        : [],
    [candidates, pinnedUrls, prefs.value, top.state, history.state],
  );

  const saveFailed = () => toast({ tone: "error", text: t("saveFailed") });

  const pin = (page: Suggestion, groupId: string | null) => {
    const linkId = newId();
    const newGroupId = newId();
    const groupName =
      groupId === null
        ? t(data.groups.length === 0 ? "defaultGroupName" : "newGroupName")
        : (data.groups.find((group) => group.id === groupId)?.name ?? "");
    void apply((current) => {
      const withGroup = groupId === null ? addGroup(current, groupName, newGroupId) : current;
      return addLink(
        withGroup,
        groupId ?? newGroupId,
        { title: page.title, url: page.url },
        linkId,
      );
    });
    toast({
      text: t("pinnedTo", { group: groupName }),
      action: {
        label: t("undo"),
        run: () =>
          void apply((current) => {
            const without = deleteLink(current, linkId);
            return groupId === null ? deleteGroup(without, newGroupId) : without;
          }),
      },
    });
  };

  const dismissPage = async (page: Suggestion) => {
    if (!(await prefs.update((value) => dismiss(value, page.url)))) return saveFailed();
    toast({
      text: t("dismissed", { name: page.title }),
      action: {
        label: t("undo"),
        run: () => void prefs.update((value) => undismiss(value, page.url)),
      },
    });
  };

  const excludeDomain = async (domain: string) => {
    if (!(await prefs.update((value) => exclude(value, domain)))) return saveFailed();
    toast({
      text: t("excluded", { domain }),
      action: {
        label: t("undo"),
        run: () => void prefs.update((value) => unexclude(value, domain)),
      },
    });
  };

  const pageRow = (page: Suggestion, domain: string, nested = false) => (
    <li className={`suggestion${nested ? " nested" : ""}`} key={page.url}>
      <a className="row" href={page.url}>
        <Favicon url={page.url} title={page.title} />
        <span className="label">{page.title}</span>
        {!nested && <span className="meta host">{domain}</span>}
      </a>
      <div className="row-actions">
        <Menu
          label={t("pinTo", { name: page.title })}
          icon={<PinIcon />}
          items={[
            ...data.groups.map((group) => ({ label: group.name, run: () => pin(page, group.id) })),
            { label: `+ ${t("pinNewGroup")}`, run: () => pin(page, null) },
          ]}
        />
        <button
          type="button"
          className="btn btn-icon"
          aria-label={t("dismissPage", { name: page.title })}
          title={t("dismissPage", { name: page.title })}
          onClick={() => void dismissPage(page)}
        >
          <CloseIcon />
        </button>
        {!nested && (
          <Menu
            label={t("moreActions", { name: page.title })}
            icon={<MoreIcon />}
            items={[
              { label: t("excludeDomain", { domain }), run: () => void excludeDomain(domain) },
            ]}
          />
        )}
      </div>
    </li>
  );

  let body: React.ReactNode;
  if (top.state === "checking" || !prefs.value) {
    body = null;
  } else if (top.state !== "granted") {
    body = (
      <PermissionRow
        text={t("frequentAsk")}
        state={top.state}
        onEnable={() => void top.request()}
        onHide={() => void apply((current) => updateSettings(current, { showFrequent: false }))}
      />
    );
  } else {
    body = (
      <>
        {rows.length === 0 ? (
          <p className="empty-line meta">{t("frequentEmpty")}</p>
        ) : (
          <ul className="suggestions">
            {rows.map((row) => {
              if (row.kind === "page") return pageRow(row.page, row.domain);
              const open = expanded.has(row.domain);
              return (
                <li className="suggestion-domain" key={row.domain}>
                  <div className="suggestion">
                    <button
                      type="button"
                      className="row row-toggle"
                      aria-expanded={open}
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(row.domain)) next.delete(row.domain);
                          else next.add(row.domain);
                          return next;
                        })
                      }
                    >
                      <Favicon url={row.pages[0]!.url} title={row.domain} />
                      <span className="label">{row.domain}</span>
                      <span className="meta host">{t("pages", { count: row.pages.length })}</span>
                      <ChevronIcon />
                    </button>
                    <div className="row-actions">
                      <Menu
                        label={t("moreActions", { name: row.domain })}
                        icon={<MoreIcon />}
                        items={[
                          {
                            label: t("excludeDomain", { domain: row.domain }),
                            run: () => void excludeDomain(row.domain),
                          },
                        ]}
                      />
                    </div>
                  </div>
                  {open && <ul>{row.pages.map((page) => pageRow(page, row.domain, true))}</ul>}
                </li>
              );
            })}
          </ul>
        )}
        {history.state !== "granted" && (
          <PermissionRow
            text={t("historyAsk")}
            state={history.state}
            enableLabel={t("historyEnable")}
            onEnable={() => void history.request()}
          />
        )}
      </>
    );
  }

  return (
    <section className="auto-section" aria-labelledby="dayport-frequent">
      <div className="section-bar">
        <h2 id="dayport-frequent" className="heading">
          {t("frequent")} <span className="tag">{t("autoTag")}</span>
        </h2>
      </div>
      {body}
    </section>
  );
}
