// Turns each lossless recording (.recordings/<theme>/<scene>/) into the
// published outputs, one set per destination, and enforces size budgets:
//
//   dist/<theme>/web/<scene>.webm   AV1, 1920 px     landing <video>, first source
//   dist/<theme>/web/<scene>.mp4    H.264, 1920 px   landing <video>, Safari/old browsers
//   dist/<theme>/web/<scene>.webp   poster frame     shown before the video plays
//   dist/<theme>/web/<scene>.gif    1280 px          fallback where <video> can't play
//   dist/<theme>/email/<scene>.gif  the scene's clip, cropped, 1200 px (shown at 600 px)
//   dist/<theme>/email/<scene>.jpg  the clip's first frame (Outlook desktop shows only that)
//
// Widths and budgets come from `outputs` in the config. GIFs go through gifski
// (a palette per frame, temporal dithering, merges repeated frames into
// longer delays) and then gifsicle's lossy LZW. When a GIF is over budget the
// encoder walks a ladder (from 20 fps: more lossy, fewer fps) before giving
// up; the run fails if anything is still over.
//
//   node kit/bin/encode.mjs --config showcase.config.mjs            # everything recorded
//   node kit/bin/encode.mjs --config showcase.config.mjs dark 02-search
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, parseArgs } from '../lib/config.mjs';

const { config: configFile, rest: args } = parseArgs();
const config = await loadConfig(configFile);
const RAW = config.raw;
const DIST = config.dist;
const BUDGET = config.outputs.budgets;
const KB = 1024;
const MB = 1024 * 1024;

/** Tried in order until the GIF fits its budget. */
const GIF_LADDER = [
  { fps: 20, quality: 95, lossy: 20 },
  { fps: 15, quality: 95, lossy: 20 },
  { fps: 12, quality: 90, lossy: 30 },
  { fps: 12, quality: 85, lossy: 50 },
  { fps: 10, quality: 80, lossy: 70 },
  { fps: 8, quality: 75, lossy: 90 },
  // Last resort for photo-heavy scenes: also a narrower GIF.
  { fps: 8, quality: 75, lossy: 90, widthFactor: 0.8 },
  { fps: 8, quality: 70, lossy: 100, widthFactor: 0.7 },
];

/** Same idea for the rest: the first setting that fits wins. */
const LADDER = {
  webmCrf: [34, 38, 42],
  mp4Crf: [23, 26, 29, 32],
  webpQuality: [80, 70, 60, 50],
  // ffmpeg's JPEG scale: 2 is best, 31 worst.
  jpgQ: [2, 3, 5, 8],
};

/** Runs `encode(setting)` down a ladder until `out` fits; returns the setting used. */
function fit(settings, out, budget, encode) {
  for (const setting of settings) {
    encode(setting);
    if (size(out) <= budget) return setting;
  }
  return settings.at(-1);
}

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
const ffmpeg = cmdArgs => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...cmdArgs]);
const size = file => statSync(file).size;
const human = bytes => bytes >= MB ? `${(bytes / MB).toFixed(2)} MB` : `${Math.round(bytes / KB)} KB`;
const even = n => Math.round(n / 2) * 2;

for (const tool of ['ffmpeg', 'gifski', 'gifsicle', 'cwebp']) {
  try {
    execFileSync('sh', ['-c', `command -v ${tool}`], { stdio: 'ignore' });
  } catch {
    console.error(`✗ Missing ${tool}. macOS: brew install ffmpeg gifski gifsicle webp · Arch: pacman -S ffmpeg gifski gifsicle libwebp`);
    process.exit(1);
  }
}
const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
const hasAv1 = /libsvtav1/.test(encoders);
if (config.outputs.web && !hasAv1) {
  console.warn('! This ffmpeg has no libsvtav1: skipping the AV1 WebM (the MP4 and GIF still cover every browser).');
}

/**
 * Scenes are recorded in slow motion (`timeline.slowmo`): every time in the
 * timeline is divided by it, so the clip plays at normal speed with `slowmo`
 * times as many real frames per second.
 */
function playbackTime(timeline) {
  const k = timeline.slowmo ?? 1;
  return {
    ...timeline,
    end: timeline.end / k,
    frames: timeline.frames.map(f => ({ ...f, t: f.t / k })),
    clip: timeline.clip && { ...timeline.clip, from: timeline.clip.from / k, to: timeline.clip.to / k },
  };
}

/** A concat-demuxer list that replays the frames with their real durations. */
function concatList(dir, timeline) {
  const quote = p => `'${p.replaceAll("'", "'\\''")}'`;
  const lines = ['ffconcat version 1.0'];
  timeline.frames.forEach((frame, i) => {
    const next = timeline.frames[i + 1]?.t ?? timeline.end;
    lines.push(`file ${quote(path.join(dir, frame.file))}`, `duration ${Math.max(0.001, next - frame.t).toFixed(4)}`);
  });
  // The demuxer ignores the last duration unless the file is repeated.
  lines.push(`file ${quote(path.join(dir, timeline.frames.at(-1).file))}`);
  const list = path.join(dir, 'frames.ffconcat');
  writeFileSync(list, lines.join('\n') + '\n');
  return list;
}

/** Renders frames at `fps` into a temp folder, then gifski + gifsicle, down the ladder. */
function gif({ input, filters, width, out, budget, tmp }) {
  for (const step of GIF_LADDER) {
    const w = even(width * (step.widthFactor ?? 1));
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    ffmpeg([...input, '-vf', `${filters},fps=${step.fps},scale=${w}:-2:flags=lanczos`, path.join(tmp, 'f%05d.png')]);
    const frames = readdirSync(tmp).filter(f => f.endsWith('.png')).sort().map(f => path.join(tmp, f));
    run('gifski', ['--quiet', '--fps', String(step.fps), '--quality', String(step.quality), '--width', String(w), '-o', out, ...frames]);
    run('gifsicle', ['-b', '-O3', `--lossy=${step.lossy}`, out]);
    if (size(out) <= budget) {
      rmSync(tmp, { recursive: true, force: true });
      return step;
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  return null;
}

const report = [];
const failures = [];
const check = (theme, scene, kind, file, budget, note = '') => {
  const bytes = size(file);
  report.push({ theme, scene, kind, file: path.relative(DIST, file), bytes, budget, note });
  if (bytes > budget) failures.push(`${theme} ${scene} ${kind}: ${human(bytes)} > ${human(budget)}`);
};

if (!existsSync(RAW)) {
  console.error(`✗ Nothing recorded yet in ${RAW}: run record first`);
  process.exit(1);
}
const knownThemes = readdirSync(RAW).filter(t => !t.startsWith('.'));
const themesWanted = args.filter(a => knownThemes.includes(a));
const scenesWanted = args.filter(a => !knownThemes.includes(a));
const themes = knownThemes.filter(t => !themesWanted.length || themesWanted.includes(t));

for (const theme of themes) {
  for (const scene of readdirSync(path.join(RAW, theme)).sort()) {
    if (scenesWanted.length && !scenesWanted.includes(scene)) continue;
    const dir = path.join(RAW, theme, scene);
    if (!existsSync(path.join(dir, 'timeline.json'))) continue;
    const timeline = playbackTime(JSON.parse(readFileSync(path.join(dir, 'timeline.json'), 'utf8')));
    if (!timeline.frames.length) {
      failures.push(`${theme} ${scene}: the recording has no frames`);
      continue;
    }
    const list = concatList(dir, timeline);
    const input = ['-f', 'concat', '-safe', '0', '-i', list];
    const source = timeline.viewport.width * timeline.scale;
    const web = path.join(DIST, theme, 'web');
    const email = path.join(DIST, theme, 'email');
    process.stdout.write(`● ${theme} ${scene} `);

    if (config.outputs.web) {
      mkdirSync(web, { recursive: true });
      const videoWidth = even(Math.min(config.outputs.webWidth, source));
      const base = `fps=30,scale=${videoWidth}:-2:flags=lanczos,format=yuv420p`;

      // Landing: AV1 first, H.264 for everything else.
      if (hasAv1) {
        const webm = path.join(web, `${scene}.webm`);
        const webmCrf = fit(LADDER.webmCrf, webm, BUDGET.webm, crf =>
          ffmpeg([...input, '-vf', base, '-c:v', 'libsvtav1', '-preset', '5', '-crf', String(crf), '-g', '300', '-svtav1-params', 'tune=0', '-an', webm]));
        check(theme, scene, 'webm', webm, BUDGET.webm, `crf ${webmCrf}`);
      }
      const mp4 = path.join(web, `${scene}.mp4`);
      const mp4Crf = fit(LADDER.mp4Crf, mp4, BUDGET.mp4, crf =>
        ffmpeg([...input, '-vf', base, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-tune', 'animation', '-profile:v', 'high', '-movflags', '+faststart', '-an', mp4]));
      check(theme, scene, 'mp4', mp4, BUDGET.mp4, `crf ${mp4Crf}`);
      process.stdout.write('· video ');

      // The poster is the frame the email clip opens on (a settled, readable
      // state), or the first frame when the scene marks no clip.
      const posterPng = path.join(dir, 'poster.png');
      const poster = path.join(web, `${scene}.webp`);
      const posterAt = timeline.clip?.from ?? 0;
      const posterFrame = [...timeline.frames].reverse().find(f => f.t <= posterAt) ?? timeline.frames[0];
      ffmpeg(['-i', path.join(dir, posterFrame.file), '-vf', `scale=${videoWidth}:-2:flags=lanczos`, posterPng]);
      const webpQ = fit(LADDER.webpQuality, poster, BUDGET.webp, q => run('cwebp', ['-quiet', '-q', String(q), '-m', '6', posterPng, '-o', poster]));
      check(theme, scene, 'webp', poster, BUDGET.webp, `q ${webpQ}`);

      const webGif = path.join(web, `${scene}.gif`);
      const gifWidth = even(Math.min(config.outputs.webGifWidth, source));
      const webStep = gif({ input, filters: 'null', width: gifWidth, out: webGif, budget: BUDGET.webGif, tmp: path.join(dir, 'gif-web') });
      check(theme, scene, 'web gif', webGif, BUDGET.webGif, webStep
        ? `${webStep.fps} fps, lossy ${webStep.lossy}${webStep.widthFactor ? `, ${even(gifWidth * webStep.widthFactor)} px` : ''}`
        : 'over budget');
      process.stdout.write('· gif ');
    }

    // Email: the scene's clip, cropped to its area. Without a marked clip,
    // the whole recording at full viewport (it may not fit the budget).
    if (config.outputs.email) {
      mkdirSync(email, { recursive: true });
      if (!timeline.clip) {
        console.warn(`\n! ${theme} ${scene}: no email clip marked (rec.clipStart/clipEnd); using the whole recording`);
      }
      const { from, to, box } = timeline.clip ?? { from: 0, to: timeline.end, box: null };
      const s = timeline.scale;
      const crop = box ? `crop=${Math.round(box.width * s)}:${Math.round(box.height * s)}:${Math.round(box.x * s)}:${Math.round(box.y * s)}` : 'null';
      const width = Math.min(config.outputs.emailWidth, even((box?.width ?? timeline.viewport.width) * s));
      const trimmed = ['-f', 'concat', '-safe', '0', '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', list];
      const emailGif = path.join(email, `${scene}.gif`);
      const emailStep = gif({ input: trimmed, filters: crop, width, out: emailGif, budget: BUDGET.emailGif, tmp: path.join(dir, 'gif-email') });
      check(theme, scene, 'email gif', emailGif, BUDGET.emailGif, emailStep ? `${emailStep.fps} fps, lossy ${emailStep.lossy}` : 'over budget');

      // JPEG, not PNG: every mail client shows it, and it stays small on photos.
      const emailJpg = path.join(email, `${scene}.jpg`);
      const framePng = path.join(dir, 'email-frame.png');
      ffmpeg([...trimmed, '-frames:v', '1', '-vf', `${crop},scale=${width}:-2:flags=lanczos`, framePng]);
      const jpgQ = fit(LADDER.jpgQ, emailJpg, BUDGET.emailJpg, q =>
        ffmpeg(['-i', framePng, '-q:v', String(q), '-frames:v', '1', '-update', '1', emailJpg]));
      check(theme, scene, 'email jpg', emailJpg, BUDGET.emailJpg, `q ${jpgQ}`);
      process.stdout.write('· email');
    }
    process.stdout.write('\n');
  }
}

// Merge with the manifest of earlier runs (encoding one scene keeps the rest).
mkdirSync(DIST, { recursive: true });
const manifestFile = path.join(DIST, 'manifest.json');
const previous = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : [];
const key = r => `${r.theme}/${r.scene}/${r.kind}`;
const merged = new Map(previous.map(r => [key(r), r]));
report.forEach(r => merged.set(key(r), r));
writeFileSync(manifestFile, JSON.stringify([...merged.values()].sort((a, b) => key(a).localeCompare(key(b))), null, 1) + '\n');

console.log('\n' + report.map(r => `${r.bytes > r.budget ? '✗' : '✓'} ${r.file.padEnd(36)} ${human(r.bytes).padStart(9)} / ${human(r.budget).padEnd(7)} ${r.note}`).join('\n'));
if (failures.length) {
  console.error(`\n✗ Over budget or incomplete:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\n✓ Every output within budget');
