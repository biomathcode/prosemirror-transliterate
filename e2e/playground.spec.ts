import { expect, test } from '@playwright/test';

test('offline playground: keyboard selection, dismissal, undo, and language changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://inputtools.google.com/**', () => { throw new Error('Offline mode must not call Google'); });
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Transliteration playground' });
  await editor.fill('namaste');
  await expect(page.getByRole('option', { name: 'नमस्ते', exact: true })).toBeVisible();
  await editor.press('ArrowDown');
  await editor.press('Space');
  await expect(editor).toHaveText('नमस्कार ');
  await expect(page.getByRole('listbox')).toBeHidden();
  await editor.press('ControlOrMeta+z');
  await expect(editor).not.toContainText('नमस्कार');
  await page.getByRole('button', { name: 'Clear' }).click();
  await editor.fill('namaste');
  await expect(page.getByRole('listbox')).toBeVisible();
  await editor.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(editor).toHaveText('namaste');
  await page.getByLabel('OUTPUT LANGUAGE').selectOption('ta');
  await page.getByRole('button', { name: 'vanakkam' }).click();
  await expect(page.getByRole('option', { name: 'வணக்கம்' })).toBeVisible();
  await editor.press('Enter');
  await expect(editor).toContainText('வணக்கம்');
  expect(errors).toEqual([]);
});

test('mouse acceptance, unknown vocabulary, and empty editor', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Transliteration playground' });
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: 'namaste', exact: false }).click();
  await page.getByRole('option', { name: 'नमस्ते', exact: true }).click();
  await expect(editor).toHaveText('नमस्ते');
  await expect(editor).toBeFocused();
  await page.getByRole('button', { name: 'Clear' }).click();
  await editor.fill('unlistedword');
  await expect(page.getByText('That word is outside the sample vocabulary.', { exact: false })).toBeVisible();
  await expect(page.getByRole('listbox')).toBeHidden();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Start with namaste…')).toBeVisible();
});

test('live provider is opt-in, handles errors, and uses the chosen language', async ({ page }) => {
  let calls = 0;
  await page.route('https://inputtools.google.com/**', async route => {
    calls++;
    const url = new URL(route.request().url());
    expect(url.searchParams.get('itc')).toBe('bn-t-i0-und');
    await route.fulfill({ status: calls === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(['SUCCESS', [['nomoshkar', ['নমস্কার']]]]) });
  });
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Transliteration playground' })).toBeVisible();
  await page.getByLabel('OUTPUT LANGUAGE').selectOption('bn');
  await page.getByLabel('SUGGESTION SOURCE').selectOption('google');
  await expect(page.getByText('Live mode sends the active word', { exact: false })).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Transliteration playground' });
  await editor.fill('nomoshkar');
  await expect(page.getByText('No live suggestions returned.', { exact: false })).toBeVisible();
  await expect(editor).toHaveText('nomoshkar');
  await editor.press('Space'); await editor.pressSequentially('nomoshkar');
  await expect(page.getByRole('option', { name: 'নমস্কার' })).toBeVisible();
  expect(calls).toBe(2);
});

test('guides, code tabs, copy buttons, and machine-readable material work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Your provider' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('getSuggestions');
  await page.getByRole('button', { name: 'Copy integration code' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('getSuggestions');
  await page.getByRole('button', { name: 'Copy the agent prompt' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Integrate prosemirror-transliterate');
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quick start');
  await page.getByRole('link', { name: 'API reference', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('API reference');
  for (const path of ['/llms.txt', '/llms-full.txt', '/agent-prompt.md']) {
    const response = await page.request.get(path); expect(response.ok()).toBeTruthy(); expect((await response.text()).length).toBeGreaterThan(300);
  }
});

test('layout fits viewport and documentation works without JavaScript', async ({ page, browser }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/home-${testInfo.project.name}.png`, fullPage: true });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const docs = await context.newPage(); await docs.goto('http://127.0.0.1:4173/docs/providers.html');
  await expect(docs.getByRole('heading', { level: 1 })).toHaveText('Bring your own provider');
  await context.close();
});
