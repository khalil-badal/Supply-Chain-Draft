# Microgenesis Supply Chain Portal

A full-stack replacement for **Microgenesis Business Systems'** internal Supply Chain System — previously a SharePoint List-based tracker.

> **Status:** Full-stack application, deployed to Render as a single service (`render.yaml`). Delivery-record/company/user/auth/SKU data runs on a real Express + Prisma + **PostgreSQL** backend (`server/`) with JWT-cookie login and server-enforced RBAC across four roles (Sales Coordinator, Logistics, TASS, **Admin**) — see [Full-Stack Setup](#full-stack-setup) below. The Customers directory remains the original frontend-only prototype (out of scope for the backend build) — see [Data & Persistence](#data--persistence).

## Full-Stack Setup

This app is two separate processes in local dev:

1. **Backend** (`server/`) — Express + Prisma + PostgreSQL, JWT auth in an httpOnly cookie, runs on port 4000.
2. **Frontend** (this directory) — Vite + React, runs on port 3000 and proxies `/api/*` to the backend (see `vite.config.ts`), so the session cookie stays same-origin.

```bash
# Terminal 1 - backend (start this first)
cd server
npm install
cp .env.example .env          # fill in a local/remote PostgreSQL DATABASE_URL + JWT_SECRET
npx prisma migrate dev        # applies the schema to your Postgres database
npm run seed                  # loads demo users, companies, and delivery records
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
| admin@microgenesis.com | password123 | Admin |

See `server/src/index.ts` and `server/.env.example` for backend configuration details (JWT secret, `DATABASE_URL`, SMTP placeholders). Production runs on Render with a managed Postgres instance — see `render.yaml` for the build/start pipeline (migrate → seed-if-empty → serve API + built frontend from one Node process).

## Table of Contents

- [Background](#background)
- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Data & Persistence](#data--persistence)
- [Known Limitations](#known-limitations)

## Background

The existing AS-IS system is a Microsoft SharePoint List that Microgenesis uses to track deliveries, returns, collections, and pick-ups. It has three confirmed pain points this portal is designed to fix:

1. **No audit trail** — the list has no reliable "who created / who last modified" record on individual entries.
2. **Free-text data entry** — fields like Company Name and Area are typed manually, causing inconsistent/duplicate values.
3. **A hard record-count ceiling** — SharePoint's list view threshold (5,000 items) blocks the view once exceeded, requiring a support ticket to keep working.

This prototype models the real AS-IS data as **one unified delivery/task record list**, where a `Category` field distinguishes the type of work (Sales Orders, Deliveries, RMA, Accounting Collection, Procurement Pick-up) — five of the sidebar screens are simply filtered views over that same record list, not separate business objects.

## Features

- **Branding** — real Microgenesis logo, navy (`#1F3864`) / blue (`#0078C1`) palette applied consistently across sidebar, headers, primary actions, and exported documents.
- **12-item sidebar navigation**: Dashboard, Deliveries, RMA, Accounting Collection, Procurement Pick-up, Sales Orders, Customers, Driver View (Logistics only), Admin Panel (Admin only), AM Directory (Sales Coordinator + Admin), SKU Master, Modernization Report — plus a footer-pinned **Data Sampler** (Admin only). (The original confirmed AS-IS spec listed 9 items and omitted Sales Orders; it was added as a full sidebar entry after testing showed records in that category had no reliable path to be found or created otherwise — see [Known Limitations](#known-limitations).)
- **Per-record audit trail** — every delivery record, SKU, and customer shows `Created By` / `Modified By` with timestamps directly on its detail view, backed by a central `audit_log` table.
- **Validated lookups** — Company Name, Area, Priority, Category, Vehicle, Driver, and Account Manager are all dropdowns backed by master data, not free text.
- **Auto Fill on record creation** — Sales Coordinator's create-record forms (Deliveries/RMA/Procurement Pick-up/Sales Orders/Accounting Collection) each have an "Auto Fill" button that populates every field with realistic, category-appropriate demo data (SAP-style reference, company, area, driver-ready fields, item description, and — for Accounting Collection — a random amount) for fast demoing.
- **Role-based views** — see [Roles & Permissions](#roles--permissions).
- **Logistics Dispatch Board** (Driver View) — a phone-mockup simulation of what each driver sees in the field, operated by the Logistics role (not a separate driver login). Unassigned records are grouped by category in a searchable dropdown (`DispatchBoardSelector.tsx`) rather than a flat button list. Every action taken there is logged as *"[Logistics user] on behalf of [driver]"*, keeping the audit trail traceable to a real account.
- **IPO-style configurable Output Actions** — six process-output trigger events (Record Created, Accomplished, Rescheduled, On-Hold, RMA Completed, Collection Verified) each have an independently configurable set of output channels (Notify AM, Notify Logistics, Notify TASS, Export to PDF, or Internal Only). Firing one shows a visible confirmation banner and appends to a persisted per-record log — this is a UI simulation only, not wired to a real email/PDF backend.
- **CSV / Excel / PDF export**, shared across all five record modules (`src/utils/export.ts` + `ExportMenu.tsx`):
  - CSV and Excel export the full field set (including audit fields) for data analysis.
  - PDF export uses a tighter, per-module column set matched to what's actually shown on screen (e.g. Record ID, Company, Reference No., Priority, Area, Delivery Date, Driver, Account Manager, Status — plus Amount and Verified for Accounting Collection), with the Microgenesis logo in the header, a bold dominant report title, colored status pill badges (green/blue/amber/violet/red), alternating row shading, and no rows split across a page break.
- **Data Sampler** (Admin only) — generates realistic demo records per module (Deliveries/RMA/Accounting Collection/Procurement Pick-up/Sales Orders) with human-readable `REC-XXXXX` IDs, and a Reset control with two modes: **Full Reset** (wipes transactional data, keeps users/companies) or **Reset to Seed Data** (full wipe + re-seed, which logs everyone out).
- **Admin Panel** — user management (list/create/deactivate) and a system-wide audit log viewer, gated to the `Admin` role both in the UI and on every backend route.
- **No record-volume cap** — the dashboard shows a live record count with no artificial data-entry block, addressing the SharePoint list-threshold pain point directly.
- **Deep-linkable flagged records** — the Dashboard's "Needs Attention" panel and the Dispatch Board's unassigned-driver list are clickable, jumping straight to the record's detail drawer regardless of category.
- **Reload-safe** — all delivery-record/company/user data lives server-side in PostgreSQL; a header-level "Reset Demo Data" action and the Admin Data Sampler's reset controls both restore known-good seed data on demand.

## Roles & Permissions

Four confirmed roles. Access is real, server-enforced RBAC tied to a login (see [Full-Stack Setup](#full-stack-setup)) — the frontend UI reflects the same rules the backend enforces on every request:

| | **Sales Coordinator** | **Logistics** | **TASS** (Finance/Accounting) | **Admin** |
|---|---|---|---|---|
| Primary purpose | Creates and owns delivery records | Manages driver-side field operations | Verifies billing/collection status | System administration & demo tooling |
| Create new records | ✅ (with Auto Fill) | ❌ | ❌ | ❌ (not a normal workflow role) |
| Edit record fields (drawer) | ✅ full edit | ✅ Driver/vehicle/assistant assignment only | ❌ read-only | ✅ full edit |
| Change record status | ❌ (server-blocked; view only) | ✅ (record drawer or Driver View) | ❌ read-only | ✅ |
| Which records are visible | All categories | All categories | **Accounting Collection only** (a deliberate spec change from the original prototype, which let TASS read every category) | All categories |
| Driver View / Dispatch Board | ❌ (not shown in sidebar) | ✅ exclusive | ❌ | ❌ |
| Admin Panel / Data Sampler | ❌ | ❌ | ❌ | ✅ exclusive |
| Configure Output Actions | ✅ (client-side simulation, see below) | ✅ (Driver View) | ❌ | ✅ |
| Dashboard KPIs | Delivery-focused, from `GET /api/dashboard/stats` (Scheduled/Pending Driver/On-Hold/Rescheduled/Completed Today) | Inventory & fulfillment-focused (client-computed) | Inventory & fulfillment-focused | All KPIs |

## Tech Stack

**Frontend:**
- **React 19** + **TypeScript** — component model & type safety
- **Vite 6** — dev server & build tooling (proxies `/api/*` to the backend)
- **Tailwind CSS 4** — styling (via `@tailwindcss/vite`)
- **Recharts** — dashboard charts
- **lucide-react** — icon set
- **jsPDF + jspdf-autotable** — branded, styled PDF export
- **exceljs** — styled Excel (`.xlsx`) export

**Backend (`server/`):**
- **Node.js + Express** + **TypeScript**
- **Prisma** ORM with the **PostgreSQL** provider
- **JWT** in an httpOnly cookie for auth
- **bcryptjs** for password hashing
- **Nodemailer** (stream transport — logs full email content to the console instead of sending, until real SMTP credentials are added to `server/.env`)

**Deployment:** Render, one web service serving the built Vite frontend + Express API from a single Node process, backed by a managed Render PostgreSQL database (see `render.yaml`).

## Project Structure

```
src/
├── App.tsx                        # Shell: sidebar, header, auth gate, routing, top-level state, role scope map
├── api.ts                         # fetch wrapper for the Express backend (/api/*)
├── types.ts                       # Domain types (DeliveryRecord, Product, Customer, UserRole, Output Actions...)
├── data.ts                        # Seed/mock data + shared option lists (AREAS, VEHICLES, DRIVERS, ...) - still used for Customers and form option lists
├── outputActions.ts               # IPO output-actions trigger logic and defaults (client-side simulation)
├── screenRouting.ts               # Category <-> screen key mapping, incl. deep-link support
├── persistence.ts                 # localStorage load/save helpers (Customers directory only now)
├── utils/export.ts                # Shared CSV/Excel/PDF export engine — formatters, per-module column configs, PDF pill-badge renderer
└── components/
    ├── LoginView.tsx               # Real email/password login screen
    ├── DashboardView.tsx           # Role-scoped KPIs (from GET /api/dashboard/stats), charts, Needs Attention panel
    ├── DeliveryRecordsView.tsx     # Generic record list + drawer + Auto Fill, powers Deliveries/RMA/Procurement Pick-up/Sales Orders
    ├── AccountingCollectionView.tsx / AccountingCollectionWorkspace.tsx  # Accounting Collection module (own form: adds `amount`, TASS verification)
    ├── DeliveryRecordWorkspace.tsx # Shared record detail drawer (audit trail, comments, output-action log)
    ├── DriverView.tsx              # Logistics Dispatch Board (phone mockups per driver)
    ├── DispatchBoardSelector.tsx   # Grouped dropdown for jumping to any unassigned record by category
    ├── DriverBoard.tsx / DeliveryCalendar.tsx  # Kanban board and calendar views for Logistics
    ├── InventoryView.tsx / SkuWorkspace.tsx    # SKU Master (backend-served, real Postgres data)
    ├── CustomersView.tsx / CustomerWorkspace.tsx  # Merchant Customers directory (frontend-only, out of backend scope)
    ├── SuppliersView.tsx / SupplierWorkspace.tsx, WarehousesView.tsx / WarehouseWorkspace.tsx
    ├── TransactionCenter.tsx / TransactionDetail.tsx  # Inventory transaction ledger
    ├── AdminPanel.tsx / AdminDashboard.tsx     # Admin-only: user management, system audit log
    ├── DataSamplerView.tsx         # Admin-only: bulk demo-record generation + Full Reset / Reset to Seed Data
    ├── AccountManagerDirectory.tsx # AM Directory (Sales Coordinator + Admin)
    ├── ExportMenu.tsx              # Shared CSV/Excel/PDF export dropdown, used by every record-list module
    ├── GlobalSearch.tsx, NotificationBell.tsx, StatusStepper.tsx
    ├── ModernizationReportView.tsx
    └── OutputActionsPanel.tsx      # Reusable IPO output-actions toggle panel

server/
├── prisma/schema.prisma       # users, companies, delivery_records, audit_log, notification_log, comments, sku/inventory/transaction models (PostgreSQL)
├── prisma/seed.ts             # Seed script (reused by POST /api/dev/reset-seed and the Admin Data Sampler's "Reset to Seed Data" mode)
└── src/
    ├── index.ts                # Express app entrypoint (serves API + built frontend in production)
    ├── db.ts                   # Prisma client
    ├── mappings.ts              # DB enum <-> frontend display-string mapping, serializeRecord()
    ├── middleware/auth.ts       # JWT cookie auth + RBAC middleware
    ├── services/audit.ts        # Central audit_log writer
    ├── services/notify.ts       # The one ACCOMPLISHED trigger (email + notification_log)
    ├── services/mailer.ts       # Nodemailer console-logging transport
    └── routes/                  # auth, records, companies, users (Admin), dashboard, admin (audit log), skus, transactions, notifications, data-sampler (Admin), dev
```

## Getting Started

**Prerequisites:** Node.js 18+

See [Full-Stack Setup](#full-stack-setup) for the full two-server local dev flow (backend must be running for the frontend to load any data beyond the login screen).

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`. It requires the backend (`server/`, port 4000) to be running to log in or load any delivery-record/company data.

Other scripts:

```bash
npm run build     # production build to dist/
npm run preview   # preview a production build locally
npm run lint       # type-check with tsc --noEmit
```

## Data & Persistence

**Delivery records, companies, users, auth, and SKU Master (Products/Inventory/Transactions)** all live in a real PostgreSQL database via Prisma, served by the Express backend in `server/`. Multiple browsers/users share the same server-side data and see each other's changes on refresh.

**The Customers directory** remains the original frontend-only prototype: React state seeded from `src/data.ts`, mirrored to the browser's `localStorage` so edits survive a page reload, local to one browser profile only. It is a separate, disconnected dataset from the real `companies` table the delivery records reference, so per-customer record counts on that screen no longer reflect real delivery records.

- "Sending an email," "notifying Logistics/TASS," and "exporting to PDF" (via the Output Actions panel) are still a client-side simulation for 5 of the 6 IPO trigger events — they produce a visible confirmation banner and a log entry, not a real network call. The one exception is the **Accomplished** trigger on a real delivery record: changing status to Delivered via Logistics now calls the real backend, which writes to `notification_log` and logs a full mock email to the backend's console (see `server/src/services/mailer.ts` for how to swap in real SMTP later). The **real** PDF/CSV/Excel export (`ExportMenu` on every record list) is a genuine client-side file generator, not a simulation.
- The header's "Reset Demo Data" action calls `POST /api/dev/reset-seed`, which truncates and re-seeds the database, then refetches. The Admin-only **Data Sampler** offers finer-grained control: **Full Reset** (deletes transactional records/audit/comments/notifications, keeps users & companies) or **Reset to Seed Data** (complete wipe + re-seed via the same `server/prisma/seed.ts`, which also recreates user accounts — this logs everyone out). Neither touches the Customers directory's `localStorage` data.
- **Record IDs** are always the human-readable `REC-XXXXX` format, not raw Prisma cuids — generated per-source with disjoint ranges to avoid collisions: seed data uses `4001`–`4999`, records created through the normal Operations-tab forms use `10000`–`49999`, and the Admin Data Sampler uses `50000`–`99999`.

## Known Limitations

- **Role switching removed**: the old header role-switcher `<select>` (no credentials, anyone-can-be-anyone) has been replaced with a real login screen backed by JWT-cookie sessions and server-enforced RBAC. See the project's final report / commit notes for the explicit call-out of this as a deviation from "don't remove existing UI."
- **TASS scope narrowed**: TASS can now only see Accounting Collection records (both in the UI and server-side), a deliberate spec change from the original prototype's TASS-sees-everything-read-only behavior.
- **Status changes restricted to Logistics (and Admin)**: the record drawer's status dropdown is only editable for the Logistics and Admin roles (matching the backend's `PATCH /api/records/:id/status` RBAC); Sales Coordinator and TASS see status as read-only text instead of an editable prototype dropdown.
- **Sales Coordinator has no dispatch actions**: by design, Sales Coordinator can create and fully edit a record but cannot assign a driver or change status — that split enforces the segregation-of-duties (SoD) rule that record creation and dispatch execution are different responsibilities. Logistics is the only role with "Assign Driver" / "Schedule" actions in the Operations tab.
- Document Attachments store only the file name (`document_attachment` column) - no file bytes are uploaded or stored, matching the original prototype's mock behavior.
- The Customers directory is an unchanged frontend-only module; it does not sync across browsers or reflect real delivery-record counts.
