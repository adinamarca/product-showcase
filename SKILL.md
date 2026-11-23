---
name: product-showcase
description: "Generate a comprehensive marketing website for a web app — multi-page with real screenshots, smooth video and GIF walkthroughs, feature deep-dives, and workflow demonstrations. Records the running app with a bundled kit (lossless 2× frames, a human-like cursor, slow-motion capture, light and dark themes) and encodes landing videos and email GIFs within size budgets, then produces a deployable site that actually teaches people what the product does. Especially useful for complex or agentic apps that are hard to explain. Triggers: 'showcase site', 'product page', 'show off the app', 'marketing site', 'demo site', 'product showcase', 'explain the app', 'how do I market this', 'walkthrough video', 'GIF for the email', 'record the app'."
compatibility: claude-code-only
---

# Product Showcase Generator

Generate a marketing website that actually teaches people what a web app does. Not just a hero and feature grid — a multi-page site with real screenshots, smooth video walkthroughs of workflows, feature deep-dives, and progressive depth from "what is this" to "here's exactly how it works."

Especially valuable for complex apps, agentic AI tools, and anything where a static screenshot doesn't convey the value.

The walkthroughs come from the **showcase kit** bundled with this skill (`kit/` next to this file; below, `$KIT` stands for that folder, e.g. `~/.claude/skills/product-showcase/kit`). It replaces ad-hoc Playwright scripts and Pillow GIFs: it records lossless 2× frames in slow motion with a visible cursor that moves like a hand, and encodes every scene into AV1/H.264 videos for the landing and cropped GIFs for email, each within a size budget.

## Depth Levels

| Depth | Output | Duration |
|-------|--------|----------|
| **quick** | Single page — hero, features, CTA, one hero walkthrough. | 20-30 min |
| **standard** | Multi-page site — home, features page, how-it-works with screenshots and 3-5 walkthroughs. | 1-2 hours |
| **thorough** | Comprehensive site — home, per-feature pages, a walkthrough per feature, use cases, comparison page, docs-style demo, email clips. | 3-6 hours |

Default: **standard**

## Workflow

### 1. Gather Input

| Field | Required | Example |
|-------|----------|---------|
| App URL | Yes | `https://app.example.com` or `http://localhost:5173` |
| App name | Yes | "Acme CRM" |
| How to sign in | If the app has auth | demo account, or the real flow (email + code) |
| Themes | No | light and dark, or light only |
| Tagline | No | "The CRM that gets out of your way" |
| Target audience | No | "Small business owners" |
| Pricing info | No | Free tier, $29/mo pro |
| CTA text + URL | No | "Start Free Trial" → signup page |
| Testimonials | No | User provides or skip section |

**Demo data matters more than anything else.** Record against a seeded, realistic dataset (an isolated database or a seed script), never production and never "Test Client / asdf@example.com". If the project has no seed, write one first and keep it in the showcase folder so the recordings can be regenerated.

### 2. Set Up the Kit

```bash
"$KIT/showcase.sh" doctor     # checks ffmpeg, gifski, gifsicle, cwebp; installs Playwright + Chromium once
mkdir -p showcase && cp "$KIT/../templates/"{showcase.config.mjs,scenes.mjs} showcase/
```

Missing tools: `brew install ffmpeg gifski gifsicle webp` (macOS) or `sudo pacman -S ffmpeg gifski gifsicle libwebp` (Arch/CachyOS). Without `libsvtav1` in ffmpeg the AV1 WebM is skipped; the MP4 and the GIF still cover every browser.

Fill `showcase/showcase.config.mjs` (every key is documented in the template; defaults in `kit/lib/config.mjs`):

| Key | What to set |
|-----|-------------|
| `baseURL` | Where the app runs (or `BASE_URL=…`) |
| `themes` | `['light', 'dark']`, or `['light']` |
| `initScript` | Pins the app's own theme before its scripts run — find where the app stores it (`localStorage.theme` in Filament, a custom key elsewhere) |
| `fixedHeader` | Height of a fixed top bar, so clicks never land on it |
| `settle.gone` | Loading veils, skeletons and spinners that must leave the DOM before the page counts as settled |
| `chartJs` | `{ pluginsGlobal: 'filamentChartJsPlugins' }` or `{ register: true }` if the app draws Chart.js charts, so they animate in slow motion too |
| `session` + `login` | `'shared'` signs in once per theme and reuses the session; `'per-scene'` signs in inside each scene (rotating refresh tokens); `'none'` |
| `coverage` | Pages to screenshot before recording, and empty-state texts that must not appear |
| `outputs` | `web` / `email` on or off, widths, byte budgets |

### 3. Capture Screenshots

Before writing scenes, run coverage. It walks `coverage.pages` in every theme, saves full-page screenshots to `showcase/screenshots/coverage/<theme>/`, prints the headings of each page (the anchors scenes aim at) and **fails if a page shows an empty state** — the check that the seed covers what the scenes visit:

```bash
cd showcase && "$KIT/showcase.sh" coverage
```

Those screenshots double as the static images of the site (hero, feature grid). For a single tight shot, use Playwright directly at the same viewport and `deviceScaleFactor: 2`.

#### What to capture:

**a. First Impression** — the main page/dashboard becomes the hero. Note the immediate value proposition.

**b. Features** — each major section. Capture 6-10 key screens that tell the product story.

**c. "How It Works" flow** — the main workflow, recorded as a scene (section 4).

**d. Detail shots** — crop to the element in a scene with `rec.clipStart(locator)`, or a full-page coverage screenshot for scrollable content.

**e. Both modes** — the kit records every theme; use the best-looking mode for the hero.

#### f. Extract the Value Propositions
Don't just list features. For each one, answer: **why does the user care?**
- BAD: "Contact management page"
- GOOD: "See every client, their history, and what needs attention — in one view"
- BAD: "Search functionality"
- GOOD: "Find anything in seconds — semantic search understands what you mean, not just what you type"

### 4. Record the Walkthroughs

Static screenshots don't convey workflow. Each walkthrough is a **scene** in `showcase/scenes.mjs`:

```js
export default {
  '02-search': {
    title: 'Find any order',                       // shown in the gallery
    description: 'Type a name and the list narrows as you go.',
    start: '/orders',
    async run(page, rec, h) {
      await h.scrollTo(page, page.locator('#orders'), 72);
      await rec.clipStart(page.locator('#orders'), 12);   // email clip starts: crop to this
      await h.typeInto(page, page.locator('#search'), 'rain jacket');
      await h.pause(page, 1200);                           // let the result read
      rec.clipEnd();
    },
  },
};
```

Helpers (`h`): `clickOn` (glides there like a hand, dwells, clicks — never `locator.click()`, which makes the cursor jump), `moveTo` (hover only), `typeInto`, `scrollTo`, `smoothScroll`, `hoverAcross` (sweep a chart so its tooltips show), `settle`, `pause` (in playback time). `rec.hold()` / `rec.hold(false)` freezes the picture across a full page load. `example/scenes.mjs` in this repo is a working set.

Then:

```bash
"$KIT/showcase.sh" all                       # coverage → record → encode → gallery
"$KIT/showcase.sh" record --theme dark 02-search   # iterate on one scene
"$KIT/showcase.sh" encode 02-search
"$KIT/showcase.sh" gallery
"$KIT/showcase.sh" sheet dist/light/email/02-search.gif /tmp/sheet.png   # contact sheet to review
```

**Review every scene before using it**: open `showcase/dist/index.html` (all outputs, both themes, with sizes) and look at a contact sheet of each email GIF. Read the frames — a contact sheet is an image you can inspect.

**What comes out** (per scene and theme, in `showcase/dist/<theme>/`):

| File | For | Format | Default budget |
|------|-----|--------|----------------|
| `web/<scene>.webm` | landing `<video>`, first source | AV1, 1920 px | 1.5 MB |
| `web/<scene>.mp4` | landing, Safari/older browsers | H.264, 1920 px | 2.5 MB |
| `web/<scene>.webp` | video poster | WebP | 150 KB |
| `web/<scene>.gif` | fallback where video can't play | GIF, 1280 px | 4 MB |
| `email/<scene>.gif` | email | the clip, cropped, 1200 px (shown at 600 px) | 1.5 MB |
| `email/<scene>.jpg` | Outlook desktop (first frame only) | JPEG | 300 KB |

`dist/EMBED.md` has copy-paste snippets for both destinations. When an output is over budget, the encoder walks a ladder (more lossy, fewer fps, narrower) and fails if it still doesn't fit — shorten the scene or crop the clip.

**What to animate**:
- The primary "create something" flow
- A search/filter interaction (show results appearing)
- A drag-and-drop or reorder operation
- Dark mode toggle (satisfying visual)
- Any "magic moment" where the app does something impressive (AI classification, instant search, real-time update)

**Scene guidelines**:
- 5-15 s per scene; email clips 3-8 s, showing one thing at a size that reads at 600 px.
- **The clip's first frame must be a finished, readable state** — Outlook desktop shows only that frame, and it is also the video poster.
- End on the result and hold it (`h.pause(page, 1200)`), so viewers see the payoff.
- Same seed per scene name: every regeneration draws the same cursor paths.
- If filtering or collapsing content shortens the page, the browser pulls the scroll back and the content jumps inside the crop: add room below the content in `before` (`page.addStyleTag({ content: 'main { padding-bottom: 900px !important }' })`).
- Content that animates on `requestAnimationFrame` outside CSS (canvas charts, custom tweens) is not slowed down; it plays a bit faster in the output. Chart.js is handled by `chartJs`.

**Why the kit and not Playwright's video**: `recordVideo` is a low-bitrate VP8 stream at 1× and looks soft; the DevTools screencast ignores the device scale. The kit polls lossless 2× screenshots instead. A 2× screenshot takes ~80 ms, so the page runs 3× slower while recording (CSS animations through CDP, every wait, scroll, cursor move and keystroke) and the encoder divides the timeline back: ~30 real frames per second of playback. GIFs go through gifski (a palette per frame, temporal dithering, repeated frames merged into longer delays) and gifsicle's lossy LZW.

**Display in HTML** — the landing gets the video, with the GIF as its fallback:
```html
<div class="browser-frame">
  <div class="browser-frame-bar">
    <span class="browser-frame-dot"></span>
    <span class="browser-frame-dot"></span>
    <span class="browser-frame-dot"></span>
  </div>
  <video autoplay muted loop playsinline preload="metadata"
         poster="walkthroughs/light/web/02-search.webp" width="1920" height="1200">
    <source src="walkthroughs/light/web/02-search.webm" type="video/webm; codecs=av01.0.08M.08">
    <source src="walkthroughs/light/web/02-search.mp4" type="video/mp4">
    <img src="walkthroughs/light/web/02-search.gif" alt="Finding an order in two seconds" width="1280" height="800">
  </video>
</div>
```
Copy `showcase/dist/<theme>/web/` into the site (e.g. `site/walkthroughs/`). To follow the visitor's theme, swap `light/` ↔ `dark/` from the site's theme toggle.

### 5. Explaining Agentic / AI Apps

Agentic apps are especially hard to market because the value is invisible — the AI does work the user never sees. Standard screenshots show a chat interface. That's not compelling.

**Patterns that work for agentic apps**:

| Pattern | What it shows | Example |
|---------|-------------|---------|
| **Before/after** | What the user used to do manually vs what the agent does | "Used to: copy-paste from 3 systems. Now: agent does it in background." |
| **Timeline** | What happens over time — show the agent working across hours/days | "8am: agent checks inbox. 9am: classifies 47 emails. 10am: flags 3 urgent." |
| **Result showcase** | Skip the process, show the output | "Agent mined 1,200 emails → 89 clients, 340 contacts, 2,100 knowledge facts" |
| **Side-by-side** | Show the agent's work next to what a human would have done | Split screen: left is the raw email, right is the extracted structured data |
| **Magic moment walkthrough** | One scene of the most impressive thing | User asks a question → agent searches knowledge → returns answer with sources |

**Copy tips for agentic apps**:
- Lead with the outcome, not the technology ("Know every client's history" not "AI-powered CRM")
- Show volume ("Processed 1,200 emails" is more impressive than "Processes your emails")
- Use time comparisons ("What took 2 hours now takes 30 seconds")
- Avoid jargon ("Finds connections in your data" not "Semantic vector search with RAG")

### 6. Generate the Site

#### Quick Mode: Single Page
One HTML file: hero (with the hero walkthrough) + feature grid + CTA. Use for MVPs and quick marketing.

#### Standard Mode: Multi-Page Site

```
site/
├── index.html              # Home — hero, overview, feature highlights, CTA
├── features.html           # All features with screenshots and descriptions
├── how-it-works.html       # Step-by-step workflow walkthrough
├── screenshots/            # Static images (from coverage or single shots)
├── walkthroughs/           # Copied from showcase/dist/<theme>/web/
└── styles.css              # Shared styles (or inline Tailwind CDN)
```

**Home page**: Hero with a walkthrough video or key screenshot, 3-4 feature highlights (not all features — just the best), "How It Works" summary (3 steps), CTA.

**Features page**: Every feature with a real screenshot and benefit-focused description. Group by category if there are 6+. Each feature gets enough space to actually explain what it does.

**How It Works page**: The primary workflow as a step-by-step visual guide. Each step has a screenshot or walkthrough, a heading, and 2-3 sentences. This page answers "ok but what does using it actually look like?"

#### Thorough Mode: Comprehensive Site

```
site/
├── index.html              # Home — hero, overview, value proposition
├── features/
│   ├── index.html          # Feature overview grid
│   ├── [feature-1].html    # Deep-dive: one page per major feature
│   ├── [feature-2].html    # Each with screenshots, walkthroughs, use cases
│   └── [feature-n].html
├── how-it-works.html       # Full workflow walkthrough
├── use-cases/
│   ├── [use-case-1].html   # Scenario: "A day in the life of..."
│   └── [use-case-2].html   # Scenario: "When a new client calls..."
├── compare.html            # "Why [app] vs alternatives" (optional)
├── screenshots/
├── walkthroughs/
└── styles.css
```

**Per-feature deep-dive pages**: Each major feature gets its own page with:
- Hero screenshot of the feature in action
- "What it does" — 1-2 paragraphs explaining the value
- "How it works" — its walkthrough, or step-by-step screenshots
- "Why it matters" — the problem this solves
- Edge cases or power-user tips
- Link to next feature (flow between pages)

**Use case pages**: Story-driven pages that show the app in a real scenario:
- "It's Monday morning. You open the dashboard and see..."
- Walk through a realistic workflow with screenshots at each step
- Show the outcome — what's different because the user used this app
- These are the most persuasive pages for apps that are hard to explain

**Comparison page** (optional): "Why [app] vs [alternatives]" — honest comparison, not marketing fluff. Feature table, key differentiators, who it's best for.

**Email clips**: for onboarding or announcement emails, use `dist/<theme>/email/*.gif` from a public URL (never attached), `width="600"`, wrapped in a link. Snippet in `dist/EMBED.md`.

### 7. Screenshot Presentation

Screenshots and videos are shown in browser-frame mockups using CSS:

```css
.browser-frame {
  border-radius: 8px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.1);
}
.browser-frame-bar {
  background: #f1f5f9;
  padding: 8px 12px;
  display: flex;
  gap: 6px;
}
.browser-frame-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e2e8f0;
}
.browser-frame video, .browser-frame img { display: block; width: 100%; height: auto; }
```

This gives screenshots a polished "app in a browser" look without needing to edit the images.

### 8. Site Navigation (multi-page)

Multi-page sites need consistent navigation:

```html
<nav>
  <a href="/">Home</a>
  <a href="/features/">Features</a>
  <a href="/how-it-works.html">How It Works</a>
  <a href="/use-cases/">Use Cases</a>  <!-- thorough only -->
  <a href="#pricing">Pricing</a>
  <button>Get Started</button>
</nav>
```

- Sticky nav on all pages
- Current page highlighted
- Mobile hamburger menu
- CTA button always visible in nav

### 9. Output

After generating, tell the user:
- Preview: `python3 -m http.server -d site` then open `http://localhost:8000`
- Review gallery of the walkthroughs: `showcase/dist/index.html`
- Deploy: drag the `site/` folder to Cloudflare Pages, Netlify, or any static host
- Regenerate the walkthroughs after a UI change: `cd showcase && "$KIT/showcase.sh" all`
- List any placeholder content that needs replacing
- List the walkthroughs and their sizes (the encoder's report or `dist/manifest.json`)

Keep `showcase/` (config, scenes, seed) in the project's repo; ignore `showcase/.recordings/` and `showcase/screenshots/` (large, regenerable).

## Design Patterns

**Colour**: If the app has a clear brand colour, extract it and use it as the primary (also for the kit's click ripple, `cursor.ripple`). Otherwise default to a neutral palette (slate/blue).

**Typography**: System font stack (no external requests).

**Responsive**: Mobile-first, screenshots scale down gracefully. On mobile, screenshots stack vertically instead of grid.

**Dark mode**: Three-state toggle (light/dark/system) with CSS custom properties; swap the walkthrough theme with it.

**Performance**: `preload="metadata"` on videos, lazy-load screenshots. Tailwind CDN for styling. No build step.

## Making It Look Premium

### Screenshot Enhancement
- **Clean data**: Seeded, realistic data — not "Test Client" and "asdf@example.com"
- **Consistent window size**: All captures at the same viewport (the kit's 1280×800 at 2×)
- **No browser chrome in screenshots**: Use the CSS browser-frame mockup instead of capturing the actual Chrome toolbar
- **Highlight the action**: If a screenshot shows a feature, have that feature active/open (modal open, filter applied, item selected)

### Visual Storytelling
- **Lead with the dashboard**: The hero should show the app populated with data, looking alive and useful
- **Show the app doing work**: Results beat empty forms
- **Progressive reveal**: Hero shows the big picture, how-it-works shows the flow, features show the details
- **End with the payoff**: The final section before the CTA should show the result — a report generated, a task completed, a client managed

### Mix Screenshots with Mockups
Real screenshots show the product is real. Mockups show the product is polished. Use both:
- **Hero**: Real walkthrough or screenshot in a browser-frame mockup — proves the app exists and looks good
- **How It Works**: Can use simplified mockup illustrations (CSS shapes, icons, arrows) for the flow steps, with real captures for the detail
- **Feature grid**: Real screenshots — users want to see the actual UI
- **Mobile showcase**: CSS device frame mockup (phone outline) around a mobile screenshot
- **Dashboard/overview**: Real screenshot — this is the money shot

**Phone mockup frame** (CSS):
```css
.phone-frame {
  border: 8px solid #1f2937;
  border-radius: 32px;
  overflow: hidden;
  max-width: 280px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
}
.phone-frame-notch {
  background: #1f2937;
  height: 24px;
  border-radius: 0 0 16px 16px;
  width: 120px;
  margin: 0 auto;
}
```

### Animation (CSS-only, no JS required)
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.section { animation: fadeInUp 0.6s ease-out both; }

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.hero-screenshot { animation: float 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .section, .hero-screenshot { animation: none; } }
```

### Gradient Accents
Extract the app's primary colour and use it for subtle gradient backgrounds on sections:
```css
.hero { background: linear-gradient(135deg, var(--primary) 0%, transparent 60%); }
.cta-banner { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; }
```

## Deployment

The showcase site needs to be hosted somewhere real — not just opened from a file. Choose based on what's available:

### Option 1: Cloudflare Workers with Static Assets

If the app being showcased is already on Cloudflare, deploy the showcase as a Worker too:

```jsonc
// site/wrangler.jsonc
{
  "name": "myapp-showcase",
  "compatibility_date": "2026-03-01",
  "assets": { "directory": "./" }
}
```

Then `npx wrangler deploy`. Attach a custom domain: `showcase.myapp.com` or `myapp.com` (if the app itself is at `app.myapp.com`).

### Option 2: Cloudflare Pages (drag-and-drop)

Dashboard → Pages → Create → Upload assets → drag the `site/` folder. Gets a `.pages.dev` URL instantly.

### Option 3: Static host (Netlify, Vercel, GitHub Pages)

Any static host works — it's just HTML + CSS + images + videos. No server-side code.

### Custom Domain

For a professional showcase, always use a custom domain:
- `myapp.com` — showcase is the main site, app is at `app.myapp.com`
- `www.myapp.com` → showcase, `app.myapp.com` → the actual app

## Contact / Enquiry Forms

Every showcase needs a way for interested people to get in touch. Don't just put "email us" — add a real form.

### Pattern 1: Formspree / Formsubmit (no backend needed)

```html
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
  <input type="text" name="name" placeholder="Your name" required>
  <input type="email" name="email" placeholder="Your email" required>
  <textarea name="message" placeholder="Tell us about your needs"></textarea>
  <button type="submit">Get in Touch</button>
</form>
```

### Pattern 2: A serverless endpoint

If the showcase is on Workers (or similar), add a `/api/enquiry` route that sends the message by email (SMTP2Go, Resend) or stores it.

### Pattern 3: Turnstile + email (spam protection)

Add Cloudflare Turnstile to prevent bot submissions:
```html
<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
```

Verify the token server-side before processing the submission.

### What the form should capture

| Field | Required | Why |
|-------|----------|-----|
| Name | Yes | Personalise follow-up |
| Email | Yes | Reply channel |
| Company/Role | No but helpful | Qualify the lead |
| Message / "What are you looking for?" | No but helpful | Context for response |
| Phone | No | Some people prefer a call |

**After submission**: redirect to a thank-you page or show an inline confirmation. Don't just reset the form silently.

## Additional Pages Worth Generating

| Page | When to include | What it does |
|------|----------------|-------------|
| **Pricing** | If pricing is defined | Tier cards, feature comparison, FAQ about billing |
| **About** | For products with a story | Who built it, why, the journey |
| **Changelog** | For shipped products | Recent updates, shows the product is actively developed |
| **Docs link** | If user docs exist | Link to the user guide |
| **Privacy / Terms** | Always | Even placeholder — shows legitimacy |
| **Status page** | For SaaS | Link to uptime monitoring |

## SEO Basics

Every showcase page should have:
```html
<title>[App Name] — [Tagline]</title>
<meta name="description" content="[One sentence value proposition]">
<meta property="og:title" content="[App Name]">
<meta property="og:description" content="[Value proposition]">
<meta property="og:image" content="screenshots/hero.png">
<link rel="canonical" href="https://myapp.com/">
```

For multi-page: each page gets its own title and description. Don't use the same meta across all pages.

## Quality Rules

1. **Only record real features** — don't fabricate capabilities the app doesn't have
2. **Choose the best walkthroughs** — not every page is showcase-worthy. Pick the ones that tell the product story
3. **Write benefit-focused copy** — "See all your contacts in one place" not "Contact list page"
4. **No fake testimonials** — leave the section out if none provided
5. **No invented statistics** — leave stats blocks empty if no real data
6. **Review before shipping** — look at the gallery and a contact sheet of every email clip; every output within budget
7. **Deploy to a real URL** — don't leave it as local files. A showcase needs to be shareable

---

Based on the `product-showcase` skill from [jezweb/claude-skills](https://github.com/jezweb/claude-skills) (MIT, © 2025 Jeremy Dawes / Jezweb). The capture and encoding workflow was replaced by the showcase kit in `kit/`. See `NOTICE.md`.
