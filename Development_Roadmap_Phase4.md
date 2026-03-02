# ProGreece — Development Roadmap: Phases 4–8
*Audit Date: 2026-03-02 | Baseline: current codebase | Target: Technical Spec + Annex ERD*

---

## Part 1 — Gap Analysis

### 1.1 The 10 Required Reports

| # | Report | Status | Gap Summary |
|---|--------|--------|-------------|
| 1 | Project P&L | **MISSING** | No endpoint, no UI. Counterparties entity absent; `vat_amount`/`withholding_amount` never computed/stored. |
| 2 | Plan vs Actual | **PARTIAL** | `/reports/budget/{id}` + BudgetReport.jsx exist. Missing: VAT/withholding columns, counterparty grouping, Excel export, drill-down. |
| 3 | Invoice Details | **MISSING** | No `invoices` table, no module, no API, no UI. |
| 4 | Customer Transactions | **PARTIAL** | `customer_payments` table + Apartments.jsx payment list exist. Missing: proper `customers` entity (FK), dedicated report view with filters, Excel export. |
| 5 | Customer Balance | **PARTIAL** | Apartments.jsx shows `total_paid`/`remaining` per apartment. Missing: proper `customers` FK, formal report with filters, payment plan integration, Excel export. |
| 6 | Company Cash Forecast | **PARTIAL** | Cash flow forecast for single project exists. Missing: "Company" project concept, unpaid customer balance integration, consolidated all-projects view, 12-month forward window. |
| 7 | Project Cash Forecast (All Projects) | **PARTIAL** | Single-project forecast exists. Missing: multi-project comparison table, next 3/6/12 month view, per-project comparison chart. |
| 8 | Payments to Accounts by Project | **MISSING** | No dedicated report. No `counterparties` entity, no account-payment category flag, no monthly breakdown. |
| 9 | VAT Report | **MISSING** | `vat_rate` stored on transactions, but `vat_amount` never computed or stored. No report endpoint or UI. |
| 10 | Withholding Tax Report | **MISSING** | `withholding_rate` stored, but `withholding_amount` never computed or stored. No report endpoint or UI. |

**Excel Export**: MISSING for all 10 reports (no openpyxl/xlsxwriter integration exists anywhere).

---

### 1.2 Database Schema Alignment

#### 1.2.1 Missing Tables

| Table | Status | Notes |
|-------|--------|-------|
| `counterparties` | **MISSING** | Currently hacked via `accounts` table + legacy text `supplier` field on transactions |
| `customers` | **MISSING** | Currently `customer_name` (text) + `customer_key` (int, not FK) in `apartments`; `cust_id` (int, not FK) in `transactions` |
| `invoices` | **MISSING** | Completely absent |
| `audit_log` | **MISSING** | Completely absent |

#### 1.2.2 Existing Tables — Missing/Incorrect Fields

**`transactions`** (current vs spec):

| Field (Spec) | Current State | Gap |
|---|---|---|
| `vat_amount` numeric(14,2) | ❌ absent — only `vat_rate` stored | Critical: all tax reports and P&L depend on this |
| `withholding_amount` numeric(14,2) | ❌ absent — only `withholding_rate` stored | Critical: Withholding Tax report depends on this |
| `direction` text (in/out) | ❌ absent — `type` text (income/expense) used inconsistently | Inconsistent field used for income/expense classification |
| `status` text (planned/executed/cancelled) | ⚠️ `transaction_type` int (1=Executed, 2=Planned) | Naming and type mismatch; no "cancelled" state |
| `category_id` FK → categories | ⚠️ `budget_item_id` FK → budget_categories + legacy text `category` | Dual-field system; messy |
| `counterparty_id` FK → counterparties | ⚠️ `to_account_id` FK → accounts (workaround) | Wrong entity being referenced |
| `customer_id` FK → customers | ⚠️ `cust_id` int (non-FK) | No referential integrity |
| `invoice_id` FK → invoices | ❌ absent | Needed for Reports 3 & 4 |
| `source_ref` text | ❌ absent | Bank reference / import ID |
| `currency` text | ❌ absent | Assumed EUR but not recorded |
| `created_by`, `updated_by` UUID | ❌ absent | Audit requirement |
| `updated_at` timestamp | ❌ absent | Audit requirement |

**`apartments`** (current vs spec):

| Field (Spec) | Current State | Gap |
|---|---|---|
| `unit_number` text (unique per project) | ⚠️ `apartment_number` (same concept, different name) | Naming inconsistency |
| `customer_id` FK → customers | ⚠️ `customer_name` text + `customer_key` int (no FK) | No referential integrity |
| `sale_date` date | ❌ absent | Needed for sales analytics |

**`projects`** (current vs spec):

| Field (Spec) | Current State | Gap |
|---|---|---|
| `is_active` boolean | ⚠️ `status` text | Different modeling |
| `cash_buffer` numeric | ⚠️ Stored in separate `project_settings` table | Spec requires it on `projects` directly |
| `code` text (slug) | ❌ absent | Optional but in spec |
| `created_at`, `updated_at` | ❌ absent | Audit requirement |

**`budget_categories` / `categories`** (current vs spec):

| Field (Spec) | Current State | Gap |
|---|---|---|
| `category_type` text (expense/income/tax) | ❌ absent | Needed for P&L and tax report filtering |
| `project_id` nullable (global categories) | ⚠️ Required (non-nullable) | Spec allows global categories (null = global) |

---

### 1.3 Frontend Gap Summary

**Missing Pages (entirely new):**
- Counterparties management
- Customers management
- Invoice management (CRUD + link to transactions)
- P&L Report page
- Customer Transactions report page
- Customer Balance report page
- VAT Report page
- Withholding Tax Report page
- Payments to Accounts by Project report page
- Multi-Project Cash Forecast comparison page

**Missing Features on Existing Pages:**
- Excel export button on all report pages
- Drill-down: click a number → see source transactions
- Transaction form: `counterparty_id` dropdown (replacing `supplier` text), `vat_amount`/`withholding_amount` calculated fields
- Transaction form: `status` dropdown (planned/executed/cancelled) replacing integer `transaction_type`
- Budget Report: add VAT/withholding columns, counterparty grouping
- Dashboard: unpaid customer balance KPI card
- Portfolio: multi-project forecast table

---

## Part 2 — Phase-Based Execution Plan

### Migration Strategy Note

The existing SQLite database has real production data. All schema changes must be **additive migrations** (no destructive ALTER TABLE). New normalized entities (`counterparties`, `customers`) will be populated via:
1. A one-time migration script that creates rows from existing text fields
2. Old text fields kept temporarily for backward compatibility, then deprecated after validation

---

### Phase 4 — Data Foundation (DB Migrations)

**Goal:** Extend the database to support all 10 reports without breaking existing functionality.

#### 4.1 New Tables

**A. `counterparties`**
```sql
CREATE TABLE counterparties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vat_number TEXT,
  default_category_id INTEGER REFERENCES budget_categories(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
*Seed:* Extract distinct `supplier` values from `transactions` → insert as counterparty rows.

**B. `customers`**
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
*Seed:* Extract distinct `customer_name` values from `apartments` → insert as customer rows. Build `customer_name → customers.id` map.

**C. `invoices`**
```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  customer_id INTEGER REFERENCES customers(id),
  counterparty_id INTEGER REFERENCES counterparties(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_value NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_invoice ON invoices(project_id, invoice_number);
```

**D. `audit_log`**
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,  -- create / update / delete
  diff_json TEXT,
  actor_user_id INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2 Alter Existing Tables (Additive Only)

**A. `transactions` — Add columns:**
```sql
ALTER TABLE transactions ADD COLUMN vat_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN withholding_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN direction TEXT;        -- 'in' / 'out'
ALTER TABLE transactions ADD COLUMN status TEXT;           -- 'planned' / 'executed' / 'cancelled'
ALTER TABLE transactions ADD COLUMN counterparty_id INTEGER REFERENCES counterparties(id);
ALTER TABLE transactions ADD COLUMN customer_id_fk INTEGER REFERENCES customers(id);
ALTER TABLE transactions ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);
ALTER TABLE transactions ADD COLUMN source_ref TEXT;
ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'EUR';
ALTER TABLE transactions ADD COLUMN updated_at DATETIME;
ALTER TABLE transactions ADD COLUMN created_by INTEGER;
ALTER TABLE transactions ADD COLUMN updated_by INTEGER;
```

*Data migration:*
- `vat_amount` = `amount * vat_rate` for all existing rows
- `withholding_amount` = `amount * withholding_rate` for all existing rows
- `direction` = `'in'` WHERE `type = 'income'` ELSE `'out'`
- `status` = `'executed'` WHERE `transaction_type = 1` ELSE `'planned'`
- `counterparty_id` = lookup by `supplier` text against seeded `counterparties` table
- `customer_id_fk` = lookup by `cust_id` against seeded `customers` table

**B. `apartments` — Add columns:**
```sql
ALTER TABLE apartments ADD COLUMN unit_number TEXT;
ALTER TABLE apartments ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE apartments ADD COLUMN sale_date DATE;
```
*Data migration:*
- `unit_number` = `apartment_number` for all existing rows
- `customer_id` = lookup seeded customers by `customer_name`

**C. `budget_categories` — Add column:**
```sql
ALTER TABLE budget_categories ADD COLUMN category_type TEXT DEFAULT 'expense';
```

**D. `projects` — Add columns:**
```sql
ALTER TABLE projects ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN cash_buffer NUMERIC(14,2);
ALTER TABLE projects ADD COLUMN code TEXT;
ALTER TABLE projects ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
```
*Data migration:* `cash_buffer` = join with `project_settings.cash_buffer_amount`

#### 4.3 Backend Changes (Phase 4)

- Add SQLAlchemy models: `Counterparty`, `Customer`, `Invoice`, `AuditLog`
- Add new fields to existing models: `Transaction`, `Apartment`, `Project`, `BudgetCategory`
- Add Pydantic schemas for all new models
- Add CRUD endpoints: `GET/POST/PUT/DELETE /counterparties/`, `GET/POST/PUT/DELETE /customers/`
- Create `backend/migrations/phase4_migrate.py` — one-time idempotent migration script
- Update `Transaction` create/update logic: auto-compute `vat_amount = amount * vat_rate` and `withholding_amount = amount * withholding_rate` on every save

#### 4.4 Frontend Changes (Phase 4)

- Update Transaction form: replace `supplier` text input → `counterparty_id` dropdown with search
- Update Transaction form: show computed `vat_amount` and `withholding_amount` (read-only, auto-calculated)
- Update Transaction form: `status` dropdown (Planned/Executed/Cancelled)
- Add Counterparties page (simple CRUD table)
- Add Customers page (simple CRUD table)

**Files to create/modify:**
- `backend/models.py` — add 4 new models, add fields to existing
- `backend/schemas.py` — add schemas for new models
- `backend/main.py` — add counterparty/customer CRUD; update transaction compute logic
- `backend/migrations/phase4_migrate.py` — NEW
- `frontend/src/pages/Counterparties.jsx` — NEW
- `frontend/src/pages/Customers.jsx` — NEW
- `frontend/src/pages/Transactions.jsx` — update form fields
- `frontend/src/api.js` — add counterparty/customer API calls
- `frontend/src/App.jsx` — add routes for new pages
- `frontend/src/components/Layout.jsx` — add nav links

---

### Phase 5 — Invoice Module

**Goal:** Full invoice lifecycle management (create, view, link to transactions) and Invoice Details report (Report 3).

#### 5.1 Backend

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/invoices/` | POST | Create invoice |
| `/invoices/` | GET | List invoices (filters: project_id, customer_id, date_from, date_to) |
| `/invoices/{id}` | PUT | Update invoice |
| `/invoices/{id}` | DELETE | Soft delete |
| `/transactions/{id}/link-invoice` | POST | Link transaction to invoice |
| `/reports/invoices` | GET | Invoice Details report (Report 3) |
| `/imports/invoices` | POST | CSV/Excel bulk import |

Report 3 response format:
```json
{
  "rows": [{"customer": "...", "invoice_value": 0, "transactions_value": 0, "balance": 0}],
  "totals": {"invoice_value": 0, "transactions_value": 0, "balance": 0},
  "drilldown_supported": true,
  "filters_applied": {}
}
```

Audit log: write to `audit_log` on invoice create/update/delete.

#### 5.2 Frontend

- **Invoice Management page** (`/invoices`):
  - List: Invoice # | Date | Project | Customer/Counterparty | Value | Linked Transactions | Balance
  - Create/Edit modal
  - Link Transactions button (multi-select existing transactions)
  - CSV import button
- **Invoice Details Report** as a tab in the unified Reports page:
  - Filters: Project, Customer, Date Range
  - Table with drill-down on Balance cell
  - Excel Export button

**Files to create/modify:**
- `backend/main.py` — add invoice routes + Report 3 endpoint
- `frontend/src/pages/Invoices.jsx` — NEW
- `frontend/src/pages/Reports.jsx` — NEW (unified tabbed reports container)
- `frontend/src/api.js` — add invoice API calls
- `frontend/src/App.jsx` — add `/invoices`, `/reports` routes
- `frontend/src/components/Layout.jsx` — add nav links

---

### Phase 6 — Advanced Reporting Engine

**Goal:** Implement Reports 1, 2 (enhanced), 4, 5, 8, 9, 10 with correct formulas from the Annex.

All report endpoints share the same response contract:
```json
{
  "rows": [...],
  "totals": {...},
  "drilldown_supported": true,
  "filters_applied": {}
}
```

#### Report 1 — Project P&L (`GET /reports/pnl`)

**Filters:** `project_id`, `date_from`, `date_to`, `status`
**Logic:** Query executed transactions → group by `category_id` + `counterparty_id`
**Formulas (direction sign: in=+1, out=−1):**
- `trans_value = SUM(sign(direction) * amount)`
- `vat_value = SUM(sign(direction) * vat_amount)`
- `value_no_vat = trans_value − vat_value`
- `withholding_value = SUM(sign(direction) * withholding_amount)`
- `value_no_vat_no_withholding = value_no_vat − withholding_value`

**Columns:** CategoryName | NegdiName | Trans Value | VAT Value | Value No VAT | Withholding Value | Value No VAT No Withholding

#### Report 2 — Plan vs Actual (Enhanced) (`GET /reports/plan-vs-actual`)

Enhance existing `/reports/budget/{id}`:
- Add VAT/withholding columns
- Filter by `direction='out'` (expenses only)
- Add counterparty grouping option
- Support `status` param (planned vs executed vs both)

#### Report 4 — Customer Transactions (`GET /reports/customer-transactions`)

**Filters:** `project_id`, `customer_id`, `date_from`, `date_to`
**Logic:** transactions WHERE `customer_id IS NOT NULL` AND `direction='in'` AND `status='executed'`
**Columns:** Customer | Project | Apartment | Transaction Date | Amount | Description | Source Ref

#### Report 5 — Customer Balance (`GET /reports/customer-balance`)

**Filters:** `project_id`, `customer_id`
**Logic:** For each apartment with `customer_id`:
- `price = apartments.sale_price`
- `received = SUM(transactions WHERE customer_id + apartment_id + direction='in' + status='executed')`
- `remaining = price − received`
- `pct_paid = received / price`

**Columns:** Customer | Floor | Apartment | Sale Price | Payments Plan | Left to Plan | Received | Customer Left to Pay | % Paid

#### Report 8 — Payments to Accounts by Project (`GET /reports/payments-by-project`)

**Filters:** `project_id`, `date_from`, `date_to`, `status`
**Logic:** transactions WHERE `direction='out'` → pivot by project × counterparty × YEAR-MONTH
**Columns:** Project | Counterparty/Account | [Month1] | [Month2] | ... | Grand Total

#### Report 9 — VAT Report (`GET /reports/vat`)

**Filters:** `project_id`, `date_from`, `date_to`
**Logic:** transactions WHERE `vat_amount > 0` AND `transaction_date` in range
**Columns:** Counterparty | Description | Transaction Date | Amount | VAT Amount

#### Report 10 — Withholding Tax Report (`GET /reports/withholding`)

**Filters:** `project_id`, `date_from`, `date_to`
**Logic:** transactions WHERE `withholding_amount > 0` AND `transaction_date` in range
**Columns:** Counterparty | Description | Transaction Date | Amount | Withholding Amount | (Totals per counterparty)

#### Frontend — Unified Reports Page

All reports as tabs in `/reports`:

| Tab | Report # | Status |
|-----|---------|--------|
| P&L | 1 | NEW |
| Plan vs Actual | 2 | Migrated from BudgetReport.jsx, enhanced |
| Invoice Details | 3 | Built in Phase 5 |
| Customer Transactions | 4 | NEW |
| Customer Balance | 5 | NEW |
| VAT Report | 9 | NEW |
| Withholding Tax | 10 | NEW |
| Payments by Project | 8 | NEW |

Each tab: Filter bar + Data table + Totals row + Excel Export button + Row click → drill-down modal

**Files to create/modify:**
- `backend/main.py` — add 7 new report endpoints; enhance 2 existing
- `frontend/src/pages/Reports.jsx` — unified tabbed reports page (NEW)
- `frontend/src/api.js` — add 8 report API functions

---

### Phase 7 — Forecast 2.0

**Goal:** Unified 12-month forecast with unpaid customer balances + multi-project comparison.

#### 7.1 Unpaid Balance Integration

Enhance `services/forecast_service.py`:
- Compute unpaid per apartment: `unpaid = sale_price − SUM(received payments)`
- Add unpaid amounts as expected inflows in forecast (roll forward overdue amounts to current month)
- Response distinguishes: `actual_income`, `planned_income`, `expected_collections`

#### 7.2 Company Cash Forecast (`GET /reports/forecast/company`)

- Scope: all projects consolidated
- Monthly: `inflows − outflows` for executed + planned + expected unpaid collections
- Cumulative cash with cash buffer alert threshold
- Enforce "Company" project: ensure project named "Company" is creatable/selectable

#### 7.3 Multi-Project Comparison (`GET /reports/forecast/projects`)

- Per-project monthly net flow (next 12 months)
- Response: per-project rows + consolidated total
- Comparison: next 3/6/12 months net, lowest cash point per project

#### 7.4 Frontend Changes

- **Dashboard.jsx**: Add "Expected Collections" KPI card (total unpaid customer balances)
- **PortfolioDashboard.jsx**: Add multi-project forecast comparison table
- **New page `/forecast`**: Company Forecast (12-month chart) + Project Comparison table

**Files to create/modify:**
- `backend/services/forecast_service.py` — overhaul with unpaid balance logic
- `backend/main.py` — add `/reports/forecast/company` and `/reports/forecast/projects`
- `frontend/src/pages/Dashboard.jsx` — add Expected Collections KPI
- `frontend/src/pages/PortfolioDashboard.jsx` — add forecast comparison table
- `frontend/src/pages/Forecast.jsx` — NEW unified forecast page
- `frontend/src/api.js` — add forecast API calls

---

### Phase 8 — Polishing & Export

**Goal:** Production-ready: Excel exports, audit log, performance, bulk imports.

#### 8.1 Excel Export (All 10 Reports)

- Add `openpyxl` to `requirements.txt`
- Create `backend/services/export_service.py`:
  ```python
  def export_to_excel(report_name: str, rows: list, totals: dict, filters: dict) -> BytesIO
  ```
- Add `?format=xlsx` param to all 10 report endpoints → `StreamingResponse` with Excel MIME type
- Column order must exactly match the Excel reference file tabs (per Annex headings)
- Metadata sheet: filters applied + generation timestamp

#### 8.2 Audit Log Population

Write to `audit_log` on changes to: transactions, invoices, customers, apartments

Helper function: `log_audit(db, entity_type, entity_id, action, old_data, new_data, actor_id)`

Trigger points in `main.py`: after every create/update/delete on core entities.

#### 8.3 Transaction Bulk Import

- `POST /imports/transactions` — accept CSV/Excel
- Required columns: project, date, amount, direction, category, counterparty, status, description
- Optional: source_ref, vat_amount, withholding_amount, customer, apartment, invoice_number
- Duplicate guard: by `source_ref` (if provided)
- Frontend: Import button in Transactions page

#### 8.4 Performance — DB Indexes

```sql
CREATE INDEX idx_tx_project_date ON transactions(project_id, date);
CREATE INDEX idx_tx_status_date ON transactions(status, date);
CREATE INDEX idx_tx_customer ON transactions(customer_id_fk);
CREATE INDEX idx_tx_invoice ON transactions(invoice_id);
CREATE INDEX idx_tx_counterparty ON transactions(counterparty_id);
```

#### 8.5 Security Review

- Ensure all new endpoints enforce the same auth rules as existing ones
- Validate: amount > 0, valid dates, FK references exist
- No raw string interpolation in SQL queries

**Files to create/modify:**
- `backend/services/export_service.py` — NEW
- `backend/services/audit_service.py` — NEW
- `backend/main.py` — add `?format=xlsx` to all report routes; add `/imports/transactions`
- `backend/requirements.txt` — add `openpyxl`
- `frontend/src/pages/Transactions.jsx` — add Excel export + CSV import
- `frontend/src/pages/Reports.jsx` — wire Excel export buttons to `?format=xlsx` endpoints

---

## Part 3 — Definition of Done Checklist

- [ ] All 10 reports return correct data matching the Excel reference file for the same dataset
- [ ] `vat_amount` and `withholding_amount` are stored on every transaction (auto-computed on save)
- [ ] `counterparties`, `customers`, `invoices`, `audit_log` tables exist and are populated
- [ ] `status` (planned/executed/cancelled) and `direction` (in/out) fields on all transactions
- [ ] "Company" project exists and company-level expenses appear in company-level reports
- [ ] Forecast includes planned transactions + unpaid customer balances rolled forward
- [ ] Multi-project cash forecast comparison is available in the UI
- [ ] Excel export works for all 10 reports matching column structure of Excel reference tabs
- [ ] Audit log populated on transaction, invoice, customer, and apartment changes
- [ ] All report drill-downs work (click number → source transaction list)
- [ ] No breaking changes to existing data (migration is additive and idempotent)
- [ ] Transaction bulk import working with duplicate guard by `source_ref`

---

## Appendix — File Impact Summary

| File | Phase(s) | Change Type |
|------|----------|-------------|
| `backend/models.py` | 4 | Add 4 models + new fields to existing models |
| `backend/schemas.py` | 4 | Add Pydantic schemas for new models |
| `backend/main.py` | 4, 5, 6, 7, 8 | Add ~20 new endpoints; update transaction save logic |
| `backend/migrations/phase4_migrate.py` | 4 | NEW — one-time additive migration script |
| `backend/services/forecast_service.py` | 7 | Major overhaul with unpaid balance logic |
| `backend/services/export_service.py` | 8 | NEW — openpyxl-based Excel export |
| `backend/services/audit_service.py` | 8 | NEW — audit log helper |
| `backend/requirements.txt` | 8 | Add openpyxl |
| `frontend/src/api.js` | 4–8 | Add ~25 new API functions |
| `frontend/src/App.jsx` | 4–6 | Add 6+ new routes |
| `frontend/src/components/Layout.jsx` | 4–6 | Add nav links for new pages |
| `frontend/src/pages/Transactions.jsx` | 4, 8 | Update form (counterparty, status, vat); add import |
| `frontend/src/pages/BudgetReport.jsx` | 6 | Migrate into Reports.jsx tabs |
| `frontend/src/pages/Dashboard.jsx` | 7 | Add Expected Collections KPI card |
| `frontend/src/pages/PortfolioDashboard.jsx` | 7 | Add multi-project forecast table |
| `frontend/src/pages/Counterparties.jsx` | 4 | NEW |
| `frontend/src/pages/Customers.jsx` | 4 | NEW |
| `frontend/src/pages/Invoices.jsx` | 5 | NEW |
| `frontend/src/pages/Reports.jsx` | 5, 6 | NEW — unified tabbed reports page |
| `frontend/src/pages/Forecast.jsx` | 7 | NEW — unified forecast page |
