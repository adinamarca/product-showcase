// One entry per walkthrough. The key is the file name of every output
// (sorted, so prefix with 01-, 02-…). `h` holds the kit's helpers:
//   h.clickOn(page, locator)            glide there like a hand, dwell, click
//   h.moveTo(page, locator)             glide only (hover states, tooltips)
//   h.typeInto(page, locator, text)     click into a field and type like a person
//   h.scrollTo(page, locator, offset)   smooth scroll the element to `offset` px from the top
//   h.smoothScroll(page, dy, ms)        smooth scroll by dy px
//   h.hoverAcross(page, locator, [0.2, 0.5, 0.8])   sweep across a chart
//   h.settle(page)                      network idle + loading indicators gone
//   h.pause(page, ms)                   wait, in playback time
// `rec` marks the email clip (its first frame must be a finished, readable
// state) and can freeze the picture across a full page load:
//   await rec.clipStart(locator | [locators] | {x, y, width, height} | null, padding)
//   rec.clipEnd()
//   rec.hold(); … navigation …; rec.hold(false)
export default {
  '01-overview': {
    title: 'Overview',
    description: 'What the user sees first, in one sentence about why it matters.',
    start: '/',
    // signedIn: false,            // record this scene signed out (the login itself, say)
    // async before(page, h) {},   // runs after the page settles, before recording
    async run(page, rec, h) {
      await h.pause(page, 600);
      await rec.clipStart(page.locator('main'), 16);
      await h.moveTo(page, page.getByRole('link').first());
      await h.pause(page, 900);
      rec.clipEnd();
    },
  },
};
