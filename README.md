# School Inventory Management System with Access Control

A complete **MERN stack** inventory management application for Cavite State University — Don Severino de las Alas Campus, College of Engineering and Information Technology.

The system centralizes school supplies, computer equipment, laboratory materials and other institutional resources, with **role-based access control**, **stock transactions**, **borrowing and return tracking**, **low-stock alerts**, **activity logs**, and **printable/exportable reports**.

The interface is an evolution of the provided `School-Inventory-Management-System-1.html` design: the same warm orange (`#F28C28`) and charcoal (`#1E1E1E`) identity, sidebar navigation, cards, tables and typography — refined with cleaner spacing, consistent components, subtle shadows, responsive layouts and a collapsible hover-reveal sidebar.

---

## First sign-in

There are **no demo accounts** and no demo credentials anywhere in the codebase. The seed script creates exactly one bootstrap administrator and prints a one-time password to the server console on first start:

```
════════════════ ONE-TIME ADMINISTRATOR CREDENTIALS ════════════════
 Sign-in email : lab.admin@cvsu.edu.ph
 Username      : lab.admin
 Password      : <generated>
 Store this password now — it is shown only once.
```

Set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `server/.env` if you want to choose the credentials instead of having one generated. After signing in, change the password from **Settings → Password** and create the other accounts (Inventory Staff, Viewer) in **User Management**.

New visitors can also self-register from **Sign up** — self-registered accounts always receive the **Viewer** role (read-only); an administrator can promote them later. **Forgot password** mails a single-use, 30-minute reset link (printed to the server console in development when no SMTP transport is configured).

---

## Features

### Dashboard
- Total inventory items, total available stocks, low-stock items, out-of-stock items, total borrowed items and overdue returns.
- 7-day stock movement bar chart and category distribution donut chart (Reactive Charts / Recharts).
- Low-stock alert table, recent transactions, recent activity timeline and active borrowings.
- All figures are computed live from MongoDB.

### Inventory
- Add, view, edit, archive and restore items.
- Item code (`INV-0001`), name, category, description, quantity, unit, minimum stock level, location, condition, date added and last updated.
- Search, category/condition/status filters, sorting and pagination.
- Status badges: **In Stock**, **Low Stock**, **Out of Stock**.
- Quantity changes are only allowed through recorded stock transactions (data integrity).
- Duplicate item names within the same category and invalid quantities are rejected.

### Stock transactions
- Separate **Stock In**, **Stock Out** and administrator-only **Adjustment** flows.
- Supplier/source, reason, remarks, transaction date and responsible user.
- Atomic stock updates with a guard against negative quantities.
- Complete transaction history with running balance and reference numbers (`TXN-00001`).

### Borrowing & returns
- Borrower name, ID/reference, item, quantity, date borrowed, expected return and remarks.
- Statuses: **Borrowed**, **Returned**, **Overdue** (computed automatically).
- Stock is deducted when borrowed and restored when returned.
- Borrowing more than the available quantity is prevented.

### Categories
- Create, edit and view categories with item counts and total quantities.
- Deletion is blocked when items still reference the category.
- There is no "Uncategorized" bucket — every item must belong to a real category.

### Storage places
- Manage the physical locations where inventory is kept (Computer Laboratory 1, AV Room, Laboratory Stockroom, Supply Room, …) as real MongoDB records instead of a hard-coded list.
- Add, edit and delete places (Administrators **and** Inventory Staff; Viewers see the list read-only), optionally grouped by area.
- Renaming a place automatically re-points every item stored there, so reports and exports never break.
- A place that still holds items cannot be deleted; item locations are validated against the registered places on the server.
- The item form, plus the Inventory filter bar, are driven by these records.

### User management (Administrator only)
- Create accounts, edit profiles, assign roles, activate/deactivate accounts and reset passwords.
- Search and filter by role/status.
- Guardrails: you cannot deactivate yourself, remove your own admin access, or leave the system without an active administrator.
- Role permission matrix.

### Activity logs (Administrator only)
- Audit trail of logins, stock movements, item changes, user changes, category changes and reports.
- Filter by keyword and date range; export to CSV.

### Reports
- Complete inventory, available stock, low-stock, out-of-stock, stock-in, stock-out, borrowed/returned and full transaction history.
- Filter by date range, category and keyword.
- **Print**, **export CSV** and **export PDF** (jsPDF + AutoTable).

### Notifications & settings
- Topbar alert bell with low-stock, out-of-stock and overdue-return notifications.
- A separate Profile page for account details and profile editing.
- Settings for password changes, light/dark appearance, inventory defaults and security information.
- Administrators can manage the shared unit-of-measurement and item-condition options in Settings → Preferences.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Database | MongoDB (Mongoose ODM) |
| Backend | Node.js, Express.js |
| Frontend | React 18, Vite, React Router |
| Auth | JWT (HTTP-only cookie + Bearer fallback), bcrypt password hashing |
| Validation | express-validator + schema validation + input sanitization |
| UI | Custom CSS design system, Lucide icons, Recharts, jsPDF |

---

## Quick start

### Prerequisites
- Node.js 20 or newer
- npm 10 or newer
- MongoDB (optional — see below)

### 1. Install dependencies

```bash
cd inventory-system
npm run setup
```

### 2. Configure the environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
NODE_ENV=development
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
COOKIE_SECURE=false
# Origins allowed to call the API (comma separated)
CLIENT_ORIGIN=http://localhost:4000,http://127.0.0.1:4000
PUBLIC_ORIGIN=http://localhost:4000
RESET_TOKEN_TTL_MINUTES=30
# Bootstrap administrator created by the seed script (no demo accounts exist)
SEED_ADMIN_EMAIL=lab.admin@cvsu.edu.ph
SEED_ADMIN_PASSWORD=change-me-before-first-run
# Optional: connect to a real MongoDB deployment
# MONGODB_URI=mongodb://127.0.0.1:27017/school_inventory
# Optional SMTP for password-reset mail; otherwise the link is logged in development
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
```

### 3. Build and start

```bash
cd inventory-system
npm run build     # builds the React client into client/dist
npm start         # Express serves the API and the built client on http://localhost:4000
```

Open **http://localhost:4000** and sign in with one of the demo accounts.

### Development mode

```bash
# Terminal 1 — API on http://localhost:4000
npm run dev:server

# Terminal 2 — Vite dev server on http://localhost:5173 (proxies /api to 4000)
npm run dev:client
```

### Seeding

The database is seeded automatically on first start (1 administrator, 6 categories, 8 storage places, 20 computer-lab items, 55 stock transactions and 6 borrow records). To reseed manually:

```bash
cd server
npm run seed
# FORCE=1 npm run seed   # clears and recreates the seeded data
```

---

## Database

MongoDB collections (Mongoose models in `server/src/models`):

| Collection | Purpose |
| --- | --- |
| `users` | Accounts, bcrypt password hashes, roles, active status, last login |
| `categories` | Product categories with descriptions |
| `places` | Storage places / locations, optional area grouping and description |
| `items` | Inventory items, quantities, minimum levels, location (place name), condition, archive flag |
| `stocktransactions` | Stock In / Stock Out / Borrowed / Returned / Adjustment records with balance after each movement |
| `borrowrecords` | Borrowing transactions, expected/actual return dates and status |
| `activitylogs` | Audit trail of important actions |
| `settings` | System defaults: low-stock threshold, borrowing period, units, conditions |
| `counters` | Atomic reference generators (`INV-`, `TXN-`, `BRW-`) |

Relationships: items → categories (ObjectId) and → places (by name, so historical reports and CSV exports keep working); transactions → items + users; borrow records → items + users; logs → users.

### Persistence note

If `MONGODB_URI` is **not** set, the server starts an in-process MongoDB instance (`mongodb-memory-server`) so the project runs out of the box. Records are stored in MongoDB for the lifetime of the server process. For production or permanent storage, set `MONGODB_URI` to a real MongoDB deployment — no code changes are required.

---

## API reference

All endpoints are under `/api`. Authentication is required unless stated otherwise.

| Method | Endpoint | Permission | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Sign in, returns JWT + user |
| POST | `/auth/logout` | Authenticated | Clear session |
| GET | `/auth/me` | Authenticated | Current user |
| PATCH | `/auth/profile` | Authenticated | Update own name/email |
| POST | `/auth/change-password` | Authenticated | Change own password |
| GET | `/dashboard` | dashboard:read | Dashboard statistics |
| GET | `/dashboard/notifications` | dashboard:read | Low-stock/out-of-stock/overdue alerts |
| GET | `/items` | inventory:read | Search, filter, sort, paginate |
| GET | `/items/:id` | inventory:read | Item details |
| POST | `/items` | inventory:create | Add item |
| PATCH | `/items/:id` | inventory:update | Edit item |
| DELETE | `/items/:id` | inventory:archive | Archive item |
| PATCH | `/items/:id/restore` | inventory:archive | Restore item |
| GET | `/transactions` | transactions:read | Transaction history |
| POST | `/transactions` | transactions:create | Stock In / Stock Out / Adjustment |
| GET | `/borrows` | borrows:read | Borrowing history |
| POST | `/borrows` | borrows:create | Record borrowing |
| POST | `/borrows/:id/return` | borrows:update | Record return |
| POST | `/auth/forgot-password` | Public | Request a single-use reset link (same response for any address) |
| POST | `/auth/reset-password` | Public | Consume token, set a new password |
| GET | `/categories` | categories:read | Categories with statistics |
| POST | `/categories` | categories:manage | Create category |
| PATCH | `/categories/:id` | categories:manage | Edit category |
| DELETE | `/categories/:id` | categories:manage | Delete empty category |
| GET | `/places` | places:read | Storage places with item counts |
| POST | `/places` | places:manage | Create storage place |
| PATCH | `/places/:id` | places:manage | Edit place (renames cascade to items) |
| DELETE | `/places/:id` | places:manage | Delete place when empty |
| GET | `/reports` | reports:read | Filtered report data |
| GET | `/users` | users:read | List users |
| POST | `/users` | users:manage | Create user |
| PATCH | `/users/:id` | users:manage | Edit user/role |
| POST | `/users/:id/toggle` | users:manage | Activate/deactivate |
| POST | `/users/:id/reset-password` | users:manage | Reset password |
| GET | `/activity-logs` | logs:read | Audit trail |
| GET | `/health` | Public | Service health |

### Role-based access control

| Permission | Administrator | Inventory Staff | Viewer |
| --- | :---: | :---: | :---: |
| View dashboard / inventory / reports | ✓ | ✓ | ✓ |
| Add / edit inventory items | ✓ | ✓ | — |
| Record stock transactions | ✓ | ✓ | — |
| Borrow / return equipment | ✓ | ✓ | — |
| Manage categories | ✓ | — | — |
| Manage storage places | ✓ | ✓ | — |
| Manage users and roles | ✓ | — | — |
| View activity logs | ✓ | — | — |
| Archive items / adjust stock | ✓ | — | — |

Permissions are enforced by Express middleware on **every** API route — hiding a button is never the only protection.

---

## Security

- **Password hashing** — bcrypt with 12 salt rounds; plain-text passwords are never stored or returned.
- **Authentication** — signed JWT (7-day expiry) stored in an HTTP-only, same-site cookie, with a Bearer token fallback for embedded previews.
- **Authorization** — `authenticate`, `requirePermission` and `requireRole` middleware on all protected routes.
- **Account status** — deactivated accounts are rejected on login and on every authenticated request.
- **Input validation** — express-validator rules on all write endpoints, plus Mongoose schema validation.
- **NoSQL injection protection** — recursive sanitization strips `$`-prefixed and dotted keys from body/query/params; ObjectId parameters are validated.
- **Data integrity** — atomic `findOneAndUpdate` operations with quantity guards; stock cannot go negative; failed audit writes trigger compensation.
- **Audit trail** — every important mutation records the actor, action, affected record, details, IP and timestamp.
- **Rate limiting** — dedicated limiters on login, signup, forgot-password and reset-password plus a global `/api` limiter; Helmet security headers. (`RATE_LIMIT_DISABLED=true` relaxes them for local automated test runs only; it is ignored when `NODE_ENV=production`.)
- **Password reset** — 32-byte `crypto.randomBytes` token, only the SHA-256 hash and a 30-minute expiry are stored, single use, and the endpoint answers identically whether or not the address exists.
- **Account management guardrails** — last active administrator protection and self-deactivation prevention.

---

## Project structure

```
inventory-system/
├── package.json                 # root scripts
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx              # routes + guards
│       ├── main.jsx
│       ├── styles.css           # design system
│       ├── api/client.js
│       ├── context/             # Auth, Toast, Theme, Chart providers
│       ├── components/          # Layout, Sidebar, Topbar, Modal, common UI
│       ├── pages/               # Login, Signup, ForgotPassword, ResetPassword,
│       │                        # Dashboard, Inventory, Transactions, Borrowing,
│       │                        # Categories, Places, Reports, Users,
│       │                        # ActivityLogs, Settings, NotFound
│   └── public/brand/            # supplied logo artwork + favicon
│       └── utils/               # permissions, formatting, constants
└── server/
    ├── src/
    │   ├── index.js             # entry point
    │   ├── app.js               # Express app
    │   ├── config/db.js
    │   ├── models/              # User, Category, Place, Item, StockTransaction,
    │   │                        # BorrowRecord, ActivityLog, Counter, Settings
    │   ├── middleware/          # auth, sanitize, validate, errors
    │   ├── routes/              # auth, users, categories, places, items,
    │   │                        # transactions, borrows, dashboard, reports,
    │   │                        # activity, settings
    │   ├── services/            # (reserved for domain services)
    │   ├── utils/               # ApiError, permissions, serializers, query helpers
    │   └── seed.js
    └── .env.example
```

---

## Design notes

- **Sidebar** — collapsed to a 72 px rail on desktop (logo still visible). A thin hot zone on the left edge reveals it on hover; it slides away when the pointer leaves. The topbar menu button is a real toggle: first click expands and pins, second click collapses — including while the pointer is resting on the rail, and it never gets stuck. On screens below 1024 px it becomes an off-canvas drawer with an overlay and Escape-to-close.
- **Theming** — every colour comes from CSS custom properties defined for `:root` and `:root[data-theme='dark']`. Sidebar labels, icons and muted text are tuned to meet WCAG AA (≥ 4.5:1) in light mode without changing dark mode.
- **Logo** — the supplied SYXTEAM artwork is used as-is (cropped only, never redrawn). The white emblem is served on dark surfaces and a charcoal-on-transparent variant on light ones; the sidebar rail, mobile header, login panel and favicon all use it.
- **Palette** — warm orange `#F28C28`, charcoal `#1E1E1E`, light grey `#F5F5F5`, white cards, subtle borders and shadows. Dark mode is available from the topbar and Settings.
- **Typography** — system UI stack, 14 px base, restrained heading sizes.
- **Feedback** — success/error toasts, loading skeletons, empty states, confirmation dialogs for destructive actions, inline field validation and server error mapping.
- **Responsive** — verified with an automated sweep of 10 pages × 8 widths (1440/1280/1024/900/768/600/430/360 px) with zero horizontal overflow; tables scroll inside their own container, grids collapse to two then one column, and the mobile drawer replaces the hover sidebar.
- **Print** — dedicated print stylesheet for reports (hides navigation, filters and actions).

---

## Verification

An automated Playwright acceptance suite lives in `client/e2e.mjs` (58 checks) and covers the redesign requirements end to end — auth flows, RBAC via direct API calls, sidebar toggle behaviour, theme legibility, chart switching, stock guards, reports, accounts, settings, storage places, the confirm-password toggle and a 10-page × 5-width responsiveness sweep.

```bash
cd client
npm i -D playwright && npx playwright install chromium   # first time only
node e2e.mjs                                             # against a running server on :4000
```

Run the server with `RATE_LIMIT_DISABLED=true` while doing repeated local runs, otherwise the login/signup limiters will (correctly) start returning `429`.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run setup` | Install server and client dependencies |
| `npm run build` | Build the React client |
| `npm start` | Start the Express server (serves API + built client) |
| `npm run dev:server` | Start the API with `node --watch` |
| `npm run dev:client` | Start the Vite dev server |
| `npm run seed` | Seed the database |
| `cd server && FORCE=1 npm run seed` | Clear and reseed the database |

---

## Notes

- The application is designed for a school environment; all demo data is fictional.
- Reports are generated from live MongoDB records and reflect the current database state.
- For production, use a strong `JWT_SECRET`, set `COOKIE_SECURE=true` behind HTTPS, and configure `CLIENT_ORIGIN` if the client is hosted separately.
