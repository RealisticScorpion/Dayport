import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "./i18n";
import { CloseIcon, ErrorIcon } from "./icons";

export interface ToastInput {
  text: string;
  action?: { label: string; run: () => void };
  /** Errors stay until dismissed and are announced assertively. */
  tone?: "info" | "error";
}

interface Toast extends ToastInput {
  id: number;
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);

const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);
  const show = useCallback((input: ToastInput) => {
    seq.current += 1;
    setToast({ ...input, id: seq.current });
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && toast.tone !== "error" && (
          <ToastView key={toast.id} toast={toast} onClose={() => setToast(null)} />
        )}
      </div>
      <div className="toast-region" aria-live="assertive">
        {toast && toast.tone === "error" && (
          <ToastView key={toast.id} toast={toast} onClose={() => setToast(null)} />
        )}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (toast.tone === "error" || paused) return;
    const timer = setTimeout(onClose, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, paused, onClose]);

  return (
    <div
      className={`toast surface-overlay${toast.tone === "error" ? " toast-error" : ""}`}
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {toast.tone === "error" && <ErrorIcon />}
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            toast.action!.run();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="btn btn-icon" aria-label={t("dismiss")} onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
