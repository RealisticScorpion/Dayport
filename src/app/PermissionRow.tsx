import { useI18n } from "./i18n";
import type { PermissionState } from "./permissions";

/**
 * The inline row an optional feature shows before it has access
 * (docs/design.md, Permissions): one sentence on what it reads, then Enable.
 */
export function PermissionRow({
  text,
  state,
  onEnable,
  onHide,
  enableLabel,
}: {
  text: string;
  state: PermissionState;
  onEnable: () => void;
  onHide?: () => void;
  enableLabel?: string;
}) {
  const { t } = useI18n();
  if (state === "denied") {
    return (
      <p className="permission-row meta" role="status">
        {t("notAllowed")}
      </p>
    );
  }
  return (
    <div className="permission-row">
      <p>{text}</p>
      <div className="permission-actions">
        <button type="button" className="btn btn-accent" onClick={onEnable}>
          {enableLabel ?? t("enable")}
        </button>
        {onHide && (
          <button type="button" className="btn" onClick={onHide}>
            {t("hide")}
          </button>
        )}
      </div>
    </div>
  );
}
