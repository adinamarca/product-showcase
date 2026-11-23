// Showcase of the demo app in example/app. Serve it first:
//   python3 -m http.server 8799 -d example/app
// then, from example/:  ../kit/showcase.sh all
export default {
  name: 'Acme Orders',
  baseURL: 'http://127.0.0.1:8799',
  scenes: './scenes.mjs',
  themes: ['light', 'dark'],
  locale: 'en-US',
  // The app reads localStorage.theme before it paints.
  initScript: theme => { try { localStorage.setItem('theme', theme); } catch {} },
  fixedHeader: 56,
  session: 'shared',
  async login(page, h) {
    await page.goto('/login.html');
    await page.fill('input[type=email]', 'demo@acme.example');
    await page.fill('input[type=password]', 'demo-password');
    await page.click('button[type=submit]');
    await page.waitForURL(/index\.html/);
    await h.settle(page, 200);
  },
  email: { link: 'https://acme.example/orders' },
  coverage: {
    pages: [{ name: 'dashboard', path: '/index.html', root: 'main' }],
    emptyText: ['No orders match'],
  },
};
