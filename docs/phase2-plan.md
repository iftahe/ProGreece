# Phase 2 Implementation Plan: Apartments + Budget Planning

## Context

The client needs two new features for ProGreece:
1. **Apartment Sales & Payment Tracking** - Track sold apartments, prices, and manually-recorded customer payments across various methods
2. **Time-Based Cash Flow Planning** - Plan *when* budget expenses will occur, improving the cash flow forecast accuracy

This builds on the existing multi-project financial management system (FastAPI + React + SQLAlchemy/SQLite).

---

## Agents Activated

| Agent | Role in This Task |
|-------|-------------------|
| **Architect** | Schema design, API structure, forecast logic integration |
| **Database Specialist** | New models, relationships, CSV import |
| **Full-Stack Developer** | API endpoints, React pages, components |
| **UX/UI Designer** | Apartments dashboard, budget plan editor UI |

---

## Step 1: Backend Models (`ProGreece/models.py`)

Add 3 new models after the existing `CustomerPaymentPlan`:

### Apartment
```python
class Apartment(Base):
    __tablename__ = "apartments"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)          # "Floor 4 - Apt 1"
    floor = Column(String(50), nullable=True)
    apartment_number = Column(String(50), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_key = Column(Integer, nullable=True)
    sale_price = Column(Numeric(18, 2), nullable=True)  # nullable for company-owned units
    ownership_percent = Column(Numeric(10, 4), nullable=True)
    remarks = Column(Text, nullable=True)
    project = relationship("Project", backref="apartments")
    payments = relationship("CustomerPayment", back_populates="apartment",
                           cascade="all, delete-orphan")
```

### CustomerPayment
```python
class CustomerPayment(Base):
    __tablename__ = "customer_payments"
    id = Column(Integer, primary_key=True, index=True)
    apartment_id = Column(Integer, ForeignKey("apartments.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    payment_method = Column(String(50), nullable=False, default="Bank Transfer")
    notes = Column(Text, nullable=True)
    apartment = relationship("Apartment", back_populates="payments")
```

Payment method values: `Bank Transfer`, `Trust Account`, `Cash`, `Direct to Owner` (validated via Pydantic enum, stored as string for SQLite compatibility).

### BudgetPlan
```python
class BudgetPlan(Base):
    __tablename__ = "budget_plans"
    id = Column(Integer, primary_key=True, index=True)
    budget_category_id = Column(Integer, ForeignKey("budget_categories.id"), nullable=False)
    planned_date = Column(DateTime, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    description = Column(Text, nullable=True)
    budget_category = relationship("BudgetCategory", backref="plans")
```

---

## Step 2: Pydantic Schemas (`ProGreece/schemas.py`)

Follow existing Base/Create/Full pattern:

- **PaymentMethodEnum** - `str, Enum` with 4 values
- **ApartmentBase/Create/Apartment** - includes computed `total_paid` and `remaining` fields (populated by API, not stored)
- **CustomerPaymentBase/Create/CustomerPayment** - validates payment_method via enum
- **BudgetPlanBase/Create/BudgetPlan** - standard schema

---

## Step 3: API Endpoints (`ProGreece/main.py`)

### Apartment CRUD (nested under project)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/apartments` | List apartments with computed total_paid/remaining |
| POST | `/projects/{project_id}/apartments` | Create apartment |
| PUT | `/apartments/{apartment_id}` | Update apartment |
| DELETE | `/apartments/{apartment_id}` | Delete apartment (cascades payments) |

The GET endpoint computes `total_paid = SUM(payments.amount)` and `remaining = sale_price - total_paid` dynamically (same pattern as `read_projects` computing `total_budget` at line 48 of main.py).

### Payment CRUD (nested under apartment)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/apartments/{apartment_id}/payments` | List payments for apartment |
| POST | `/apartments/{apartment_id}/payments` | Add payment |
| PUT | `/payments/{payment_id}` | Update payment |
| DELETE | `/payments/{payment_id}` | Delete payment |

### Budget Plan CRUD (nested under category)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/budget-categories/{category_id}/plans` | List plans for category |
| POST | `/budget-categories/{category_id}/plans` | Add plan entry |
| PUT | `/budget-plans/{plan_id}` | Update plan |
| DELETE | `/budget-plans/{plan_id}` | Delete plan |

### CSV Import
| Method | Path | Description |
|--------|------|-------------|
| POST | `/import/apartments` | Import from CSV file |

---

## Step 4: CSV Import Service (new file: `ProGreece/services/apartment_import_service.py`)

- Read `progreeace 34 - Appartment_price_upload.csv` (224 data rows)
- Map CSV `Project` names to existing `Project.id` via case-insensitive name matching
- Skip empty/padding rows (ProjectKey=0 or empty Project)
- Build apartment name from Floor + Apartment columns: `"Floor 4 - Apt 1"`
- Return `{imported: N, skipped: N, unmapped_projects: [...]}`
- Unmapped projects are reported (not auto-created) so user can create them first if needed

---

## Step 5: Update Forecast Service (`ProGreece/services/forecast_service.py`)

Add a new block after line 97 (after processing CustomerPaymentPlans) to incorporate BudgetPlan entries:

1. Query all `BudgetPlan` entries (filtered by project via join to BudgetCategory)
2. For each BudgetPlan entry:
   - If `planned_date` is in the past → roll to current month (same rolling logic as plans)
   - Add `amount` to `monthly_data[month_key]["planned_expense"]`
3. This means the cash flow chart will show planned expenses from BudgetPlan entries, giving an accurate forward-looking forecast

**Double-counting prevention:** BudgetPlan entries represent *planned* expenses. If actual transactions already exist for that budget category in that month, both will show (actual as `actual_expense`, plan as `planned_expense`). The dashboard already displays these separately, so the user can see the distinction. For a future enhancement, fulfilled plans could be filtered out like CustomerPaymentPlans.

---

## Step 6: Frontend API Functions (`ProGreece/frontend/src/api.js`)

Add 13 new functions following existing pattern:
- `getApartments(projectId)`, `createApartment(projectId, data)`, `updateApartment(id, data)`, `deleteApartment(id)`
- `getPayments(apartmentId)`, `createPayment(apartmentId, data)`, `updatePayment(id, data)`, `deletePayment(id)`
- `getBudgetPlans(categoryId)`, `createBudgetPlan(categoryId, data)`, `updateBudgetPlan(id, data)`, `deleteBudgetPlan(id)`
- `importApartments()`

---

## Step 7: New Icons (`ProGreece/frontend/src/components/Icons.jsx`)

- **ApartmentsIcon** - building icon for sidebar navigation
- **CalendarPlanIcon** - calendar icon for the "Plan" action button in BudgetReport

---

## Step 8: Apartments Page (new file: `ProGreece/frontend/src/pages/Apartments.jsx`)

### Layout
- Project selector dropdown (same pattern as Dashboard/BudgetReport)
- 4 KPI summary cards: Total Apartments, Total Revenue, Total Collected, Collection %
- Main apartments table
- Inline detail panel for selected apartment (payments)

### Apartments Table
| Column | Content |
|--------|---------|
| Apartment | Name (e.g., "Floor 4 - Apt 1") |
| Customer | Customer name |
| Sale Price | Formatted EUR |
| Total Paid | Formatted EUR |
| Remaining | Formatted EUR |
| Progress | Visual progress bar (emerald fill, like BudgetReport) |
| Actions | View details button |

### Apartment Detail Panel (inline, below selected row)
- Apartment info header (name, customer, price summary)
- Payment form: Date, Amount, Payment Method (select with 4 options), Notes
- Payments history table: Date, Amount, Method, Notes, Edit/Delete actions
- "Back to list" link to collapse

### State Management
Component-level with useState (consistent with all existing pages):
- `projects`, `selectedProjectId`, `apartments`, `selectedApartment`, `payments`, `paymentFormData`, `message`, `loading`

---

## Step 9: Enhance BudgetReport Page (`ProGreece/frontend/src/pages/BudgetReport.jsx`)

### Changes
1. Add a new "Actions" column to the budget table header
2. For each non-parent row, show a calendar/plan icon button
3. Clicking it opens an inline `BudgetPlanEditor` panel (rendered as an extra `<tr>` with `colSpan` below the category row)

### BudgetPlanEditor (new file: `ProGreece/frontend/src/components/BudgetPlanEditor.jsx`)
- Shows existing plan entries for the category (date, amount, description) in a mini-table
- Add form: Date picker, Amount input, Description text input
- Edit/Delete actions on each entry
- Summary line: "Total planned: X / Budget: Y" with a warning if they differ significantly
- Close button to collapse

---

## Step 10: Navigation & Routing

### Layout.jsx (line 6-11)
Add to navigation array:
```js
{ name: 'Apartments', href: '/apartments', icon: ApartmentsIcon }
```
Positioned between "Projects" and "Budget Report".

### App.jsx (line 13-18)
Add route:
```jsx
<Route path="/apartments" element={<Apartments />} />
```

---

## Implementation Order

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1 | Add 3 new models to models.py | models.py | - |
| 2 | Add schemas to schemas.py | schemas.py | Step 1 |
| 3 | Add Apartment + Payment API endpoints | main.py | Steps 1-2 |
| 4 | Add BudgetPlan API endpoints | main.py | Steps 1-2 |
| 5 | Create CSV import service + endpoint | services/apartment_import_service.py, main.py | Steps 1-3 |
| 6 | Add frontend API functions | frontend/src/api.js | Steps 3-4 |
| 7 | Add new icons | frontend/src/components/Icons.jsx | - |
| 8 | Create Apartments page | frontend/src/pages/Apartments.jsx | Steps 6-7 |
| 9 | Create BudgetPlanEditor component | frontend/src/components/BudgetPlanEditor.jsx | Step 6 |
| 10 | Enhance BudgetReport page | frontend/src/pages/BudgetReport.jsx | Step 9 |
| 11 | Update navigation + routing | Layout.jsx, App.jsx | Steps 7-8 |
| 12 | Update forecast service | services/forecast_service.py | Step 1 |

---

## Verification

1. **Start backend**: `cd ProGreece && python main.py` - tables auto-create
2. **Test Apartment API**: POST/GET apartments via `/projects/{id}/apartments`
3. **Test CSV Import**: POST `/import/apartments` and verify data loaded
4. **Test Payment API**: POST/GET payments via `/apartments/{id}/payments`
5. **Test Budget Plan API**: POST/GET plans via `/budget-categories/{id}/plans`
6. **Start frontend**: `cd frontend && npm run dev`
7. **Verify Apartments page**: Navigate to /apartments, select project, see table, add payment
8. **Verify Budget Planning**: Go to Budget Report, click Plan on a category, add installments
9. **Verify Forecast**: Check Dashboard cash flow chart shows planned_expense data from BudgetPlan entries
