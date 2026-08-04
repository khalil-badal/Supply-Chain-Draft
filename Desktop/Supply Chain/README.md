# Microgenesis Supply Chain Portal

A full-stack replacement for **Microgenesis Business Systems'** internal Supply Chain System — previously a SharePoint List-based tracker.

> **Status:** Full-stack application, deployed to Render as a single service (`render.yaml`). Delivery records, companies, customers, suppliers, drivers, users/auth, and the SKU Master all run on a real Express + Prisma + **PostgreSQL** backend (`server/`) with JWT-cookie login and server-enforced RBAC across **five roles** (Sales Coordinator, Logistics, TASS, Admin, and **Driver**) — see [Full-Stack Setup](#full-stack-setup) below.

## Table of Contents

- [Full-Stack Setup](#full-stack-setup)
- [Background](#background)
- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Backend API](#backend-api)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Data & Persistence](#data--persistence)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)

## Full-Stack Setup

This app is two separate processes in local dev:

1. **Backend** (`server/`) — Express + Prisma + PostgreSQL, JWT auth in an httpOnly cookie, runs on port 4000.
2. **Frontend** (this directory) — Vite + React, runs on port 3000 and proxies `/api/*` to the backend (see `vite.config.ts`), so the session cookie stays same-origin.

```bash
# Terminal 1 - backend (start this first)
cd server
npm install
cp .env.example .env          # fill in a PostgreSQL DATABASE_URL + JWT_SECRET (see Environment Variables)
npx prisma migrate dev        # applies the schema to your Postgres database
npm run seed                  # loads demo users, companies, customers, and delivery records
npm run dev                   # http://localhost:4000

# Terminal 2 - frontend
npm install
npm run dev                   # http://localhost:3000
```

Open `http://localhost:3000` and log in with one of the seeded accounts (also shown on the login screen):

| Email | Password | Role |
|---|---|---|
| sales@microgenesis.com | password123 | Sales Coordinator |
| logistics@microgenesis.com | password123 | Logistics |
| tass@microgenesis.com | password123 | TASS |
| admin@microgenesis.com | admin123 | Admin |

> There is no seeded Driver account by default — an Admin creates Driver logins through **Admin Panel → Users** (or `POST /api/users`) once the app is running. See [Roles & Permissions](#roles--permissions) for what the Driver role sees.

See `server/src/index.ts` and `server/.env.example` for backend configuration details. Production runs on Render with a managed Postgres instance — see [Deployment](#deployment) and `render.yaml`.

## Background

The existing AS-IS system is a Microsoft SharePoint List that Microgenesis uses to track deliveries, returns, collections, and pick-ups. It has three confirmed pain points this portal is designed to fix:

1. **No audit trail** — the list has no reliable "who created / who last modified" record on individual entries.
2. **Free-text data entry** — fields like Company Name and Area are typed manually, causing inconsistent/duplicate values.
3. **A hard record-count ceiling** — SharePoint's list view threshold (5,000 items) blocks the view once exceeded, requiring a support ticket to keep working.

The portal models the real AS-IS data as **one unified delivery/task record list** (the `DeliveryRecord` model), where a `category` field distinguishes the type of work — **Sales Orders, Deliveries, RMA, Accounting Collection, Procurement Pick-up**. Most of the sidebar's record screens are simply filtered views over that same underlying table, not separate business objects. Alongside it, the portal has grown a real **SKU Master / inventory** subsystem and master-data directories (Companies, Customers, Suppliers, Drivers) that are genuinely backed by their own Postgres tables — this is no longer a delivery-tracker prototype only.

## Features

- **Branding** — Microgenesis logo, navy (`#1F3864`) / blue (`#0078C1`) palette applied consistently across sidebar, headers, primary actions, and exported documents.
- **Role-scoped sidebar navigation**, driven per-user by a role default plus optional per-screen overrides (see [Roles & Permissions](#roles--permissions)): Dashboard, Deliveries, RMA, Accounting Collection, Procurement Pick-up, Sales Orders (deep-link only, no dedicated sidebar item), Customers, Suppliers, SKU Master / Inventory, Transactions, Driver Dispatch Board, Driver Board (Kanban), Delivery Calendar, Driver Manager, AM Directory, Status History, Statistical Reports, Admin Panel, and (Admin only) Data Sampler.
- **Per-record audit trail** — delivery records and SKUs show `Created By` / `Modified By` with timestamps, backed by a central `AuditLog` table; a separate append-only `RemarkLog` keeps a full history of remarks per record (contexts: `CREATION`, `GENERAL_EDIT`, `DRIVER_UPDATE`, `STATUS_CHANGE`).
- **Validated lookups** — Company, Area, Priority, Category, Vehicle, Driver, and Account Manager are dropdowns backed by master data, not free text.
- **Auto Fill on record creation** — create-record forms (Deliveries/RMA/Procurement Pick-up/Sales Orders/Accounting Collection) each have an "Auto Fill" button that populates every field with realistic, category-appropriate demo data for fast demoing.
- **Role-based views**, including a dedicated full-screen mobile-style app for the **Driver** role (`DriverDashboard.tsx`), separate from the sidebar shell every other role sees — see [Roles & Permissions](#roles--permissions).
- **Logistics Dispatch Board** (`DriverView.tsx`) — a phone-mockup simulation of what each driver sees in the field. Unassigned records are grouped by category in a searchable dropdown (`DispatchBoardSelector.tsx`). Actions taken here on behalf of a driver are still logged against the acting Logistics account, keeping the audit trail traceable.
- **Driver Board** (`DriverBoard.tsx`) — a Kanban-style board view of records by status, and a **Delivery Calendar** (`DeliveryCalendar.tsx`) for date-based scheduling views.
- **Driver directory management** (`DriverManagerView.tsx` + `Driver` table) — CRUD over real driver/assistant records (`type`: `DRIVER` or `ASSISTANT`), each with coverage areas and an active flag, replacing what used to be a hardcoded array in `src/data.ts`.
- **Customers & Suppliers directories** — both are real backend-served master-data tables (`Customer`, `Supplier`) with their own workspace/detail views (`CustomerWorkspace.tsx`, `SupplierWorkspace.tsx`); Suppliers additionally carry a `category` (Hardware, Consumables, Electronics, Packaging, Services) used for Procurement Pick-up context.
- **SKU Master & Inventory** — `Product` / `InventoryItem` / `InventoryTransaction` tables track SKU code, category (A/B/C), unit cost/price, reorder point, warehouse bin location, on-hand/allocated quantity, and a full transaction ledger (`Goods Receipt`, `Sale`, `Adjustment`, `Transfer`) viewable in `TransactionCenter.tsx` / `TransactionDetail.tsx`.
- **Linked collections** — an Accounting Collection record can be linked back to the delivery record(s) that generated it (`linkedCollectionId`, a self-relation on `DeliveryRecord`), so billing can be traced to the original fulfillment.
- **Per-user granular permissions** — beyond each role's default screen set, an Admin can grant or revoke access to individual screens for a specific user (`UserPermission` table, managed from Admin Panel or `GET/PUT /api/users/:id/permissions`).
- **In-app notifications** — a notification bell (`NotificationBell.tsx`) backed by a `Notification` table, plus a separate `NotificationLog` audit trail of trigger events (title/message, recipient, send status) distinct from the in-app bell.
- **IPO-style configurable Output Actions** — six process-output trigger events (Record Created, Accomplished, Rescheduled, On-Hold, RMA Completed, Collection Verified), each with an independently configurable set of output channels (Notify AM, Notify Logistics, Notify TASS, Export to PDF, or Internal Only). The **Accomplished** trigger on a real delivery record is wired to the backend: changing status to Delivered writes to `NotificationLog` and logs a full mock email to the server console via Nodemailer. The other five triggers remain a client-side simulation (visible confirmation banner + persisted per-record log entry), not a real network call.
- **CSV / Excel / PDF / Word export**, shared across record modules:
  - `src/utils/export.ts` — the shared CSV/Excel(exceljs)/PDF(jsPDF + autotable) engine used by `ExportMenu.tsx` on every record list: 3-row metadata header, navy header row with white bold text, Title-Case columns, Microgenesis-formatted dates/times, status pill badges, alternating row shading, and a footer row with the total record count.
  - `src/utils/exportDocx.ts` — Word (`.docx`) export via the `docx` package, formatted A4 landscape.
  - `src/utils/exportDriverReport.ts` — a styled Excel driver report using the Microgenesis navy/gold theme.
  - `src/utils/routeSlip.ts` — a "Daily Route Slip" export (Excel + PDF) matching Microgenesis's delivery-route paper template.
  - `src/utils/allOpsExport.ts` — a cross-category "All Operations" export (`AllOpsExportMenu.tsx`) with selectable sort order (nearest/oldest/furthest date), a computed summary, and CSV/Excel(with a Summary sheet)/PDF(with a cover page) output.
- **Reports** — `StatisticalReportView.tsx` and the `reports.ts` API (`daily-status-history`, `summary`) surface trend data drawn from a `DailyStatusSnapshot` daily rollup table, plus `StatusHistoryView.tsx` / `StatusStepper.tsx` for per-record status progression.
- **Global Search** (`GlobalSearch.tsx`) — search across records from anywhere in the app.
- **Data Sampler** (Admin only) — generates realistic demo records per module with human-readable `REC-XXXXX` IDs, plus a Reset control with two modes: **Full Reset** (wipes transactional data, keeps users/master data) or **Reset to Seed Data** (full wipe + re-seed, which logs everyone out).
- **Admin Panel** — user management (list/create/deactivate/activate, per-user permission overrides) and a system-wide audit log viewer, gated to the `Admin` role both in the UI and on every backend route.
- **No record-volume cap** — the dashboard shows a live record count with no artificial data-entry block, addressing the SharePoint list-threshold pain point directly.
- **Deep-linkable flagged records** — the Dashboard's "Needs Attention" panel and the Dispatch Board's unassigned-driver list are clickable, jumping straight to the record's detail drawer regardless of category.
- **Server-backed, reload-safe** — nearly all data (delivery records, companies, customers, suppliers, drivers, users, SKU/inventory) lives server-side in PostgreSQL; multiple browsers/users share the same data and see each other's changes on refresh.

## Roles & Permissions

Access is real, server-enforced RBAC tied to a login — the frontend UI reflects the same rules the backend enforces on every request (`requireAuth` + `requireRole(...)` in `server/src/middleware/auth.ts`). There are **five** roles: `SALES_COORDINATOR`, `LOGISTICS`, `TASS`, `ADMIN`, `DRIVER`.

Each role gets a default set of accessible screens (see `DEFAULT_ROLE_SCOPE` in `src/App.tsx`); an Admin can additionally grant or revoke individual screens per user via `UserPermission` records, layered on top of the role default.

| | **Sales Coordinator** | **Logistics** | **TASS** (Finance/Accounting) | **Admin** | **Driver** |
|---|---|---|---|---|---|
| Primary purpose | Creates and owns delivery records | Manages driver-side field operations & master data | Verifies billing/collection status | System administration & demo tooling | Field execution — mobile-style app only |
| UI shell | Full sidebar + dashboard | Full sidebar + dashboard | Full sidebar + dashboard | Full sidebar + dashboard | **Dedicated full-screen `DriverDashboard`**, no sidebar |
| Create new records | ✅ (with Auto Fill) | ❌ | ❌ | ❌ (not a normal workflow role) | ❌ |
| Edit record fields (drawer) | ✅ full edit | ✅ Driver/vehicle/assistant assignment, and full edit | ❌ read-only | ✅ full edit | ✅ (own assigned records only) |
| Change record status | ❌ (server-blocked; view only) | ✅ | ❌ read-only | ✅ | ✅ (own assigned records only) |
| Verify Accounting Collection | ❌ | ❌ | ✅ exclusive (`PATCH /:id/verify-collection`) | ❌ | ❌ |
| Which categories are visible | All | All | **Accounting Collection, RMA, Procurement Pick-up** | All | Only records assigned to that driver |
| Driver Dispatch Board / Driver Board / Calendar | ❌ | ✅ | ❌ | ✅ | N/A (has its own app instead) |
| Driver Manager (driver directory CRUD) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Customers / Suppliers directories | ✅ | ✅ | Suppliers only | ✅ | ❌ |
| SKU Master / Inventory / Transactions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Admin Panel / Data Sampler | ❌ | ❌ | ❌ | ✅ exclusive | ❌ |
| Statistical Reports / Status History | ❌ | ✅ | ❌ | ✅ | ❌ |
| Dashboard KPIs | Delivery-focused, from `GET /api/dashboard/stats` (Scheduled/Pending Driver/On-Hold/Rescheduled/Completed Today) | Inventory & fulfillment-focused | Inventory & fulfillment-focused | All KPIs | N/A |

Permissions are enforced twice: on the frontend (hides nav items and shows an access-request prompt for anything outside `effectiveScreens`) and, authoritatively, on every backend route via `requireRole(...)` — a user cannot get server data for a screen they aren't permitted, even by calling the API directly.

## Tech Stack

**Frontend:**
- **React 19** + **TypeScript** — component model & type safety
- **Vite 6** — dev server & build tooling (proxies `/api/*` to the backend)
- **Tailwind CSS 4** — styling (via `@tailwindcss/vite`)
- **Recharts** — dashboard charts
- **lucide-react** — icon set
- **motion** — animations
- **jsPDF + jspdf-autotable** — branded, styled PDF export
- **exceljs** / **xlsx** — styled Excel (`.xlsx`) export
- **docx** — Word (`.docx`) export

**Backend (`server/`):**
- **Node.js + Express** + **TypeScript**
- **Prisma** ORM with the **PostgreSQL** provider
- **JWT** (`jsonwebtoken`) in an httpOnly cookie for auth, 8-hour session expiry
- **bcryptjs** for password hashing
- **Nodemailer** (console-logging stream transport by default — logs full email content to the server console instead of sending, until real SMTP credentials are added to `server/.env`)

**Deployment:** Render, one web service serving the built Vite frontend + Express API from a single Node process, backed by a managed Render PostgreSQL database (see [Deployment](#deployment) and `render.yaml`).

> Note: the root `package.json` also lists `@google/genai` and a root `.env.example` with a `GEMINI_API_KEY` / `APP_URL` — these are leftovers from the project's original AI Studio scaffold and are not used by any current application feature.

## Database Schema

PostgreSQL via Prisma (`server/prisma/schema.prisma`). Enum-like fields (role, status, category, etc.) are modeled as plain `String` columns — valid values are enforced in application code (`server/src/mappings.ts`, RBAC in `middleware/auth.ts` and the route handlers), not by native Postgres enums.

| Model | Purpose |
|---|---|
| `User` | Login accounts: name, email, hashed password, `role`, `isActive`. Relations to created/modified records, audit entries, notifications, comments, permissions, remark logs. |
| `UserPermission` | Per-user, per-screen access override (`screen`, `granted`), layered on top of the role default. |
| `Company` | The validated Company/SAP lookup (`sapNumber`, address, contact person) that `DeliveryRecord.companyId` references. |
| `Customer` | Merchant/customer directory — a relationship-management directory, intentionally **not** foreign-keyed to `DeliveryRecord`. |
| `Supplier` | Supplier directory with a `category` (Hardware/Consumables/Electronics/Packaging/Services) — also not foreign-keyed to `DeliveryRecord`; feeds Procurement Pick-up context. |
| `Driver` | Real driver/assistant directory: `type` (`DRIVER`/`ASSISTANT`), JSON `coverageAreas`, `isActive`. |
| `DeliveryRecord` | The core unified record: `category`, `status`, `priority`, `companyId`, `driver`, `driverAssistants`, `vehicle`, `area`, `deliveryDate`, `itemType`/`itemDescription`, `timeIn`/`timeOut`, `receivedBy`, `accountManager`, `amount` (Accounting Collection), `collectionVerified`/`By`/`At`, `documentAttachment` (filename only), `address`, `linkedCollectionId` (self-relation to a related record), `createdById`/`modifiedById`, soft-delete `deletedAt`. |
| `AuditLog` | Generic audit trail for any entity: `recordId`, `recordType`, `action` (CREATE/UPDATE/DELETE), `changedById`, `previousValue`/`newValue` (JSON), timestamp. |
| `RemarkLog` | Append-only remark history per record, with a `context` (`CREATION`/`GENERAL_EDIT`/`DRIVER_UPDATE`/`STATUS_CHANGE`). |
| `Comment` | Threaded comments on a record (`recordId`, `recordType`, `body`, `authorId`). |
| `Notification` | In-app notification-bell entries per user (`title`, `message`, `recordId`/`recordType`, `isRead`). |
| `NotificationLog` | Audit trail of outbound trigger events (`triggerEvent`, `recipientRole`, `recipientName`, `message`, `status`: SENT/FAILED/MOCKED). |
| `Product` | SKU Master: `skuCode`, `name`, `category` (A/B/C), `unitCost`, `unitPrice`, `reorderPoint`, soft-delete. |
| `InventoryItem` | One-to-one with `Product`: `warehouseLocation`, `onHandQty`, `allocatedQty`. |
| `InventoryTransaction` | Ledger entries per product: `date`, `type` (Goods Receipt/Sale/Adjustment/Transfer), `qtyChange`, `resultingBalance`, `reference`. |
| `DailyStatusSnapshot` | Daily rollup (`date`, `category`, `status`, `count`) written by an end-of-day job, powering fast historical/statistical reporting without scanning the full record table. |

See `server/prisma/migrations/` for the full evolution history (RBAC fixes, SKU Master, notifications/comments, user permissions, driver table, customers/suppliers, remark log, linked collections, and more).

## Backend API

All routes are mounted under `/api` and require an authenticated session (`mg_session` JWT cookie) unless noted. Role names in parentheses gate write/sensitive operations via `requireRole(...)`.

| Route file | Endpoints |
|---|---|
| `auth.ts` | `POST /login`, `POST /logout`, `GET /me` |
| `records.ts` | `GET /`, `GET /status-history-counts`, `GET /:id`, `GET /:id/audit`, `GET /:id/remarks`, `GET/POST /:id/comments`, `POST /` (Sales Coordinator, Logistics), `PUT /:id` (Sales Coordinator, Logistics, Admin, Driver, TASS), `PATCH /:id/status` (same 5 roles), `PATCH /:id/verify-collection` (TASS only), `DELETE /:id` (Sales Coordinator only) |
| `companies.ts` | `GET /` (any authed user), `POST /` (Sales Coordinator only) |
| `customers.ts` | `GET /` (any authed), `POST /` (Sales Coordinator, Logistics, Admin, Driver) |
| `suppliers.ts` | `GET /` (any authed), `POST /` (Sales Coordinator, Logistics, Admin, Driver) |
| `drivers.ts` | `GET /` (any authed), `POST`/`PUT`/`DELETE` (Logistics, Admin) |
| `users.ts` | `GET /`, `POST /`, `PATCH /:id/deactivate`, `PATCH /:id/activate`, `GET/PUT /:id/permissions` — all Admin only |
| `skus.ts` | `GET /`, `GET /:id`, `GET /:id/audit` (Admin), `POST /` (Admin), `PUT /:id` (Admin), `POST /:id/adjust` (Admin, Logistics) |
| `transactions.ts` | `GET /`, `GET /:source/:id` |
| `dashboard.ts` | `GET /stats` — role-discriminated KPI payload |
| `reports.ts` | `GET /daily-status-history`, `GET /summary` (Logistics, Admin) |
| `notifications.ts` | `GET /`, `GET /unread-count`, `PATCH /read-all`, `PATCH /:id/read` |
| `admin.ts` | `GET /audit-log` (Admin only) |
| `data-sampler.ts` | `GET /counts`, `POST /generate`, `POST /reset` — all Admin only |
| `dev.ts` | `POST /reset-seed` — no auth required; dev/demo convenience only, truncates and re-seeds the database |

## Project Structure

```
src/
├── App.tsx                        # Shell: sidebar, header, auth gate, role screen scope (DEFAULT_ROLE_SCOPE + per-user overrides), top-level state
├── api.ts                         # fetch wrapper for the Express backend (/api/*)
├── types.ts                       # Domain types (DeliveryRecord, Product, Customer, Supplier, Driver, UserRole, Output Actions...)
├── data.ts                        # Shared option lists (AREAS, VEHICLES, AREA_HIERARCHY, ...) used by forms and exports
├── outputActions.ts               # IPO output-actions trigger logic and defaults
├── screenRouting.ts                # Category <-> screen key mapping, incl. deep-link support for Sales Orders
├── persistence.ts                 # localStorage helpers (legacy leftovers only; core data is server-backed now)
└── utils/
    ├── export.ts                  # Shared CSV/Excel/PDF export engine — formatters, per-module column configs, PDF pill-badge renderer
    ├── exportDocx.ts               # Word (.docx) export
    ├── exportDriverReport.ts       # Styled Excel driver report
    ├── routeSlip.ts                 # Daily Route Slip export (Excel + PDF)
    └── allOpsExport.ts              # Cross-category "All Operations" export with sort modes and summary

src/components/
├── LoginView.tsx                              # Email/password login screen
├── DashboardView.tsx                           # Role-scoped KPIs, charts, Needs Attention panel; dispatches to role dashboards below
├── LogisticsDashboard.tsx / TassDashboard.tsx / AdminDashboard.tsx / DriverDashboard.tsx  # Per-role dashboard variants (Driver's is a full-screen app, not embedded)
├── DeliveryRecordsView.tsx                      # Generic record list + drawer + Auto Fill, powers Deliveries/RMA/Procurement Pick-up/Sales Orders
├── DeliveryRecordWorkspace.tsx                  # Shared record detail drawer (audit trail, remarks, comments, output-action log)
├── AccountingCollectionView.tsx / AccountingCollectionWorkspace.tsx  # Accounting Collection module (adds `amount`, TASS verification workflow)
├── DriverView.tsx                               # Logistics Dispatch Board (phone mockups per driver)
├── DispatchBoardSelector.tsx                    # Grouped dropdown for jumping to any unassigned record by category
├── DriverBoard.tsx / DeliveryCalendar.tsx        # Kanban board and calendar views
├── DriverManagerView.tsx                        # CRUD screen for the Driver directory
├── InventoryView.tsx / SkuWorkspace.tsx          # SKU Master (backend-served)
├── TransactionCenter.tsx / TransactionDetail.tsx # Inventory transaction ledger
├── CustomersView.tsx / CustomerWorkspace.tsx      # Customer directory (backend-served)
├── SuppliersView.tsx / SupplierWorkspace.tsx      # Supplier directory (backend-served)
├── WarehousesView.tsx / WarehouseWorkspace.tsx    # Warehouse location workspace (retired from the sidebar; force-excluded in App.tsx)
├── AdminPanel.tsx                               # Admin-only: user management, permission overrides, system audit log
├── DataSamplerView.tsx                           # Admin-only: bulk demo-record generation + Full Reset / Reset to Seed Data
├── AccountManagerDirectory.tsx / AccountManagerCombobox.tsx  # AM directory + lookup combobox
├── StatusHistoryView.tsx / StatusStepper.tsx      # Status history and status-progression UI
├── StatisticalReportView.tsx                     # Statistical reports screen
├── RecordCreateForm.tsx                          # Record creation form (Auto Fill support)
├── ExportMenu.tsx / AllOpsExportMenu.tsx / RouteSlipMenu.tsx  # Export dropdowns (per-module, all-ops, route slip)
├── OutputActionsPanel.tsx                        # Reusable IPO output-actions toggle panel
├── GlobalSearch.tsx / NotificationBell.tsx        # Global search and notification bell
├── ComboboxField.tsx                              # Reusable combobox input
└── MainView.tsx                                   # Landing/overview screen distinct from Dashboard

server/
├── prisma/schema.prisma       # All models (see Database Schema) — PostgreSQL
├── prisma/migrations/         # Full migration history
├── prisma/seed.ts             # Seed script (reused by POST /api/dev/reset-seed and the Admin Data Sampler's "Reset to Seed Data")
└── src/
    ├── index.ts                # Express app entrypoint (serves API + built frontend in production)
    ├── db.ts                   # Prisma client
    ├── mappings.ts              # DB value <-> frontend display-string mapping, serializeRecord()
    ├── middleware/auth.ts       # JWT cookie auth + requireAuth/requireRole RBAC middleware
    ├── services/audit.ts        # Central AuditLog writer
    ├── services/notify.ts       # The ACCOMPLISHED trigger (writes NotificationLog + sends mock email)
    ├── services/inAppNotify.ts  # Writes in-app Notification rows
    ├── services/mailer.ts       # Nodemailer console-logging transport (swap in real SMTP via .env)
    └── routes/                  # See Backend API above
```

## Getting Started

**Prerequisites:** Node.js 18+, a PostgreSQL database (local or remote).

See [Full-Stack Setup](#full-stack-setup) for the full two-process local dev flow — the backend must be running for the frontend to load any data beyond the login screen.

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`. It requires the backend (`server/`, port 4000) to be running to log in or load any data.

Other frontend scripts:

```bash
npm run build     # production build to dist/
npm run preview   # preview a production build locally
npm run clean     # remove dist/ and server.js
npm run lint       # type-check with tsc --noEmit
```

Backend scripts (run from `server/`):

```bash
npm run dev              # tsx watch src/index.ts — http://localhost:4000
npm run build             # tsc build to dist/
npm start                 # run the compiled build (node dist/src/index.js)
npm run prisma:generate   # regenerate the Prisma client
npm run prisma:migrate    # prisma migrate dev --name init
npm run seed               # tsx prisma/seed.ts
npm run lint                # type-check with tsc --noEmit
```

## Environment Variables

**`server/.env`** (copy from `server/.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (the schema is Postgres-only — despite the shipped `.env.example` showing a stale SQLite-style `file:./dev.db` placeholder, a real deployment needs a Postgres URL, e.g. `postgresql://user:pass@host:5432/dbname`) |
| `JWT_SECRET` | Long random string used to sign session JWTs |
| `PORT` | Backend port (defaults to `4000`) |
| `CLIENT_ORIGIN` | Allowed CORS origin for the frontend in dev (e.g. `http://localhost:3000`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Optional real SMTP credentials — leave blank to keep the console-logging mock mailer (`server/src/services/mailer.ts`) |

**Root `.env`** — `GEMINI_API_KEY` / `APP_URL` in the root `.env.example` are unused AI Studio scaffold leftovers; no current feature reads them.

## Data & Persistence

Delivery records, companies, customers, suppliers, drivers, users/auth, notifications, audit logs, and the SKU Master (Products/Inventory/Transactions) all live in a real PostgreSQL database via Prisma, served by the Express backend. Multiple browsers/users share the same server-side data and see each other's changes on refresh.

- "Notifying Logistics/TASS" and "exporting to PDF" via the Output Actions panel are a client-side simulation for 5 of the 6 IPO trigger events — they produce a visible confirmation banner and a persisted log entry, not a real network call. The one exception is the **Accomplished** trigger: changing a delivery record's status to Delivered calls the real backend, which writes a `NotificationLog` row and logs a full mock email to the server console (swap in real SMTP via `server/.env` to send for real). The **real** PDF/CSV/Excel/Word export menus are genuine client-side file generators, not simulations.
- The header's "Reset Demo Data" action calls `POST /api/dev/reset-seed`, which truncates and re-seeds the database, then refetches. The Admin-only **Data Sampler** offers finer-grained control: **Full Reset** (deletes transactional records/audit/comments/notifications, keeps users & master data) or **Reset to Seed Data** (complete wipe + re-seed via `server/prisma/seed.ts`, which also recreates user accounts — this logs everyone out).
- **Record IDs** are always the human-readable `REC-XXXXX` format, not raw Prisma cuids — generated per-source with disjoint ranges to avoid collisions: seed data uses `4001`–`4999`, records created through the normal Operations-tab forms use `10000`–`49999`, and the Admin Data Sampler uses `50000`–`99999`.
- Document Attachments store only the file name (`documentAttachment` column) — no file bytes are uploaded or stored.

## Deployment

Deployed on **Render** as a single Blueprint (`render.yaml`) with two resources:

- **`mg-portal-db`** — a managed Render PostgreSQL database.
- **`mg-portal`** — a Node web service that:
  - **Builds** the frontend and backend in one pass: `npm install --include=dev && npm run build && cd server && npm install --include=dev && npx prisma generate && npm run build`
  - **Starts** by applying migrations, seeding, then serving both the API and the built frontend from one Express process: `cd server && npx prisma migrate deploy && npx tsx prisma/seed.ts && cd .. && node server/dist/src/index.js`
  - Gets `DATABASE_URL` from the linked database and an auto-generated `JWT_SECRET`; `NODE_ENV=production`, `PORT=10000`.

## Known Limitations

- **Driver is a real login role, not a Logistics-operated simulation.** The Driver Dispatch Board (`DriverView.tsx`) still exists for Logistics to act on behalf of drivers in the field, but a Driver can also log in directly and use the dedicated `DriverDashboard` app, scoped to their own assigned records.
- **TASS scope is narrowed**: TASS sees Accounting Collection, RMA, and Procurement Pick-up records (read-only outside collection verification), not Deliveries or Sales Orders.
- **Status changes are restricted**: the record drawer's status control is only editable for Logistics, Admin, and (on their own records) Driver — matching the backend's `PATCH /api/records/:id/status` RBAC. Sales Coordinator and TASS see status as read-only.
- **Sales Coordinator has no dispatch actions**: by design, Sales Coordinator can create and fully edit a record but cannot assign a driver or change status — enforcing a segregation-of-duties (SoD) split between record creation and dispatch execution. Logistics is the primary role with "Assign Driver" / "Schedule" actions.
- **Warehouses module is retired**: `WarehousesView.tsx` / `WarehouseWorkspace.tsx` still exist in the codebase but the `warehouses` screen is force-excluded from every role's effective screen set in `App.tsx` (including stale per-user permission grants), so it is not reachable from the UI.
- **Document Attachments are filename-only** — no file bytes are uploaded or stored anywhere.
- **Five of six Output Action triggers are simulated**, not wired to real email/notification delivery — see [Data & Persistence](#data--persistence) for the one exception (Accomplished).
- **SMTP is mocked by default** — real email requires setting `SMTP_*` variables in `server/.env`; until then, all "sent" email is logged to the server console only.
