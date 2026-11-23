// Copy into <project>/showcase/ next to scenes.mjs and fill it in.
// Every key is optional; the defaults live in kit/lib/config.mjs.
export default {
  name: 'My App',
  baseURL: 'http://127.0.0.1:5173', // or BASE_URL=… on the command line
  scenes: './scenes.mjs',
  themes: ['light', 'dark'],        // ['light'] if the app has no dark mode
  viewport: { width: 1280, height: 800 },
  scale: 2,                         // frames at 2560×1600
  slowmo: 3,                        // or SLOWMO=… ; 1 disables slow motion
  locale: 'en-US',
  // timezoneId: 'America/Santiago',

  // Pin the app's own theme before its scripts run (serialized: no outer variables).
  // Examples: Filament → localStorage.theme; a React app → its own key.
  initScript: theme => { try { localStorage.setItem('theme', theme); } catch {} },

  fixedHeader: 64,                  // px of a fixed top bar, 0 if none
  settle: {
    gone: [],                       // e.g. ['.skeleton', '[data-loading]']: must leave the DOM
    extra: 600,
  },
  // chartJs: { pluginsGlobal: 'filamentChartJsPlugins' },  // or { register: true }
  // cursor: { ripple: 'rgba(96,61,231,.35)' },             // brand colour of the click ripple

  // 'none' | 'shared' (sign in once per theme) | 'per-scene' (rotating refresh tokens)
  session: 'none',
  // async login(page, h) {
  //   await page.goto('/login');
  //   await page.fill('input[type=email]', process.env.DEMO_EMAIL);
  //   await page.fill('input[type=password]', process.env.DEMO_PASSWORD);
  //   await page.click('button[type=submit]');
  //   await page.waitForURL(/dashboard/);
  //   await h.settle(page);
  // },

  outputs: {
    web: true,                      // landing: WebM + MP4 + WebP poster + GIF fallback
    email: true,                    // email: cropped GIF + first-frame JPG
    // budgets: { webm: 1.5 * 1024 ** 2, mp4: 2.5 * 1024 ** 2, emailGif: 1.5 * 1024 ** 2 },
  },
  email: { link: 'https://myapp.example' },

  coverage: {
    pages: [
      // { name: 'dashboard', path: '/dashboard', root: 'main' },
    ],
    emptyText: [],                  // e.g. ['No data yet', 'Nothing here']
  },
};
