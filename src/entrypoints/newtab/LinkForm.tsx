import { useId, useState } from "react";
import { useI18n } from "../../app/i18n";
import { MAX_TITLE_LENGTH } from "../../data/schema";
import { normalizeUrl, titleFromUrl } from "../../data/url";

export interface LinkFormValue {
  title: string;
  url: string;
}

/** Inline form for adding or editing a link. The name defaults to the URL's host. */
export function LinkForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: LinkFormValue;
  onSave: (value: LinkFormValue) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const checked = normalizeUrl(url);
    if (!checked.ok) {
      setError(checked.reason === "scheme" ? t("urlScheme") : t("urlInvalid"));
      return;
    }
    onSave({
      url: checked.url,
      title: title.trim().slice(0, MAX_TITLE_LENGTH) || titleFromUrl(checked.url),
    });
  };

  return (
    <form
      className="link-form"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <label className="sr-only" htmlFor={`${id}-url`}>
        {t("linkUrl")}
      </label>
      <input
        id={`${id}-url`}
        className="field"
        value={url}
        placeholder={`${t("linkUrl")} · github.com`}
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setUrl(event.target.value);
          setError(null);
        }}
      />
      <label className="sr-only" htmlFor={`${id}-title`}>
        {t("linkTitle")}
      </label>
      <input
        id={`${id}-title`}
        className="field"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        placeholder={t("linkTitleOptional")}
        onChange={(event) => setTitle(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        {onDelete && (
          <button type="button" className="btn btn-danger-text" onClick={onDelete}>
            {t("deleteLink", { name: "" }).trim()}
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button type="submit" className="btn btn-primary">
          {t("save")}
        </button>
      </div>
    </form>
  );
}
