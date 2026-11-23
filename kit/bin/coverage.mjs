// Walks every page in `coverage.pages`, in every theme: lists its section
// headings (the anchors scenes can aim at), saves a full-page screenshot, and
// FAILS when a page shows one of `coverage.emptyText`. Run it before
// recording, to check the demo data still fills every screen a scene visits.
//
//   node kit/bin/coverage.mjs --config showcase.config.mjs          # every theme
//   node kit/bin/coverage.mjs --config showcase.config.mjs light    # one theme
//
// Screenshots: screenshots/coverage/<theme>/<page>.png
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { helpers, launch, settle } from '../lib/browser.mjs';
import { loadConfig, parseArgs } from '../lib/config.mjs';

const { config: configFile, rest } = parseArgs();
const config = await loadConfig(configFile);
const { pages, emptyText, headings } = config.coverage;
if (!pages.length) {
  console.log('· No coverage.pages in the config: nothing to check');
  process.exit(0);
}

const themes = rest.length ? rest : config.themes;
const problems = [];

for (const theme of themes) {
  const out = path.join(config.shots, 'coverage', theme);
  mkdirSync(out, { recursive: true });
  const { browser, page } = await launch(config, { theme, scale: 1 });
  if (config.session !== 'none' && config.login) {
    await config.login(page, helpers);
  }
  for (const { name, path: url, root = 'body' } of pages) {
    await page.goto(new URL(url, config.baseURL).href);
    await settle(page, 1200);
    const scope = page.locator(root).first();
    const titles = await scope.locator(headings).allInnerTexts().catch(() => []);
    const text = await scope.innerText().catch(() => '');
    const empties = emptyText.filter(marker => text.includes(marker));
    console.log(`${theme} ${name}${empties.length ? '  ⚠ ' + empties.join(' | ') : ''}\n    ${[...new Set(titles.map(h => h.trim()).filter(Boolean))].join(' · ')}`);
    empties.forEach(e => problems.push(`${theme} ${name}: "${e}"`));
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  }
  await browser.close();
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} empty state(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\n✓ Every page has data');
