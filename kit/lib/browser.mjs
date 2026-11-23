// Playwright helpers for showcase recordings: a browser context per theme in
// slow motion, a visible cursor that moves like a hand, smooth scrolls, and
// "the page has settled" waits. Scenes and the login receive these as `h`.
import { chromium } from 'playwright';

/**
 * A visible cursor and click ripple, injected into every page: a headless
 * browser draws no pointer, and a walkthrough without one is hard to follow.
 */
const CURSOR_SCRIPT = ripple => {
  const install = () => {
    if (document.getElementById('__showcase_cursor')) return;
    const c = document.createElement('div');
    c.id = '__showcase_cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6L9.6 20z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none',
      transform: 'translate(var(--x,-100px), var(--y,-100px))', transition: 'none' });
    // The arrow's tip sits on the pointer; pressing squeezes it towards the tip.
    const arrow = c.firstChild;
    Object.assign(arrow.style, { display: 'block', transformOrigin: '4px 2px', transition: 'transform .16s cubic-bezier(.3,1.6,.5,1)' });
    document.documentElement.appendChild(c);
    const pos = JSON.parse(sessionStorage.getItem('__cursor') || '[-100,-100]');
    c.style.setProperty('--x', pos[0] + 'px'); c.style.setProperty('--y', pos[1] + 'px');
    document.addEventListener('mousemove', e => {
      c.style.setProperty('--x', e.clientX + 'px'); c.style.setProperty('--y', e.clientY + 'px');
      sessionStorage.setItem('__cursor', JSON.stringify([e.clientX, e.clientY]));
    }, true);
    document.addEventListener('mouseup', () => { arrow.style.transform = ''; }, true);
    document.addEventListener('mousedown', e => {
      arrow.style.transform = 'scale(.86)';
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: (e.clientX - 18) + 'px', top: (e.clientY - 18) + 'px', width: '36px', height: '36px',
        borderRadius: '50%', background: ripple, zIndex: 2147483646, pointerEvents: 'none',
        transition: 'transform .45s ease-out, opacity .45s ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; }));
      // Not a timer: in slow motion the transition outlasts any fixed delay.
      r.addEventListener('transitionend', () => r.remove(), { once: true });
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
};

/**
 * Stretches Chart.js animations by the slow-motion factor before a chart
 * first draws, through a plugin: pushed onto a global array the framework
 * reads (Filament: `filamentChartJsPlugins`), or registered on `window.Chart`
 * as soon as it is defined.
 */
const CHART_SLOWMO_SCRIPT = ({ k, pluginsGlobal, register }) => {
  const stretch = animation => {
    if (animation && typeof animation === 'object' && !animation.__slowmo) {
      animation.duration = (animation.duration ?? 1000) * k;
      animation.__slowmo = true;
    }
  };
  const plugin = {
    id: 'showcaseSlowmo',
    beforeInit(chart) {
      stretch(chart.constructor.defaults.animation);
      const options = chart.config.options;
      if (options.animation !== false) {
        options.animation = options.animation ?? {};
        stretch(options.animation);
      }
    },
  };
  if (pluginsGlobal) {
    window[pluginsGlobal] = [...(window[pluginsGlobal] ?? []), plugin];
  }
  if (register) {
    let chart = window.Chart;
    const hook = c => { try { c?.register?.(plugin); } catch {} };
    if (chart) hook(chart);
    else Object.defineProperty(window, 'Chart', { configurable: true, get: () => chart, set: v => { chart = v; hook(v); } });
  }
};

/**
 * A browser context in one theme. `colorScheme` matches the theme for
 * anything that reads the media query; `config.initScript` pins the app's own
 * theme setting before any of its scripts run.
 */
export async function launch(config, { theme = 'light', storageState = undefined, scale = config.scale, slowmo = 1 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: config.viewport, deviceScaleFactor: scale, locale: config.locale, timezoneId: config.timezoneId,
    colorScheme: theme === 'dark' ? 'dark' : 'light', storageState, baseURL: config.baseURL,
  });
  if (config.initScript) await context.addInitScript(config.initScript, theme);
  await context.addInitScript(CURSOR_SCRIPT, config.cursor.ripple);
  const { pluginsGlobal, register } = config.chartJs;
  if (slowmo !== 1 && (pluginsGlobal || register)) {
    await context.addInitScript(CHART_SLOWMO_SCRIPT, { k: slowmo, pluginsGlobal, register });
  }
  const page = await context.newPage();
  page.__slow = slowmo;
  page.__config = config;
  page.__cursor = { x: config.viewport.width / 2, y: config.viewport.height / 2 };
  page.__random = seededRandom('showcase');
  if (slowmo !== 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Animation.enable');
    const apply = () => cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / slowmo }).catch(() => {});
    await apply();
    // A new document gets a new timeline: slow it down again on every load.
    page.on('domcontentloaded', apply);
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) apply(); });
  }
  return { browser, context, page };
}

/** Waits for the network, the configured loading indicators, and `extra` ms. */
export async function settle(page, extra = page.__config.settle.extra) {
  await page.waitForLoadState('networkidle').catch(() => {});
  for (const selector of page.__config.settle.gone) {
    await page.locator(selector).first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await pause(page, extra);
}

/**
 * Runs `fn` alone against the page's other exclusive work. The recorder holds
 * it from reading the scroll offset to taking the screenshot, and every
 * scroll waits for it: otherwise a scroll landing between the two shifts the
 * whole frame, fixed header included, by that step.
 */
export function exclusive(page, fn) {
  const run = (page.__exclusive ?? Promise.resolve()).then(fn);
  page.__exclusive = run.catch(() => {});
  return run;
}

/** The page's slow-motion factor: 1 outside recordings. */
export const slow = page => page.__slow ?? 1;

/** Waits `ms` of playback time. */
export async function pause(page, ms) {
  await page.waitForTimeout(ms * slow(page));
}

/** A small seeded PRNG (mulberry32), so every run draws the same cursor paths. */
export function seededRandom(seed) {
  let a = [...String(seed)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Minimum-jerk position profile: the speed curve of a hand reaching for a target. */
const minimumJerk = t => t * t * t * (10 + t * (-15 + 6 * t));

/** Puts the cursor somewhere without animating (before a recording starts). */
export async function placeCursor(page, x, y) {
  await page.mouse.move(x, y);
  page.__cursor = { x, y };
}

/**
 * Moves the cursor to (x, y) the way a hand does:
 * - the trip takes longer the farther it goes (Fitts's law, ~0.45 s for
 *   100 px, ~0.8 s across the screen);
 * - it speeds up and slows down smoothly (minimum-jerk profile);
 * - it bends slightly, on a quadratic Bézier with the control point 4–10 % of
 *   the distance off the straight line;
 * - long trips overshoot by 2–3 % and settle back.
 * One mouse event per ~16 ms of playback, paced by the clock.
 */
export async function glide(page, x, y, { speed = 1 } = {}) {
  const random = page.__random ?? Math.random;
  const from = page.__cursor;
  const dx = x - from.x;
  const dy = y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) {
    await placeCursor(page, x, y);
    return;
  }
  const overshoot = distance > 400 ? 0.02 + random() * 0.01 : 0;
  const end = { x: x + dx * overshoot, y: y + dy * overshoot };
  const bend = distance * (0.04 + random() * 0.06) * (random() < 0.5 ? -1 : 1);
  const control = {
    x: (from.x + end.x) / 2 - (dy / distance) * bend,
    y: (from.y + end.y) / 2 + (dx / distance) * bend,
  };
  const duration = (250 + 120 * Math.log2(1 + distance / 40)) / speed;
  await trace(page, duration, p => {
    const u = 1 - p;
    return { x: u * u * from.x + 2 * u * p * control.x + p * p * end.x, y: u * u * from.y + 2 * u * p * control.y + p * p * end.y };
  });
  if (overshoot > 0) {
    await trace(page, 140, p => ({ x: end.x + (x - end.x) * p, y: end.y + (y - end.y) * p }));
  }
  page.__cursor = { x, y };
}

/** Plays `point(progress)` over `ms` of playback, eased by the minimum-jerk profile. */
async function trace(page, ms, point) {
  const total = ms * slow(page);
  const started = Date.now();
  for (;;) {
    const p = Math.min(1, (Date.now() - started) / total);
    const at = point(minimumJerk(p));
    await page.mouse.move(at.x, at.y);
    if (p >= 1) return;
    await new Promise(resolve => setTimeout(resolve, 16 * slow(page)));
  }
}

/**
 * Where a person would aim inside a box: near the middle, not on the exact
 * centre pixel (within the middle 40 %, at most ±60 px off).
 */
function aim(page, box) {
  const random = page.__random ?? Math.random;
  const jitter = size => Math.max(-60, Math.min(60, (random() - 0.5) * 0.4 * size));
  return { x: box.x + box.width / 2 + jitter(box.width), y: box.y + box.height / 2 + jitter(box.height) };
}

/**
 * Moves the visible cursor to a point near the centre of a locator. A target
 * off screen or hidden under the fixed header is first scrolled smoothly into
 * the upper third: `scrollIntoViewIfNeeded` jumps, and leaves a target that
 * is above the viewport right under the header, where a click lands on it.
 */
export async function moveTo(page, locator, { speed = 1 } = {}) {
  const { viewport, fixedHeader } = page.__config;
  const top = fixedHeader ? fixedHeader + 8 : 0;
  const hidden = b => !b || b.y < top || b.y + b.height > viewport.height - 8;
  let box = await locator.boundingBox();
  if (box && hidden(box)) {
    await smoothScroll(page, box.y - Math.max(220, top + 140), 700);
    box = await locator.boundingBox();
  }
  // Still hidden: it lives in its own scroll container (a sidebar that
  // scrolls to its active item, say), which the window scroll can't reach.
  if (hidden(box)) {
    await exclusive(page, () => locator.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {}));
    box = await locator.boundingBox();
  }
  if (!box) return;
  const target = aim(page, box);
  await glide(page, target.x, target.y, { speed });
  await pause(page, 150);
}

/**
 * Clicks where the cursor is, with a short dwell first, so the pointer never
 * jumps (`locator.click()` would move it again on its own). If the element
 * moved during the glide, the cursor corrects onto it.
 */
export async function clickOn(page, locator, animate = true) {
  if (!animate) {
    await locator.click();
    return;
  }
  await locator.waitFor({ state: 'visible' });
  await moveTo(page, locator);
  const box = await locator.boundingBox();
  const { x, y } = page.__cursor;
  if (box && (x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height)) {
    const target = aim(page, box);
    await glide(page, target.x, target.y, { speed: 1.6 });
  }
  await pause(page, 120);
  await page.mouse.down();
  await pause(page, 80);
  await page.mouse.up();
}

/** Clicks into a field and types like a person (or fills it when `animate` is off). */
export async function typeInto(page, locator, text, { animate = true, delay = 45 } = {}) {
  if (!animate) {
    await locator.fill(text);
    return;
  }
  await clickOn(page, locator);
  await locator.pressSequentially(text, { delay: delay * slow(page) });
}

/**
 * Smooth scroll by `dy` pixels over `ms` of playback, eased in and out. Driven
 * from Node, one `scrollTo` per ~16 ms of playback: an in-page
 * requestAnimationFrame loop crawls under slow motion while the recorder is
 * capturing, and its frames came out blank.
 */
export async function smoothScroll(page, dy, ms = 1200) {
  const start = await page.evaluate(() => window.scrollY);
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const total = ms * slow(page);
  const started = Date.now();
  for (;;) {
    const p = Math.min(1, (Date.now() - started) / total);
    await exclusive(page, () => page.evaluate(y => window.scrollTo(0, y), start + dy * ease(p)));
    if (p >= 1) break;
    await new Promise(resolve => setTimeout(resolve, 16 * slow(page)));
  }
  await pause(page, 250);
}

/** Scrolls an element smoothly to `offset` px from the top of the viewport. */
export async function scrollTo(page, locator, offset = 96, ms = 1100) {
  await locator.waitFor();
  const y = await locator.evaluate(el => el.getBoundingClientRect().top);
  if (Math.abs(y - offset) > 8) {
    await smoothScroll(page, y - offset, ms);
  }
}

export async function scrollToTop(page, ms = 0) {
  if (ms > 0) {
    await smoothScroll(page, -(await page.evaluate(() => window.scrollY)), ms);
  } else {
    await exclusive(page, () => page.evaluate(() => window.scrollTo(0, 0)));
  }
}

/** Glides the cursor across an element so hover states and tooltips show. */
export async function hoverAcross(page, locator, points = [0.2, 0.5, 0.8], dwell = 550, y = 0.5) {
  if ((await locator.count()) === 0) return;
  const box = await locator.boundingBox({ timeout: 5000 }).catch(() => null);
  if (!box) return;
  for (const p of points) {
    await glide(page, box.x + box.width * p, box.y + box.height * y);
    await pause(page, dwell);
  }
}

/** Everything a scene or the login receives as `h`. */
export const helpers = {
  settle, pause, slow, glide, placeCursor, moveTo, clickOn, typeInto,
  smoothScroll, scrollTo, scrollToTop, hoverAcross, exclusive, seededRandom,
};
