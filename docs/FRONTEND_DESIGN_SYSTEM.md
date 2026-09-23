# Frontend Design System — Well Lups Auto Tyres Limited

## 1. Purpose + boundaries

This document is the single contract for all frontend work. Three
related surfaces share one brand language, one design system, one
accessible interaction language, and one data-safety model:

- public marketing UI (homepage and brand surfaces),
- customer transactional UI (catalog, quote, booking, tracking),
- operational Admin UI (utility screens for staff).

DESIGN RULE vs BUSINESS DATA: everything in this document governs
visuals and interaction only. It never authorizes a business value.

"The prototype is a visual/interaction reference only. Production
business data comes from the application/database/configuration."

## 2. Prototype as visual reference

`prototype/welllups.html` (plus `prototype/images/`) is the accepted
visual/motion direction: quote-based commerce ("Get a Quote" via
WhatsApp, no listed prices) and the motion set (hero roll-in, featured
carousel, parallax road scene). The prototype covers only the
homepage/catalog-grid view; it contains no tables, modals, validation,
pagination, breadcrumbs, detail pages, tracking flows, warranty terms,
or admin surface. Pages without a prototype reference translate the
same tokens and patterns to their own layout — they do not invent a new
visual language.

## 3. Typography

- Family: Plus Jakarta Sans everywhere (`--font-sans`), weights
  400/500/600/700/800. Technical/reference strings use `--font-mono`.
- PageHeader is the single heading pattern: eyebrow-free `h1`
  `text-3xl font-extrabold tracking-tight` with an optional
  `text-sm text-text-secondary` description for listing and admin
  pages. Detail/transactional pages (`products/[id]`, `services/[id]`,
  quote/booking tracking) use the compact `text-2xl font-extrabold`
  variant — an intentional density distinction, documented here.
- Body text: `text-sm` default, `text-xs` for secondary/meta,
  `text-text-secondary` for de-emphasized copy.
- Never use `text-[11px]` or other one-off sizes; never set
  `font-family` outside the token.

## 4. Colors/tokens

Canonical tokens live in `app/globals.css` (`@theme`) and are the only
source of color truth. Prototype palette, preserved exactly:

| Token | Value | Use |
|---|---|---|
| `primary` | `#045CB4` | Primary actions, links, focus ring |
| `primary-dark` / `primary-hover` | `#043D8B` | Primary hover |
| `primary-active` | `#032A6A` | Primary pressed |
| `navy` | `#144177` | Headings emphasis, admin session surfaces, dark sections |
| `blue-muted` / `secondary` | `#658EBE` | Tints (`/10`, `/15`), secondary accents |
| `background` | `#F1F0EF` | Page background |
| `card` / `input` | `#FFFFFF` | Surfaces, fields (never raw `white`) |
| `foreground` | `#1A1B1B` | Body/heading text (never `text-text-primary`) |
| `muted` | `#E8E9EC` | Subtle surface tint |
| `muted-foreground` | `#777878` | Secondary text (never `text-text-secondary`) |
| `border` | `#E0DFDD` | Dividers, card borders — prototype value wins |
| `ring` | `#045CB4` | Global `:focus-visible` outline |
| `success` | `#16A34A` | Confirmations, in-stock |
| `warning` | `#D97706` | Pending states, low-stock |
| `destructive` | `#DC2626` | Errors, danger actions |
| `info` | `#2563EB` | Informational badges/banners |
| `whatsapp` | `#25D366` | WhatsApp actions only |
| `overlay` | `rgba(10,25,47,0.6)` | Dialog/drawer scrims |
| `disabled` | `#CBD2D7` | Disabled fills |

`secondary` is an alias of `blue-muted`; `primary-hover` an alias of
`primary-dark`. No other duplicate values are allowed. Stock badges map
to `success`/`warning`/`neutral`. The legacy `landing.css` `:root`
block aliases these canonical values and must not define competing
ones. Never use raw hex, `rgb()/hsl()`, or `bg-white`/`text-white`
(except `primary-foreground`-mapped text on colored fills) in
components; SVG fills use currentColor or tokens.

## 5. Spacing

Container `mx-auto max-w-[1240px] px-4 md:px-10`; page vertical rhythm
`py-8 space-y-8`; admin queue cards `p-5`; form grid `gap-4`; control
rows `gap-2`. The landing preserves the prototype's wider section
rhythm (48-96px) and 64px nav via its stylesheet, mapped to the same
tokens.

## 6. Radius

The prototype is predominantly square. Canonical radii:

- `rounded-none` (0): cards, buttons, inputs, dialogs, banners — the default.
- `rounded-sm` (0.25rem): badges, chips, table wrappers.
- `rounded-full`: icon buttons, spinners, status dots, avatar-like marks.

`rounded-md`/`rounded-lg` and bare `rounded` are retired except inside
third-party primitives that cannot be restyled. One exception carried
from the prototype: the stock badge keeps its single-corner treatment
via the shared `StockBadge` style, not ad-hoc classes.

## 7. Shadows

Three levels, tokens `--shadow-sm/md/lg`:

- `sm`: raised controls on light surfaces (active filter tab).
- `md`: dialog and drawer elevation.
- `lg`: floating cards (hero quote card, FAB).

Product imagery uses the prototype `drop-shadow` treatment only inside
landing imagery. Never invent `box-shadow` literals; `shadow-sm/lg/xl`
utilities map to the three levels.

## 8. Buttons

The shared `Button` is the only button framework: variants
`primary` (solid brand), `secondary` (tint), `outline`, `ghost`,
`destructive`, `success`; sizes `sm/md/lg`; built-in `loading` spinner
with `aria-busy`. The prototype `.btn-*` language is expressed through
these variants, not a parallel CSS system. Icon-only buttons always
carry `aria-label`. Destructive actions always use the confirmation
dialog, never native `confirm()`. Never nest `<button>` inside `<a>`;
use `asChild` or a styled link.

## 9. Forms

Every field is a `FormField`: visible `Label`, `Input`/`Textarea`/
`Select`, helper text, validation message, loading and error states.
Placeholder text is never the only label — every input has a label or
`aria-label`. Filter/search inputs use the same anatomy at `sm` scale.
Validation messages sit under the field in `text-destructive`; they are
never `alert()` popups. No new business validation rules live in this
document.

## 10. Cards

Public cards speak the prototype square language: `rounded-none`,
`1px solid border`, image/media block, category eyebrow, title, spec,
footer action row, hover inset-ring (`0 0 0 2px primary`) — no lifted
shadow hover. One `ProductCard`/`ServiceCard` implementation serves the
homepage, `/products`, and `/services`. Admin panels keep the utility
`Card` (same radius/border, `p-5`, no marketing hover) — deliberately
operational, not promotional.

## 11. Tables/lists

Admin data uses whichever fits density: native `<table>` for rosters,
catalogs, and import previews; card lists for quote/booking queues.
Both share header treatment, `rounded-sm` wrappers, and horizontal
`overflow-x-auto` on small screens. Never present two patterns for the
same dataset on sibling screens without a density reason, documented at
the call site.

## 12. Badges/status

`Badge` tones: `primary`, `secondary`, `info`, `success`, `warning`,
`error`, `neutral`, `outline`. Stock maps `in→success`,
`low→warning`, `out→neutral`. Quote/booking statuses map through one
helper per flow (`new→warning`, `quoted/under_review→info`,
`accepted/scheduled/completed→success`, `declined/cancelled→neutral`).
Status is never color alone — every badge carries text.

## 13. Dialogs

Radix `Dialog` is the only dialog system. Anatomy: `DialogTitle`,
description, form or message body, footer with cancel + primary action,
inline error (never `alert()`), loading via `Button loading`. Mobile
drawer uses the same primitive (focus trap, focus return, Escape,
overlay dismissal, `aria-modal`). Destructive or irreversible actions
use `ConfirmationDialog` (title, description, confirm/cancel, loading,
error). Modal content caps height and scrolls internally on small
screens.

## 14. Empty states

`EmptyState` (heading, body, optional action) with `CatalogEmptyState`
for the public catalog. Admin and tracking surfaces reuse it. Three
states are visually distinct and never confused: EMPTY (neutral panel,
honest copy), UNAUTHORIZED (access-denied panel), ERROR (destructive
panel, `role="alert"`). A failed protected read is never rendered as an
empty state.

## 15. Error states

`ErrorState`: `role="alert"`, title, plain-language message, optional
retry action, consistent `rounded-none` panel in `destructive` tint.
User-facing copy never exposes SQL internals, table names, or query
text. Field errors stay attached to their `FormField`.

## 16. Success states

Success banners share the `success`-tint panel anatomy with ErrorState
(without `role="alert"`). Toasts (`wl:toast`) are for lightweight
confirmations of completed actions only — never for fake interactions.

## 17. Loading states

`LoadingState`: one spinner (`border-primary`, `aria-hidden`) plus
optional text. Page-level loads use it; the app root provides
`loading.tsx`. Skeletons/pulse blocks are allowed only for multi-region
page loads (catalog search/filter). No plain-text-only loaders.

## 18. Responsive rules

Breakpoints 900px and 560px (prototype reference). grids collapse
(3→2→1 as density demands), CTAs go full-width under 560px, admin
sub-nav scrolls horizontally, tables scroll inside their wrapper,
dialogs cap at `max-h-[90dvh]` with internal scroll, the drawer is full
height. No horizontal page overflow at 390px, 768px, or 1440px.

## 19. Accessibility

Semantic headings (one `h1` per page), visible labels, keyboard-
reachable controls, global `:focus-visible` ring, trapped dialogs with
Escape and focus return, `role="alert"` on errors, meaningful alt text
(never empty `alt` on a brand mark), decorative counts hidden from
assistive tech. Contrast is claimed only when tooling measures it.

## 20. Imagery

Real photos only where the database supplies them; otherwise the
neutral placeholder block (no fake product renders, no brand marks
presented as product). Prototype photos in `public/images/` are the
approved treatment reference for when real imagery lands.

## 21. Motion

Animate `transform` and `opacity` only. Keep the accepted prototype
motion: hero roll-in, featured carousel spring, road-scene cruise with
scroll boost, drawer slide, 0.15s hover transitions. Everything sleeps
off-screen and disables under `prefers-reduced-motion`. No decorative
animation on transactional or admin screens.
