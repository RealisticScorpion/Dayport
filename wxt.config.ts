import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "__MSG_extName__",
    short_name: "Dayport",
    description: "__MSG_extDescription__",
    default_locale: "en",
    minimum_chrome_version: "120",
    // `favicon` reads Chrome's local favicon cache; no remote icon requests.
    permissions: ["storage", "favicon"],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
