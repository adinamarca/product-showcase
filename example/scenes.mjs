// Each scene: a title and description (used by the gallery), the page it
// starts on, and run(page, rec, h). `h` holds the helpers of kit/lib/browser.mjs.
// rec.clipStart(target) … rec.clipEnd() marks the email clip; its first frame
// must be a finished, readable state (Outlook desktop shows only that frame).
export default {
  '01-dashboard': {
    title: 'Dashboard',
    description: 'Revenue, orders and returning customers at a glance, against last week.',
    start: '/index.html',
    async run(page, rec, h) {
      await h.pause(page, 600);
      const kpis = page.locator('#kpis');
      await rec.clipStart(kpis, 16);
      const cards = page.locator('.kpi');
      for (let i = 0; i < 4; i++) {
        await h.moveTo(page, cards.nth(i));
        await h.pause(page, 450);
      }
      rec.clipEnd();
      await h.hoverAcross(page, page.locator('.bars'), [0.15, 0.45, 0.75, 0.95], 350, 0.7);
      await h.pause(page, 600);
    },
  },

  '02-search': {
    title: 'Find any order',
    description: 'Type a name or a product and the list narrows as you go.',
    start: '/index.html',
    // Filtering shortens the page, and the browser then pulls the scroll back,
    // shifting the list inside the clip's crop. Room below the content (never
    // inside the crop) keeps the scroll where it is.
    async before(page) {
      await page.addStyleTag({ content: 'main { padding-bottom: 900px !important; }' });
    },
    async run(page, rec, h) {
      await h.scrollTo(page, page.locator('#orders'), 72, 900);
      await rec.clipStart(page.locator('#orders'), 12);
      await h.typeInto(page, page.locator('#search'), 'rain jacket', { delay: 70 });
      await h.pause(page, 1200);
      rec.clipEnd();
      await page.locator('#search').fill('');
      await page.locator('#search').dispatchEvent('input');
      await h.pause(page, 500);
    },
  },

  '03-new-order': {
    title: 'Create an order',
    description: 'Two fields and it is on the list, highlighted.',
    start: '/index.html',
    async run(page, rec, h) {
      await h.scrollTo(page, page.locator('#orders'), 72, 900);
      await rec.clipStart(null);
      await h.clickOn(page, page.locator('#new'));
      await h.pause(page, 400);
      await h.typeInto(page, page.locator('input[name=customer]'), 'Ana Gómez', { delay: 60 });
      await h.clickOn(page, page.locator('dialog button.primary'));
      await h.pause(page, 1600);
      rec.clipEnd();
    },
  },
};
