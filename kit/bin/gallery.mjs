// Writes dist/index.html (a review gallery of every output, per theme, with
// their sizes) and dist/EMBED.md (copy-paste snippets for the landing and the
// email) from dist/manifest.json. Scene titles and descriptions come from
// scenes.mjs.
//
//   node kit/bin/gallery.mjs --config showcase.config.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadScenes, parseArgs } from '../lib/config.mjs';

const { config: configFile } = parseArgs();
const config = await loadConfig(configFile);
const SCENES = await loadScenes(config);
const DIST = config.dist;
const manifestFile = path.join(DIST, 'manifest.json');
if (!existsSync(manifestFile)) {
  console.error('✗ No dist/manifest.json: run encode first');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const human = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
const row = (theme, scene, kind) => manifest.find(r => r.theme === theme && r.scene === scene && r.kind === kind);
const sizeOf = (theme, scene, kind) => {
  const r = row(theme, scene, kind);
  return r ? human(r.bytes) : '—';
};
const scenes = [...new Set(manifest.map(r => r.scene))].sort();
const themes = [...new Set(manifest.map(r => r.theme))].sort().reverse();
const titleOf = scene => SCENES[scene]?.title ?? scene;
const textOf = scene => SCENES[scene]?.description ?? '';
const { width: vw, height: vh } = config.viewport;
const webH = Math.round(config.outputs.webWidth * vh / vw);
const gifH = Math.round(config.outputs.webGifWidth * vh / vw);
const themeLabel = t => ({ light: 'Light', dark: 'Dark' }[t] ?? t);

const webFigure = (theme, scene) => {
  if (!row(theme, scene, 'mp4')) return '';
  const webm = row(theme, scene, 'webm')
    ? `<source src="${theme}/web/${scene}.webm" type="video/webm; codecs=av01.0.08M.08">` : '';
  return `
      <figure class="web">
        <video autoplay muted loop playsinline preload="metadata" poster="${theme}/web/${scene}.webp" width="${config.outputs.webWidth}" height="${webH}">
          ${webm}
          <source src="${theme}/web/${scene}.mp4" type="video/mp4">
          <img src="${theme}/web/${scene}.gif" alt="${esc(titleOf(scene))}" width="${config.outputs.webGifWidth}" height="${gifH}">
        </video>
        <figcaption>Landing · WebM ${sizeOf(theme, scene, 'webm')} · MP4 ${sizeOf(theme, scene, 'mp4')} · poster ${sizeOf(theme, scene, 'webp')} · fallback GIF ${sizeOf(theme, scene, 'web gif')}</figcaption>
      </figure>`;
};

const emailFigure = (theme, scene) => {
  if (!row(theme, scene, 'email gif')) return '';
  return `
      <figure class="email">
        <img src="${theme}/email/${scene}.gif" alt="${esc(titleOf(scene))}" width="600" loading="lazy">
        <figcaption>Email · GIF ${sizeOf(theme, scene, 'email gif')} (600 px, 2×) · first frame JPG ${sizeOf(theme, scene, 'email jpg')}</figcaption>
      </figure>`;
};

const card = (theme, scene) => `
  <article class="scene">
    <header><h2>${esc(titleOf(scene))}</h2><p>${esc(textOf(scene))}</p></header>
    <div class="outputs">${webFigure(theme, scene)}${emailFigure(theme, scene)}
    </div>
  </article>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.name)} Showcase</title>
<style>
  :root { --bg: #f8fafc; --surface: #fff; --text: #0f172a; --muted: #64748b; --line: #e2e8f0; --accent: #603de7; }
  :root[data-theme="dark"] { --bg: #0b0b12; --surface: #15151f; --text: #f1f5f9; --muted: #94a3b8; --line: #262636; --accent: #a78bfa; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .top { position: sticky; top: 0; z-index: 2; display: flex; gap: 16px; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  .top h1 { font-size: 17px; margin: 0; }
  .top h1 span { color: var(--muted); font-weight: 400; }
  .toggle { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 3px; background: var(--surface); }
  .toggle button { border: 0; background: none; color: var(--muted); font: inherit; padding: 4px 14px; border-radius: 999px; cursor: pointer; }
  .toggle button[aria-pressed="true"] { background: var(--accent); color: #fff; }
  main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 64px; }
  .theme { display: none; } .theme.on { display: block; }
  .scene { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin-bottom: 24px; }
  .scene h2 { margin: 0; font-size: 19px; } .scene header p { margin: 4px 0 16px; color: var(--muted); }
  .outputs { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 20px; align-items: start; }
  figure { margin: 0; } figcaption { color: var(--muted); font-size: 12.5px; margin-top: 8px; }
  video, .email img { width: 100%; height: auto; display: block; border-radius: 10px; border: 1px solid var(--line); }
  .email img { max-width: 600px; }
  @media (max-width: 860px) { .outputs { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="top">
  <h1>${esc(config.name)} <span>— landing (video) and email (GIF)</span></h1>
  <div class="toggle" role="group" aria-label="Theme">
    ${themes.map(t => `<button type="button" data-theme-button="${t}">${themeLabel(t)}</button>`).join('')}
  </div>
</div>
<main>
${themes.map(t => `<section class="theme" data-theme-panel="${t}">${scenes.map(s => card(t, s)).join('')}</section>`).join('\n')}
</main>
<script>
  const show = theme => {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-theme-panel]').forEach(p => p.classList.toggle('on', p.dataset.themePanel === theme));
    document.querySelectorAll('[data-theme-button]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeButton === theme)));
    document.querySelectorAll('[data-theme-panel]:not(.on) video').forEach(v => v.pause());
    document.querySelectorAll('[data-theme-panel].on video').forEach(v => v.play().catch(() => {}));
  };
  document.querySelectorAll('[data-theme-button]').forEach(b => b.addEventListener('click', () => show(b.dataset.themeButton)));
  const themes = ${JSON.stringify(themes)};
  const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  show(themes.includes(preferred) ? preferred : themes[0]);
</script>
</body>
</html>
`;
writeFileSync(path.join(DIST, 'index.html'), html);

const ex = scenes[0] ?? 'scene';
const t0 = themes[0] ?? 'light';
const alt = config.email.alt ?? titleOf(ex);
const embed = `# Using the files

Two destinations, two formats. Paths are relative to \`dist/\`; swap \`${t0}/\` for another theme folder.

## Landing: video

Put the video first and the GIF inside it as the fallback:
- **WebM (AV1)** is the lightest (absent when the encoder's ffmpeg had no libsvtav1).
- **MP4 (H.264)** covers old Safari and every other browser.
- The **WebP poster** shows while it loads.
- The **GIF** is for wherever \`<video>\` can't play.

Without \`controls\`, muted and looping, it looks like a GIF with the quality of a video.

\`\`\`html
<video autoplay muted loop playsinline preload="metadata"
       poster="${t0}/web/${ex}.webp" width="${config.outputs.webWidth}" height="${webH}">
  <source src="${t0}/web/${ex}.webm" type="video/webm; codecs=av01.0.08M.08">
  <source src="${t0}/web/${ex}.mp4" type="video/mp4">
  <img src="${t0}/web/${ex}.gif" alt="${esc(titleOf(ex))}" width="${config.outputs.webGifWidth}" height="${gifH}">
</video>
\`\`\`

To follow the visitor's theme, swap the \`light/\` ↔ \`dark/\` path from the site's CSS or JS.

## Email: GIF

Mail clients don't play video, so the email gets the GIF:
- **Width:** the GIF is ${config.outputs.emailWidth} px and shows at 600 px, sharp on retina screens. Set \`width="600"\`; Outlook ignores CSS.
- **Weight:** each clip is at most ${human(config.outputs.budgets.emailGif)}.
- **Outlook desktop** shows only the first frame. That is why each clip opens on a finished, readable state, and there is a \`.jpg\` of that frame for a static version.
- **Link:** wrap the GIF in a link to the matching landing section or the app.

\`\`\`html
<a href="${config.email.link}">
  <img src="https://CDN/${t0}/email/${ex}.gif" width="600" alt="${esc(alt)}"
       style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:8px">
</a>
\`\`\`

The files must live at a public URL (a CDN or the landing's own hosting), not as attachments.

## Sizes

| Scene | Theme | WebM | MP4 | Poster | Landing GIF | Email GIF | Email JPG |
|---|---|---|---|---|---|---|---|
${themes.flatMap(t => scenes.map(s => `| ${titleOf(s)} | ${t} | ${sizeOf(t, s, 'webm')} | ${sizeOf(t, s, 'mp4')} | ${sizeOf(t, s, 'webp')} | ${sizeOf(t, s, 'web gif')} | ${sizeOf(t, s, 'email gif')} | ${sizeOf(t, s, 'email jpg')} |`)).join('\n')}
`;
writeFileSync(path.join(DIST, 'EMBED.md'), embed);
console.log(`✓ dist/index.html and dist/EMBED.md (${scenes.length} scenes × ${themes.length} themes)`);
