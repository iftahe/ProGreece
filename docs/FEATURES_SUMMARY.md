# ProGreece - Features & Changes Summary

> Financial Management System for Real Estate Projects in Greece
> Stack: Python/FastAPI + React/Vite + Tailwind CSS + PostgreSQL
> Last updated: February 2025

---

## Core Data Management

### Multi-Project Support
- Create, edit, and manage multiple real estate projects independently
- Project status tracking: Active / Completed / Archived
- Dynamic total budget calculation from budget categories
- Project selector persistent across all pages via URL parameters

### Budget Categories & Planning
- Hierarchical budget structure with 10 default categories per project (Buying, License, Realtor, Law, Buy Tax, Notary, Construction, Materials, Architect, Unforeseen)
- Editable planned amounts per category
- **Time-based budget planning** — schedule WHEN expenses will occur (date + amount + description per entry)
- Plan entries feed directly into cash flow forecasts
- Progress tracking: planned vs actual per category

### Transaction Management
- Full CRUD for financial transactions with date, amount, from/to accounts, remarks
- **Executed vs Planned** transaction types for separating actuals from forecasts
- **Automatic VAT logic** — VAT rate set to 0 when either account is a system account
- Withholding tax rate support
- Budget category linking per transaction
- Filterable list with date range, search, and type filters
- Paginated results

### Apartment Sales & Payment Tracking
- Record sold apartments with customer name, floor, unit number, sale price, ownership %
- **4 payment methods**: Bank Transfer, Trust Account, Cash, Direct to Owner
- Payment history per apartment with date, amount, method, notes
- Dynamic calculations: total paid, remaining balance, collection %
- KPI summary cards: Total Apartments, Total Revenue, Total Collected, Collection Rate
- Cascade delete (removing apartment removes all its payments)

### Account Management
- Chart of accounts with account types (Customer, Supplier, System/Middle)
- System account flag controls automatic VAT behavior

---

## Dashboards & Reports

### Cash Flow Forecast Dashboard
- **12-month rolling forecast** combining actuals and planned amounts
- Data sources: executed transactions, customer payment plans, budget plan entries
- **Rolling logic**: unfulfilled past plans automatically move to current month
- **Recharts visualization**: stacked bars (income/expense) + cumulative balance line
- Monthly breakdown table with expandable accordion detail
- Separation of actual vs planned for decision-making

### Budget vs Actual Report
- Side-by-side comparison of planned budget to actual spending
- **Color-coded progress bars**: Green (0-80%), Amber (80-100%), Red (>100%)
- Matching logic: primary via budget_item_id, fallback via category name
- Inline BudgetPlanEditor to add time-based spending entries per category
- Editable budget amounts pushed back to backend

### Portfolio Dashboard (Executive Overview)
- **Cross-project aggregation** for all active projects
- 4 KPI cards: Total Projects, Total Cash Position, Collection Rate, Budget Health Score
- **Budget health scoring** (0-100): penalizes over-budget and near-limit categories
- **Alerts panel**: over-budget categories, overdue apartment payments
- 12-month aggregated cash flow chart across all projects
- Project comparison table with inline progress bars
- Click-to-drill-down into individual project views

---

## UX/UI Features

### Navigation & Layout
- Fixed sidebar with 3 sections: Portfolio, Project (context-aware), Management
- Breadcrumb trail: ProGreece > Project Name > Page Name
- Project selector dropdown synced via URL query parameters (`?project=2`)
- Mobile hamburger menu with slide-out sidebar

### Design System
- **Tailwind CSS 3.4** with custom color palette (indigo primary, emerald income, rose expense)
- Elevation system: card shadows (sm/md/lg) for visual hierarchy
- 12+ custom SVG icons for navigation and actions
- Font-mono for decimal alignment on financial amounts
- Minimum text-sm (14px) for accessibility

### Reusable Components
- **Layout** — main wrapper with sidebar + breadcrumbs
- **BudgetPlanEditor** — inline panel for time-based budget entries
- **Icons** — 12+ SVG icon components
- **ConfirmDialog** — modal confirmation for destructive actions
- **Pagination** — controls for large data tables

### State Management
- **ProjectContext** — global project selection with URL param persistence
- Auto-selects first project when none specified
- Component-level state via React useState for page-specific data

---

## Data Import

### CSV Import
- **Apartment import** via API endpoint with CSV upload
- Project name mapping (case-insensitive)
- Apartment name construction from Floor + Apartment columns
- Skip logic for empty/padding rows
- Returns summary: imported count, skipped count, unmapped projects

### Transaction Import
- Script-based import from CSV files
- Smart income/expense classification based on account names
- Date format handling (MM/DD/YYYY)
- Comma-in-amounts support

---

## Backend Architecture

### API (40+ endpoints)
- **FastAPI** REST API with Pydantic validation
- CORS configured for frontend access
- Service layer separation: forecast, budget report, apartment import
- Response consistency with computed fields (total_paid, remaining, total_budget)

### Database (8 tables)
| Table | Purpose |
|-------|---------|
| projects | Real estate project definitions |
| budget_categories | Budget structure per project |
| budget_plans | Time-based expense entries |
| transactions | Financial movements |
| accounts | Chart of accounts |
| account_types | Account type definitions |
| apartments | Building units / sales |
| customer_payments | Apartment payment records |

### Testing
- **7 test files** using pytest
- Coverage: apartments, budget plans, CSV import, forecast, API endpoints, CRUD

### Deployment
- **Render.com** with render.yaml configuration
- Backend: gunicorn + uvicorn workers
- Frontend: Vite static build
- PostgreSQL (production), SQLite (development)

---

## Implementation Phases

### Phase 1 (Complete)
- [x] Multi-project support
- [x] Hierarchical budget (Phases > Categories)
- [x] Transaction management
- [x] Navigation redesign (sidebar + breadcrumbs)
- [x] Look & feel foundations (color palette, elevation, typography)

### Phase 2 (Complete)
- [x] Apartment sales & payment tracking
- [x] Cash flow dashboard with chart visualization
- [x] KPI cards on key pages
- [x] Portfolio dashboard (executive overview)
- [x] Time-based budget planning (BudgetPlan model + editor)
- [x] CSV apartment import

### Phase 3 (In Progress)
- [ ] Budget timeline / Gantt visualization (B2)
- [ ] Look & feel polish (E — typography refinements, color consistency)

---

## Key Architectural Decisions

1. **Dynamic budget totals** — computed at query time from category sums, not stored
2. **Service layer** — business logic in `services/` for reusability and testability
3. **URL-based state** — project selection persisted via URL params across navigation
4. **Pydantic validation** — request/response schemas with auto-generated API docs
5. **Cascade relationships** — apartment deletion cascades to payments
6. **Payment method enum** — string storage for SQLite compatibility, Pydantic-validated
7. **Rolling forecast logic** — unfulfilled past plans auto-shifted to current month

---

## File Structure

```
ProGreece/
├── backend/
│   ├── main.py              # API routes (40+ endpoints)
│   ├── models.py            # SQLAlchemy ORM (8 tables)
│   ├── schemas.py           # Pydantic validation
│   ├── database.py          # DB configuration
│   └── services/
│       ├── forecast_service.py
│       ├── budget_report_service.py
│       └── apartment_import_service.py
├── frontend/src/
│   ├── pages/
│   │   ├── PortfolioDashboard.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Apartments.jsx
│   │   ├── BudgetReport.jsx
│   │   ├── Transactions.jsx
│   │   └── Projects.jsx
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── BudgetPlanEditor.jsx
│   │   ├── Icons.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── Pagination.jsx
│   ├── contexts/ProjectContext.jsx
│   ├── lib/utils.js
│   └── api.js
└── docs/
```
