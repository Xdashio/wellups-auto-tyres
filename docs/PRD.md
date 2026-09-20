# Product Requirements Document
## WELL LUPS AUTO TYRES LIMITED — Platform

## 1. Overview

WELL LUPS AUTO TYRES LIMITED operates two branches selling tyres and auto parts, and performs garage services (installs, repairs, alignments, and others) on request, with service scope and pricing varying by vehicle type. The platform gives the business a single, original, professionally designed online presence that unifies retail and service operations for both customers and staff.

This is a custom build. The frontend must be clean, modern, creative, and professional at every level of execution — not a generic or templated e-commerce look.

## 2. Objectives

- Establish strong search visibility for the business, through both traditional SEO and AI Engine Optimization (AI EO) for AI-driven answer engines.
- Present goods and services as equally weighted offerings — a customer visiting for a service should have as clear and prominent a path as one shopping for parts.
- Support both online and in-shop transactions: customers may purchase goods online, and services are booked online but paid for in-shop.
- Give staff a POS and back-office system to record sales, manage stock, and track profit margin per item.
- Support hybrid order fulfillment — pickup and delivery.

## 3. Users & Roles

| Role | Description |
|---|---|
| **Customer** | Browses goods and services, places orders, books services, manages an account (wishlist, saved vehicles, order/booking history) |
| **Cashier** | Processes in-shop sales via POS, views stock for their branch, updates booking status |
| **Manager** | Business-level visibility across both branches — reporting and oversight |
| **Admin** | Full system access — stock, pricing, margin data, staff management, both branches |

**Needs input from client:** exact permission boundaries between Manager and Admin (e.g., whether Manager has the same system-configuration rights as Admin, or a reporting-only superset of Cashier access).

## 4. Functional Requirements

### 4.1 Public storefront
- A unified catalog presenting products and services as equally prominent, independently browsable categories — not services nested under a secondary or optional path.
- Search across both products and services by name, size, brand, or service type.
- Product detail pages: image, price, live stock status, specification, customer reviews.
- Service detail pages: description, price or "quote on inspection" where pricing depends on vehicle type, customer reviews, and a booking action with the same visual weight as "Add to Cart."
- A vehicle filter (make / model / year / trim) to narrow product results.
- A "My Vehicle" saved profile, so returning customers can reuse their vehicle details across the filter and service booking.
- A wishlist for saved products.
- A product comparison tool (2–3 items side by side).
- Cart and checkout for goods, supporting M-Pesa payment and a pay-in-shop / pay-on-pickup option.
- A service booking flow: customer selects a service, vehicle type, preferred branch, and preferred date; the request is confirmed via the branch, and payment is always collected in-shop after the service is performed.
- Hybrid fulfillment: customer chooses pickup or delivery at checkout.
- Branch listings with contact details and a WhatsApp entry point.
- Warranty and returns policy pages.
- Technical SEO and AI Engine Optimization foundations: structured data (schema.org for Product, Service, LocalBusiness, Review), a machine-readable sitemap, plain-language descriptive content, and consistent business information site-wide, so both search engines and AI answer engines can accurately find and describe the business.

### 4.2 Staff / POS
- In-shop checkout that deducts stock automatically on sale.
- Stock visibility with low-stock indicators.
- Per-item cost price, sell price, and automatically computed margin.
- Daily and monthly sales and margin reporting.
- A booking queue for incoming service requests, with status updates (Scheduled → In Progress → Complete).
- Role-based dashboard views for Admin, Manager, and Cashier.

**Needs input from client:** whether stock is a single pool shared across both branches, or tracked separately per branch. This determines the data model for Product and Branch and cannot be finalized without an answer.

### 4.3 Notifications
- Automated order and booking status notifications via WhatsApp Business API.

### 4.4 Product & service data
- Full product catalog with pricing, categories, and stock levels.
- Full services list with pricing logic by vehicle type.

**Needs input from client:** both of the above — the client has indicated this data is ready but it has not yet been delivered.

## 5. Non-Functional Requirements

- Mobile-first responsive design.
- Fast load performance on mobile networks, supporting both user experience and SEO/AI EO goals.
- Role-based access control with HTTPS throughout.
- Maintainable by a small team without dedicated in-house engineering support.

## 6. Confirmed Feature Set

| Feature | In scope |
|---|---|
| Unified product + service catalog | Yes |
| Vehicle filter (make/model/year/trim) | Yes |
| "My Vehicle" saved profile | Yes |
| Wishlist | Yes |
| Product comparison tool | Yes |
| Customer reviews and ratings | Yes |
| Cart + checkout with M-Pesa | Yes |
| Service booking (in-shop payment) | Yes |
| Hybrid pickup/delivery | Yes |
| Warranty & returns pages | Yes |
| POS with automatic stock deduction | Yes |
| Per-item margin tracking | Yes |
| WhatsApp Business API notifications | Yes |
| SEO + AI Engine Optimization foundation | Yes |
| Native mobile app | No — explicitly excluded |
| Multi-currency support | No — explicitly excluded (KES-only) |

## 7. Success Criteria

- The site is live, fully indexable, and reflects the brand identity (logo, blue/white palette) through an original and distinctive design.
- Staff can complete an in-shop sale with stock and margin updating automatically.
- Customers can complete a purchase or a service booking with equal ease.
- All features in the confirmed set are functional at launch.
- The frontend reads as a clean, modern, professional product — not a stripped-down or templated site.
- Both search engines and AI answer engines can accurately surface and describe the business.
