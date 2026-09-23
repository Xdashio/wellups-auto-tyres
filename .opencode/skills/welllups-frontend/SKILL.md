---
name: welllups-frontend
description: Governs all frontend/UI work for Well Lups Auto Tyres Limited. Use whenever working on public website UI, catalog UI, quote UI, booking UI, Admin UI, responsive behavior, accessibility, visual polish, design-system work, frontend component creation, or prototype parity.
---

# Well Lups Frontend

Permanent project-local UI contract for Well Lups Auto Tyres Limited.
The purpose is NOT to force every page to look identical. The purpose is:

- ONE BRAND LANGUAGE
- ONE DESIGN SYSTEM
- ONE ACCESSIBLE INTERACTION LANGUAGE
- ONE DATA-SAFETY MODEL

with public marketing UI, customer transactional UI, and operational
Admin UI all intentionally related.

## 1. Visual reference vs business truth

Primary visual reference: `prototype/welllups.html` plus `prototype/images/`.
The prototype defines visual language, typography direction, color
direction, spacing, card treatment, button treatment, navigation
direction, responsive behavior, motion language, and imagery treatment.

The prototype DOES NOT define production business data. The current
application/database/configuration is the ONLY source of truth for real
business data. NEVER copy from the prototype: phone numbers, WhatsApp
numbers, addresses, branch names, opening hours, prices, products,
services, stock, ratings, years of experience, branch counts,
testimonials, payment claims, warranty claims.

Rule: REAL DATA WHEN AVAILABLE. EMPTY WHEN NOT. NEVER FABRICATED.

When implementing a public-facing feature: inspect the closest prototype
section, reproduce its visual hierarchy, translate the pattern into
reusable application components, replace all prototype business data
with real/dynamic application data, and verify the rendered result in
the browser. Never copy prototype HTML blindly into production.

## 2. Browser-first visual verification

For meaningful frontend changes, follow this workflow:

1. Inspect current implementation.
2. Inspect the prototype reference.
3. Run the application.
4. Open the affected route in the browser.
5. Inspect the rendered result.
6. Take screenshot(s).
7. Implement the change.
8. Re-open/reload the route.
9. Take before/after screenshots.
10. Verify responsive behavior.
11. Verify accessibility where applicable.
12. Run relevant tests.

Source inspection alone is NOT visual certification.

"Do not claim a visual fix is complete without rendered browser evidence
when the affected UI can be rendered."

## 3. Design system

- Typography: Plus Jakarta Sans.
- Primary `#045CB4`, primary dark `#043D8B`, navy `#144177`,
  blue muted `#658EBE`, background `#F1F0EF`, card `#FFFFFF`,
  text `#1A1B1B`, secondary text `#777878`, border `#E0DFDD`.
- Stock states: In Stock, Low Stock, Out of Stock (qualitative only).
- WhatsApp `#25D366`.
- Shape philosophy: predominantly square, minimal rounding, controlled
  shadows, 1px borders, strong spacing rhythm, clear type hierarchy.
- Reference spacing: max content width ~1240px, desktop horizontal
  padding ~40px, section spacing generally 48-96px, navigation ~64px,
  primary controls ~50px high.
- Reference breakpoints: 900px, 560px.
- Respect `prefers-reduced-motion`.

Use canonical tokens from `app/globals.css` (`@theme`) and the rules in
`docs/FRONTEND_DESIGN_SYSTEM.md` when it exists. Do not invent one-off
colors, radii, shadows, or font sizes when a shared token exists.

## 4. Components

Prefer shared reusable components for: PageHeader, Button, FormField,
Card, StatusBadge, EmptyState, ErrorState, LoadingState,
ConfirmationDialog, admin filter tabs, and data table/list wrappers
where justified. Do not create duplicate implementations of an existing
shared pattern without a clear reason.

Do not use native `confirm()` or `alert()` for product UI. Prefer
accessible application dialogs and feedback components (Radix Dialog
architecture).

Forms use visible Label plus Input/Textarea/Select, with validation
state, error message, loading state, and success state. Do not rely on
placeholder text as the only label.

## 5. Admin UI

The Admin UI is an operational utility interface. It should be visually
related to the public brand but must NOT simply copy marketing-page
layouts. Admin screens share page heading structure, navigation,
cards/panels, buttons, tabs, forms, error states, empty states, and
loading states. The Admin UI must feel like one product.

## 6. Public catalog

Public products/services are quote-based: no public prices unless the
current product contract explicitly says otherwise, no public
`cost_price`, no public margin, no exact stock quantity, qualitative
stock only, no fake catalog rows. Empty catalogue is valid — use honest
empty-state messaging. Never manufacture records to improve the visual
appearance.

## 7. Authorization

Visual hiding is NOT security. Preserve Supabase RLS, RPC
authorization, `verifiedStaffActor`, token-scoped reads, role
boundaries, financial projections, and protected admin views. Never make
protected data public merely to make the UI render.

## 8. Data-driven UI

Consume business data from the established sources. Do not hardcode
branch data, contact information, products, services, prices, stock, or
M-Pesa details. If a value is unavailable: omit it, show the approved
empty state, or disable/hide the dependent action. Do not invent
fallback business information.

## 9. Motion

Use motion deliberately. Preferred: `transform`, `opacity`. Respect
`prefers-reduced-motion`. Do not add animation merely for decoration.

## 10. Accessibility

For every frontend change consider: semantic HTML, visible labels,
keyboard access, focus state, focus trapping for dialogs, Escape
behavior, `aria-label` where necessary, `aria-expanded`, `aria-modal`,
`role="alert"` for important errors, meaningful alt text, and no status
communicated by color alone. Do not claim measured contrast unless a
browser/accessibility tool actually measured it.

## 11. Responsive

Check every significant UI change at desktop, tablet, and mobile. Watch
nav, grids, forms, dialogs, tables, buttons, cards, and admin
navigation. Prevent horizontal overflow, clipped controls, unusable
modals, broken table layouts, and overlapping buttons.

## 12. Code quality

Follow `docs/CODE_STANDARDS.md` and `docs/ARCHITECTURE.md`. Avoid God
Components, duplicated auth logic, duplicated design patterns, raw
Supabase calls in UI, inline business calculations in presentational
components, silent error swallowing, and arbitrary one-off styles when a
shared token exists.

---

FINAL RULES

Prototype = visual reference.
Database/application/configuration = business truth.
Browser-rendered evidence = visual verification.
Never fabricate business data.
Never weaken security for visual convenience.
