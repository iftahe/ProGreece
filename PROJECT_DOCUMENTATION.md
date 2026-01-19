# ProGreece - תיעוד מלא של הפרויקט

**תאריך עדכון אחרון:** ינואר 2025  
**פלטפורמת פיתוח:** Cursor (מעבר מ-Antigravity)  
**סטטוס:** פעיל ופועל

---

## 1. סקירה כללית (Overview)

**ProGreece** היא אפליקציית Web מלאה לניהול תזרים מזומנים (Cash Flow) וניהול תקציב פרויקטלי עבור פרויקטי נדל"ן ביוון. המערכת תומכת בריבוי פרויקטים, מעקב תקציב מול ביצוע, ניהול תנועות כספיות, ותחזית תזרים מזומנים.

### מטרות המערכת:
- ניהול ריבוי פרויקטים במקביל
- מעקב תזרים מזומנים (Actual vs Planned)
- ניהול תקציב היררכי (Budget Categories)
- ניהול תנועות כספיות (Transactions)
- דוחות ותחזיות תזרים מזומנים

---

## 2. ארכיטקטורה וטכנולוגיות

### 2.1 Backend Stack
- **Framework:** FastAPI (Python 3.13+)
- **ORM:** SQLAlchemy 2.0
- **Database:** SQLite (Development) / PostgreSQL (Production)
- **API Documentation:** FastAPI Swagger UI (`/docs`)
- **Server:** Uvicorn (Development) / Gunicorn (Production)

### 2.2 Frontend Stack
- **Framework:** React 19.2
- **Build Tool:** Vite 7.2
- **Styling:** Tailwind CSS 3.4
- **Charts:** Recharts 3.6
- **HTTP Client:** Axios 1.13
- **Routing:** React Router DOM 7.11

### 2.3 Infrastructure
- **Deployment:** Render.com (מוכן לפריסה)
- **Configuration:** `render.yaml` מוגדר
- **Environment Variables:** 
  - `DATABASE_URL` - חיבור לבסיס נתונים
  - `ALLOWED_ORIGINS` - רשימת origins מורשים (CORS)

### 2.4 מבנה הפרויקט
```
ProGreece/
├── main.py                 # FastAPI application & endpoints
├── database.py             # Database connection & session
├── models.py               # SQLAlchemy models
├── schemas.py              # Pydantic schemas (API validation)
├── requirements.txt        # Python dependencies
├── seed_data.py           # Script ליצירת דאטה ראשונית
├── init_db.py              # Script לאתחול בסיס נתונים
├── services/
│   └── forecast_service.py # לוגיקת תחזית תזרים מזומנים
├── frontend/
│   ├── src/
│   │   ├── api.js          # API client (Axios)
│   │   ├── App.jsx         # Main React app & routing
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # דשבורד תזרים מזומנים
│   │   │   ├── Projects.jsx    # ניהול פרויקטים
│   │   │   └── Transactions.jsx # ניהול תנועות
│   │   └── components/
│   │       └── Layout.jsx      # Layout component
│   └── package.json
└── greece_project.db       # SQLite database (development)
```

---

## 3. מודל נתונים (Database Schema)

### 3.1 Lookup Tables

#### AccountType
- `id` (PK)
- `name` - סוג חשבון (Customer, Supplier, System/Middle)

#### Category
- `id` (PK)
- `name` - שם קטגוריה
- `order` - סדר תצוגה
- `category_group` - קבוצת קטגוריה

### 3.2 Core Entities

#### Project
- `id` (PK)
- `name` (Unique) - שם הפרויקט
- `project_account_val` - ערך חשבון פרויקט
- `property_cost` - עלות נכס
- `status` - סטטוס (Active, Completed, Archived)
- `remarks` - הערות
- `account_balance` - יתרת חשבון
- `total_budget` - תקציב כולל

**Relationships:**
- `transactions` - תנועות של הפרויקט
- `apartment_prices` - מחירי דירות
- `payment_phases` - שלבי תשלום
- `budget_categories` - קטגוריות תקציב

#### Account
- `id` (PK)
- `name` - שם החשבון
- `account_type_id` (FK → AccountType)
- `remarks` - הערות
- `is_system_account` - האם חשבון מערכת (0/1)

**Relationships:**
- `account_type` - סוג החשבון
- `transactions_from` - תנועות יוצאות
- `transactions_to` - תנועות נכנסות

#### BudgetCategory
- `id` (PK)
- `project_id` (FK → Project)
- `name` - שם קטגוריה
- `parent_id` (FK → BudgetCategory) - תמיכה בהיררכיה
- `amount` - סכום תקציב
- `date` - תאריך

**Relationships:**
- `project` - הפרויקט
- `parent` / `children` - היררכיה
- `transactions` - תנועות משויכות

### 3.3 Operational Data

#### Transaction
- `id` (PK)
- `date` - תאריך תנועה
- `project_id` (FK → Project)
- `phase_id` - מזהה שלב תשלום
- `from_account_id` (FK → Account)
- `to_account_id` (FK → Account)
- `amount` - סכום
- `vat_rate` - שיעור מע"מ (%)
- `withholding_rate` - שיעור ניכוי במקור (%)
- `remarks` - הערות
- `transaction_type` - סוג תנועה (1=Executed, 2=Planned)
- `cust_invoice` - מספר חשבונית לקוח
- `cust_id` - מזהה לקוח
- `budget_item_id` (FK → BudgetCategory)

**Relationships:**
- `project` - הפרויקט
- `from_account` / `to_account` - חשבונות
- `budget_item` - קטגוריית תקציב

**לוגיקת VAT:**
- אם `from_account` או `to_account` הוא System Account (`is_system_account=1`), אז `vat_rate` מוגדר אוטומטית ל-0.
- אחרת, משתמש בערך שהוזן על ידי המשתמש.

### 3.4 Forecast & Planning

#### ProjectPaymentPhase
- `id` (PK)
- `project_id` (FK → Project)
- `name` - שם שלב
- `amount` - סכום שלב
- `target_date` - תאריך יעד
- `status` - סטטוס (Pending, Completed, etc.)
- `remarks` - הערות

#### ApartmentPrice
- `id` (PK)
- `project_id` (FK → Project)
- `customer_account_id` (FK → Account)
- `floor` - קומה
- `apartment` - מספר דירה
- `price` - מחיר
- `percent` - אחוז
- `remarks` - הערות

#### CustomerPaymentPlan
- `id` (PK)
- `price_id` (FK → ApartmentPrice)
- `phase_id` - מזהה שלב
- `manual_date` - תאריך ידני
- `value` - סכום תשלום מתוכנן
- `remarks` - הערות
- `project_id` - מזהה פרויקט (לא FK, למיטוב)

**תפקיד:** טבלה זו מניעה את החלק "Planned" בתחזית תזרים המזומנים.

---

## 4. API Endpoints

### 4.1 Projects

- `GET /projects/` - רשימת כל הפרויקטים
- `GET /projects/{project_id}` - פרטי פרויקט ספציפי
- `POST /projects/` - יצירת פרויקט חדש
- `PUT /projects/{project_id}` - עדכון פרויקט
- `GET /projects/{project_id}/budget-items` - קטגוריות תקציב של פרויקט

### 4.2 Accounts

- `GET /accounts/` - רשימת כל החשבונות
- `GET /accounts/{account_id}` - פרטי חשבון ספציפי
- `POST /accounts/` - יצירת חשבון חדש

### 4.3 Transactions

- `GET /transactions/` - רשימת כל התנועות
- `GET /transactions/{transaction_id}` - פרטי תנועה ספציפית
- `POST /transactions/` - יצירת תנועה חדשה (עם לוגיקת VAT אוטומטית)
- `PUT /transactions/{transaction_id}` - עדכון תנועה
- `DELETE /transactions/{transaction_id}` - מחיקת תנועה

### 4.4 Reports

- `GET /reports/cash-flow/{project_id}` - תחזית תזרים מזומנים לפרויקט

**תגובת Cash Flow Forecast:**
```json
[
  {
    "date": "2025-01",
    "actual_income": 100000.0,
    "actual_expense": 20000.0,
    "planned_income": 50000.0,
    "planned_expense": 0.0,
    "net_flow": 130000.0,
    "cumulative_balance": 130000.0
  }
]
```

---

## 5. פיצ'רים (Features)

### 5.1 Dashboard (Cash Flow Dashboard)

**מיקום:** `frontend/src/pages/Dashboard.jsx`

**תכונות:**
- בחירת פרויקט מתוך רשימה
- גרף תזרים מזומנים (ComposedChart):
  - עמודות: Income (ירוק), Expense (אדום)
  - קו: Cumulative Balance (כחול)
- טבלה מפורטת:
  - Actual Income/Expense
  - Planned Income/Expense
  - Total Income/Expense
  - Net Flow
  - Cumulative Balance

**נתונים:**
- נטען מ-`/reports/cash-flow/{project_id}`
- מעובד ומציג לפי חודשים

### 5.2 Projects Management

**מיקום:** `frontend/src/pages/Projects.jsx`

**תכונות:**
- יצירת פרויקט חדש
- עריכת פרויקט קיים
- רשימת כל הפרויקטים בטבלה
- שדות: שם, סטטוס, תקציב כולל, הערות

**API:**
- `GET /projects/` - טעינת רשימה
- `POST /projects/` - יצירה
- `PUT /projects/{id}` - עדכון

### 5.3 Transactions Management

**מיקום:** `frontend/src/pages/Transactions.jsx`

**תכונות:**
- יצירת תנועה חדשה
- עריכת תנועה קיימת
- מחיקת תנועה
- רשימת כל התנועות בטבלה
- שדות: תאריך, פרויקט, חשבון מ/אל, סכום, מע"מ, הערות, סטטוס

**לוגיקת VAT:**
- מוחלת אוטומטית ב-Backend
- אם אחד החשבונות הוא System Account, מע"מ = 0

**API:**
- `GET /transactions/` - טעינת רשימה
- `POST /transactions/` - יצירה
- `PUT /transactions/{id}` - עדכון
- `DELETE /transactions/{id}` - מחיקה

### 5.4 Cash Flow Forecast Service

**מיקום:** `services/forecast_service.py`

**לוגיקה:**
1. **טעינת נתונים:**
   - Transactions (Actuals)
   - CustomerPaymentPlan (Planned)

2. **Rolling Logic:**
   - תכניות שלא שולמו בעבר מועברות לחודש הנוכחי

3. **זיהוי Income vs Expense:**
   - Income: אם `to_account` הוא Project/Income/Bank
   - Expense: אם `to_account` הוא Supplier/Expense או `from_account` הוא Project

4. **איגוד לפי חודש:**
   - Actual Income/Expense
   - Planned Income/Expense
   - Net Flow = (Actual + Planned) Income - (Actual + Planned) Expense
   - Cumulative Balance

5. **פורמט פלט:**
   - מערך JSON לפי חודשים
   - כל רשומה מכילה את כל הנתונים לחודש

---

## 6. מבנה Frontend

### 6.1 Routing

**מיקום:** `frontend/src/App.jsx`

- `/` - Dashboard
- `/transactions` - Transactions Management
- `/projects` - Projects Management

### 6.2 API Client

**מיקום:** `frontend/src/api.js`

**פונקציות:**
- `getProjects()` - רשימת פרויקטים
- `createProject(data)` - יצירת פרויקט
- `updateProject(id, data)` - עדכון פרויקט
- `getAccounts()` - רשימת חשבונות
- `getTransactions()` - רשימת תנועות
- `createTransaction(data)` - יצירת תנועה
- `updateTransaction(id, data)` - עדכון תנועה
- `deleteTransaction(id)` - מחיקת תנועה
- `getCashFlowForecast(projectId)` - תחזית תזרים מזומנים

**Base URL:** `http://localhost:8000` (או `VITE_API_URL` מ-environment)

### 6.3 Components

#### Layout
- Sidebar navigation
- Main content area

#### Pages
- **Dashboard:** גרפים וטבלאות תזרים מזומנים
- **Projects:** CRUD פרויקטים
- **Transactions:** CRUD תנועות

---

## 7. הוראות הרצה

### 7.1 Development Setup

#### Backend:
```bash
# התקנת תלויות
pip install -r requirements.txt

# אתחול בסיס נתונים (אם צריך)
python init_db.py

# יצירת דאטה ראשונית (אופציונלי)
python seed_data.py

# הרצת שרת
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend:
```bash
cd frontend

# התקנת תלויות
npm install

# הרצת שרת פיתוח
npm run dev
```

**URLs:**
- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:5173` (או פורט אחר)
- API Docs: `http://localhost:8000/docs`

### 7.2 Production Deployment

**Render.com:**
- קובץ `render.yaml` מוגדר
- Backend: Python service עם Gunicorn
- Frontend: Static site build
- Database: PostgreSQL (מוגדר ב-Render)

**Environment Variables:**
- `DATABASE_URL` - חיבור PostgreSQL
- `ALLOWED_ORIGINS` - רשימת origins (CORS)

---

## 8. דאטה ראשונית (Seed Data)

**מיקום:** `seed_data.py`

**מה שנוצר:**
- **Account Types:** Customer, Supplier, System/Middle
- **Accounts:** 
  - Bank Leumi IL (System)
  - VAT Authority (System)
  - Yossi Cohen (Investor) - Customer
  - BuildIt Ltd - Supplier
- **Project:** "Athens Luxury 1"
- **Transactions:** 
  - הכנסה: 100,000 (לפני 60 יום)
  - הוצאה: 20,000 (לפני 30 יום)
- **Payment Plans:**
  - 50,000 (איחור - יועבר לחודש נוכחי)
  - 50,000 (בעוד 30 יום)

**הרצה:**
```bash
python seed_data.py
```

---

## 9. הערות חשובות

### 9.1 מעבר מ-Antigravity ל-Cursor

הפרויקט פותח במקור באמצעות **Antigravity** והועבר לפיתוח ב-**Cursor**.

**שינויים:**
- אין שינוי בקוד או בארכיטקטורה
- כל הקבצים והמבנה נשמרו
- הפרויקט רץ בצורה זהה בשתי הפלטפורמות

**יתרונות Cursor:**
- תמיכה טובה יותר ב-AI-assisted coding
- אינטגרציה טובה יותר עם Git
- ביצועים משופרים

### 9.2 Database Schema Updates

המודל כולל שדה `total_budget` ב-Project שלא היה קיים בגרסאות קודמות. אם יש בסיס נתונים ישן, יש למחוק אותו וליצור מחדש עם `seed_data.py`.

### 9.3 VAT Logic

לוגיקת המע"מ מוחלת אוטומטית ב-Backend:
- אם `from_account` או `to_account` הוא System Account (`is_system_account=1`), מע"מ = 0
- אחרת, משתמש בערך שהוזן

### 9.4 Cash Flow Forecast Logic

התחזית משלבת:
- **Actuals:** תנועות שבוצעו (Transactions)
- **Planned:** תכניות תשלום עתידיות (CustomerPaymentPlan)
- **Rolling:** תכניות מאוחרות מועברות לחודש הנוכחי

---

## 10. סטטוס נוכחי

### ✅ הושלם:
- [x] תמיכה בריבוי פרויקטים
- [x] מודל תקציב היררכי (BudgetCategory)
- [x] מסך ניהול פרויקטים
- [x] מסך ניהול תנועות
- [x] דשבורד תזרים מזומנים
- [x] לוגיקת תחזית תזרים מזומנים
- [x] לוגיקת VAT אוטומטית
- [x] API מלא (CRUD)
- [x] Frontend מלא (React + Tailwind)
- [x] מוכן לפריסה (Render.com)

### 🔄 בתכנון:
- [ ] שיוך תנועות לקטגוריות תקציב ב-UI
- [ ] דוחות תקציב (Budget vs Actual)
- [ ] יבוא נתונים מבנק (CSV/Excel)
- [ ] ניהול שלבי תשלום (Payment Phases)
- [ ] ניהול מחירי דירות (Apartment Prices)

---

## 11. קישורים שימושיים

- **API Documentation:** `http://localhost:8000/docs` (Swagger UI)
- **GitHub Repository:** `https://github.com/iftahe/ProGreece`
- **Branch:** `feature/budget-model`

---

**מסמך זה עודכן לאחרונה:** ינואר 2025  
**מפתח:** ProGreece Team  
**פלטפורמת פיתוח:** Cursor
