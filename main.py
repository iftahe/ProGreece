from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta

from database import SessionLocal, engine
import models
import schemas

# Create tables if they don't exist (useful for dev)
models.Base.metadata.create_all(bind=engine)

import os

app = FastAPI(title="Greece Project API")

# Define allowed origins
# In production, set ALLOWED_ORIGINS to a comma-separated list of URLs (e.g., "https://my-app.onrender.com")
# Default to ["*"] for development or if not set
origins_env = os.getenv("ALLOWED_ORIGINS")
if origins_env:
    origins = origins_env.split(",")
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

# --------------------------
# Helper Functions
# --------------------------
def create_default_budget_categories(db: Session, project_id: int):
    """
    Creates default budget categories for a new project.
    Sets up the standard hierarchy:
    - Phase: Buying -> Children: [License, Realtor, Law, Buy Tax, Notary]
    - Phase: Construction -> Children: [Construction, Materials, Architect]
    """
    today = datetime.now().date()
    
    # Phase: Buying
    buying_phase = models.BudgetCategory(
        name="Buying",
        project_id=project_id,
        parent_id=None,  # Top-level phase
        amount=Decimal(0),
        date=today
    )
    db.add(buying_phase)
    db.flush()  # Get the ID
    
    # Buying phase children
    buying_children = [
        models.BudgetCategory(name="License", project_id=project_id, parent_id=buying_phase.id, amount=Decimal(0), date=today + timedelta(days=60)),
        models.BudgetCategory(name="Realtor", project_id=project_id, parent_id=buying_phase.id, amount=Decimal(0), date=today + timedelta(days=45)),
        models.BudgetCategory(name="Law", project_id=project_id, parent_id=buying_phase.id, amount=Decimal(0), date=today + timedelta(days=15)),
        models.BudgetCategory(name="Buy Tax", project_id=project_id, parent_id=buying_phase.id, amount=Decimal(0), date=today + timedelta(days=20)),
        models.BudgetCategory(name="Notary", project_id=project_id, parent_id=buying_phase.id, amount=Decimal(0), date=today + timedelta(days=25)),
    ]
    db.add_all(buying_children)
    
    # Phase: Construction
    construction_phase = models.BudgetCategory(
        name="Construction",
        project_id=project_id,
        parent_id=None,  # Top-level phase
        amount=Decimal(0),
        date=today + timedelta(days=180)  # 6 months from today
    )
    db.add(construction_phase)
    db.flush()  # Get the ID
    
    # Construction phase children
    construction_children = [
        models.BudgetCategory(name="Construction", project_id=project_id, parent_id=construction_phase.id, amount=Decimal(0), date=today + timedelta(days=210)),
        models.BudgetCategory(name="Materials", project_id=project_id, parent_id=construction_phase.id, amount=Decimal(0), date=today + timedelta(days=200)),
        models.BudgetCategory(name="Architect", project_id=project_id, parent_id=construction_phase.id, amount=Decimal(0), date=today + timedelta(days=190)),
    ]
    db.add_all(construction_children)
    
    db.commit()
    return len(buying_children) + len(construction_children) + 2  # Return total count

# --------------------------
# Projects CRUD
# --------------------------
@app.post("/projects/", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    # Create default budget categories for the new project
    try:
        create_default_budget_categories(db, db_project.id)
    except Exception as e:
        # Log the error but don't fail the project creation
        print(f"Warning: Failed to create default budget categories for project {db_project.id}: {e}")
        # Optionally, you could rollback or raise the exception here
    
    return db_project

@app.get("/projects/", response_model=List[schemas.Project])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(models.Project).offset(skip).limit(limit).all()
    return projects

@app.get("/projects/{project_id}", response_model=schemas.Project)
def read_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.put("/projects/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project, key, value)
    
    db.commit()
    db.refresh(db_project)
    return db_project

@app.get("/projects/{project_id}/budget-items", response_model=List[schemas.BudgetCategory])
def read_project_budget_items(project_id: int, db: Session = Depends(get_db)):
    try:
        items = db.query(models.BudgetCategory).filter(models.BudgetCategory.project_id == project_id).all()
        return items
    except Exception as e:
        import traceback
        print(f"Error in read_project_budget_items: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/budget-categories/{item_id}", response_model=schemas.BudgetCategory)
def update_budget_category(item_id: int, update_data: schemas.BudgetCategoryUpdate, db: Session = Depends(get_db)):
    """
    Updates a budget category's amount.
    """
    db_item = db.query(models.BudgetCategory).filter(models.BudgetCategory.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Budget category not found")
    
    # Update only the amount field
    if update_data.amount is not None:
        db_item.amount = update_data.amount
    
    db.commit()
    db.refresh(db_item)
    return db_item

# --------------------------
# Accounts CRUD
# --------------------------
@app.post("/accounts/", response_model=schemas.Account)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db)):
    db_account = models.Account(**account.model_dump())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@app.get("/accounts/", response_model=List[schemas.Account])
def read_accounts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    accounts = db.query(models.Account).offset(skip).limit(limit).all()
    return accounts

@app.get("/accounts/{account_id}", response_model=schemas.Account)
def read_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

# --------------------------
# Transactions CRUD & Logic
# --------------------------
def apply_vat_logic(db: Session, transaction_data: schemas.TransactionCreate) -> Decimal:
    """
    Applies the legacy VAT logic:
    If 'from' or 'to' account is a System Account (or specific type), VAT Rate becomes 0.
    Otherwise, it returns the user provided vat_rate (or 0 if none).
    """
    # Default to input VAT rate or 0
    vat_rate = transaction_data.vat_rate if transaction_data.vat_rate is not None else Decimal(0)

    # Fetch involved accounts
    from_acc = None
    to_acc = None

    if transaction_data.from_account_id:
        from_acc = db.query(models.Account).filter(models.Account.id == transaction_data.from_account_id).first()
    
    if transaction_data.to_account_id:
        to_acc = db.query(models.Account).filter(models.Account.id == transaction_data.to_account_id).first()

    # Logic: Validate against "System" or specific criteria
    # Based on legacy view: CASE WHEN [from] = 47 OR [to] = 47 ... (System Accounts)
    # 47/45 were specific IDs. We generalize this to 'is_system_account' flag or similar.

    is_system_involved = False

    if from_acc and from_acc.is_system_account == 1:
        is_system_involved = True
    elif to_acc and to_acc.is_system_account == 1:
        is_system_involved = True
    
    # We can also check account_type_id if 'is_system_account' isn't sufficient or populated
    # For example, if AccountType is 'Internal' or 'Middle'
    # if from_acc and from_acc.account_type_id == SOME_ID: ...

    if is_system_involved:
        return Decimal(0)
    
    return vat_rate

@app.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    # 1. Apply VAT Logic
    final_vat_rate = apply_vat_logic(db, transaction)
    
    print(f"DEBUG: VAT Logic applied. Input: {transaction.vat_rate}, Output: {final_vat_rate}")

    # 2. Create Transaction Model
    # We override the schema's vat_rate with our calculated one
    transaction_data = transaction.model_dump()
    transaction_data['vat_rate'] = final_vat_rate

    db_transaction = models.Transaction(**transaction_data)
    
    # 3. Save
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/transactions/", response_model=List[schemas.Transaction])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).offset(skip).limit(limit).all()
    return transactions

@app.get("/transactions/{transaction_id}", response_model=schemas.Transaction)
def read_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: int, transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # 1. Update fields from schema
    update_data = transaction.model_dump(exclude_unset=True)
    
    # 2. Re-apply VAT Logic (optional/recommended if amounts/accounts changed)
    # We pass the schema object 'transaction' to our logic helper
    final_vat_rate = apply_vat_logic(db, transaction)
    update_data['vat_rate'] = final_vat_rate

    for key, value in update_data.items():
        setattr(db_transaction, key, value)

    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(db_transaction)
    db.commit()
    return {"ok": True}

# --------------------------
# Reports
# --------------------------
import services.forecast_service
import services.budget_report_service

@app.get("/reports/cash-flow/{project_id}")
def get_cash_flow_forecast(project_id: int, db: Session = Depends(get_db)):
    """
    Generates the Cash Flow Forecast for a specific project.
    """
    return services.forecast_service.generate_cash_flow_forecast(db, project_id)

@app.get("/reports/budget/{project_id}")
def get_budget_report(project_id: int, db: Session = Depends(get_db)):
    """
    Generates the Budget Report for a specific project.
    Shows planned vs actual amounts, variances, and progress for each budget category.
    """
    return services.budget_report_service.generate_budget_report(db, project_id)
