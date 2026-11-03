import { useState } from "react";
import { browser } from "wxt/browser";
import { openLink } from "../../app/appearance";
import { Favicon } from "../../app/Favicon";
import { formatSavedAt, useI18n } from "../../app/i18n";
import { ChevronIcon, CloseIcon } from "../../app/icons";
import { useToast } from "../../app/Toasts";
import { useStored } from "../../app/useStored";
import {
  laterCodec,
  laterEntries,
  removeFromLater,
  restoreToLater,
  type LaterItem,
} from "../../data/later";
import { KEYS } from "../../data/storage";

const RECENT_ENTRIES = 6;

/**
 * Tabs saved from the toolbar popup or the page context menu. Opening an item
 * removes it, with Undo; tabs saved together form one expandable row.
 */
export function ContinueLater() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const later = useStored(KEYS.later, laterCodec);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (!later.value) return null;

  const entries = laterEntries(later.value);
  const visible = showAll ? entries : entries.slice(0, RECENT_ENTRIES);

  const remove = async (items: LaterItem[], text: string) => {
    const ok = await later.update((current) =>
      removeFromLater(
        current,
        items.map((item) => item.id),
      ),
    );
    if (!ok) {
      toast({ tone: "error", text: t("saveFailed") });
      return false;
    }
    toast({
      text,
      action: {
        label: t("undo"),
        run: () => void later.update((current) => restoreToLater(current, items)),
      },
    });
    return true;
  };

  const removedText = (items: LaterItem[]) =>
    items.length === 1
      ? t("removedLater", { name: items[0]!.title })
      : t("removedTabs", { count: items.length });

  const openItems = async (items: LaterItem[], background: boolean) => {
    if (background) {
      for (const item of items) void browser.tabs.create({ url: item.url, active: false });
      await remove(
        items,
        items.length === 1
          ? t("openedLater", { name: items[0]!.title })
          : t("openedTabs", { count: items.length }),
      );
    } else if (await remove(items, removedText(items))) {
      // Navigate only after the removal is stored, or it could be lost with the page.
      openLink(items[0]!.url);
    }
  };

  const itemRow = (item: LaterItem, nested = false) => (
    <li className={`suggestion${nested ? " nested" : ""}`} key={item.id}>
      <a
        className="row"
        href={item.url}
        onClick={(event) => {
          event.preventDefault();
          void openItems([item], event.metaKey || event.ctrlKey);
        }}
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          void openItems([item], true);
        }}
      >
        <Favicon url={item.url} title={item.title} />
        <span className="label">{item.title}</span>
        {!nested && <span className="meta host">{formatSavedAt(item.savedAt, locale)}</span>}
      </a>
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-icon"
          aria-label={t("remove", { name: item.title })}
          title={t("remove", { name: item.title })}
          onClick={() => void remove([item], removedText([item]))}
        >
          <CloseIcon />
        </button>
      </div>
    </li>
  );

  return (
    <section className="auto-section" aria-labelledby="dayport-later">
      <div className="section-bar">
        <h2 id="dayport-later" className="heading">
          {t("continueLater")}
        </h2>
        {entries.length > RECENT_ENTRIES && (
          <button
            type="button"
            className="btn"
            aria-expanded={showAll}
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? t("less") : t("laterAll", { count: later.value.length })}
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="empty-line meta">{t("laterEmpty")}</p>
      ) : (
        <ul className="suggestions">
          {visible.map((entry) => {
            if (entry.items.length === 1) return itemRow(entry.items[0]!);
            const open = expanded.has(entry.batch);
            const label = t("tabsCount", { count: entry.items.length });
            return (
              <li className="suggestion-domain" key={entry.batch}>
                <div className="suggestion">
                  <button
                    type="button"
                    className="row row-toggle"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(entry.batch)) next.delete(entry.batch);
                        else next.add(entry.batch);
                        return next;
                      })
                    }
                  >
                    <span className="stack" aria-hidden="true">
                      {entry.items.slice(0, 3).map((item) => (
                        <Favicon key={item.id} url={item.url} title={item.title} />
                      ))}
                    </span>
                    <span className="label">{label}</span>
                    <span className="meta host">{formatSavedAt(entry.savedAt, locale)}</span>
                    <ChevronIcon />
                  </button>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void openItems(entry.items, true)}
                    >
                      {t("openAll")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon"
                      aria-label={t("remove", { name: label })}
                      title={t("remove", { name: label })}
                      onClick={() => void remove(entry.items, removedText(entry.items))}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                {open && <ul>{entry.items.map((item) => itemRow(item, true))}</ul>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
