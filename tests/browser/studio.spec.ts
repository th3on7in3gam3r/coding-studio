import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator('[aria-label="Project files"]')).toBeAttached();
}

async function usePlainEditor(page: Page) {
  await page.getByRole("button", { name: "Use plain text editor" }).click();
  return page.getByRole("textbox", { name: "Source code" });
}

test("edit, save/reload, live HTML/JS preview, review/apply/undo, backups", async ({ page }) => {
  await open(page);
  const editor = await usePlainEditor(page);
  await editor.fill(
    '<!doctype html><html><head><title>Test</title></head><body><h1>Persisted example</h1><button id="count">Run JS</button><script>document.querySelector("#count").onclick=()=>document.querySelector("h1").textContent="JS executed";</script></body></html>',
  );
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ }).first()).toBeVisible();
  await page.reload();
  await expect(page.locator('[aria-label="Project files"]')).toBeAttached();
  await expect(await usePlainEditor(page)).toHaveValue(/Persisted example/);

  await page.getByRole("button", { name: /^Run/ }).first().click();
  const preview = page.frameLocator('iframe[title="Project preview"]');
  await expect(preview.getByRole("heading", { name: "Persisted example" })).toBeVisible();
  await expect(async () => {
    await preview.getByRole("button", { name: "Run JS" }).click();
    await expect(preview.getByRole("heading", { name: "JS executed" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  // Local check → review → accept → undo (focus is inside the preview frame, so use the button)
  await page.getByRole("button", { name: "Search files or run a command" }).first().click();
  await page.keyboard.type("local checks");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Review/ }).first().click();
  await page.getByRole("button", { name: /Accept change/ }).click();
  await expect(page.getByRole("textbox", { name: "Source code" })).toHaveValue(/name="viewport"/);
  await page.getByRole("tab", { name: "Checks" }).click();
  await page.getByRole("button", { name: /Undo/ }).first().click();
  await expect(page.getByRole("textbox", { name: "Source code" })).not.toHaveValue(/name="viewport"/);

  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Download ZIP" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
});

test("PHP executes source in a terminable WASM worker", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+k");
  await page.keyboard.type("new project");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^PHP/ }).click();
  const editor = await usePlainEditor(page);
  await editor.fill('<?php echo "<h1>PHP result: " . (6 * 7) . "</h1>";');
  await page.getByRole("button", { name: /^Run/ }).first().click();
  await expect(
    page.frameLocator('iframe[title="Project preview"]').getByRole("heading", { name: "PHP result: 42" }),
  ).toBeVisible({ timeout: 30000 });
});

test("Monaco self-hosted editor loads", async ({ page }) => {
  await open(page);
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20000 });
});

test("phone layout switches sections and shows coding keys", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByRole("toolbar", { name: "Coding keys" })).toBeVisible();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Studio AI" }).click();
  await expect(page.getByRole("textbox", { name: "Message Studio AI" })).toBeVisible();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Files" }).click();
  await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
});
