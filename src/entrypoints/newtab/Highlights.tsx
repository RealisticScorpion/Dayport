import { useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { Drawer } from "../../app/Drawer";
import { useI18n } from "../../app/i18n";
import { useStored } from "../../app/useStored";
import { libraryCodec, pickHighlight, type Book, type Highlight } from "../../data/highlights";
import type { Settings } from "../../data/schema";
import { KEYS } from "../../data/storage";

/**
 * One WeRead excerpt with its book and chapter, and the user's own thought
 * below it (docs/design.md, Tools). "Next" rotates; "All" browses by book.
 */
export function Highlights({ settings }: { settings: Settings }) {
  const { t } = useI18n();
  const library = useStored(KEYS.highlights, libraryCodec);
  const books = library.value?.books ?? [];
  const [offset, setOffset] = useState(0);
  const [browsing, setBrowsing] = useState(false);

  const all = useMemo(
    () => books.flatMap((book) => book.highlights.map((highlight) => ({ book, highlight }))),
    [books],
  );
  const first = useMemo(
    () => pickHighlight(books, settings.highlightRotate, new Date()),
    // Pick once per page open, not on every storage write.
    [library.loaded, books.length],
  );
  if (!library.loaded || !settings.showHighlights) return null;

  const start = first ? all.findIndex((item) => item.highlight.id === first.highlight.id) : 0;
  const current = all.length ? all[(start + offset) % all.length] : null;

  return (
    <section className="tool" aria-labelledby="dayport-highlights">
      <div className="section-bar">
        <h2 id="dayport-highlights" className="heading">
          {t("highlights")}
        </h2>
        {current && (
          <div className="tool-actions">
            <button type="button" className="btn" onClick={() => setOffset((value) => value + 1)}>
              {t("highlightNext")}
            </button>
            <button type="button" className="btn" onClick={() => setBrowsing(true)}>
              {t("highlightAll")}
            </button>
          </div>
        )}
      </div>
      {current ? (
        <Excerpt book={current.book} highlight={current.highlight} />
      ) : (
        <div className="permission-row">
          <p>{t("highlightsEmpty")}</p>
          <div className="permission-actions">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() =>
                void browser.tabs.create({ url: browser.runtime.getURL("/options.html#weread") })
              }
            >
              {t("highlightsConnect")}
            </button>
          </div>
        </div>
      )}
      {browsing && <AllHighlights books={books} onClose={() => setBrowsing(false)} />}
    </section>
  );
}

function Excerpt({ book, highlight }: { book: Book; highlight: Highlight }) {
  return (
    <figure className="excerpt">
      <blockquote>{highlight.text}</blockquote>
      {highlight.note && <p className="excerpt-note">{highlight.note}</p>}
      <figcaption className="meta">
        {book.title}
        {highlight.chapter && ` · ${highlight.chapter}`}
      </figcaption>
    </figure>
  );
}

function AllHighlights({ books, onClose }: { books: Book[]; onClose: () => void }) {
  const { t } = useI18n();
  const [bookId, setBookId] = useState("");
  const shown = bookId ? books.filter((book) => book.bookId === bookId) : books;
  return (
    <Drawer title={t("highlights")} onClose={onClose}>
      <label className="setting-row">
        <span className="sr-only">{t("highlightsAllBooks")}</span>
        <select
          className="field select"
          value={bookId}
          onChange={(event) => setBookId(event.target.value)}
        >
          <option value="">{t("highlightsAllBooks")}</option>
          {books.map((book) => (
            <option key={book.bookId} value={book.bookId}>
              {book.title} ({book.highlights.length})
            </option>
          ))}
        </select>
      </label>
      <div className="excerpt-list">
        {shown.map((book) =>
          book.highlights.map((highlight) => (
            <Excerpt key={`${book.bookId}:${highlight.id}`} book={book} highlight={highlight} />
          )),
        )}
      </div>
    </Drawer>
  );
}
