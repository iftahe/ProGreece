# ProGreece - Project Documentation

**Last updated:** February 2025
**Repository:** https://github.com/iftahe/ProGreece
**Branch:** `main`
**Status:** Active

---

## 1. Overview

**ProGreece** is a full-stack web application for managing real-estate projects in Greece. It provides cash flow tracking, budget management, transaction recording, and financial forecasting across multiple projects.

### Core Capabilities

- Multi-project management with budget tracking
- Transaction recording with VAT and withholding tax support
- Budget vs. Actual comparison reports
- Cash flow forecasting with rolling logic for overdue payments
- CSV data import from external accounting sources

---

## 2. Architecture

```
+-------------------+        REST API        +-------------------+
|                   |  <------ JSON ------>  |                   |
|  React Frontend   |    http://localhost     |  FastAPI Backend  |
|  (Vite + Tailwind)|       :8000            |  (Python 3.13+)  |
|  Port 5173        |                        |                   |
+-------------------+                        +--------+----------+
                                                      |
                                              SQLAlchemy ORM
                                                      |
                                             +--------+----------+
                                             |    SQLite (Dev)   |
                                             |  PostgreSQL (Prod)|
                                             +-------------------+
```

### Backend Stack

| Component       | Technology              | Version  |
|-----------------|-------------------------|----------|
| Framework       | FastAPI                 | latest   |
| ORM             | SQLAlchemy              | latest   |
| Validation      | Pydantic                | latest   |
| Dev Server      | Uvicorn                 | latest   |
| Prod Server     | Gunicorn + Uvicorn      | latest   |
| Database (Dev)  | SQLite                  | built-in |
| Database (Prod) | PostgreSQL (psycopg2)   | latest   |

### Frontend Stack

| Component      | Technology        | Version  |
|----------------|-------------------|----------|
| UI Library     | React             | 19.2     |
| Build Tool     | Vite              | 7.2      |
| CSS Framework  | Tailwind CSS      | 3.4      |
| Charts         | Recharts          | 3.6      |
| HTTP Client    | Axios             | 1.13     |
| Routing        | React Router DOM  | 7.11     |
| Utilities      | clsx, tailwind-merge | latest |

### Python Dependencies (`requirements.txt`)

```
fastapi
uvicorn
sqlalchemy
pydantic
gunicorn
psycopg2-binary
```

> Note: `psycopg2-binary` is included for production PostgreSQL deployment. Development uses SQLite.

### Frontend Dependencies (`frontend/package.json`)

**Runtime:** react, react-dom, react-router-dom, axios, recharts, tailwindcss, postcss, autoprefixer, clsx, tailwind-merge

**Dev:** vite, @vitejs/plugin-react, eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, @types/react, @types/react-dom, globals

---

## 3. Project Structure

```
ProGreece/
|
|-- main.py                         # FastAPI app, all API endpoints
|-- database.py                     # SQLAlchemy engine + raw SQLite helper
|-- models.py                       # SQLAlchemy ORM models (6 tables)
|-- schemas.py                      # Pydantic request/response schemas
|-- requirements.txt                # Python dependencies
|-- render.yaml                     # Render.com deployment config
|-- greece_project.db               # SQLite database file (dev)
|
|-- services/
|   |-- forecast_service.py         # Cash flow forecast logic
|   |-- budget_report_service.py    # Budget vs actual report logic
|   +-- __init__.py
|
|-- frontend/
|   |-- package.json
|   |-- vite.config.js
|   |-- tailwind.config.js
|   |-- index.html
|   +-- src/
|       |-- main.jsx                # React entry point
|       |-- App.jsx                 # Router + layout wrapper
|       |-- api.js                  # Axios API client
|       |-- index.css               # Global styles
|       |-- App.css                 # App styles
|       |-- components/
|       |   +-- Layout.jsx          # Sidebar navigation layout
|       +-- pages/
|           |-- Dashboard.jsx       # Cash flow dashboard + charts
|           |-- Transactions.jsx    # Transaction CRUD
|           |-- Projects.jsx        # Project CRUD
|           +-- BudgetReport.jsx    # Budget vs actual report
|
|-- import_real_data.py             # Original CSV import script (v1)
|-- import_real_data_v2.py          # Fixed CSV import script (v2)
|-- import_plans.py                 # Payment plans import
|-- inspect_data_issues.py          # Diagnostic: investigate import bugs
|-- init_db.py                      # DB initialization script
|-- seed_data.py                    # Sample data seeder
|-- clean_data.py                   # Data cleanup utilities
|-- fix_data.py                     # Data correction utilities
|-- fix_db_schema.py                # Schema migration utilities
|
+-- CSV data files:
    |-- progreeace 34 - תנועות בפועל.csv      # Transaction data
    |-- progreeace 34 - Appartment_price_upload.csv  # Project/apartment data
    +-- progreeace 34 - AccountsImport.csv     # Accounts data
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
AccountType (1) ──────── (M) Account
                               |
                     from_account / to_account
                               |
Project (1) ──────── (M) Transaction
    |                          |
    |--- (M) BudgetCategory ---+  (via budget_item_id)
    |
    +--- (M) CustomerPaymentPlan
```

### 4.2 Tables

#### `account_types`

| Column | Type         | Notes       |
|--------|--------------|-------------|
| id     | Integer (PK) |             |
| name   | String(255)  | e.g. "Customer", "Supplier", "System/Middle" |

#### `accounts`

| Column            | Type         | Notes                        |
|-------------------|--------------|------------------------------|
| id                | Integer (PK) |                              |
| name              | String(255)  | Account display name         |
| account_type_id   | Integer (FK) | -> account_types.id          |
| remarks           | Text         | Optional notes               |
| is_system_account | Integer      | 0/1 flag; affects VAT logic  |

**Relationships:** `account_type` (M:1 -> AccountType)

#### `projects`

| Column              | Type           | Notes                                    |
|---------------------|----------------|------------------------------------------|
| id                  | Integer (PK)   |                                          |
| name                | String(255)    | Indexed                                  |
| status              | String(255)    | "Active", "Completed", "Archived"        |
| project_account_val | Numeric(18,2)  | Default 0                                |
| property_cost       | Numeric(18,2)  | Nullable                                 |
| remarks             | Text           | Optional notes                           |
| account_balance     | Numeric(18,2)  | Default 0                                |
| total_budget        | Numeric(18,2)  | Calculated dynamically at query time     |

**Important:** `total_budget` is stored in the DB but **overridden at query time** by summing `budget_categories.planned_amount` for the project (see `main.py` GET /projects/).

#### `transactions`

| Column           | Type           | Notes                                       |
|------------------|----------------|---------------------------------------------|
| id               | Integer (PK)   |                                             |
| project_id       | Integer (FK)   | -> projects.id                              |
| date             | DateTime       |                                             |
| phase_id         | Integer        | Logical link (not FK), used for plan matching |
| from_account_id  | Integer (FK)   | -> accounts.id (source)                     |
| to_account_id    | Integer (FK)   | -> accounts.id (destination)                |
| amount           | Numeric(18,2)  |                                             |
| vat_rate         | Numeric(10,4)  | Auto-set to 0 for system accounts           |
| withholding_rate | Numeric(10,4)  |                                             |
| remarks          | String(255)    |                                             |
| transaction_type | Integer        | 1 = Executed, 2 = Planned                   |
| cust_invoice     | String(255)    | Customer invoice number                     |
| cust_id          | Integer        | Logical link (not FK)                       |
| budget_item_id   | Integer (FK)   | -> budget_categories.id                     |
| category         | Text           | **Legacy** - populated by CSV import        |
| description      | Text           | **Legacy** - populated by CSV import        |
| supplier         | Text           | **Legacy** - populated by CSV import        |
| type             | Text           | **Legacy** - "expense" / "income"           |

**Relationships:** `project` (M:1), `from_account` (M:1), `to_account` (M:1)

**VAT Logic:** When creating or updating a transaction, if either `from_account` or `to_account` has `is_system_account = 1`, the `vat_rate` is automatically set to 0.

#### `budget_categories`

| Column         | Type         | Notes                       |
|----------------|--------------|-----------------------------|
| id             | Integer (PK) |                             |
| project_id     | Integer (FK) | -> projects.id              |
| category_name  | Text         | e.g. "Construction", "Law"  |
| planned_amount | Float        | Planned budget for category |

**Note:** `planned_amount` uses `Float` while other monetary fields use `Numeric(18,2)`. This inconsistency may cause precision issues.

**Default Categories** (created by `initialize_project_budget`):
Buying, License, Realtor, Law, Buy Tax, Notary, Construction, Materials, Architect, Unforeseen

#### `customer_payment_plans`

| Column      | Type           | Notes                      |
|-------------|----------------|----------------------------|
| id          | Integer (PK)   |                            |
| price_id    | Integer        | Logical link (not FK)      |
| phase_id    | Integer        | Logical link (not FK)      |
| manual_date | DateTime       | Payment target date        |
| value       | Numeric(18,2)  | Payment amount             |
| remarks     | Text           |                            |
| project_id  | Integer (FK)   | -> projects.id             |

**Note:** No Pydantic schema defined for this model. No dedicated API endpoint exists.

---

## 5. API Endpoints

All endpoints are defined in `main.py`.

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/`  | Returns `{"message": "ProGreece API is running"}` |

### Projects

| Method | Path                                  | Description                          |
|--------|---------------------------------------|--------------------------------------|
| GET    | `/projects/?skip=0&limit=100`         | List all projects (total_budget calculated dynamically) |
| POST   | `/projects/`                          | Create a new project                 |
| PUT    | `/projects/{project_id}`              | Update a project                     |
| GET    | `/projects/{project_id}/budget-items` | Get budget categories for a project  |

### Transactions

| Method | Path                              | Description                               |
|--------|-----------------------------------|-------------------------------------------|
| GET    | `/transactions/?skip=0&limit=100` | List all transactions                     |
| POST   | `/transactions/`                  | Create transaction (with auto VAT logic)  |
| PUT    | `/transactions/{transaction_id}`  | Update transaction (with auto VAT logic)  |
| DELETE | `/transactions/{transaction_id}`  | Delete a transaction                      |

### Reports

| Method | Path                              | Description                    |
|--------|-----------------------------------|--------------------------------|
| GET    | `/reports/budget/{project_id}`    | Budget vs Actual report        |
| GET    | `/reports/cash-flow/{project_id}` | Cash flow forecast             |

### Accounts

| Method | Path                       | Description          |
|--------|----------------------------|----------------------|
| GET    | `/accounts/?skip=0&limit=100` | List all accounts |

### API Documentation

FastAPI auto-generates interactive docs at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 6. Service Layer

### 6.1 Cash Flow Forecast (`services/forecast_service.py`)

**Function:** `generate_cash_flow_forecast(db, project_id)`

**Algorithm:**
1. Fetch all transactions for the project (actuals)
2. Fetch all customer payment plans (planned)
3. Build set of fulfilled `phase_id`s from executed transactions
4. For unfulfilled plans:
   - If `manual_date` is in the past -> roll forward to current month
   - If `manual_date` is in the future -> use as-is
5. Classify each transaction as income or expense based on account types:
   - `to_account` type contains "project"/"income"/"bank" -> income
   - `to_account` type contains "supplier"/"expense" -> expense
   - `from_account` type contains "project" -> expense
   - Default -> expense
6. Aggregate by month (YYYY-MM format)
7. Calculate cumulative balance

**Response format:**
```json
[
  {
    "date": "2024-05",
    "actual_income": 10000.0,
    "actual_expense": 5000.0,
    "planned_income": 20000.0,
    "planned_expense": 0.0,
    "net_flow": 25000.0,
    "cumulative_balance": 25000.0
  }
]
```

### 6.2 Budget Report (`services/budget_report_service.py`)

**Function:** `get_budget_report(project_id)`

**Algorithm:**
1. Fetch budget categories for the project
2. Fetch actual expenses from transactions (grouped by `budget_item_id` and `category`)
3. Match actuals to budget:
   - First by `budget_item_id` (exact match)
   - Fallback to case-insensitive `category_name` matching
4. Calculate variance (planned - actual) and progress percentage

**Additional functions:**
- `update_budget_item(item_id, new_amount)` - Update a budget category's planned amount
- `initialize_project_budget(project_id)` - Create default budget categories for a new project

---

## 7. Frontend

### 7.1 Routing (`App.jsx`)

| Path              | Component       | Description                  |
|-------------------|-----------------|------------------------------|
| `/`               | Dashboard       | Cash flow dashboard + charts |
| `/transactions`   | Transactions    | Transaction CRUD             |
| `/projects`       | Projects        | Project CRUD                 |
| `/budget-report`  | BudgetReport    | Budget vs actual report      |

### 7.2 API Client (`api.js`)

Axios instance with `baseURL` from environment variable `VITE_API_URL` (defaults to `http://localhost:8000`).

**Exported functions:**
- `getProjects()`, `createProject(data)`, `updateProject(id, data)`
- `getTransactions()`, `createTransaction(data)`, `updateTransaction(id, data)`, `deleteTransaction(id)`
- `getAccounts()`
- `getBudgetCategories(projectId)`, `updateBudgetCategory(itemId, amount)`
- `getBudgetReport(projectId)`
- `getCashFlowForecast(projectId)`

### 7.3 Pages

**Dashboard** - Cash flow chart (ComposedChart from Recharts) showing income/expense bars and cumulative balance line. Monthly breakdown table with actual/planned values. Project selector dropdown.

**Transactions** - Form to create/edit transactions with fields: date, project, from/to accounts, amount, VAT, withholding, remarks, status (Executed/Planned), budget category. Transaction history table with edit/delete actions.

**Projects** - Form to create/edit projects. Project list with name, status, total budget, and remarks.

**BudgetReport** - Budget vs actual comparison table with progress bars. Editable budget amounts. Variance calculation. Project selector.

### 7.4 Layout (`components/Layout.jsx`)

Responsive sidebar navigation with links to all four pages. Active route highlighting. Mobile-friendly.

---

## 8. Data Import

### 8.1 CSV Files

| File | Content |
|------|---------|
| `progreeace 34 - תנועות בפועל.csv` | Transaction records (76 rows) |
| `progreeace 34 - Appartment_price_upload.csv` | Projects and apartment prices |
| `progreeace 34 - AccountsImport.csv` | Account definitions |

### 8.2 Import Scripts

**`import_real_data.py` (v1 - Original)**
- Uses `dayfirst=True` for date parsing (problematic with mixed-format dates)
- Hardcodes all transactions as `type='expense'`
- Known bugs: see section 10

**`import_real_data_v2.py` (v2 - Fixed)**
- Uses `dayfirst=False` (MM/DD/YYYY) to match the actual CSV format
- Smart income/expense classification based on `from`/`to` accounts:
  - `to` contains "Trust" -> income
  - `to` contains "ProGreece" -> income
  - `from` contains "ProGreece" -> expense
  - Default -> expense
- Handles commas in amounts
- Clean start: deletes all existing transactions before import
- Prints verification for previously reported issues

**Run import:**
```bash
python import_real_data_v2.py
```

### 8.3 CSV Transaction Columns

```
ID, Date, Phaze, from, to, Amount, VAT, Withholding, Remarks,
from key, to key, phaze key, project key
```

Date format in CSV: **MM/DD/YYYY** (American format, e.g. `5/30/2024 0:00`)

---

## 9. Running the Application

### Development

**Backend:**
```bash
cd ProGreece
pip install -r requirements.txt
python init_db.py                    # Initialize database (first time)
python import_real_data_v2.py        # Import data from CSV
python main.py                       # Start server on http://127.0.0.1:8000
```

**Frontend:**
```bash
cd ProGreece/frontend
npm install
npm run dev                          # Start dev server on http://localhost:5173
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

### Production (Render.com)

Configured via `render.yaml`:

- **Backend:** Python web service, `gunicorn -k uvicorn.workers.UvicornWorker main:app`
- **Frontend:** Static site, `npm install && npm run build`, serves `dist/`

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `ALLOWED_ORIGINS` - CORS allowed origins
- `VITE_API_URL` - Backend URL (auto-injected from Render service)

---

## 10. Known Issues and Technical Debt

### Active Issues

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | `BudgetCategory.planned_amount` uses `Float` while all other monetary fields use `Numeric(18,2)` | `models.py:62` | Medium - may cause precision issues |
| 2 | CORS is fully open (`allow_origins: ["*"]`) | `main.py:18` | Low (dev) / High (prod) |
| 3 | `CustomerPaymentPlan` has no Pydantic schema or API endpoint | `models.py:66`, `schemas.py` | Medium |
| 4 | Legacy fields on Transaction (`category`, `description`, `supplier`, `type`) are populated by CSV import but not by the UI | `models.py:48-51` | Low |
| 5 | `phase_id`, `cust_id`, `price_id` are not proper foreign keys | `models.py` | Low |
| 6 | All routes in single `main.py` file (no router separation) | `main.py` | Low - will grow |

### Resolved Issues (February 2025)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Dates parsed with `dayfirst=True` caused misinterpretation of MM/DD dates | `import_real_data_v2.py` uses `dayfirst=False` |
| 2 | All imported transactions hardcoded as `type='expense'` | `import_real_data_v2.py` classifies based on from/to account names |

---

## 11. Current Status

### Completed
- [x] Multi-project support (DB + Frontend)
- [x] Budget categories model and management
- [x] Project management page (CRUD)
- [x] Transaction management page (CRUD)
- [x] Cash flow dashboard with charts
- [x] Cash flow forecast service with rolling logic
- [x] Budget vs Actual report
- [x] Automatic VAT logic for system accounts
- [x] CSV data import with smart classification (v2)
- [x] Render.com deployment configuration

### Planned
- [ ] Link transactions to budget categories via UI
- [ ] Payment phase management (CustomerPaymentPlan CRUD)
- [ ] Apartment price management
- [ ] Bank data import (CSV/Excel)
- [ ] Router separation in backend (move endpoints to separate files)
- [ ] Close CORS for production

---

## 12. Database Configuration (`database.py`)

```python
DB_NAME = "greece_project.db"
SQLALCHEMY_DATABASE_URL = "sqlite:///./greece_project.db"
```

Two access patterns:
1. **SQLAlchemy ORM** - Used by FastAPI endpoints via `SessionLocal`
2. **Raw SQLite** - Used by import scripts and budget report service via `get_db_connection()`

Tables are auto-created on server startup: `models.Base.metadata.create_all(bind=engine)`
