from datetime import datetime, timedelta
from decimal import Decimal
from database import SessionLocal, engine
import models
import services.forecast_service

# Setup
db = SessionLocal()
models.Base.metadata.create_all(bind=engine)

def cleanup(db):
    try:
        db.query(models.Transaction).delete()
        db.query(models.CustomerPaymentPlan).delete()
        db.query(models.Project).delete()
        db.query(models.ProjectPaymentPhase).delete()
        db.query(models.Account).delete()
        db.query(models.AccountType).delete()
        db.commit()
    except Exception as e:
        print(f"Cleanup warning: {e}")
        db.rollback()

def setup_test_data(db):
    # 1. Create Project
    p = models.Project(name="Test Project", status="Active")
    db.add(p)
    db.commit()
    db.refresh(p)
    print(f"Created Project ID: {p.id}")
    
    # 2. Create Account Types & Accounts
    at_proj = models.AccountType(name="Project Account")
    at_supp = models.AccountType(name="Supplier")
    db.add_all([at_proj, at_supp])
    db.commit()
    
    acc_proj = models.Account(name="My Project Bank", account_type=at_proj)
    acc_supp = models.Account(name="Big Supplier", account_type=at_supp)
    db.add_all([acc_proj, acc_supp])
    db.commit()
    
    # 3. Create Transactions (Actuals)
    # Income: Customer pays to Project
    # We simulate this by just having an incoming transaction (to Project Account)
    # (Assuming we handle Income detection via to_account type)
    t1 = models.Transaction(
        project_id=p.id,
        date=datetime.now() - timedelta(days=60), # 2 months ago
        amount=Decimal(1000),
        to_account_id=acc_proj.id, # Income
        remarks="Initial Deposit"
    )
    
    # Expense: Project pays Supplier
    t2 = models.Transaction(
        project_id=p.id,
        date=datetime.now() - timedelta(days=30), # 1 month ago
        amount=Decimal(500),
        from_account_id=acc_proj.id,
        to_account_id=acc_supp.id, # Expense
        remarks="Material Cost"
    )
    
    db.add_all([t1, t2])
    db.commit()
    
    # 4. Create Payment Plans (Planned)
    # Plan 1: FULFILLED (matched by t1 phase? we need to link them if we want fulfillment logic)
    # For simplicity, let's create a NEW plan that is PAST due and NOT fulfilled -> Should Roll Over
    
    past_date = datetime.now() - timedelta(days=45) # 1.5 months ago
    plan_unpaid_past = models.CustomerPaymentPlan(
        project_id=p.id,
        manual_date=past_date,
        value=Decimal(2000),
        remarks="Late Payment"
    )
    
    # Plan 2: FUTURE
    future_date = datetime.now() + timedelta(days=30)
    plan_future = models.CustomerPaymentPlan(
        project_id=p.id,
        manual_date=future_date,
        value=Decimal(3000),
        remarks="Future Installment"
    )
    
    db.add_all([plan_unpaid_past, plan_future])
    db.commit()
    
    return p.id

def test_forecast():
    cleanup(db)
    pid = setup_test_data(db)
    
    print("\nAlso testing Forecast Service...")
    report = services.forecast_service.generate_cash_flow_forecast(db, pid)
    
    print("\n--- FORECAST REPORT ---")
    current_month_str = datetime.now().strftime("%Y-%m")
    
    for row in report:
        print(f"Date: {row['date']}, Actual Net: {row['actual_income'] - row['actual_expense']}, Planned Net: {row['planned_income'] - row['planned_expense']}, Net Flow: {row['net_flow']}")
        
        # Validation checks
        if row['date'] == current_month_str:
            print("  -> checking rolling logic: Should include the 2000 past plan here.")
            if row['planned_income'] >= 2000:
                 print("  [PASS] Rolling logic seems to work (found planned income in current month).")
            else:
                 print("  [FAIL] Rolling logic failed.")

if __name__ == "__main__":
    try:
        test_forecast()
    finally:
        # cleanup(db) # keep for inspection if needed
        db.close()
