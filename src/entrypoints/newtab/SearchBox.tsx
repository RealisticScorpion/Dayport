import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { browser } from "wxt/browser";
import { useToast } from "../../app/Toasts";
import { openLink } from "../../app/appearance";
import { Favicon } from "../../app/Favicon";
import { useI18n } from "../../app/i18n";
import { SearchIcon } from "../../app/icons";
import type { LaterItem } from "../../data/later";
import type { Group } from "../../data/schema";
import { searchLinks, type SearchResult } from "../../data/search";

export type SearchMode = "local" | "web" | "chatgpt" | "claude";
const MODES: SearchMode[] = ["local", "web", "chatgpt", "claude"];

/** Official start pages. The draft is copied, never put in the URL (docs/design.md, Search results). */
const AI_SERVICES = {
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/" },
  claude: { name: "Claude", url: "https://claude.ai/new" },
} as const;

const MAX_DRAFT_LINES = 6;

interface Props {
  groups: Group[];
  /** Continue-later items are searched after pinned links (docs/design.md, Search results). */
  later: LaterItem[];
  showSlashHint: boolean;
}

export interface SearchHandle {
  focus: () => void;
}

/** Searches with Chrome's default engine; Dayport has no engine setting of its own. */
function webSearch(text: string, newTab: boolean) {
  void browser.search.query({ text, disposition: newTab ? "NEW_TAB" : "CURRENT_TAB" });
}

export const SearchBox = forwardRef<SearchHandle, Props>(function SearchBox(
  { groups, later, showSlashHint },
  ref,
) {
  const { t } = useI18n();
  const toast = useToast();
  const [mode, setMode] = useState<SearchMode>("local");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const focusAfterSwap = useRef(false);
  const sources = useMemo(
    () =>
      later.length === 0
        ? groups
        : [...groups, { id: "later", name: t("continueLater"), links: later }],
    [groups, later, t],
  );
  const results = useMemo(
    () => (mode === "local" ? searchLinks(sources, query) : []),
    [sources, query, mode],
  );
  const listId = useId();
  const hasText = query.trim().length > 0;
  const open = mode === "local" && hasText;
  const active = results[Math.min(selected, results.length - 1)];
  const ai = mode === "chatgpt" || mode === "claude" ? AI_SERVICES[mode] : null;

  useImperativeHandle(ref, () => ({ focus: () => fieldRef.current?.focus() }), []);

  const choose = (next: SearchMode) => {
    setMode(next);
    // A single-line field can't show line breaks, so keep the words apart.
    if (next === "local" || next === "web")
      setQuery((current) => current.replace(/\s*\n\s*/g, " "));
    setSelected(0);
    // Focus now for the same mode; the layout effect refocuses if the field is swapped.
    fieldRef.current?.focus();
    focusAfterSwap.current = true;
  };

  // Focus once React has swapped the input and textarea, before the next keystroke.
  useLayoutEffect(() => {
    if (!focusAfterSwap.current) return;
    focusAfterSwap.current = false;
    fieldRef.current?.focus();
  }, [mode]);

  // Alt+1 to Alt+4 choose the mode from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const index = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
      if (index < 0) return;
      event.preventDefault();
      choose(MODES[index]!);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const sendToAi = async (newTab: boolean) => {
    if (!ai || !hasText) return;
    try {
      await navigator.clipboard.writeText(query);
    } catch {
      toast({ tone: "error", text: t("aiCopyFailed", { service: ai.name }) });
      return;
    }
    if (newTab) {
      void browser.tabs.create({ url: ai.url, active: false });
      toast({ text: t("aiCopied", { service: ai.name }) });
    } else {
      openLink(ai.url);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const newTab = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") {
      setQuery("");
      setSelected(0);
      return;
    }
    if (ai) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendToAi(newTab);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && hasText) {
      event.preventDefault();
      if (mode === "local" && active) openLink(active.url, { background: newTab });
      else webSearch(query.trim(), newTab);
    }
  };

  const placeholder =
    mode === "local"
      ? t("searchPlaceholder")
      : mode === "web"
        ? t("webPlaceholder")
        : t("aiPlaceholder", { service: ai!.name });

  const common = {
    id: "dayport-search",
    className: "search-input",
    autoComplete: "off",
    spellCheck: false,
    placeholder,
    value: query,
    onKeyDown,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setQuery(event.target.value);
      setSelected(0);
    },
  };

  return (
    <div className="search">
      <div className={`search-field${ai ? " drafting" : ""}`} role="search">
        <SearchIcon />
        <label className="sr-only" htmlFor="dayport-search">
          {t("search")}
        </label>
        {ai ? (
          <textarea
            ref={fieldRef}
            {...common}
            spellCheck
            rows={Math.min(MAX_DRAFT_LINES, Math.max(1, query.split("\n").length))}
          />
        ) : (
          <input
            ref={fieldRef}
            {...common}
            type="search"
            role={mode === "local" ? "combobox" : undefined}
            aria-expanded={mode === "local" ? open : undefined}
            aria-controls={mode === "local" ? listId : undefined}
            aria-autocomplete={mode === "local" ? "list" : undefined}
            aria-activedescendant={open && active ? `${listId}-${active.linkId}` : undefined}
          />
        )}
        <div className="modes-switch" role="group" aria-label={t("searchMode")}>
          {MODES.map((value, index) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              title={`Alt+${index + 1}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(value)}
            >
              {value === "local"
                ? t("modeLocal")
                : value === "web"
                  ? t("modeWeb")
                  : AI_SERVICES[value].name}
            </button>
          ))}
        </div>
        {showSlashHint && mode === "local" && (
          <span className="kbd" aria-hidden="true">
            /
          </span>
        )}
      </div>
      {(ai || (mode === "web" && hasText)) && (
        <p className="search-hint meta">{ai ? t("aiHint", { service: ai.name }) : t("webHint")}</p>
      )}
      {open && (
        <div className="results surface-overlay on-surface">
          <p className="results-label meta">{t("searchResults")}</p>
          <div id={listId} role="listbox" aria-label={t("searchResults")}>
            {results.map((result, index) => (
              <ResultRow
                key={result.linkId}
                id={`${listId}-${result.linkId}`}
                result={result}
                selected={result === active}
                onHover={() => setSelected(index)}
              />
            ))}
          </div>
          {results.length === 0 && <p className="results-empty">{t("noResultsWeb")}</p>}
          <p className="results-hint meta">{t("searchHint")}</p>
        </div>
      )}
    </div>
  );
});

function ResultRow({
  id,
  result,
  selected,
  onHover,
}: {
  id: string;
  result: SearchResult;
  selected: boolean;
  onHover: () => void;
}) {
  const { t } = useI18n();
  const { title, match } = result;
  return (
    <div
      id={id}
      className="result"
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => openLink(result.url, { background: event.metaKey || event.ctrlKey })}
    >
      <Favicon url={result.url} title={title} />
      <span className="label">
        {match ? (
          <>
            {title.slice(0, match[0])}
            <mark>{title.slice(match[0], match[1])}</mark>
            {title.slice(match[1])}
          </>
        ) : (
          title
        )}
      </span>
      <span className="result-source meta">
        {result.groupName}
        {match ? "" : ` · ${t("urlMatch")}`}
      </span>
    </div>
  );
}
