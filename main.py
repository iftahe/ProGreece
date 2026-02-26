from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import models, schemas
import services.budget_report_service
import services.forecast_service
from database import SessionLocal, engine, DB_NAME, IS_RENDER

# Create tables (only if they don't exist)
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Routes ---

@app.get("/")
def read_root():
    return {"message": "ProGreece API is running"}

@app.get("/health")
def health_check():
    """Health check endpoint for deployment diagnostics."""
    status = {"api": "ok", "render": bool(IS_RENDER), "db_path": DB_NAME}
    try:
        db_exists = os.path.exists(DB_NAME)
        status["db_file_exists"] = db_exists
        if db_exists:
            status["db_size_bytes"] = os.path.getsize(DB_NAME)
        db = SessionLocal()
        count = db.query(models.Project).count()
        status["db_connected"] = True
        status["project_count"] = count

        # Duplicate apartment audit
        dup_query = db.query(
            models.Apartment.project_id,
            models.Apartment.apartment_number,
            func.count(models.Apartment.id).label("cnt")
        ).filter(
            models.Apartment.apartment_number.isnot(None),
            models.Apartment.apartment_number != "",
        ).group_by(
            models.Apartment.project_id,
            models.Apartment.apartment_number,
        ).having(func.count(models.Apartment.id) > 1).all()

        extra_copies = sum(row.cnt - 1 for row in dup_query)
        status["duplicate_apartments"] = extra_copies
        status["duplicate_apartment_groups"] = [
            {"project_id": row.project_id, "apartment_number": row.apartment_number, "count": row.cnt}
            for row in dup_query
        ]

        db.close()
    except Exception as e:
        status["db_connected"] = False
        status["db_error"] = str(e)
    return status

@app.get("/projects/", response_model=List[schemas.Project])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(models.Project).offset(skip).limit(limit).all()
    
    # Calculate total_budget dynamically for each project
    result = []
    for project in projects:
        # Sum all planned_amount from budget_categories for this project
        total_budget = db.query(func.sum(models.BudgetCategory.planned_amount)).filter(
            models.BudgetCategory.project_id == project.id
        ).scalar() or 0
        
        # Create a dict with all project fields and override total_budget
        project_dict = {
            "id": project.id,
            "name": project.name,
            "status": project.status,
            "project_account_val": float(project.project_account_val) if project.project_account_val else 0,
            "property_cost": float(project.property_cost) if project.property_cost else None,
            "remarks": project.remarks,
            "account_balance": float(project.account_balance) if project.account_balance else 0,
            "total_budget": float(total_budget) if total_budget else None
        }
        result.append(project_dict)
    
    return result

@app.post("/projects/", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(
        name=project.name, 
        status=project.status or "Active",
        project_account_val=project.project_account_val or 0,
        property_cost=project.property_cost,
        remarks=project.remarks,
        account_balance=project.account_balance or 0,
        total_budget=project.total_budget
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.put("/projects/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_project.name = project.name
    db_project.status = project.status or "Active"
    db_project.project_account_val = project.project_account_val or 0
    db_project.property_cost = project.property_cost
    db_project.remarks = project.remarks
    db_project.account_balance = project.account_balance or 0
    db_project.total_budget = project.total_budget
    
    db.commit()
    db.refresh(db_project)
    return db_project

@app.get("/transactions/")
def read_transactions(
    skip: int = 0,
    limit: int = 50,
    project_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    transaction_type: Optional[int] = None,
    tx_type: Optional[str] = None,
    budget_item_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Transaction)
    if project_id:
        query = query.filter(models.Transaction.project_id == project_id)
    if budget_item_id:
        query = query.filter(models.Transaction.budget_item_id == budget_item_id)
    if date_from:
        query = query.filter(models.Transaction.date >= datetime.fromisoformat(date_from))
    if date_to:
        dt_to = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59)
        query = query.filter(models.Transaction.date <= dt_to)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                models.Transaction.remarks.ilike(pattern),
                models.Transaction.description.ilike(pattern),
                models.Transaction.supplier.ilike(pattern),
                models.Transaction.category.ilike(pattern),
            )
        )
    if transaction_type is not None:
        query = query.filter(models.Transaction.transaction_type == transaction_type)
    if tx_type:
        query = query.filter(models.Transaction.type == tx_type)
    total = query.count()
    transactions = query.order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()
    return {"items": transactions, "total": total, "skip": skip, "limit": limit}

@app.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    # Handle VAT logic: if from_account or to_account is system account, set vat_rate to 0
    vat_rate = transaction.vat_rate or 0
    if transaction.from_account_id:
        from_acc = db.query(models.Account).filter(models.Account.id == transaction.from_account_id).first()
        if from_acc and from_acc.is_system_account:
            vat_rate = 0
    if transaction.to_account_id:
        to_acc = db.query(models.Account).filter(models.Account.id == transaction.to_account_id).first()
        if to_acc and to_acc.is_system_account:
            vat_rate = 0

    transaction_data = transaction.dict()
    transaction_data['vat_rate'] = vat_rate
    db_transaction = models.Transaction(**transaction_data)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)

    # Feature 3: Upsert AccountCategoryMapping
    _upsert_account_category_mapping(db, db_transaction)

    return db_transaction

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: int, transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Handle VAT logic
    vat_rate = transaction.vat_rate or 0
    if transaction.from_account_id:
        from_acc = db.query(models.Account).filter(models.Account.id == transaction.from_account_id).first()
        if from_acc and from_acc.is_system_account:
            vat_rate = 0
    if transaction.to_account_id:
        to_acc = db.query(models.Account).filter(models.Account.id == transaction.to_account_id).first()
        if to_acc and to_acc.is_system_account:
            vat_rate = 0

    transaction_data = transaction.dict()
    transaction_data['vat_rate'] = vat_rate

    for key, value in transaction_data.items():
        setattr(db_transaction, key, value)

    db.commit()
    db.refresh(db_transaction)

    # Feature 3: Upsert AccountCategoryMapping
    _upsert_account_category_mapping(db, db_transaction)

    return db_transaction

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(db_transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}

# --- דוחות ותקציב ---

@app.get("/reports/budget/{project_id}")
def get_budget_report(project_id: int):
    # שימוש בפונקציה החדשה והנכונה מה-Service
    try:
        return services.budget_report_service.get_budget_report(project_id)
    except Exception as e:
        print(f"Error generating budget report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/cash-flow/{project_id}")
def get_cash_flow_forecast(project_id: int, db: Session = Depends(get_db)):
    """תחזית תזרים מזומנים לפרויקט"""
    try:
        return services.forecast_service.generate_cash_flow_forecast(db, project_id)
    except Exception as e:
        print(f"Error generating cash flow forecast: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{project_id}/budget-items", response_model=List[schemas.BudgetCategory])
def read_project_budget_items(project_id: int, db: Session = Depends(get_db)):
    items = db.query(models.BudgetCategory).filter(models.BudgetCategory.project_id == project_id).all()
    return items

@app.put("/budget-categories/{category_id}", response_model=schemas.BudgetCategory)
def update_budget_category(category_id: int, update: schemas.BudgetCategoryUpdate, db: Session = Depends(get_db)):
    db_category = db.query(models.BudgetCategory).filter(models.BudgetCategory.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Budget category not found")
    if update.planned_amount is not None:
        db_category.planned_amount = update.planned_amount
    if update.category_name is not None:
        db_category.category_name = update.category_name
    db.commit()
    db.refresh(db_category)
    return db_category

# --- Accounts ---

@app.get("/accounts/", response_model=List[schemas.Account])
def read_accounts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """רשימת כל החשבונות"""
    try:
        accounts = db.query(models.Account).offset(skip).limit(limit).all()
        return accounts
    except Exception as e:
        print(f"Error fetching accounts: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- Apartments ---

@app.get("/projects/{project_id}/apartments")
def read_apartments(project_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(models.Apartment).filter(models.Apartment.project_id == project_id)
    total = query.count()
    apartments = query.offset(skip).limit(limit).all()
    result = []
    for apt in apartments:
        total_paid = db.query(func.sum(models.CustomerPayment.amount)).filter(
            models.CustomerPayment.apartment_id == apt.id
        ).scalar() or 0
        sale_price = float(apt.sale_price) if apt.sale_price else None
        remaining = (sale_price - float(total_paid)) if sale_price is not None else None
        result.append({
            "id": apt.id,
            "project_id": apt.project_id,
            "name": apt.name,
            "floor": apt.floor,
            "apartment_number": apt.apartment_number,
            "customer_name": apt.customer_name,
            "customer_key": apt.customer_key,
            "sale_price": sale_price,
            "ownership_percent": float(apt.ownership_percent) if apt.ownership_percent else None,
            "remarks": apt.remarks,
            "total_paid": float(total_paid),
            "remaining": remaining,
        })
    return {"items": result, "total": total, "skip": skip, "limit": limit}

@app.post("/projects/{project_id}/apartments", response_model=schemas.Apartment)
def create_apartment(project_id: int, apartment: schemas.ApartmentCreate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db_apartment = models.Apartment(project_id=project_id, **apartment.dict())
    db.add(db_apartment)
    db.commit()
    db.refresh(db_apartment)
    return {**db_apartment.__dict__, "total_paid": 0, "remaining": float(db_apartment.sale_price) if db_apartment.sale_price else None}

@app.put("/apartments/{apartment_id}", response_model=schemas.Apartment)
def update_apartment(apartment_id: int, apartment: schemas.ApartmentCreate, db: Session = Depends(get_db)):
    db_apartment = db.query(models.Apartment).filter(models.Apartment.id == apartment_id).first()
    if not db_apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    for key, value in apartment.dict().items():
        setattr(db_apartment, key, value)
    db.commit()
    db.refresh(db_apartment)
    total_paid = db.query(func.sum(models.CustomerPayment.amount)).filter(
        models.CustomerPayment.apartment_id == apartment_id
    ).scalar() or 0
    sale_price = float(db_apartment.sale_price) if db_apartment.sale_price else None
    remaining = (sale_price - float(total_paid)) if sale_price is not None else None
    return {**db_apartment.__dict__, "total_paid": float(total_paid), "remaining": remaining}

@app.delete("/apartments/{apartment_id}")
def delete_apartment(apartment_id: int, db: Session = Depends(get_db)):
    db_apartment = db.query(models.Apartment).filter(models.Apartment.id == apartment_id).first()
    if not db_apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    db.delete(db_apartment)
    db.commit()
    return {"message": "Apartment deleted successfully"}

# --- Customer Payments ---

@app.get("/apartments/{apartment_id}/payments", response_model=List[schemas.CustomerPayment])
def read_payments(apartment_id: int, db: Session = Depends(get_db)):
    payments = db.query(models.CustomerPayment).filter(
        models.CustomerPayment.apartment_id == apartment_id
    ).order_by(models.CustomerPayment.date.desc()).all()
    return payments

@app.post("/apartments/{apartment_id}/payments", response_model=schemas.CustomerPayment)
def create_payment(apartment_id: int, payment: schemas.CustomerPaymentCreate, db: Session = Depends(get_db)):
    apartment = db.query(models.Apartment).filter(models.Apartment.id == apartment_id).first()
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    db_payment = models.CustomerPayment(apartment_id=apartment_id, **payment.dict())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.put("/payments/{payment_id}", response_model=schemas.CustomerPayment)
def update_payment(payment_id: int, payment: schemas.CustomerPaymentCreate, db: Session = Depends(get_db)):
    db_payment = db.query(models.CustomerPayment).filter(models.CustomerPayment.id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    for key, value in payment.dict().items():
        setattr(db_payment, key, value)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = db.query(models.CustomerPayment).filter(models.CustomerPayment.id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(db_payment)
    db.commit()
    return {"message": "Payment deleted successfully"}

# --- Budget Plans ---

@app.get("/budget-categories/{category_id}/plans", response_model=List[schemas.BudgetPlan])
def read_budget_plans(category_id: int, db: Session = Depends(get_db)):
    plans = db.query(models.BudgetPlan).filter(
        models.BudgetPlan.budget_category_id == category_id
    ).order_by(models.BudgetPlan.planned_date).all()
    return plans

@app.post("/budget-categories/{category_id}/plans", response_model=schemas.BudgetPlan)
def create_budget_plan(category_id: int, plan: schemas.BudgetPlanCreate, db: Session = Depends(get_db)):
    category = db.query(models.BudgetCategory).filter(models.BudgetCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Budget category not found")
    db_plan = models.BudgetPlan(budget_category_id=category_id, **plan.dict())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

@app.put("/budget-plans/{plan_id}", response_model=schemas.BudgetPlan)
def update_budget_plan(plan_id: int, plan: schemas.BudgetPlanCreate, db: Session = Depends(get_db)):
    db_plan = db.query(models.BudgetPlan).filter(models.BudgetPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Budget plan not found")
    for key, value in plan.dict().items():
        setattr(db_plan, key, value)
    db.commit()
    db.refresh(db_plan)
    return db_plan

@app.delete("/budget-plans/{plan_id}")
def delete_budget_plan(plan_id: int, db: Session = Depends(get_db)):
    db_plan = db.query(models.BudgetPlan).filter(models.BudgetPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Budget plan not found")
    db.delete(db_plan)
    db.commit()
    return {"message": "Budget plan deleted successfully"}

# --- Portfolio Summary ---

@app.get("/reports/portfolio-summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """Aggregated portfolio summary across all active projects."""
    projects = db.query(models.Project).filter(
        models.Project.status.in_(["Active", "Completed"])
    ).all()

    project_summaries = []
    total_budget_all = 0
    total_spent_all = 0
    total_collected_all = 0
    total_revenue_all = 0

    for project in projects:
        # Budget: sum of planned amounts
        total_budget = db.query(func.sum(models.BudgetCategory.planned_amount)).filter(
            models.BudgetCategory.project_id == project.id
        ).scalar() or 0
        total_budget = float(total_budget)

        # Actual spending: sum of expense transactions (executed only)
        actual_spent = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.project_id == project.id,
            models.Transaction.transaction_type == 1,
            models.Transaction.type == "expense"
        ).scalar() or 0
        actual_spent = float(actual_spent)

        # Apartments: collection data
        apartments = db.query(models.Apartment).filter(
            models.Apartment.project_id == project.id
        ).all()

        total_revenue = 0
        total_collected = 0
        apartments_count = len(apartments)
        fully_paid = 0

        for apt in apartments:
            sale_price = float(apt.sale_price) if apt.sale_price else 0
            paid = db.query(func.sum(models.CustomerPayment.amount)).filter(
                models.CustomerPayment.apartment_id == apt.id
            ).scalar() or 0
            paid = float(paid)
            total_revenue += sale_price
            total_collected += paid
            if sale_price > 0 and paid >= sale_price:
                fully_paid += 1

        collection_rate = (total_collected / total_revenue * 100) if total_revenue > 0 else 0
        budget_progress = (actual_spent / total_budget * 100) if total_budget > 0 else 0

        # Budget health: count categories by status
        budget_items = db.query(models.BudgetCategory).filter(
            models.BudgetCategory.project_id == project.id
        ).all()

        categories_ok = 0
        categories_warning = 0
        categories_over = 0
        worst_category = None
        worst_overrun = 0

        for cat in budget_items:
            planned = float(cat.planned_amount) if cat.planned_amount else 0
            if planned <= 0:
                continue
            cat_actual = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.budget_item_id == cat.id,
                models.Transaction.transaction_type == 1
            ).scalar() or 0
            cat_actual = float(cat_actual)
            cat_progress = (cat_actual / planned * 100) if planned > 0 else 0

            if cat_progress > 100:
                categories_over += 1
                overrun = cat_actual - planned
                if overrun > worst_overrun:
                    worst_overrun = overrun
                    worst_category = {"name": cat.category_name, "progress": round(cat_progress, 1), "overrun": round(overrun, 2)}
            elif cat_progress > 90:
                categories_warning += 1
            else:
                categories_ok += 1

        total_cats = categories_ok + categories_warning + categories_over
        budget_health = round(max(0, 100 - (categories_over * 20) - (categories_warning * 5)), 0) if total_cats > 0 else 100

        # Cash flow for this project
        try:
            cash_flow = services.forecast_service.generate_cash_flow_forecast(db, project.id)
            net_cash_flow = sum(row.get("net_flow", 0) for row in cash_flow)
        except Exception:
            cash_flow = []
            net_cash_flow = 0

        project_summaries.append({
            "id": project.id,
            "name": project.name,
            "status": project.status,
            "total_budget": round(total_budget, 2),
            "actual_spent": round(actual_spent, 2),
            "budget_progress": round(budget_progress, 1),
            "total_revenue": round(total_revenue, 2),
            "total_collected": round(total_collected, 2),
            "collection_rate": round(collection_rate, 1),
            "apartments_count": apartments_count,
            "fully_paid": fully_paid,
            "net_cash_flow": round(net_cash_flow, 2),
            "budget_health": budget_health,
            "categories_ok": categories_ok,
            "categories_warning": categories_warning,
            "categories_over": categories_over,
            "worst_category": worst_category,
            "cash_flow": cash_flow,
        })

        total_budget_all += total_budget
        total_spent_all += actual_spent
        total_collected_all += total_collected
        total_revenue_all += total_revenue

    overall_collection = (total_collected_all / total_revenue_all * 100) if total_revenue_all > 0 else 0
    overall_budget_progress = (total_spent_all / total_budget_all * 100) if total_budget_all > 0 else 0

    # Feature 4: Buffer alerts
    buffer_alerts = []
    for proj_summary in project_summaries:
        setting = db.query(models.ProjectSetting).filter(
            models.ProjectSetting.project_id == proj_summary["id"]
        ).first()
        buffer_amount = float(setting.cash_buffer_amount) if setting else 200000

        proj_buffer_alerts = []
        for row in (proj_summary.get("cash_flow") or []):
            cum_balance = row.get("cumulative_balance", 0)
            if cum_balance < buffer_amount:
                shortfall = buffer_amount - cum_balance
                proj_buffer_alerts.append({
                    "month": row["date"],
                    "balance": round(cum_balance, 2),
                    "buffer": round(buffer_amount, 2),
                    "shortfall": round(shortfall, 2),
                })

        proj_summary["buffer_alerts"] = proj_buffer_alerts
        for alert in proj_buffer_alerts:
            buffer_alerts.append({
                "project_id": proj_summary["id"],
                "project_name": proj_summary["name"],
                **alert,
            })

    return {
        "projects": project_summaries,
        "totals": {
            "project_count": len(project_summaries),
            "total_budget": round(total_budget_all, 2),
            "total_spent": round(total_spent_all, 2),
            "budget_progress": round(overall_budget_progress, 1),
            "total_revenue": round(total_revenue_all, 2),
            "total_collected": round(total_collected_all, 2),
            "collection_rate": round(overall_collection, 1),
        },
        "buffer_alerts": buffer_alerts,
    }

# --- Project KPI Summary ---

@app.get("/projects/{project_id}/kpi-summary")
def get_project_kpi_summary(project_id: int, db: Session = Depends(get_db)):
    """Per-project KPI summary: collection, budget health, next month projection."""
    # Collection data from apartments
    apartments = db.query(models.Apartment).filter(
        models.Apartment.project_id == project_id
    ).all()

    total_revenue = 0
    total_collected = 0
    fully_paid = 0
    outstanding = 0

    for apt in apartments:
        sale_price = float(apt.sale_price) if apt.sale_price else 0
        paid = db.query(func.sum(models.CustomerPayment.amount)).filter(
            models.CustomerPayment.apartment_id == apt.id
        ).scalar() or 0
        paid = float(paid)
        total_revenue += sale_price
        total_collected += paid
        if sale_price > 0 and paid >= sale_price:
            fully_paid += 1
        elif sale_price > 0:
            outstanding += 1

    collection_percent = (total_collected / total_revenue * 100) if total_revenue > 0 else 0

    # Budget health
    budget_items = db.query(models.BudgetCategory).filter(
        models.BudgetCategory.project_id == project_id
    ).all()

    categories_ok = 0
    categories_warning = 0
    categories_over = 0
    worst_category = None
    worst_overrun = 0
    total_budget = 0
    total_actual_spent = 0

    for cat in budget_items:
        planned = float(cat.planned_amount) if cat.planned_amount else 0
        total_budget += planned
        if planned <= 0:
            continue
        cat_actual = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.budget_item_id == cat.id,
            models.Transaction.transaction_type == 1
        ).scalar() or 0
        cat_actual = float(cat_actual)
        total_actual_spent += cat_actual
        cat_progress = (cat_actual / planned * 100) if planned > 0 else 0

        if cat_progress > 100:
            categories_over += 1
            overrun = cat_actual - planned
            if overrun > worst_overrun:
                worst_overrun = overrun
                worst_category = {"name": cat.category_name, "progress": round(cat_progress, 1), "overrun": round(overrun, 2)}
        elif cat_progress > 90:
            categories_warning += 1
        else:
            categories_ok += 1

    total_cats = categories_ok + categories_warning + categories_over
    budget_health = round(max(0, 100 - (categories_over * 20) - (categories_warning * 5)), 0) if total_cats > 0 else 100

    # Next month projection from cash flow
    from datetime import datetime
    now = datetime.now()
    next_month = now.month + 1
    next_year = now.year
    if next_month > 12:
        next_month = 1
        next_year += 1
    next_month_key = f"{next_year}-{next_month:02d}"

    try:
        cash_flow = services.forecast_service.generate_cash_flow_forecast(db, project_id)
        next_month_data = next((row for row in cash_flow if row["date"] == next_month_key), None)
    except Exception:
        next_month_data = None

    next_month_income = 0
    next_month_expense = 0
    if next_month_data:
        next_month_income = next_month_data.get("actual_income", 0) + next_month_data.get("planned_income", 0)
        next_month_expense = next_month_data.get("actual_expense", 0) + next_month_data.get("planned_expense", 0)

    return {
        "collection": {
            "total_revenue": round(total_revenue, 2),
            "total_collected": round(total_collected, 2),
            "collection_percent": round(collection_percent, 1),
            "fully_paid": fully_paid,
            "outstanding": outstanding,
            "total_apartments": len(apartments),
        },
        "budget_health": {
            "score": budget_health,
            "categories_ok": categories_ok,
            "categories_warning": categories_warning,
            "categories_over": categories_over,
            "worst_category": worst_category,
            "total_budget": round(total_budget, 2),
            "total_spent": round(total_actual_spent, 2),
        },
        "next_month": {
            "month": next_month_key,
            "projected_income": round(next_month_income, 2),
            "projected_expense": round(next_month_expense, 2),
            "gap": round(next_month_income - next_month_expense, 2),
        }
    }

# --- Budget Timeline ---

@app.get("/reports/budget-timeline/{project_id}")
def get_budget_timeline(project_id: int, db: Session = Depends(get_db)):
    """Budget timeline: monthly planned vs actual spending per category."""
    from collections import defaultdict

    categories = db.query(models.BudgetCategory).filter(
        models.BudgetCategory.project_id == project_id
    ).all()

    if not categories:
        return []

    result = []

    for cat in categories:
        planned = float(cat.planned_amount) if cat.planned_amount else 0

        # Get budget plans (planned spending schedule)
        plans = db.query(models.BudgetPlan).filter(
            models.BudgetPlan.budget_category_id == cat.id
        ).order_by(models.BudgetPlan.planned_date).all()

        planned_by_month = defaultdict(float)
        for bp in plans:
            if bp.planned_date:
                month_key = bp.planned_date.strftime("%Y-%m")
                planned_by_month[month_key] += float(bp.amount) if bp.amount else 0

        # Get actual transactions for this category
        txns = db.query(models.Transaction).filter(
            models.Transaction.budget_item_id == cat.id,
            models.Transaction.transaction_type == 1
        ).all()

        actual_by_month = defaultdict(float)
        total_actual = 0
        for tx in txns:
            if tx.date:
                month_key = tx.date.strftime("%Y-%m")
                amt = float(tx.amount) if tx.amount else 0
                actual_by_month[month_key] += amt
                total_actual += amt

        # Fallback: match by category name if no budget_item_id matches
        if total_actual == 0 and cat.category_name:
            fallback_txns = db.query(models.Transaction).filter(
                models.Transaction.project_id == project_id,
                models.Transaction.transaction_type == 1,
                func.lower(models.Transaction.category) == cat.category_name.strip().lower()
            ).all()
            for tx in fallback_txns:
                if tx.date:
                    month_key = tx.date.strftime("%Y-%m")
                    amt = float(tx.amount) if tx.amount else 0
                    actual_by_month[month_key] += amt
                    total_actual += amt

        # Collect all months
        all_months = sorted(set(list(planned_by_month.keys()) + list(actual_by_month.keys())))

        monthly = []
        cumulative_planned = 0
        cumulative_actual = 0
        for month in all_months:
            p = planned_by_month.get(month, 0)
            a = actual_by_month.get(month, 0)
            cumulative_planned += p
            cumulative_actual += a
            monthly.append({
                "month": month,
                "planned": round(p, 2),
                "actual": round(a, 2),
                "cumulative_planned": round(cumulative_planned, 2),
                "cumulative_actual": round(cumulative_actual, 2),
            })

        progress = (total_actual / planned * 100) if planned > 0 else 0

        result.append({
            "id": cat.id,
            "name": cat.category_name,
            "budget": round(planned, 2),
            "total_actual": round(total_actual, 2),
            "progress": round(progress, 1),
            "variance": round(planned - total_actual, 2),
            "monthly": monthly,
            "start_month": all_months[0] if all_months else None,
            "end_month": all_months[-1] if all_months else None,
        })

    return result

# --- CSV Import ---

@app.post("/import/apartments")
async def import_apartments(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from services.apartment_import_service import import_apartments_from_csv
    try:
        content = await file.read()
        result = import_apartments_from_csv(db, content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Feature 4: Project Settings (Cash Buffer) ---

@app.get("/projects/{project_id}/settings")
def get_project_settings(project_id: int, db: Session = Depends(get_db)):
    setting = db.query(models.ProjectSetting).filter(
        models.ProjectSetting.project_id == project_id
    ).first()
    if not setting:
        return {"project_id": project_id, "cash_buffer_amount": 200000}
    return {
        "id": setting.id,
        "project_id": setting.project_id,
        "cash_buffer_amount": float(setting.cash_buffer_amount) if setting.cash_buffer_amount else 200000,
    }

@app.put("/projects/{project_id}/settings")
def update_project_settings(project_id: int, settings: schemas.ProjectSettingCreate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    existing = db.query(models.ProjectSetting).filter(
        models.ProjectSetting.project_id == project_id
    ).first()
    if existing:
        existing.cash_buffer_amount = settings.cash_buffer_amount
    else:
        existing = models.ProjectSetting(
            project_id=project_id,
            cash_buffer_amount=settings.cash_buffer_amount
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {
        "id": existing.id,
        "project_id": existing.project_id,
        "cash_buffer_amount": float(existing.cash_buffer_amount) if existing.cash_buffer_amount else 200000,
    }

# --- Feature 3: Suggested Category ---

def _upsert_account_category_mapping(db: Session, tx):
    """Upsert AccountCategoryMapping when transaction has both to_account_id and budget_item_id."""
    if tx.to_account_id and tx.budget_item_id:
        existing = db.query(models.AccountCategoryMapping).filter(
            models.AccountCategoryMapping.account_id == tx.to_account_id,
            models.AccountCategoryMapping.budget_category_id == tx.budget_item_id,
        ).first()
        if existing:
            existing.last_used = datetime.now()
        else:
            mapping = models.AccountCategoryMapping(
                account_id=tx.to_account_id,
                budget_category_id=tx.budget_item_id,
                last_used=datetime.now(),
            )
            db.add(mapping)
        db.commit()

@app.get("/accounts/{account_id}/suggested-category")
def get_suggested_category(account_id: int, db: Session = Depends(get_db)):
    mapping = db.query(models.AccountCategoryMapping).filter(
        models.AccountCategoryMapping.account_id == account_id
    ).order_by(models.AccountCategoryMapping.last_used.desc()).first()
    if not mapping:
        return {"budget_category_id": None}
    return {"budget_category_id": mapping.budget_category_id}

# --- Feature 1: Apartment Search ---

@app.get("/apartments/search")
def search_apartments(
    q: str = Query("", min_length=0),
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if len(q) < 2:
        return []
    query = db.query(models.Apartment).filter(
        models.Apartment.customer_name.ilike(f"%{q}%")
    )
    if project_id:
        query = query.filter(models.Apartment.project_id == project_id)
    results = query.limit(10).all()
    return [
        {
            "id": apt.id,
            "name": apt.name,
            "customer_name": apt.customer_name,
            "project_id": apt.project_id,
        }
        for apt in results
    ]

# --- Feature 5: Direct to Owner Payment ---

@app.post("/apartments/{apartment_id}/payments/direct-to-owner")
def create_direct_to_owner_payment(
    apartment_id: int,
    payment: schemas.CustomerPaymentCreate,
    db: Session = Depends(get_db),
):
    apartment = db.query(models.Apartment).filter(models.Apartment.id == apartment_id).first()
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")

    # Find Direct Account and Owner Account
    direct_account = db.query(models.Account).filter(
        models.Account.name.ilike("%direct%"),
        models.Account.is_system_account == 1,
    ).first()
    owner_account = db.query(models.Account).filter(
        models.Account.name.ilike("%owner%"),
    ).first()

    if not direct_account:
        # Check if a "Direct" account exists but isn't marked as system
        maybe_direct = db.query(models.Account).filter(
            models.Account.name.ilike("%direct%")
        ).first()
        if maybe_direct:
            raise HTTPException(
                status_code=400,
                detail=f"Found account '{maybe_direct.name}' (id={maybe_direct.id}) but is_system_account is not set. Please set is_system_account=1 on this account."
            )
        raise HTTPException(status_code=400, detail="No account with 'Direct' in the name exists. Please create a system account with 'Direct' in the name.")
    if not owner_account:
        raise HTTPException(status_code=400, detail="No account with 'Owner' in the name exists. Please create an account with 'Owner' in the name.")

    customer_name = apartment.customer_name or "Unknown"

    try:
        # Create CustomerPayment record
        db_payment = models.CustomerPayment(
            apartment_id=apartment_id,
            date=payment.date,
            amount=payment.amount,
            payment_method="Direct to Owner",
            notes=payment.notes,
        )
        db.add(db_payment)
        db.flush()

        # TX1: Income to Direct Account
        tx1 = models.Transaction(
            project_id=apartment.project_id,
            date=payment.date,
            amount=payment.amount,
            to_account_id=direct_account.id,
            remarks=f"Direct to Owner - {customer_name} - IN",
            transaction_type=1,
            type="income",
            apartment_id=apartment_id,
        )
        db.add(tx1)
        db.flush()

        # TX2: Expense from Direct Account to Owner Account
        tx2 = models.Transaction(
            project_id=apartment.project_id,
            date=payment.date,
            amount=payment.amount,
            from_account_id=direct_account.id,
            to_account_id=owner_account.id,
            remarks=f"Direct to Owner - {customer_name} - OUT",
            transaction_type=1,
            type="expense",
            apartment_id=apartment_id,
        )
        db.add(tx2)
        db.flush()

        # Store linked transaction IDs
        db_payment.linked_transaction_ids = json.dumps([tx1.id, tx2.id])

        db.commit()
        db.refresh(db_payment)
        db.refresh(tx1)
        db.refresh(tx2)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create Direct to Owner payment: {str(e)}")

    return {
        "payment": {
            "id": db_payment.id,
            "apartment_id": db_payment.apartment_id,
            "date": db_payment.date.isoformat() if db_payment.date else None,
            "amount": float(db_payment.amount),
            "payment_method": db_payment.payment_method,
            "notes": db_payment.notes,
            "linked_transaction_ids": db_payment.linked_transaction_ids,
        },
        "transactions_created": 2,
    }


# --- Diagnostics ---

@app.get("/diagnostics/system-accounts")
def diagnostics_system_accounts(db: Session = Depends(get_db)):
    """Returns all accounts with system account flags, highlights Direct and Owner candidates."""
    all_accounts = db.query(models.Account).all()
    accounts_list = []
    direct_candidate = None
    owner_candidate = None

    for acc in all_accounts:
        entry = {
            "id": acc.id,
            "name": acc.name,
            "is_system_account": bool(acc.is_system_account),
        }
        if "direct" in (acc.name or "").lower():
            entry["role"] = "Direct Account candidate"
            if acc.is_system_account:
                direct_candidate = acc
        if "owner" in (acc.name or "").lower():
            entry["role"] = "Owner Account candidate"
            owner_candidate = acc
        accounts_list.append(entry)

    issues = []
    if not direct_candidate:
        # Check if there's a non-system Direct account
        maybe = next((a for a in all_accounts if "direct" in (a.name or "").lower()), None)
        if maybe:
            issues.append(f"Account '{maybe.name}' (id={maybe.id}) found but is_system_account is not set")
        else:
            issues.append("No account with 'Direct' in the name exists")
    if not owner_candidate:
        issues.append("No account with 'Owner' in the name exists")

    return {
        "accounts": accounts_list,
        "status": "ok" if not issues else "misconfigured",
        "issues": issues,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)