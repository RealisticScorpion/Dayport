import { useCallback, useEffect, useState } from "react";
import { browser, type Browser } from "wxt/browser";

/** Optional permissions, declared in wxt.config.ts and requested only from a user action. */
export type OptionalPermission = "topSites" | "history" | "bookmarks" | "sessions" | "tabs";
export const OPTIONAL_PERMISSIONS: OptionalPermission[] = [
  "topSites",
  "history",
  "bookmarks",
  "sessions",
  "tabs",
];

export type PermissionState = "checking" | "granted" | "missing" | "denied";

const toRequest = (permissions: OptionalPermission[]) => ({
  permissions: permissions as Browser.runtime.ManifestPermission[],
});

export function hasPermissions(permissions: OptionalPermission[]): Promise<boolean> {
  return browser.permissions.contains(toRequest(permissions));
}

/** Must be called from a click or key handler; Chrome shows its own prompt. */
export async function requestPermissions(permissions: OptionalPermission[]): Promise<boolean> {
  try {
    return await browser.permissions.request(toRequest(permissions));
  } catch {
    return false;
  }
}

export function revokePermissions(permissions: OptionalPermission[]): Promise<boolean> {
  return browser.permissions.remove(toRequest(permissions));
}

/**
 * Tracks whether all of `permissions` are granted. "denied" means the user
 * refused the prompt on this page; the feature then explains how to enable it
 * later and nothing else on the page changes.
 */
export function usePermissions(...permissions: OptionalPermission[]) {
  const id = permissions.join(",");
  const [state, setState] = useState<PermissionState>("checking");

  useEffect(() => {
    const list = id.split(",") as OptionalPermission[];
    let cancelled = false;
    const check = () =>
      hasPermissions(list).then(
        (granted) =>
          !cancelled &&
          setState((current) =>
            granted ? "granted" : current === "denied" ? "denied" : "missing",
          ),
        () => !cancelled && setState("missing"),
      );
    void check();
    browser.permissions.onAdded.addListener(check);
    browser.permissions.onRemoved.addListener(check);
    return () => {
      cancelled = true;
      browser.permissions.onAdded.removeListener(check);
      browser.permissions.onRemoved.removeListener(check);
    };
  }, [id]);

  const request = useCallback(async () => {
    const granted = await requestPermissions(id.split(",") as OptionalPermission[]);
    setState(granted ? "granted" : "denied");
    return granted;
  }, [id]);

  return { state, request };
}
