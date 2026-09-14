# Design Document
## WELL LUPS AUTO TYRES LIMITED — Platform

## 1. Principles

- **Original.** Nothing in the visual design, copy, or layout is drawn from any other site. The brand, voice, and interface are distinctly WELL LUPS' own.
- **Clean, modern, creative, professional — at large.** This standard applies across the entire frontend, not just the homepage: every page, every state (empty, loading, error), and every interaction should meet it.
- **Goods and services on equal footing.** Navigation, homepage layout, and search treat "Book a Service" with the same visual weight as "Shop Products."
- **Familiar structure, distinctive execution.** Customers should intuitively understand how to browse and buy; the visual language, motion, and layout choices are what make the site feel like WELL LUPS specifically.
- **Mobile-first.** Most traffic will arrive on mobile; every layout decision is validated there first.

## 2. Brand Foundation

- **Logo:** wordmark "WELL LUPS AUTO TYRES LIMITED" with a tyre graphic, in blue with a black subtitle line, on a white background.
- **Palette:** blue and white as the core brand colors.

**Extracted palette:**

| Token | Hex | Role |
|---|---|---|
| `primary` | `#045CB4` | Core brand blue — primary buttons, links, active states |
| `primary-dark` | `#043D8B` | Hover/pressed state for primary blue |
| `navy` | `#144177` | Deep accent — headers, footer, dark UI sections |
| `blue-muted` | `#658EBE` | Secondary accent — tags, subtle backgrounds, info states, disabled-primary |
| `background` | `#F1F0EF` | Page background (off-white, matches logo canvas — avoid pure white) |
| `text-primary` | `#1A1B1B` | Body text, headings |
| `text-secondary` | `#777878` | Secondary text, borders, dividers |

Note: `#0253BC` was also present in the extracted palette and is nearly identical to `primary` (`#045CB4`) — recommend treating `#045CB4` as the single canonical primary blue and dropping `#0253BC` rather than carrying two near-duplicate blues through the system, unless a specific use (e.g. a distinct focus-ring color) is intended for it.

## 3. Design System Foundations

To be built out in parallel with backend development, once the exact brand colors are extracted:

- **Color:** primary blue (from logo), white, and a small set of supporting neutrals (grays for text/borders) and functional colors (success/error/warning states, stock-status indicators).
- **Typography:** a clear two-tier type system — a distinctive display typeface for headings that reflects the brand's character, paired with a highly legible body typeface. Both need to perform well at small sizes on mobile.
- **Spacing & grid:** a consistent spacing scale (e.g. 4px/8px base) applied uniformly across components, not per-page improvisation.
- **Components:** built once, reused everywhere — buttons, cards, form fields, badges (stock status), modals, the two equal-weight "Shop" / "Book a Service" entry points, and the review/rating display.
- **Motion:** restrained, purposeful use of transitions — page/route transitions, add-to-cart/wishlist feedback, form validation states — never decorative for its own sake.
- **Imagery style:** consistent treatment for product photography and any hero/marketing imagery, defined before content population begins.

## 4. Site Map

```
Home
├── Shop & Services
│   ├── Products
│   │   ├── Category listing
│   │   │   └── Product detail page
│   │   └── Search results
│   ├── Services
│   │   ├── Service listing (by vehicle type)
│   │   │   └── Service detail + booking
│   │   └── Search results (shared index with products)
│   └── Vehicle filter
├── My Vehicle
├── Wishlist
├── Cart / Checkout
├── Service Booking
├── Reviews (embedded in product/service pages)
├── Branches / Contact
├── Warranty & Returns
├── About
└── Staff / Admin (not public)
    ├── Login
    ├── POS
    ├── Stock management
    ├── Bookings queue
    └── Reports
```

## 5. Key Pages

**Home** — hero built around the brand palette and tyre motif, with "Shop Products" and "Book a Service" given equal visual weight; featured products and popular services shown side by side; vehicle-filter entry point; persistent WhatsApp contact.

**Shop / category / product pages** — category grid, vehicle filter, product cards with stock-status badges and wishlist toggle, product detail with comparison and reviews.

**Services** — service cards matching the visual treatment of product cards (not a plain list), service detail with reviews and a booking action styled with the same prominence as "Add to Cart."

**Cart / checkout** — pickup-or-delivery choice, M-Pesa or pay-in-shop/pickup.

**Service booking form** — vehicle, service, branch, preferred date; in-shop payment stated clearly on-screen.

**Staff / admin** — POS screen for fast in-shop checkout; stock view with cost/margin visible to Admin/Owner only; booking queue with status controls; daily/monthly reporting.

## 6. Content Dependencies

- Full product and service data (pending).
- Branch addresses, contact numbers, hours.
- Warranty/returns policy wording.
- Delivery area and fee structure.

## 7. Accessibility & Usability

- Large mobile tap targets throughout, especially the two primary homepage actions.
- High-contrast text suitable for outdoor/bright-screen viewing.
- Short, focused checkout and booking forms — every additional field is a drop-off risk on mobile data.
