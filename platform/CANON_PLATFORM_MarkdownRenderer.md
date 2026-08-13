# SoftwareOne Marketplace — Platform HTML/Markdown Renderer

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-08-13
> **Status:** Draft

---

## Purpose

This document captures the observed rendering behaviour of the SoftwareOne Marketplace platform's HTML/Markdown renderer. It is a reference for anyone authoring content that is rendered by the platform — including Product long descriptions, Templates, and any other object that accepts HTML or Markdown string content.

**Canon principle:** This document records only confirmed, observed behaviour. Nothing here is inferred from theoretical CSS or HTML specifications. If it has not been observed in practice, it is not documented here.

---

## 1. Scope

The renderer is a platform-wide component. It is not specific to any single object type. The same renderer is used wherever the platform renders HTML or Markdown string content.

**Confirmed observation contexts:**
- `Catalog: Product` — `longDescription` field (rendered on the Product page)
- `Catalog: Product Template` — `content` field (rendered on Order, Agreement, Asset, and Subscription objects)

Every context uses the same shared renderer, so behaviour observed in one holds in the others. Observations made in either context are treated as platform-wide facts.

---

## 2. Rendering Environment

| Property | Observed Value | Notes |
|----------|---------------|-------|
| Background colour | `#f4f6f8` | The renderer surface background. Content authors should design with this background in mind. |
| Maximum content width | No platform-enforced maximum | Authors typically constrain width using `max-width` on outer container divs. |
| Typical authored max-width | `1000px` for content sections; up to `1600px` for hero banners | Convention only — not enforced by the platform. |
| Outer margin pattern | `margin: 48px auto` | Conventional spacing between sections. |

---

## 3. Supported HTML Elements

The following HTML elements have been observed to render correctly:

| Element | Notes |
|---------|-------|
| `<div>` | Primary layout element. Reliable. |
| `<img>` | Reliable. See Section 7 for image-specific behaviour. |
| `<table>` | Reliable for layout. Preferred over flexbox for equal-height columns. See Section 6.2. |
| `<tr>` | Reliable within `<table>`. |
| `<td>` | Reliable. See Section 6.3 for critical carriage return requirement. |
| `<h1>` | Reliable. |
| `<h2>` | Reliable. |
| `<p>` | Reliable. |
| `<a>` | Reliable. Standard href linking behaviour observed. |
| `<br />` | Reliable for line breaks within content. |

**Elements not listed above:** Treat as unconfirmed until observed — do not assume support based on general HTML standards. Two separate constraints apply: the renderer's permitted list (Section 9.2, wider than this table) decides whether an element survives at all, and observation decides whether it renders reliably. An element outside the permitted list is removed along with its contents.

---

## 4. Inline Styles

Inline styles are supported. External CSS stylesheets and CSS classes are not — a `class` attribute is removed from the content rather than merely ignored.

All styling must be applied via the `style` attribute directly on the element. Section 9.4 lists which declarations are permitted.

---

## 5. CSS Properties — Confirmed Behaviour

### 5.1 Reliable Properties

The following CSS properties have been observed to work correctly:

| Property | Notes |
|----------|-------|
| `background` | Solid colours, `rgba()`, and `linear-gradient()` all work. |
| `color` | Reliable. |
| `font-size` | Reliable. |
| `font-weight` | Reliable. |
| `line-height` | Reliable. |
| `margin` | Reliable on block elements. See Section 5.2 for inline image margin behaviour. |
| `padding` | Reliable. |
| `border` | Reliable. |
| `border-radius` | Reliable. |
| `border-left` | Reliable. Useful for visual dividers between columns. |
| `box-shadow` | Reliable. |
| `text-align` | Reliable. |
| `width` | Reliable. Percentage widths work for column layouts. |
| `max-width` | Reliable. |
| `min-height` | Reliable. Useful for vertical alignment in multi-column layouts. |
| `box-sizing: border-box` | Reliable. Essential when using percentage widths with padding. |
| `position: relative` | Reliable. |
| `position: absolute` | Reliable. Used for hero banner overlay positioning. |
| `inset: 0` | Reliable shorthand for `top:0; right:0; bottom:0; left:0`. |
| `transform: translateY()` | Reliable. Used for vertical centring of absolutely positioned elements. |
| `overflow: hidden` | Reliable. |
| `opacity` | Reliable. |
| `backdrop-filter: blur()` | Reliable. Used for frosted glass card effects. |
| `-webkit-backdrop-filter: blur()` | Reliable. Include alongside `backdrop-filter` for broader compatibility. |
| `linear-gradient()` | Reliable. Used for hero overlay gradients. |
| `display: block` | Reliable. |
| `display: inline-block` | Reliable. Primary method for multi-column layouts. See Section 6.1. |
| `display: table` | Reliable. Used for equal-height column layouts. See Section 6.2. |
| `display: table-cell` | Reliable. Used in combination with `display: table`. |
| `vertical-align` | Reliable on `inline-block` and `table-cell` elements. |
| `white-space: nowrap` | Reliable. |

### 5.2 Unreliable or Non-Functional Properties

| Property | Observed Behaviour |
|----------|-------------------|
| `display: flex` | Unreliable. Flexbox layout cannot be depended upon. Do not use for layout. |
| `align-items` | Non-functional without reliable flexbox support. |
| `justify-content` | Non-functional without reliable flexbox support. |
| `display: grid` | Not confirmed. Treat as unsupported. |
| `margin` on inline `<img>` | Never applies — the renderer ignores the whole `style` attribute on an `<img>`. See Section 7. |

**Note:** flexbox and grid are permitted by the filter (Section 9.4), so their unreliability is a rendering matter with no established cause. Use the Section 6.1 and 6.2 patterns instead.

---

## 6. Layout Patterns

### 6.1 Multi-Column Layout with `inline-block`

The standard pattern for multi-column layouts uses `display: inline-block` on column divs inside a `font-size: 0` container. The `font-size: 0` removes whitespace gaps between `inline-block` elements that would otherwise cause columns to wrap unexpectedly.

```html
<div style="font-size:0;">
  <div style="display:inline-block; vertical-align:top; width:50%; font-size:14px; box-sizing:border-box;">
    <!-- Column 1 -->
  </div>
  <div style="display:inline-block; vertical-align:top; width:50%; font-size:14px; box-sizing:border-box;">
    <!-- Column 2 -->
  </div>
</div>
```

**Critical:** `box-sizing: border-box` is required on each column when padding is present. Without it, padding adds to the declared width and causes the total to exceed 100%, wrapping the second column to a new line.

**Known limitation:** `inline-block` columns do not stretch to equal height. If equal height is required, use the `display: table` pattern (see Section 6.2).

### 6.2 Equal-Height Column Layout with `display: table`

When equal-height columns are required, wrap columns in a `display: table` container and set each column to `display: table-cell`. This produces reliable equal-height behaviour without flexbox.

```html
<div style="display:table; width:100%; table-layout:fixed;">
  <div style="display:table-cell; width:30%; box-sizing:border-box;">
    <!-- Column 1 -->
  </div>
  <div style="display:table-cell; width:2%;">
    <!-- Spacer -->
  </div>
  <div style="display:table-cell; width:68%; box-sizing:border-box;">
    <!-- Column 2 -->
  </div>
</div>
```

**Important:** `display: table-cell` elements do not support `margin`. Use a dedicated empty spacer cell to create gaps between columns. Apply spacing via `padding` rather than `margin` within cells.

**Column width budget:** All column widths and spacer widths must sum to exactly 100%.

### 6.3 Critical: Carriage Returns in `<td>` Elements

Content inside `<td>` elements must be wrapped with carriage returns to render correctly. Without carriage returns, content may not render as expected.

**Correct pattern:**
```html
<td>
  {content}
</td>
```

**Incorrect pattern (may not render):**
```html
<td>{content}</td>
```

This requirement applies to all `<td>` elements regardless of content type.

### 6.4 Hero Banner Pattern

The hero banner uses absolute positioning to layer a gradient overlay and a frosted glass content card over a background image.

Key structural elements:
- Outer container: `position: relative; overflow: hidden`
- Background image: `width: 100%; height: auto; display: block`
- Gradient overlay: `position: absolute; inset: 0`
- Content card: `position: absolute; top: 50%; transform: translateY(-50%)`

The frosted glass effect on the content card uses `backdrop-filter: blur()` and a semi-transparent `background: rgba()`.

---

## 7. Image Behaviour

| Property | Observed Behaviour |
|----------|-------------------|
| `width` and `height` attributes | Reliable, and the only way to size an image. Set them as HTML attributes on the `<img>` tag. The same values written as inline styles have no effect. |
| `style` attribute on `<img>` | Ignored in full — `display: block`, `margin: 0 auto` and `margin` all have no effect. To centre an image, wrap it in a `<div style="text-align:center;">`; for spacing, apply `padding` to a wrapper div. |
| Asset URLs | Product Media assets are referenced via the platform Media endpoint URL. Format: `/public/v1/catalog/products/{PRD-id}/media/{MED-id}/image` |
| Retina / HiDPI | The conventional approach is to upload source assets at 2× the intended rendered size. A 40×40px rendered icon should be uploaded at 80×80px. Set the rendered size with the `width` and `height` attributes. |
| Full-width banners | Images are capped at their container's width and keep their proportions, so a 2× banner fills the container rather than overflowing it. A source narrower than its container will not stretch to fill it. |

---

## 8. Bullet Lists

### 8.1 Markdown Bullets vs HTML `<ul>`

HTML list elements (`<ul>`, `<ol>`, `<li>`) produce inconsistent rendering and should be avoided.

**Observed reliable alternatives:**

**Option A — Markdown bullets (preferred for simple lists):**
Use the `*` or `-` markdown character followed by a space. These render reliably as bullet points.

```
* First item
* Second item
* Third item
```

**Option B — Manual bullet character with `<br />`:**
Use the bullet character `•` with explicit line breaks. Reliable when markdown is not appropriate or when mixing with HTML layout.

```html
• First item<br />
• Second item<br />
• Third item
```

**Option C — Structured div per item (preferred for heading + description pairs):**
When each bullet has a heading and a description, use a div-per-item structure rather than a list element.

```html
<div style="margin-bottom:16px;">
  <div style="font-weight:500; margin-bottom:4px;">Item heading</div>
  <div style="color:#434952; opacity:0.8; line-height:1.4;">Item description.</div>
</div>
```

### 8.2 Recommendation

Exhaust markdown bullets and manual bullet characters before reaching for HTML list elements. HTML `<ul>` and `<li>` are not confirmed as reliably supported and should be treated as unsupported until confirmed.

**Note:** `<ul>`, `<ol>` and `<li>` are permitted by the filter (Section 9.2), so their inconsistency is a rendering matter. The renderer applies its own list spacing and bullet style, which overrides authored list styling.

---

## 9. What the Renderer Removes

### 9.1 How filtering works

The renderer checks authored HTML against a list of what is permitted and removes everything else. Removal is silent: no error, no placeholder, no gap in the page. Sections 1–8 tell you which markup *renders well*; this section tells you which markup *survives at all*.

Filtering exists because a stored description is rendered in every reader's browser, so markup that can run code or pull in content from elsewhere is not permitted.

If a description does not look the way it was authored, Section 9.4 lists the style declarations most often responsible.

### 9.2 Elements that are kept

`a`, `abbr`, `b`, `blockquote`, `br`, `caption`, `cite`, `code`, `col`, `colgroup`, `dd`, `del`, `details`, `dfn`, `div`, `dl`, `dt`, `em`, `figcaption`, `figure`, `h1`–`h6`, `hr`, `i`, `img`, `ins`, `kbd`, `li`, `mark`, `ol`, `p`, `pre`, `q`, `rp`, `rt`, `ruby`, `s`, `samp`, `section`, `small`, `span`, `strong`, `sub`, `summary`, `sup`, `table`, `tbody`, `td`, `tfoot`, `th`, `thead`, `time`, `tr`, `u`, `ul`, `var`, `wbr`

Every element Section 3 records as reliable is kept. Anything else is removed along with everything inside it.

**Removed on purpose** — these run code or pull in content from elsewhere: `script`, `style`, `iframe`, `object`, `embed`, `link`, `meta`, and form fields such as `input`, `button`, `select` and `textarea`.

**Also removed** — not permitted, though nothing about them is dangerous: `article`, `header`, `footer`, `nav`, `aside`, `main`, `video`, `audio`, `svg`. If you have a use for one of these, it can be added. Raise it rather than working around it.

### 9.3 Attributes that are kept

| Attribute | Rule |
|-----------|------|
| `align`, `alt`, `colspan`, `datetime`, `dir`, `lang`, `rowspan`, `title` | Kept as written. |
| `href` | Must start with `http://`, `https://`, `mailto:` or `tel:`, or be a relative link. |
| `src` | See Section 9.5. |
| `style` | Checked one declaration at a time. See Section 9.4. |
| `role` | Only `presentation`, `none` or `img`. `role="presentation"` is the correct choice on the layout tables in Section 6.2. |
| `width`, `height` | Kept. On images these are the only sizing that has any effect — see Section 7. |

**Removed:** anything that reacts to user actions (`onclick`, `onerror`, `onload` and every other `on…` attribute), plus `class`, `id` and `data-…`.

### 9.4 Inline styles

Each declaration is checked on its own. An unsupported one is dropped and the rest of the `style` attribute still applies, so a single bad declaration will not flatten the whole element.

**Kept** — the full permitted list, a superset of what Sections 5.1, 6 and 7 record as reliable:

- Spacing and size: `margin` and `padding` (including the per-side versions), `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`, `box-sizing`, `overflow` and its `-x`/`-y` versions
- Text: `color`, `font-family`, `font-size`, `font-style`, `font-variant`, `font-weight`, `letter-spacing`, `line-height`, `text-align`, `text-decoration`, `text-indent`, `text-overflow`, `text-transform`, `white-space`, `word-break`, `overflow-wrap`, `list-style-type`, `vertical-align`
- Backgrounds and edges: `background`, `background-color`, `border` (including the per-side, colour, style and width versions), `border-radius`, `border-collapse`, `border-spacing`, `box-shadow`, `opacity`, `filter`, `backdrop-filter`, `-webkit-backdrop-filter`
- Layout: `display`, `table-layout`, the `flex` and `grid` families, `gap`, `row-gap`, `column-gap`, `align-items`, `align-self`, `justify-content`, `justify-items`, `justify-self`, `object-fit`, `object-position`
- Position: `position`, `top`, `right`, `bottom`, `left`, `inset`, `transform`, `transform-origin`

Values may use colours, numbers, keywords, quoted font names, `calc()`, `min()`, `max()`, `clamp()`, the gradient functions, `blur()` and the other filter functions, and the `translate` / `scale` / `rotate` transforms.

**What to check existing content for:**

| Not permitted | What to do instead |
|---------------|--------------------|
| `url(…)` in any style — background images, custom cursors, SVG filters | Use an `<img>` element. A style is never allowed to fetch a file; this is the single rule that keeps `background` and `filter` safe to permit at all. |
| `background-image`, `border-image`, `list-style-image`, `mask`, `cursor`, `content` | These exist only to load or generate content. Use an `<img>`, or plain text. |
| `z-index` | Order your markup instead — later elements paint on top. |
| Custom properties (`--my-colour`) and `var()` | Write the value directly. |
| `pointer-events`, `user-select` | No alternative; these change how the page responds to the reader and are not permitted. |
| CSS comments (`/* … */`), `@` rules, and backslash escapes | Remove them. They are rejected wherever they appear in a value. |

Positioning **is** permitted, including `position: fixed`. The renderer keeps positioned content inside the description's own area, so an overlay cannot cover the surrounding page even if it asks to. Every pattern in Section 6.4 works unchanged.

### 9.5 Image sources

Section 7 covers how images render; this covers which images the filter admits.

| Aspect | Behaviour |
|--------|-----------|
| Where the image may come from | Any `http://` or `https://` address, or a relative path. Platform Media URLs (Section 7) are the normal case. |
| Embedded images | A `data:` image is accepted for PNG, JPEG, GIF, WebP and AVIF. An embedded SVG is refused, because an SVG file can carry code. |
| Refused | `javascript:` and addresses starting `//`. An image with no usable address is removed entirely. |
| `onerror` and similar | Removed from the page and from the saved text. |

### 9.6 Permitted is not the same as reliable

The filter and the rendering are separate matters. `display: flex`, `display: grid` and HTML lists (`<ul>`, `<li>`) all pass the filter untouched, but Sections 5.2 and 8.2 record them as unreliable *to render*. Keep using the `inline-block` and `display: table` patterns in Section 6.

### 9.7 Known gaps

These are accepted, not solved. They are recorded here so nobody assumes the filter covers them:

| Gap | Detail |
|-----|--------|
| Images may be loaded from any address | Whoever controls that address can tell when a description was opened, and by roughly whom. Restricting images to platform addresses is proposed as RND-005. |
| Text can be hidden | `font-size: 0`, `opacity` and `color` can hide text from a reviewer while leaving it in the page. `font-size: 0` is required by the Section 6.1 layout, so it cannot be prohibited. Worth a look during content review. |
| Convincing-looking panels | Styling plus a link can produce something that looks like part of the platform. The renderer can confirm a link is a proper web address; it cannot judge whether it is honest. |
| Overlay of the editing toolbar | While editing, positioned content can cover the toolbar. It cannot reach beyond the editor. |

### 9.8 Guardrails

The lists above are covered by automated tests, including the layout patterns in Sections 6.1, 6.2 and 6.4. If a pattern documented here stops working, that is a defect in the renderer rather than a fault in the pattern, and worth raising as one.

---

## 10. Open Questions

| ID | Question | Priority |
|----|----------|----------|
| RND-001 | Is there a documented character or size limit for the `longDescription` field on `Catalog: Product`? No limit has been observed in practice but none has been confirmed as absent. | Medium |
| RND-003 | Does `display: grid` render reliably? It is permitted (Section 9.4) but untested. Someone needs to author a grid layout and look at the result. | Low |
| RND-004 | Do the permitted semantic elements (`<section>`, `<figure>`, `<details>`) render reliably? Untested. `<article>`, `<header>`, `<footer>`, `<nav>` and `<aside>` are not permitted (Section 9.2) — should any of them be? | Low |
| RND-005 | Should images be restricted to platform addresses? Section 7 documents only platform Media URLs, but any address is accepted (Section 9.7). Needs a decision from the platform owners. | Medium |
| RND-006 | Should images render as blocks by default? Because `style` on an `<img>` has no effect, a full-width banner sits on a text line rather than on its own. The renderer could apply this itself, but it would also affect images placed mid-sentence. | Medium |
| RND-007 | Do any stored descriptions rely on markup the renderer removes? A scan of `longDescription` and Template `content` values for `url(`, `<iframe`, `<video`, `class=` and `z-index` would size it. Not yet checked. | High |

---

## Version History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-14 | Stu | Initial draft. Observations sourced from Product long description authoring sessions for Adobe VIP Marketplace and SoftwareOne Cloud Managed Services Essentials for AWS. |
| 0.2 | 2026-08-13 | Guilherme Meireles | Section 9: what the renderer removes — permitted elements, attributes and style declarations, image sources, and known gaps. Corrected Sections 5.2 and 7 to record that the `style` attribute on an `<img>` is ignored in full, and added image auto-sizing behaviour. Resolved RND-002 (CSS custom properties are removed) into Section 9.4 and added RND-005 to RND-007. |
