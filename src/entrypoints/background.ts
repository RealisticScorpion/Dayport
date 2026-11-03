import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { addToLater, laterCodec, saveableUrl } from "../data/later";
import { KEYS, mutateKey } from "../data/storage";

const MENU_ID = "continue-later";

// Page context menu "Continue later": saves the page and marks the toolbar
// button with ✓ (or ! if it could not be saved). It never closes the tab.
export default defineBackground(() => {
  // Menus persist across updates, so clear them before creating ours again.
  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: MENU_ID,
      title: browser.i18n.getMessage("menuContinueLater"),
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
    const page = { url: tab.url ?? info.pageUrl, title: tab.title };
    let ok = saveableUrl(page) !== null;
    if (ok) {
      try {
        await mutateKey(KEYS.later, laterCodec, (items) => addToLater(items, [page]));
      } catch {
        ok = false;
      }
    }
    const tabId = tab.id;
    await browser.action.setBadgeBackgroundColor({ tabId, color: ok ? "#1F5E7A" : "#9F3A2C" });
    await browser.action.setBadgeText({ tabId, text: ok ? "✓" : "!" });
    setTimeout(() => void browser.action.setBadgeText({ tabId, text: "" }), 3000);
  });
});
