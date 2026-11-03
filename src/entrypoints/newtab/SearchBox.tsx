import { forwardRef, useId, useMemo, useState } from "react";
import { openLink } from "../../app/appearance";
import { Favicon } from "../../app/Favicon";
import { useI18n } from "../../app/i18n";
import { SearchIcon } from "../../app/icons";
import type { Group } from "../../data/schema";
import { searchLinks, type SearchResult } from "../../data/search";

export const SearchBox = forwardRef<HTMLInputElement, { groups: Group[]; showSlashHint: boolean }>(
  function SearchBox({ groups, showSlashHint }, ref) {
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(0);
    const results = useMemo(() => searchLinks(groups, query), [groups, query]);
    const listId = useId();
    const open = query.trim().length > 0;
    const active = results[Math.min(selected, results.length - 1)];

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((i) => Math.min(i + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      } else if (event.key === "Escape") {
        setQuery("");
        setSelected(0);
      } else if (event.key === "Enter" && active) {
        event.preventDefault();
        openLink(active.url, { background: event.metaKey || event.ctrlKey });
      }
    };

    return (
      <div className="search">
        <div className="search-field" role="search">
          <SearchIcon />
          <label className="sr-only" htmlFor="dayport-search">
            {t("search")}
          </label>
          <input
            ref={ref}
            id="dayport-search"
            className="search-input"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active ? `${listId}-${active.linkId}` : undefined}
          />
          {showSlashHint && (
            <span className="kbd" aria-hidden="true">
              /
            </span>
          )}
        </div>
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
            {results.length === 0 && <p className="results-empty">{t("noResults")}</p>}
            <p className="results-hint meta">{t("searchHint")}</p>
          </div>
        )}
      </div>
    );
  },
);

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
