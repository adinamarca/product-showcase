// Loads a project's showcase.config.mjs and fills in the defaults.
//
// Every command takes `--config <file>` (default: ./showcase.config.mjs).
// Paths in the config are relative to the config file's folder, and the
// outputs land next to it: .recordings/ (lossless frames), dist/ (published
// files) and screenshots/ (coverage).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MB = 1024 * 1024;
const KB = 1024;

export const DEFAULTS = {
  name: 'Showcase',
  baseURL: 'http://127.0.0.1:5173',
  scenes: './scenes.mjs',
  themes: ['light', 'dark'],
  /** CSS viewport; frames are captured at `scale`× and scaled down per output. */
  viewport: { width: 1280, height: 800 },
  scale: 2,
  /**
   * Scenes are recorded this many times slower than they play. A lossless 2×
   * screenshot takes ~80 ms, so real time gives only ~10 uneven frames per
   * second; at 3× slower the encoder (which divides every time by this) gets
   * a real frame every ~30 ms of playback.
   */
  slowmo: 3,
  locale: 'en-US',
  timezoneId: undefined,
  /**
   * Runs in the page before any of its scripts, with the theme name as its
   * argument: pin the app's theme here (e.g. `localStorage.setItem('theme', t)`).
   * It is serialized, so it cannot use variables from the config file.
   */
  initScript: null,
  /** Height in CSS px of a fixed top bar: targets under it are scrolled out first. */
  fixedHeader: 0,
  /** What "the page has settled" means after navigating or clicking. */
  settle: {
    /** Loading indicators that must leave the DOM (veils, skeletons, spinners). */
    gone: [],
    /** Extra wait, in ms of playback, after everything is idle. */
    extra: 600,
  },
  /**
   * Chart.js animates on requestAnimationFrame, outside the CSS timeline that
   * slow motion stretches. Name the global array your framework reads Chart.js
   * plugins from (Filament: 'filamentChartJsPlugins'), or set `register: true`
   * to register the plugin on `window.Chart` once it exists.
   */
  chartJs: { pluginsGlobal: null, register: false },
  cursor: { ripple: 'rgba(96,61,231,.35)' },
  /**
   * 'shared': sign in once per theme and reuse the session in every scene.
   * 'per-scene': sign in inside every scene's context (rotating refresh tokens).
   * 'none': no sign-in.
   */
  session: 'none',
  /** async (page, helpers) => {...}: the real sign-in flow. */
  login: null,
  outputs: {
    web: true,
    email: true,
    webWidth: 1920,
    webGifWidth: 1280,
    emailWidth: 1200,
    budgets: {
      webm: 1.5 * MB,
      mp4: 2.5 * MB,
      webp: 150 * KB,
      webGif: 4 * MB,
      emailGif: 1.5 * MB,
      emailJpg: 300 * KB,
    },
  },
  /** Where the email GIF links to, for dist/EMBED.md. */
  email: { link: 'https://example.com', alt: null },
  /**
   * Pages to walk before recording: full-page screenshots in both themes, the
   * headings they show, and a failure when any shows one of `emptyText`.
   */
  coverage: { pages: [], emptyText: [], headings: 'h1, h2, h3' },
};

const isObject = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function';

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

/** `--config <file>` from argv, plus the remaining arguments. */
export function parseArgs(argv = process.argv.slice(2)) {
  const rest = [];
  let config = 'showcase.config.mjs';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') config = argv[++i];
    else rest.push(argv[i]);
  }
  return { config: path.resolve(config), rest };
}

export async function loadConfig(file) {
  if (!existsSync(file)) {
    throw new Error(`No config at ${file}. Copy templates/showcase.config.mjs next to your scenes.`);
  }
  const user = (await import(pathToFileURL(file).href)).default ?? {};
  const config = merge(DEFAULTS, user);
  config.dir = path.dirname(file);
  config.raw = path.join(config.dir, '.recordings');
  config.dist = path.join(config.dir, 'dist');
  config.shots = path.join(config.dir, 'screenshots');
  config.scenesFile = path.resolve(config.dir, config.scenes);
  config.baseURL = process.env.BASE_URL ?? config.baseURL;
  config.slowmo = Number(process.env.SLOWMO ?? config.slowmo);
  return config;
}

export async function loadScenes(config) {
  const mod = await import(pathToFileURL(config.scenesFile).href);
  return mod.default ?? mod.scenes;
}
