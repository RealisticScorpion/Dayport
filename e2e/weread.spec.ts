import { expect, test, type BrowserContext } from "@playwright/test";
import { launch, newProfileDir, newTabUrl, optionsUrl } from "./extension";

// Milestone 3b WeRead highlights through the official gateway (stubbed).
// Acceptance: invalid or failed syncs preserve existing highlights.

type Mode = "ok" | "rejected" | "upgrade";

async function stubGateway(
  context: BrowserContext,
  state: { mode: Mode; bodies: unknown[]; auth: string[] },
) {
  await context.route("https://i.weread.qq.com/api/agent/gateway", async (route) => {
    const body = route.request().postDataJSON() as { api_name: string; skill_version: string };
    state.bodies.push(body);
    state.auth.push(route.request().headers().authorization ?? "");
    const json = (status: number, value: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (state.mode === "rejected") return json(401, { errcode: -2010, errmsg: "用户不存在" });
    if (state.mode === "upgrade") return json(200, { upgrade_info: { message: "请升级到 1.0.6" } });
    if (body.api_name === "/user/notebooks") {
      return json(200, {
        books: [
          {
            bookId: "b1",
            book: { title: "瓦尔登湖", author: "梭罗" },
            noteCount: 1,
            reviewCount: 1,
            sort: 9,
          },
        ],
        hasMore: 0,
      });
    }
    if (body.api_name === "/book/bookmarklist") {
      return json(200, {
        updated: [
          {
            bookmarkId: "m1",
            markText: "我步入丛林，因为我希望生活得有意义。",
            range: "1-20",
            chapterUid: 3,
            createTime: 1700000000,
          },
        ],
        chapters: [{ chapterUid: 3, title: "我生活的地方" }],
      });
    }
    if (body.api_name === "/review/list/mine") {
      return json(200, {
        reviews: [
          {
            review: {
              reviewId: "r1",
              content: "每年重读。",
              range: "1-20",
              abstract: "我步入丛林，因为我希望生活得有意义。",
              createTime: 1700000001,
            },
          },
        ],
        hasMore: 0,
        synckey: 1,
      });
    }
    return json(200, { errcode: -1, errmsg: "unknown api" });
  });
}

test("syncs highlights with the official key and keeps them when a later sync fails", async () => {
  const state = { mode: "ok" as Mode, bodies: [] as unknown[], auth: [] as string[] };
  const context = await launch(newProfileDir());
  await stubGateway(context, state);
  const page = await context.newPage();
  await page.goto(newTabUrl);
  const tool = page.locator('[aria-labelledby="dayport-highlights"]');
  await expect(tool).toContainText("Connect WeRead on the options page");

  const options = await context.newPage();
  await options.goto(`${optionsUrl}#weread`);
  const keyField = options.getByPlaceholder("wrk-");
  await keyField.fill("sk-not-a-weread-key");
  await options.getByRole("button", { name: "Save and sync" }).click();
  await expect(options.getByRole("alert")).toHaveText("A WeRead key starts with wrk-.");
  expect(state.bodies).toHaveLength(0);

  await keyField.fill("wrk-test-1234567890");
  await options.getByRole("button", { name: "Save and sync" }).click();
  await expect(options.getByRole("status")).toContainText("1 books, 1 highlights");
  expect(state.auth.every((value) => value === "Bearer wrk-test-1234567890")).toBe(true);
  expect(
    state.bodies.every((body) => (body as { skill_version: string }).skill_version === "1.0.5"),
  ).toBe(true);

  // The open new tab page shows the excerpt, its thought, and its source.
  await expect(tool.locator("blockquote")).toHaveText("我步入丛林，因为我希望生活得有意义。");
  await expect(tool).toContainText("每年重读。");
  await expect(tool).toContainText("瓦尔登湖 · 我生活的地方");

  // A rejected key and an upgrade request both stop the sync and keep the highlights.
  state.mode = "rejected";
  await options.getByRole("button", { name: "Sync now" }).click();
  await expect(options.getByRole("alert")).toHaveText(
    "WeRead rejected this key. Check it and try again.",
  );
  state.mode = "upgrade";
  await options.getByRole("button", { name: "Sync now" }).click();
  await expect(options.getByRole("alert")).toContainText("请升级到 1.0.6");
  await page.reload();
  await expect(tool.locator("blockquote")).toHaveText("我步入丛林，因为我希望生活得有意义。");

  // Removing the key deletes the synced highlights from this device.
  await options.getByRole("button", { name: "Remove key and highlights…" }).click();
  await options.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(tool).toContainText("Connect WeRead on the options page");
  await context.close();
});
