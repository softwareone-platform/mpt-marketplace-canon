# SoftwareOne Marketplace — Platform HTML/Markdown Renderer

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft — based on observed behaviour only

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

There is no reason to believe renderer behaviour differs between these contexts. Observations made in either context are treated as platform-wide facts.

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

**Elements not confirmed as safe:** Any element not listed above should be treated as unconfirmed until observed. Do not assume support based on general HTML standards.

---

## 4. Inline Styles

Inline styles are supported. External CSS stylesheets are not supported. CSS classes are not supported.

All styling must be applied via the `style` attribute directly on the element.

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
| `margin` on inline `<img>` | Unreliable. Margin applied directly to an `<img>` tag may not render as expected. Wrap images in a `<div>` and apply margin or padding to the wrapper instead. |

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
| `width` and `height` attributes | Reliable when set directly on the `<img>` tag. Always set both `width` and `height` as HTML attributes AND as inline style values for maximum compatibility. |
| `display: block` | Reliable. Use on images to remove inline spacing artefacts. |
| `margin: 0 auto` on `<img>` | Unreliable for centring. Wrap the image in a `<div style="text-align:center;">` instead. |
| `margin` directly on `<img>` | Unreliable. Apply spacing via a wrapper div using `padding` instead. |
| Asset URLs | Product Media assets are referenced via the platform Media endpoint URL. Format: `/public/v1/catalog/products/{PRD-id}/media/{MED-id}/image` |
| Retina / HiDPI | The conventional approach is to upload source assets at 2× the intended rendered size. A 40×40px rendered icon should be uploaded at 80×80px. |

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

---

## 9. Open Questions

| ID | Question | Priority |
|----|----------|----------|
| RND-001 | Is there a documented character or size limit for the `longDescription` field on `Catalog: Product`? No limit has been observed in practice but none has been confirmed as absent. | Medium |
| RND-002 | Are CSS custom properties (`var()`) supported? Not yet tested. | Low |
| RND-003 | Is `display: grid` supported? Not yet tested. | Low |
| RND-004 | Are HTML5 semantic elements (`<section>`, `<article>`, `<header>`) supported? Not yet tested. | Low |

---

## Version History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-14 | Stu / Claude | Initial draft. Observations sourced from Product long description authoring sessions for Adobe VIP Marketplace and SoftwareOne Cloud Managed Services Essentials for AWS. |
