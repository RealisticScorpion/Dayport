import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "./i18n";
import { CloseIcon } from "./icons";

/** A 400 px panel from the right (docs/design.md, Settings): Esc closes it and Tab stays inside. */
export function Drawer({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus();
  }, []);

  // Listen on the document: focus can fall to <body> when the focused control
  // inside the drawer disappears, and Esc must still close it.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !ref.current) return;
    const focusable = [...ref.current.querySelectorAll<HTMLElement>("button, input, a[href]")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <aside
        ref={ref}
        className="drawer on-surface"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
      >
        <div className="setting-row">
          <h2>{title}</h2>
          <button
            type="button"
            className="btn btn-icon"
            aria-label={closeLabel ?? t("close")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
