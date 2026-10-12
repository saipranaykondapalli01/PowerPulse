# PowerPulse — Landing design notes

Owner: landing & motion design. Covers what the reference site was studied for, what could
and could not be verified, and how PowerPulse turns that study into its own visual identity.

## 1. Reference study — https://noho.ink/

Method: fetched the public HTML and its three first-party stylesheets
(`/assets/css/webflow.shared.min.css`, `noho.webflow.overrides.min.css`, `noho.bundle.min.css`)
and read the declared values. Scripts were identified by URL only; their source was not read
or reused. Nothing from the reference (code, assets, logo, copy, layout) is copied into PowerPulse.

### Verified (seen directly in HTML/CSS)

| Topic | Finding |
| --- | --- |
| Typeface | `font-family: Switzer, sans-serif` is used throughout (17 declarations), plus a `Switzer Variable` face with a `100 900` weight range. Self-hosted `Switzer-Regular.woff2` and `Switzer-Semibold.woff2`. |
| Weights | Mainly two: 400 and 600 (one 300). Hierarchy comes from size, not weight. |
| Tracking | Negative tracking on display type: `-.02em`, `-.03em` (most common), `-.04em` on the largest sizes. |
| Leading | Display lines are set solid: `line-height: 100%` (most common) and `95%`. |
| Scale | Fluid. The page wrapper sets `font-size: 1vw` and type is sized in `em` on top of that (`6.944em`, `6.25em`, `5.556em`, `4.167em`, `3.255em`, `2.604em`, `1.953em`), so the largest headline is about 7vw. Spacing and buttons are also in `vw` (for example `padding: 1.628vw 7.161vw`). |
| Palette | Warm off-white page (`--bg-page: #f1eee9`), soft charcoal ink (`#3c3c3c`) with 40/60% alpha variants for secondary text, sand neutrals (`#e7e2da`, `#d7d1c7`, `#cdc0b0`), small red and green indicator colors. |
| Breakpoints | 479px, 767px, 991px and 1279px, plus queries on `hover`/`pointer`/`orientation` for touch tablets. |
| Motion stack | Script tags load GSAP, ScrollTrigger, CustomEase, SplitText, Lenis (smooth scroll) and Embla Carousel (with auto-scroll). |
| Reveal hooks | Elements carry `data-animation-name` values such as `gallery-title-appearance`, `gallery-image-appearance`, `quote-title-appearance` and `sustainability-title-appearance`: title (split text) and image reveals bound to scroll. |
| Sticky | `position: sticky` appears 8 times in the stylesheets. |
| Video | No `<video>` elements in the served HTML. The hero uses image sequences and a 3D (`.glb`) model link. |
| Navigation | Small anchor nav (About, Price, Blog, FAQ), a full-screen mobile menu, and an "energy" panel with a **Reduce animation** toggle. |
| Footer | Contact, company nav, socials, "Back to top", legal links, credit line. |
| Pacing | Long single page. Sections alternate between large statement headlines and dense, image-led product blocks. |

### Not verified / inferred

- Exact easing curves and durations live in the JS bundle and were not read. Only CSS
  transitions were visible (`.32s ease`, `.3s`, `.1s`).
- How SplitText is configured (lines, words or chars) was not verified. "Masked line reveal"
  is inferred from the attribute names and the usual SplitText pattern.
- Hover effects beyond the CSS transitions above (for example magnetic buttons or cursor followers).
- Whether sticky elements are pinned by ScrollTrigger or by CSS (both are present).
- How images are composed at runtime (only one `<img>` tag is in the initial HTML; the rest are
  probably injected or background images).

## 2. What PowerPulse takes, and what it changes

The reference is a warm, playful furniture brand. PowerPulse is infrastructure monitoring. We take
the **discipline** (fluid oversized type, solid leading, negative tracking, two weights, warm paper,
restrained motion bound to scroll), not the look.

| Reference trait | PowerPulse translation |
| --- | --- |
| Switzer neo-grotesk | **General Sans** (Fontshare) for display, Inter for body, **JetBrains Mono** for technical labels. The mono layer is PowerPulse's own: it reads as instrumentation (`OIL TEMP`, `TAP POS`, `kVA`). We keep General Sans on purpose so the identity is not a typeface clone. No `index.html` change is needed. |
| vw-based em scale | `clamp()` tokens (`--text-display-xl` … `--text-display-sm`, `--text-metric`) so type stays readable at 375px and stops growing past 1600px. |
| Two weights, size-led hierarchy | Display 600, body 400/500, labels in mono 500 uppercase with positive tracking (`0.08em`), the opposite of the tight display tracking. |
| Warm off-white + charcoal | Paper `#F2F0E9`, ink `#151713` (darker, more technical), secondary `#686A61`. The accent `#C9F24A` is used only as an "energized" marker: the live dot, one hero mark, the focus ring, selection. Warning, critical and steel come from the status domain, never decoration. |
| Image-led product blocks | Original **line-art technical drawings**: a pole-mounted distribution transformer with bushings, radiator fins and a conservator, plus feeder lines to a substation, with mono annotations. No photography, no dashboard screenshots. |
| SplitText title reveals | `RevealLines`: each headline line sits in an `overflow: hidden` mask and slides up (transform only), staggered 80ms. |
| Image reveals | `ClipReveal`: a clip-path inset wipe on diagrams and panels. |
| Sticky storytelling | The **fault sequence** pins one diagram while scroll moves it through Reading → Rule → Alert → Highlight. It scrubs in both directions. |
| Lenis smooth scroll | Not used. Native scrolling is kept for accessibility and to avoid a dependency. Anchor CTAs use `scrollIntoView` (smooth unless reduced motion). |
| Reduce-animation toggle | Follows the OS setting via `useReducedMotion()` + `MotionConfig reducedMotion="user"`. All reveals, parallax and scrubbing are off and content is visible immediately. |

## 3. System decisions

- **Grid**: 12 columns in `container-content` (max 1600px, fluid gutter). Compositions are
  asymmetric (for example headline across 1–9, copy across 8–12 one row lower) and avoid centered stacks.
- **Rhythm**: section padding `clamp(6rem, 14vw, 13rem)`. Hairlines (`1px ink/15%`) divide
  sections instead of cards and shadows. Corners are square or 2px.
- **Labels**: every section opens with a mono index (`01 — INTRO`) to give an instrument-panel reading order.
- **Motion budget**: on load, the hero headline lines and the illustration stroke draw-in (about 1.6s).
  Everything else runs only when it enters the viewport or as the user scrolls. Nothing loops, and only
  transform, opacity, clip-path and stroke-dashoffset are animated.
- **Data honesty**: every number on the page comes from `/api/v1/public/network-preview`
  (simulated readings), and the page says so. If the API is unreachable, metrics show "—" and the
  network shows a static diagram with the caption "Live preview unavailable — start the PowerPulse server".
  The fault sequence is labelled as an illustrative diagram of the rule flow, not live data.
- **Copy honesty**: detection is rule-based threshold evaluation on simulated sensor readings.
  The page makes no ML, AI-prediction or real-IoT claims.

## 4. Tokens added or changed (`frontend/src/styles/tokens.css`)

- Typography: `--font-display` / `--font-body` / `--font-mono` (unchanged families, fuller
  fallbacks), tracking (`--tracking-display`, `--tracking-tight`, `--tracking-label`), leading
  (`--leading-display`, `--leading-body`), `--text-lead`, `--text-body-lg`. Display clamp minimums were
  lowered slightly so long display lines wrap cleanly at 375px without overflow.
- Motion: `--ease-reveal`, `--dur-reveal`, `--stagger-line` (mirrored as JS constants in
  `pages/landing/motion/tokens.ts`).
- Layout: `--section-y`, `--header-h`.
- Tailwind token names are unchanged.
