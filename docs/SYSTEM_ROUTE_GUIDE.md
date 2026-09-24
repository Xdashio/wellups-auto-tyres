# Well Lups Auto Tyres — Complete System Navigation & Operations Guide

This guide is written for the business operator to navigate, operate, and inspect the Well Lups Auto Tyres platform across all supported roles and customer journeys.

---

## How to Log In and Explore the System

### 1. Supported Roles
The platform implements three staff roles governed by Supabase Auth and PostgreSQL Row-Level Security (RLS):
1. **Admin** (`role: admin`): Full operational, inventory, financial, staff, and branch management authority.
2. **Manager** (`role: manager`): Operations, quote response, booking workflow, and POS counter sales. Financial margins and costs are hidden.
3. **Cashier** (`role: cashier`): POS in-shop counter checkout, receipt issuance, personal transaction review, and service booking completion. Catalog management, settings, and margins are inaccessible.

> [!NOTE]
> There is **no customer login role**. Customer interactions (browsing tyres, requesting quotes, booking workshop services, accepting/declining quotes) are conducted entirely through public storefront flows and secure, cryptographic single-use guest tokens.

### 2. Signing In During Development
When navigating internal surfaces (`/admin/*` or `/pos`), unauthenticated visitors are presented with the **Staff Authentication Required** panel. In development mode (`NODE_ENV=development`), quick one-click login buttons are provided directly on the interface:
- **Sign In as Admin** (`admin@test.local`)
- **Sign In as Manager** (`mgr@test.local`)
- **Sign In as Cashier** (`cashier@test.local`)

*(In production, staff enter their email and password issued via the Admin Staff Management panel.)*

---

## Complete Route Inventory

| Route | Purpose | Public / Private | Auth Required? | Allowed Role(s) | Primary User | Important Actions | Notes / Restrictions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Storefront Homepage | Public | No | Guest / All | Customer | Search tyres, view hero, explore services, see branch address & hours | No pricing rendered publicly |
| `/products` | Tyre & Parts Catalogue | Public | No | Guest / All | Customer | Keyword search, category filter, view tyre specs, request quote modal | Renders items where `status != 'discontinued'`. Prices hidden. |
| `/products/[id]` | Tyre / Product Details | Public | No | Guest / All | Customer | View full specifications, stock status badge, trigger quote request | Stock is qualitative (`In Stock`, `Low Stock`, `Out of Stock`) |
| `/services` | Workshop Services Catalogue | Public | No | Guest / All | Customer | Filter by vehicle type (Sedan, SUV, Pickup, Van), trigger booking modal | Lists services with `is_available = true` |
| `/services/[id]` | Service Details | Public | No | Guest / All | Customer | Read service description, compatible vehicles, book appointment | Guest booking creation |
| `/warranty` | Warranty & Returns Policy | Public | No | Guest / All | Customer | View tyre warranty terms, claims procedure, return conditions | Static informational page |
| `/quotes/[id]` | Guest Quote Tracker | Guest (Token) | Token Query (`?token=...`) | Guest (Token holder) | Customer | View staff quotation, offered price, validity period, Accept / Decline quote | Requires cryptographic `secret_token` from quote creation |
| `/bookings/[id]` | Guest Booking Tracker | Guest (Token) | Token Query (`?token=...`) | Guest (Token holder) | Customer | Track appointment status (`new`, `scheduled`, `completed`), view date/time | Requires cryptographic `secret_token` from booking creation |
| `/pos` | In-Shop Point of Sale Terminal | Private | Yes | Cashier, Manager, Admin | Cashier | Search active products, add to cart, adjust qty, atomic checkout (`pos_complete_sale`), print receipt | Financial costs and margins omitted. Out-of-stock items cannot be added. |
| `/admin` | Admin Index Redirect | Private | Yes | Admin, Manager, Cashier | Staff | Automatically redirects to `/admin/quotes` | Landing shortcut |
| `/admin/quotes` | Staff Quote Queue | Private | Yes | Admin, Manager (Mutate) / Cashier (Read-only) | Admin, Manager | Review customer requests, submit offered pricing (`staff_respond_to_quote`), set expiration date | Cashier has no pricing mutation privileges. |
| `/admin/bookings` | Workshop Booking Queue | Private | Yes | Admin, Manager (Full) / Cashier (Complete only) | Admin, Manager, Cashier | Filter by status/date, confirm appointment schedule, add workshop notes | Cashiers can only mark a `scheduled` booking as `completed`. |
| `/admin/products` | Single Product Catalogue | Private | Yes | Admin Only | Admin | View complete inventory (including cost & margin), Add Product modal, Edit, Delete | Manager and Cashier blocked by server action & RLS. |
| `/admin/products/import` | Bulk Product CSV Import | Private | Yes | Admin Only | Admin | Download CSV template, upload inventory batch, client validation, atomic upsert | Admin only. Rejects `SEED ` / `SAMPLE ` prefixes. |
| `/admin/services` | Service Management | Private | Yes | Admin Only | Admin | Create new service, edit vehicle types, toggle active availability, delete | Includes disabled services (unfiltered view). |
| `/admin/services/import` | Bulk Service CSV Import | Private | Yes | Admin Only | Admin | Bulk upload garage service catalogue via CSV | Admin only. |
| `/admin/staff` | Staff User Provisioning | Private | Yes | Admin Only | Admin | View staff roster, send invitations (`admin_invite_staff`), change roles, revoke invites, delete staff | Prevented from deleting the last admin. |
| `/admin/settings` | Branch & M-Pesa Settings | Private | Yes | Admin Only | Admin | Update physical branch details (name, address, phones) and active M-Pesa channels | Validated server-side via `admin_update_branch_settings` RPC. |

---

## Role Permissions Matrix

| Route / Feature | Guest / Public | Cashier | Manager | Admin | Notes / Enforcement |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Public Storefront** (`/`, `/products`, `/services`, `/warranty`) | ✓ | ✓ | ✓ | ✓ | Publicly accessible to all |
| **Request Quote** (`create_quote_request` RPC) | ✓ | ✓ | ✓ | ✓ | Unauthenticated guest RPC |
| **Book Service** (`create_service_booking` RPC) | ✓ | ✓ | ✓ | ✓ | Unauthenticated guest RPC |
| **View Quote via Token** (`/quotes/[id]?token=...`) | ✓ | ✓ | ✓ | ✓ | Requires quote secret token |
| **View Booking via Token** (`/bookings/[id]?token=...`) | ✓ | ✓ | ✓ | ✓ | Requires booking secret token |
| **POS Terminal** (`/pos`) | — | ✓ | ✓ | ✓ | StaffAuthGate (`cashier`, `manager`, `admin`) |
| **Execute POS Sale** (`pos_complete_sale` RPC) | — | ✓ (M) | ✓ (M) | ✓ (M) | Atomic stock decrement + ledger logging |
| **View Own Sales** (`sales_cashier`) | — | ✓ (R) | ✓ (R) | ✓ (R) | Cashier sees own sales; no cost/margin |
| **View Branch Sales** (`sales_manager`) | — | — | ✓ (R) | ✓ (R) | Manager sees branch revenue; no cost/margin |
| **View Financial Margins** (`sales_admin`, `sale_items_admin`) | — | — | — | ✓ (R) | Admin-only view with unit cost & item margin |
| **View Quotes Queue** (`/admin/quotes`) | — | ✓ (R) | ✓ (R) | ✓ (R) | Staff read access |
| **Price / Respond to Quotes** (`staff_respond_to_quote` RPC) | — | — | ✓ (M) | ✓ (M) | Cashier fails closed |
| **View Bookings Queue** (`/admin/bookings`) | — | ✓ (R) | ✓ (R) | ✓ (R) | Staff read access |
| **Schedule / Manage Bookings** (`staff_manage_booking` RPC) | — | Complete only | ✓ (M) | ✓ (M) | Cashier can only transition `scheduled` → `completed` |
| **Product Catalogue Management** (`/admin/products`) | — | — | — | ✓ (M) | Admin-only server action & `products_admin_write` RLS |
| **Product Bulk CSV Import** (`/admin/products/import`) | — | — | — | ✓ (M) | Admin-only server action & RLS |
| **Service Catalogue Management** (`/admin/services`) | — | — | — | ✓ (M) | Admin-only server action & `services_admin_write` RLS |
| **Service Bulk CSV Import** (`/admin/services/import`) | — | — | — | ✓ (M) | Admin-only server action & RLS |
| **Staff Provisioning** (`/admin/staff`) | — | — | — | ✓ (M) | Admin-only via `admin_*` security definer RPCs |
| **Branch & M-Pesa Settings** (`/admin/settings`) | — | — | — | ✓ (M) | Admin-only via `admin_update_branch_settings` RPC |

*Legend: `✓` = Allowed; `—` = Forbidden / Inaccessible; `R` = Read-only; `M` = Full Mutation capability.*

---

## Guided Walkthroughs

### 1. Public Customer Journey
1. **Landing**: Visit `/` to see the storefront, shop overview, and workshop service highlights.
2. **Search Products**: Click "Shop Products" or visit `/products`. Enter a tyre size (e.g. `265/65R17`) or click a category.
3. **Request a Quote**:
   - On `/products/[id]`, click **Request a Quote**.
   - Fill in your Name, Phone Number (e.g., `0712345678`), Quantity, and Notes in the dialog.
   - Click **Submit Request**.
   - You receive an immediate reference link: `/quotes/[quote-id]?token=[secret-token]`.
4. **Accepting Quotation**:
   - When the workshop responds with pricing, reload `/quotes/[id]?token=...` to see the offered price and validity date.
   - Click **Accept Quote** (or **Decline Quote**).
5. **Booking Workshop Service**:
   - Visit `/services` and select a garage service (e.g. "Wheel Alignment").
   - Click **Book Service**. Fill in your contact info, preferred date, time slot, and vehicle details.
   - Click **Submit Booking**. You receive your booking link `/bookings/[id]?token=[secret-token]`.

---

### 2. Admin Journey
1. **Sign In**: Navigate to `/admin`. Click **Sign In as Admin** (`admin@test.local`).
2. **Quotes Queue**: Review incoming customer quote requests at `/admin/quotes`. Select a quote, click **Respond**, enter an offered price in KES and validity date, then click **Send Quotation**.
3. **Bookings Queue**: Visit `/admin/bookings`. Click a booking to set its status to `Scheduled`, confirm the appointment timestamp, and add internal staff notes.
4. **Product Inventory**: Go to `/admin/products` to review live inventory, unit cost, sell price, margin, and stock counts.
5. **Staff Management**: Go to `/admin/staff` to invite new staff members, set roles (`cashier`, `manager`, `admin`), or revoke access.
6. **Branch Configuration**: Go to `/admin/settings` to update branch address, phone numbers, WhatsApp link, or configure active M-Pesa Paybill / Till numbers.

---

### 3. Manager Journey
1. **Sign In**: Navigate to `/admin`. Click **Sign In as Manager** (`mgr@test.local`).
2. **Operational Queues**:
   - Go to `/admin/quotes`: Managers can review customer quote inquiries and submit authoritative pricing.
   - Go to `/admin/bookings`: Managers can review booking requests, assign appointment dates/times, and manage workshop queue statuses.
3. **POS Terminal**: Managers can navigate to `/pos` to process in-shop sales.
4. **Restricted Surfaces**: If a Manager clicks `/admin/products`, `/admin/services`, `/admin/staff`, or `/admin/settings`, the UI and server action immediately display:
   > *"Catalogue management is Admin-only. Sign in with an Admin account."*
   Managers cannot see confidential wholesale unit costs or item margins.

---

### 4. Cashier / POS Journey
1. **Sign In**: Navigate to `/pos`. Click **Sign In as Cashier** (`cashier@test.local`).
2. **Product Lookup**: Type a tyre name, brand, or SKU in the search input.
3. **Cart Building**:
   - Click **Add** next to the desired tyre.
   - Adjust quantities using the cart controls.
   - Items with zero stock render as **Out of Stock** with the Add button disabled.
4. **Checkout**: Click **Complete Sale**. The database atomically deducts stock, appends a movement ledger entry, and outputs the completed sale receipt (`SALE-...`) with total amount.
5. **Workshop Coordination**: Cashiers can visit `/admin/bookings` to view scheduled appointments. Once a customer's service is completed in the workshop, the Cashier marks the booking as **Completed**. Cashiers cannot alter pricing or schedules.

---

## Where Do I Add a Product? (Step-by-Step Operator Guide)

### Option A: Adding a Single Product via Admin Panel
1. **Route**: Navigate to [`/admin/products`](file:///home/xdashio/Desktop/wellups-auto-tyres/app/admin/products).
2. **Sign In**: Ensure your session bar displays `ROLE: ADMIN`.
3. **Open Modal**: Click the blue `+ Add Product` button in the top right.
4. **Fill In Attributes**:
   - **Product Name** *(Required)*: e.g. `Bridgestone Dueler A/T 265/65R17` (min 2 characters, no `SEED ` prefix).
   - **SKU** *(Required, Unique)*: e.g. `TYR-BRI-2656517`.
   - **Brand** *(Optional)*: e.g. `Bridgestone`.
   - **Size / Spec** *(Optional)*: e.g. `265/65R17 112T`.
   - **Category** *(Optional)*: Select `Tyres`, `Alloy Wheels`, `Batteries`, etc.
   - **Cost Price (KES)** *(Financially Sensitive, Admin Only)*: e.g. `14500` (wholesale cost).
   - **Sell Price (KES)** *(Financially Sensitive, Admin Only)*: e.g. `18500` (counter/retail price).
   - **Stock Qty** *(Required)*: e.g. `8` (physical quantity received into shop).
   - **Status** *(Required)*: Set to **`active`**.
5. **Submit**: Click **Save Product**.
   - The application calculates margin: $\text{Margin} = \text{Sell Price} - \text{Cost Price} = 18,500 - 14,500 = \text{KES } 4,000$.
   - The row is committed directly to `public.products_admin` and `app.products`.
   - The product is immediately available in the POS lookup on `/pos` for cashiers.

### Option B: Bulk Onboarding via CSV Import
1. **Route**: Navigate to [`/admin/products/import`](file:///home/xdashio/Desktop/wellups-auto-tyres/app/admin/products/import).
2. **Download Template**: Click `/import-templates/products.csv`.
3. **Populate Real Inventory**: Include `name`, `sku`, `category`, `brand`, `size_spec`, `cost_price`, `sell_price`, `stock_quantity`, and `status=active`.
4. **Upload & Validate**: Choose the file. The client pre-validates all rows, checks for SKU duplicates, and flags any invalid categories.
5. **Commit**: Click **Import Products** to execute an atomic batch upsert.

### What Makes a Product POS-Sellable?
To be selectable and sold at the counter:
1. `status` must be set to **`active`** (the POS lookup filter matches `p.status === 'active'`).
2. `stock_quantity` must be **$\ge 1$** (products with 0 stock are marked "Out of Stock" with a disabled Add button).
3. The sale must be transacted by an authenticated staff member (`cashier`, `manager`, or `admin`).

---

## Security: What Each Role Cannot See

To maintain business integrity, strict security boundaries are enforced at the database level:
- **Guests Cannot See**: Internal wholesale costs, profit margins, staff queues, POS terminals, unaccepted quote notes, or other customers' quotes/bookings without their secret token.
- **Cashiers Cannot See**: Wholesale costs (`cost_price`), profit margins (`margin` or `item_margin`), other cashiers' counter sales, staff provisioning, or branch financial settings. Cashiers cannot modify product prices or quote estimates.
- **Managers Cannot See**: Item cost prices (`unit_cost_at_sale`), per-item margins, staff administration (`/admin/staff`), or branch settings (`/admin/settings`).
- **Admins**: Hold full visibility over the entire platform.
