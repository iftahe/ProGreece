# ProGreece UX/UI Review & Improvement Plan

**Date:** February 2025
**Prepared by:** UX/UI Designer Agent + Domain Expert Agent
**Status:** Approved for implementation

---

## Deliverable 1: UX Audit Report

### Current System Friction Points

#### CRITICAL (Production Blockers)

**1. No Pagination or Virtualization**
- Transactions table (`limit=10000` on API) loads everything at once
- Apartments page: 200+ rows with no pagination controls
- Dashboard cash flow table: unbounded rows (all forecast months)
- **Impact:** Browser will freeze with real production data volumes. This is the single biggest scalability issue.

**2. No Search or Filtering on Any Table**
- No date range picker on Dashboard or Transactions
- No project filter on the Transactions table (form has project selector, but the table shows ALL transactions across ALL projects)
- No customer name search on Apartments
- No category filter on Budget Report
- **Impact:** Finding a specific record requires visual scanning of hundreds of rows.

**3. State Lost on Navigation**
- User selects "Project Athens" on Dashboard, navigates to Apartments — resets to first project
- No URL query parameters (`?project=2`) to preserve context
- Each page independently fetches projects and defaults to the first one
- **Impact:** Repetitive friction on every single navigation event. For a tool used daily, this is extremely annoying.

#### MAJOR (Significant Usability Problems)

**4. Apartments Table: 200+ Rows with No Grouping**
- All apartments shown in a flat list regardless of floor, building, or payment status
- No visual distinction between fully-paid, partially-paid, and unpaid units
- Progress bars are uniform green — no color coding by urgency
- **Impact:** A project manager cannot quickly answer "which floors have outstanding payments?"

**5. Cash Flow Visualization is Table-Heavy**
- 9-column table with abbreviated headers ("Act. Inc.", "Plan. Inc.") — unclear terminology
- Chart and table show identical data — redundant vertical space
- No ability to zoom into a specific quarter or toggle between monthly/quarterly views
- No "Forecast vs. Actual" overlay that highlights divergence
- **Impact:** The most important decision-making view lacks the visual clarity needed for quick executive decisions.

**6. Budget Report Hierarchy Unclear**
- Parent vs. child categories differentiated only by bold text + indentation
- No expand/collapse tree controls
- Planning panel opens inline, breaking table visual flow
- Can't compare planning across multiple categories simultaneously
- **Impact:** With 10+ budget categories, the hierarchy becomes a wall of text.

**7. Form Complexity on Transactions Page**
- 10 input fields across 3 fieldsets (Date, Amount, Description, Project, Budget Category, From Account, To Account, VAT, Status...)
- From/To Account fields have unclear purpose for non-accountants
- "Remarks" in backend vs. "Description" in UI — naming mismatch
- No per-field validation feedback
- **Impact:** High cognitive load for frequent data entry tasks.

**8. Very Small Font Sizes in Nested Components**
- BudgetPlanEditor: all text at `text-xs` (12px) — financial amounts hard to read
- Payment history table: `text-xs` (12px)
- Action icons: `w-3 h-3` — very small click targets
- **Impact:** Eye strain, input errors, accessibility failure.

**9. Information Architecture: Flat Navigation**
- 5 top-level items in sidebar (Dashboard, Transactions, Projects, Apartments, Budget Report)
- No sub-navigation or contextual panels
- No "project scope" — each page is a standalone silo
- No breadcrumbs showing where you are
- **Impact:** User constantly re-orients. No sense of "I'm working in Project Athens right now."

#### MINOR (Polish & Professionalism)

**10. No Hebrew UI** — CLAUDE.md requires Hebrew for end users, but all labels are English

**11. No User Menu / Logout** — No account controls, no profile, no "working as" indicator

**12. Delete Confirmation uses `window.confirm()`** — browser-native dialog breaks the premium feel

**13. Inconsistent Button Sizing** — Some `py-2 px-4`, others `py-2.5 px-6`, uneven visual weight

**14. No Empty Dashboard Guidance** — New project with no data shows blank charts instead of onboarding prompts

**15. CSV Import: No Preview** — Apartments CSV import executes immediately with no preview, no undo, no validation display

---

## Deliverable 2: Concrete UI Proposals

### Proposal A: Apartments Dashboard Overhaul

#### A1. Floor-Grouped View with Status Indicators
```
+-------------------------------------------------------------+
|  Apartments & Payments          [Project v]  [View: Grid|List]|
+-------------------------------------------------------------+
|  Search customer or apartment...    [Filter: All v]          |
|                                     [Paid|Partial|Unpaid]    |
+-------------------------------------------------------------+
|  FLOOR 5                                          2/4 paid   |
|  +------------+ +------------+ +------------+ +------------+ |
|  | Apt 501    | | Apt 502    | | Apt 503    | | Apt 504    | |
|  | John S.    | | Maria K.   | | Nikos P.   | | --         | |
|  | #### 100%  | | ###. 72%   | | #### 100%  | | .... 0%    | |
|  | EUR250,000 | | EUR180,000 | | EUR320,000 | | EUR275,000 | |
|  | Paid       | | 50K left   | | Paid       | | No buyer   | |
|  +------------+ +------------+ +------------+ +------------+ |
|                                                               |
|  FLOOR 4                                          1/4 paid   |
|  +------------+ +------------+ ...                           |
|  | Apt 401    | | Apt 402    |                               |
|  +------------+ +------------+                               |
+-------------------------------------------------------------+
```

**Key changes:**
- **Grid view** option (default) groups apartments by floor — visual overview of the entire building
- **Color-coded status**: Green card = fully paid, Amber = partial, Gray = no buyer, Red = overdue
- **Search bar** with instant filter by customer name or apartment number
- **Status filter chips**: All | Paid | Partial | Unpaid
- **List view** toggle preserves the current table for detailed work
- Clicking a card opens a **slide-out panel** (right side) instead of inline expansion — keeps context visible

#### A2. Apartment Detail Slide-Out Panel
```
                                    +----------------------+
 [Main table stays visible]         |  Apt 502 - Floor 5   |
                                    |  Customer: Maria K.  |
                                    +----------------------+
                                    |  Sale: EUR250,000    |
                                    |  Paid: EUR180,000    |
                                    |  Remaining: EUR70,000|
                                    |  ========.. 72%      |
                                    +----------------------+
                                    |  Payment History     |
                                    |  +----+------+-----+ |
                                    |  |Date|Amount|Meth.| |
                                    |  |1/15|80K   |Bank | |
                                    |  |3/20|50K   |Trust| |
                                    |  |6/10|50K   |Bank | |
                                    |  +----+------+-----+ |
                                    |  [+ Add Payment]     |
                                    +----------------------+
```

**Why:** Inline expansion breaks the table. A slide-out panel lets the user see the apartment list AND payment details simultaneously.

---

### Proposal B: Cash Flow & Budgeting Visualization

#### B1. Interactive Forecast vs. Actual Chart
```
+-------------------------------------------------------------+
|  Cash Flow        [Project v]   [Monthly|Quarterly]  [2025] |
+-------------------------------------------------------------+
|  +----------+ +----------+ +----------+ +--------------+    |
|  | Income   | | Expenses | | Net Flow | | Cash Runway  |    |
|  | EUR1.2M  | | EUR980K  | | +EUR220K | | 8 months     |    |
|  | ^12% vs  | | v5% vs   | |          | | at burn rate |    |
|  | forecast | | forecast  | |          | |              |    |
|  +----------+ +----------+ +----------+ +--------------+    |
+-------------------------------------------------------------+
|                                                               |
|  [Stacked bar chart: Actual vs Planned income/expense]       |
|  [Cumulative balance line overlay]                            |
|  [Reference line at 0]                                        |
|                                                               |
|  -- Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep --           |
|     === Actual Income  ... Planned Income                     |
|     === Actual Expense ... Planned Expense                    |
|     --- Cumulative Balance                                    |
|                                                               |
|  [Zoom: Q1] [Q2] [Q3] [Q4] [Full Year]                      |
+-------------------------------------------------------------+
```

**Key changes:**
- **Stacked bars** distinguishing Actual (solid) vs. Planned (hatched/lighter) for both income and expense
- **Quarter zoom buttons** — click Q1 to see only Jan-Mar in detail
- **Monthly/Quarterly toggle** — aggregate view for big picture
- **New KPI: "Cash Runway"** — months of operation remaining at current burn rate
- **Trend indicators** on KPI cards (% vs. forecast)
- Replace the 9-column detail table with an **expandable accordion** per month — click a bar to see the breakdown

#### B2. Budget Timeline View (Replace Table-Only)
```
+-------------------------------------------------------------+
|  Budget Planning    [Project v]    [View: Table|Timeline]    |
+-------------------------------------------------------------+
|  TIMELINE VIEW                                                |
|                                                               |
|  Category        Jan   Feb   Mar   Apr   May   Jun           |
|  --------------------------------------------------------    |
|  Construction    ==============================  EUR2M       |
|                  ############...............  68%             |
|                                                               |
|  Materials       ========........            EUR100K          |
|                  ##############              104% WARNING     |
|                                                               |
|  Architect       ==================         EUR100K          |
|                  #########.........         52%               |
|                                                               |
|  ==== = Planned spending periods                              |
|  #### = Actual spending (overlaid)                            |
|  .... = Remaining planned                                     |
|  WARNING = Over budget                                        |
+-------------------------------------------------------------+
```

**Why:** A Gantt-like timeline shows WHEN spending happens, not just totals. This is critical for cash flow planning — the current table only shows amounts, not timing.

---

### Proposal C: Navigation & Information Hierarchy

#### C1. Project-Scoped Navigation
```
+--------------------------------------------------------------+
| +----------+  +---------------------------------------------+|
| | SIDEBAR  |  |                                              ||
| |          |  |  Content area                                ||
| | ProGreece|  |                                              ||
| |          |  |                                              ||
| | -- PORTFOLIO --|                                           ||
| | Overview |  |                                              ||
| |          |  |                                              ||
| | -- PROJECT --  |                                           ||
| | [Athens v]|  |  (Project-scoped pages below)               ||
| |          |  |                                              ||
| | Dashboard|  |                                              ||
| | Apartments|  |                                             ||
| | Budget   |  |                                              ||
| | Transactions|  |                                           ||
| |          |  |                                              ||
| | -- ADMIN --|  |                                            ||
| | Projects |  |                                              ||
| | Accounts |  |                                              ||
| | Settings |  |                                              ||
| +----------+  +---------------------------------------------+|
+--------------------------------------------------------------+
```

**Key changes:**
- **Project selector IN the sidebar** — once selected, ALL pages below operate in that project's scope
- **Three navigation sections:**
  - **Portfolio**: Cross-project overview (the new Executive Dashboard)
  - **Project**: Dashboard, Apartments, Budget, Transactions (all scoped to selected project)
  - **Admin**: Projects CRUD, Accounts management, Settings
- **Breadcrumb bar** at top of content area: `Portfolio > Athens > Apartments > Floor 5`
- **State persists** via URL: `/projects/2/apartments?floor=5`

#### C2. Recommended Page Flow
```
Portfolio Overview (new!)
  +-- Project Dashboard (cash flow + KPIs for one project)
        +-- Apartments (sales & payment tracking)
        +-- Budget Report (variance analysis + timeline)
        +-- Transactions (detailed ledger)

Admin Section:
  +-- Projects (CRUD)
  +-- Accounts (CRUD)
  +-- Settings (future)
```

**Why the current flow is wrong:**
- Current: Dashboard > Transactions > Projects > Apartments > Budget
- Problem: "Projects" (CRUD admin page) is mixed in between operational pages
- Solution: Separate admin/config pages from daily operational views

---

### Proposal D: Actionable KPI Cards

#### D1. Collection Progress %
```
+-----------------------------+
|  Collection Progress         |
|  ================.... 78.5% |
|  EUR3.14M / EUR4.0M collected|
|  ^ 2.3% from last month    |
|  12 apartments fully paid   |
|  8 with outstanding balance |
+-----------------------------+
```
**Data source:** `SUM(total_paid) / SUM(sale_price)` from Apartments endpoint. Already available.

#### D2. Next Month's Projected Gap
```
+-----------------------------+
|  March 2025 Projection       |
|  Income:   EUR180,000        |
|  Expenses: EUR245,000        |
|  -------------------------   |
|  Gap:      -EUR65,000  !!    |
|  Action needed: 3 overdue   |
|  payments totaling EUR72K   |
+-----------------------------+
```
**Data source:** Cash flow forecast endpoint — take next month's `planned_income` vs `planned_expense + actual_expense`. Cross-reference with overdue CustomerPaymentPlans.

#### D3. Budget Health Score
```
+-----------------------------+
|  Budget Health               |
|  Score: 87/100  * Good      |
|                              |
|  OK  7 categories on track  |
|  !!  2 categories >90% used |
|  XX  1 category over budget |
|                              |
|  Biggest risk: Materials     |
|  (104% -- EUR4,500 over)    |
+-----------------------------+
```
**Data source:** Budget Report endpoint — count categories by progress threshold.

---

### Proposal E: Look & Feel — Premium Financial Aesthetic

#### E1. Color Palette Refinement
```
Current                          Proposed
---------                        ---------
Primary: Indigo #4f46e5    -->   Slate Blue #3b5998 (more financial/corporate)
Sidebar: Slate-900 #0f172a -->   Navy #1a1f36 (deeper, more premium)
Income:  Emerald #10b981   -->   Keep (universal "money" green)
Expense: Rose #f43f5e      -->   Warm Red #dc2626 (less pink, more serious)
Warning: Amber #f59e0b     -->   Keep
Background: Slate-50       -->   Gray-50 #f9fafb (slightly warmer)
Cards: White + shadow-sm   -->   White + shadow-md + border-0 (elevated cards)
```

#### E2. Typography Upgrade
- Add **Inter** or **IBM Plex Sans** font — standard for financial dashboards
- Increase base body text to `text-sm` (14px) minimum everywhere
- Nested tables: `text-sm` (14px) instead of `text-xs` (12px)
- Financial amounts: `font-mono` for aligned decimal points
- KPI values: `text-3xl font-bold` for impact

#### E3. Card Elevation System
```
Level 0: bg-gray-50 (page background)
Level 1: bg-white shadow-sm rounded-xl border border-gray-100 (current cards)
Level 2: bg-white shadow-md rounded-xl (elevated cards -- KPIs, charts)
Level 3: bg-white shadow-lg rounded-2xl (modals, slide-out panels)
```

#### E4. Table Refinement
- Remove alternating row colors (visual noise with many columns)
- Use **subtle row hover** + **left border accent** for selected rows
- Sticky header on scroll
- Column resizing handles
- Condensed/comfortable density toggle

---

## Deliverable 3: Executive Dashboard — Wireframe Logic

### "Portfolio Overview" — Aggregates Everything

```
+------------------------------------------------------------------+
|  SIDEBAR  |  Portfolio Overview                    Feb 2025       |
|           |                                                       |
|           |  +-----------+ +-----------+ +-----------+ +--------+ |
|           |  | Total     | | Cash      | | Collection| |Budget  | |
|           |  | Projects  | | Position  | | Rate      | |Health  | |
|           |  | 3 active  | | EUR1.45M  | | 78.5%     | |87/100  | |
|           |  | 1 compltd | | ^EUR120K  | | ^2.3% mo  | |Good    | |
|           |  +-----------+ +-----------+ +-----------+ +--------+ |
|           |                                                       |
|           |  +----------------------+ +-------------------------+ |
|           |  | 12-MONTH CASH FLOW   | | ALERTS & ACTION ITEMS   | |
|           |  |                      | |                          | |
|           |  | [Stacked area chart] | | !! Materials over budget | |
|           |  | All projects overlay | |   Athens: EUR4,500 (104%)| |
|           |  | or selected project  | |                          | |
|           |  |                      | | !! 3 overdue payments    | |
|           |  | Income ===           | |   EUR72,000 outstanding  | |
|           |  | Expense ###          | |   [View details -->]     | |
|           |  | Balance ---          | |                          | |
|           |  |                      | | OK Construction on track | |
|           |  | [Project filter]     | |   68% complete, on pace  | |
|           |  |                      | |                          | |
|           |  +----------------------+ +-------------------------+ |
|           |                                                       |
|           |  +--------------------------------------------------+ |
|           |  | PROJECT COMPARISON TABLE                          | |
|           |  |                                                    | |
|           |  | Project     |Budget  |Spent  |Collected|Cash Flow | |
|           |  | ------------|--------|-------|---------|--------- | |
|           |  | Athens      |EUR3.0M |EUR2.1M|EUR3.14M |+EUR220K  | |
|           |  | ======================== 70%  ======== 78%        | |
|           |  | Thessaloniki|EUR1.5M |EUR0.9M|EUR1.1M  |+EUR85K   | |
|           |  | =============== 60%          ======== 73%         | |
|           |  | Crete       |EUR2.2M |EUR1.8M|EUR2.0M  |-EUR45K!! | |
|           |  | ======================== 82%  ============ 91%    | |
|           |  +--------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Executive Dashboard Components:

| Component | Data Source | Purpose |
|-----------|-----------|---------|
| **4 KPI Cards** | Projects + Apartments + Budget Report + Cash Flow APIs | At-a-glance health |
| **12-Month Cash Flow Chart** | `/reports/cash-flow/{id}` for each project, aggregated | Trend visualization |
| **Alerts Panel** | Budget Report (over-budget items) + Apartments (overdue payments) | Actionable next steps |
| **Project Comparison Table** | All projects with inline progress bars | Portfolio-level comparison |

### Data Requirements for Executive Dashboard:
All data sources **already exist** in the backend:
- `GET /projects/` — project list with total_budget
- `GET /reports/budget/{id}` — per-project variance data
- `GET /reports/cash-flow/{id}` — per-project cash flow
- `GET /projects/{id}/apartments` — collection totals

Only a new **aggregation endpoint** would be beneficial:
- `GET /reports/portfolio-summary` — returns all projects with key metrics pre-computed (avoids N+1 API calls from frontend)

---

## Implementation Priority (Recommended Order)

### Phase 1: Foundation (Do First)
1. **Proposal C** — Navigation restructure (project-scoped sidebar, URL state persistence)
2. **Proposal E** — Look & feel refresh (font, colors, card elevation, table refinement)

### Phase 2: Core Improvements
3. **Proposal A** — Apartments dashboard overhaul (grid view, slide-out panel, search/filter)
4. **Proposal B1** — Cash flow interactive chart (zoom, monthly/quarterly, stacked bars)
5. **Proposal D** — KPI cards (Collection %, Projected Gap, Budget Health)

### Phase 3: Advanced Features
6. **Proposal B2** — Budget timeline view (Gantt-like visualization)
7. **Executive Dashboard** — Portfolio Overview page (new route)
8. **Hebrew localization** — i18n framework + RTL support

---

## Technical Notes

### Backend Changes Required
- New endpoint: `GET /reports/portfolio-summary` (aggregation across projects)
- Add pagination parameters to existing endpoints (Transactions, Apartments)
- All other KPI data is already available from existing endpoints

### Frontend Architecture Changes
- Add React Context or URL-based state for selected project (shared across pages)
- Add react-router URL parameters for state persistence
- Consider adding a lightweight table library for pagination/sorting (e.g., TanStack Table)
- Add slide-out panel component (reusable for Apartments + Budget detail views)

### Current File Reference
```
Frontend Pages:
- frontend/src/pages/Dashboard.jsx (202 lines)
- frontend/src/pages/Transactions.jsx (422 lines)
- frontend/src/pages/Apartments.jsx (584 lines)
- frontend/src/pages/BudgetReport.jsx (334 lines)
- frontend/src/pages/Projects.jsx

Frontend Components:
- frontend/src/components/Layout.jsx (115 lines)
- frontend/src/components/BudgetPlanEditor.jsx (185 lines)
- frontend/src/components/Icons.jsx (103 lines)

Styling:
- frontend/src/index.css (42 lines)
- frontend/tailwind.config.js (36 lines)

API:
- frontend/src/api.js (~40 endpoints)
- frontend/src/lib/utils.js (32 lines)

Backend:
- backend main.py (all routes)
- services/forecast_service.py
- services/budget_report_service.py
```
