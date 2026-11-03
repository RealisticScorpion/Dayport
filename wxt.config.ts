import { defineConfig } from "wxt";

// Optional permissions are requested from a user action when a feature is
// enabled (docs/architecture.md, Browser API boundaries).
const optionalPermissions = ["topSites", "history", "bookmarks", "sessions", "tabs"] as const;

// The end-to-end build grants them up front, since tests cannot click Chrome's
// permission prompt. Refusal is covered by stubbing the permissions API.
const e2e = process.env.DAYPORT_E2E === "1";

export default defineConfig({
  srcDir: "src",
  outDir: e2e ? ".output-e2e" : ".output",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "__MSG_extName__",
    short_name: "Dayport",
    description: "__MSG_extDescription__",
    default_locale: "en",
    minimum_chrome_version: "120",
    // `favicon` reads Chrome's local favicon cache; no remote icon requests.
    // `activeTab` and `contextMenus` let the toolbar button and the page menu
    // save the current tab without broad tab access.
    permissions: [
      "storage",
      "favicon",
      "activeTab",
      "contextMenus",
      ...(e2e ? optionalPermissions : []),
    ],
    optional_permissions: e2e ? [] : [...optionalPermissions],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
