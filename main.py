from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import models, schemas
import services.budget_report_service
import services.forecast_service
from database import SessionLocal, engine

# יצירת הטבלאות (רק אם לא קיימות, לא דורס)
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# הגדרת CORS (כדי שהאתר יוכל לדבר עם השרת)
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

@app.get("/transactions/", response_model=List[schemas.Transaction])
def read_transactions(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()
    return transactions

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

@app.get("/projects/{project_id}/apartments", response_model=List[schemas.Apartment])
def read_apartments(project_id: int, db: Session = Depends(get_db)):
    apartments = db.query(models.Apartment).filter(models.Apartment.project_id == project_id).all()
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
    return result

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)