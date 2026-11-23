// Lossless 2× scene recorder.
//
// Playwright's `recordVideo` is a low-bitrate VP8 stream at 1×, and it is why
// GIFs made from it look soft. The DevTools screencast is no better: headless
// Chromium sends its frames at CSS size, ignoring the device scale. So the
// recorder polls `Page.captureScreenshot` in a loop instead, with a
// viewport-sized `clip` at the configured scale (2560×1600 for 1280×800 at
// 2×), at roughly 10–15 fps alongside the scene's actions. The clip is in
// document coordinates, so each capture first reads the scroll offset, under
// the same lock the scroll helpers take (see `exclusive` in browser.mjs). Each
// PNG is written as it arrives with the time it was taken; durations come
// from the gap to the next frame. `encode.mjs` builds every output from these.
//
// The page runs in slow motion (see browser.mjs), so these ~10 captures per
// second become ~30 per second of playback. Times here are real seconds; the
// encoder divides them by `slowmo`.
//
// A scene can mark the window and the crop of its email clip:
//   await rec.clipStart(locatorOrBox)  … actions …  rec.clipEnd()
// and freeze the picture across a full page load (a redirect, say):
//   rec.hold()  … navigation …  rec.hold(false)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { exclusive, pause, slow } from './browser.mjs';

export class Recorder {
  constructor(page, dir) {
    this.page = page;
    this.dir = dir;
    this.frames = [];
    this.clip = null;
    this.held = false;
    const { viewport, scale } = page.__config;
    this.viewport = viewport;
    this.scale = scale;
  }

  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(path.join(this.dir, 'frames'), { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.running = true;
    this.loop = (async () => {
      while (this.running) {
        if (this.held) {
          // A full page load in progress (see hold()): the previous frame holds.
          await new Promise(resolve => setTimeout(resolve, 30));
          continue;
        }
        const t = Date.now() / 1000;
        try {
          // Offset and screenshot under one lock, so no scroll lands between them.
          const { data } = await exclusive(this.page, async () => {
            const { cssVisualViewport: view } = await this.cdp.send('Page.getLayoutMetrics');
            return this.cdp.send('Page.captureScreenshot', {
              format: 'png',
              optimizeForSpeed: true,
              clip: { x: view.pageX, y: view.pageY, width: this.viewport.width, height: this.viewport.height, scale: this.scale },
            });
          });
          const file = `frames/${String(this.frames.length).padStart(5, '0')}.png`;
          writeFileSync(path.join(this.dir, file), Buffer.from(data, 'base64'));
          this.frames.push({ file, t });
        } catch {
          // Mid-navigation there is nothing to capture; the previous frame holds.
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    })();
    for (let i = 0; i < 100 && this.frames.length === 0; i++) {
      await this.page.waitForTimeout(20);
    }
    this.t0 = this.frames[0]?.t ?? Date.now() / 1000;
  }

  /**
   * Stops capturing while `on`, so a full page load shows the last frame
   * instead of a blank page. Capture starts again when called with `false`.
   */
  hold(on = true) {
    this.held = on;
  }

  /**
   * Starts the email clip at the current screen. `target` is a locator, a
   * list of locators (their union) or a `{x, y, width, height}` box in CSS
   * px; `null` keeps the whole viewport.
   */
  async clipStart(target = null, padding = 16) {
    let box = null;
    const targets = target === null ? [] : Array.isArray(target) ? target : [target];
    for (const t of targets) {
      const b = typeof t?.boundingBox === 'function' ? await t.boundingBox() : t;
      if (!b) continue;
      box = box === null ? { ...b } : {
        x: Math.min(box.x, b.x), y: Math.min(box.y, b.y),
        width: Math.max(box.x + box.width, b.x + b.width) - Math.min(box.x, b.x),
        height: Math.max(box.y + box.height, b.y + b.height) - Math.min(box.y, b.y),
      };
    }
    if (box) {
      const x = Math.max(0, box.x - padding);
      const y = Math.max(0, box.y - padding);
      box = {
        x, y,
        width: Math.min(this.viewport.width - x, box.width + padding * 2),
        height: Math.min(this.viewport.height - y, box.height + padding * 2),
      };
    }
    // Let the screen show the state the clip opens on.
    await pause(this.page, 150);
    this.clip = { from: Date.now() / 1000 - this.t0, box };
  }

  clipEnd() {
    if (this.clip) {
      this.clip.to = Date.now() / 1000 - this.t0;
    }
  }

  async stop() {
    await pause(this.page, 120);
    this.running = false;
    await this.loop;
    const end = Date.now() / 1000 - this.t0;
    const timeline = {
      viewport: this.viewport,
      scale: this.scale,
      slowmo: slow(this.page),
      end,
      frames: this.frames.map(f => ({ file: f.file, t: Math.max(0, f.t - this.t0) })),
      clip: this.clip && this.clip.to ? this.clip : null,
    };
    writeFileSync(path.join(this.dir, 'timeline.json'), JSON.stringify(timeline, null, 1));
    return timeline;
  }
}
