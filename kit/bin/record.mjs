// Records every scene of scenes.mjs, in each theme, as lossless frames (see
// lib/recorder.mjs). `encode.mjs` turns each recording into the outputs.
//
//   node kit/bin/record.mjs --config showcase.config.mjs               # every scene, every theme
//   node kit/bin/record.mjs --config showcase.config.mjs --theme dark 02-search
//
// A scene starts recording once its first page has settled. Inside a scene,
// `rec.clipStart(target)` … `rec.clipEnd()` marks the email clip: its first
// frame must already be a finished, readable state, because Outlook desktop
// shows only that frame.
import path from 'node:path';
import { helpers, launch, placeCursor, seededRandom, settle } from '../lib/browser.mjs';
import { loadConfig, loadScenes, parseArgs } from '../lib/config.mjs';
import { Recorder } from '../lib/recorder.mjs';

const { config: configFile, rest } = parseArgs();
const config = await loadConfig(configFile);
const scenes = await loadScenes(config);

const themeArg = rest.includes('--theme') ? rest[rest.indexOf('--theme') + 1] : 'all';
const themes = themeArg === 'all' || themeArg === 'both' ? config.themes : [themeArg];
const wanted = rest.filter((a, i) => a !== '--theme' && rest[i - 1] !== '--theme');
const unknown = wanted.filter(name => !(name in scenes));
if (unknown.length) {
  console.error(`✗ Unknown scenes: ${unknown.join(', ')}. Known: ${Object.keys(scenes).join(', ')}`);
  process.exit(1);
}
const selected = Object.entries(scenes).filter(([name]) => wanted.length === 0 || wanted.includes(name));

if (config.session !== 'none' && typeof config.login !== 'function') {
  console.error(`✗ session is '${config.session}' but the config has no login(page, h)`);
  process.exit(1);
}

for (const theme of themes) {
  // 'shared': one sign-in per theme, reused by every signed-in scene.
  let storageState;
  if (config.session === 'shared') {
    const session = await launch(config, { theme, scale: 1 });
    await config.login(session.page, helpers);
    storageState = await session.context.storageState();
    await session.browser.close();
  }

  for (const [name, scene] of selected) {
    const started = Date.now();
    const signedIn = scene.signedIn !== false;
    const { browser, page } = await launch(config, {
      theme, storageState: signedIn ? storageState : undefined, slowmo: config.slowmo,
    });
    try {
      if (config.session === 'per-scene' && signedIn) {
        await config.login(page, helpers);
      }
      // Same paths in every theme and on every run.
      page.__random = seededRandom(name);
      await page.goto(new URL(scene.start ?? '/', config.baseURL).href);
      await settle(page, 900);
      if (scene.before) await scene.before(page, helpers);
      await placeCursor(page, config.viewport.width * 0.6, config.viewport.height * 0.42);
      const rec = new Recorder(page, path.join(config.raw, theme, name));
      await rec.start();
      await scene.run(page, rec, helpers);
      const timeline = await rec.stop();
      const k = timeline.slowmo;
      console.log(`● ${theme} ${name} — ${timeline.frames.length} frames, ${(timeline.end / k).toFixed(1)} s`
        + ` (${(timeline.frames.length * k / timeline.end).toFixed(0)} fps)`
        + (timeline.clip ? `, clip ${((timeline.clip.to - timeline.clip.from) / k).toFixed(1)} s` : ', no clip')
        + ` (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    } finally {
      await browser.close();
    }
  }
}
