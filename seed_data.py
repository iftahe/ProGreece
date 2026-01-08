from database import SessionLocal, engine
import models
from datetime import datetime, timedelta
from decimal import Decimal

# Create tables if not exist
models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # 1. Check if data exists
    if db.query(models.Project).first():
        print("Database already contains data. Skipping seed.")
        return

    print("Seeding data...")

    # 2. Create Account Types
    type_customer = models.AccountType(name="Customer") # ID 1
    type_supplier = models.AccountType(name="Supplier") # ID 2
    type_system = models.AccountType(name="System/Middle") # ID 3
    db.add_all([type_customer, type_supplier, type_system])
    db.commit()

    # 3. Create Accounts
    # System Accounts
    acc_bank_il = models.Account(name="Bank Leumi IL", account_type=type_system)
    acc_vat = models.Account(name="VAT Authority", account_type=type_system)
    
    # Customers
    acc_investor_1 = models.Account(name="Yossi Cohen (Investor)", account_type=type_customer)
    
    # Suppliers
    acc_contractor = models.Account(name="BuildIt Ltd", account_type=type_supplier)
    
    db.add_all([acc_bank_il, acc_vat, acc_investor_1, acc_contractor])
    db.commit()

    # 4. Create Project
    proj_alpha = models.Project(
        name="Athens Luxury 1", 
        status="Active", 
        project_account_val=0,
        property_cost=500000
    )
    db.add(proj_alpha)
    db.commit()

    # 5. Create Transactions (HISTORY)
    # Income: Investor pays 100,000
    t1 = models.Transaction(
        date=datetime.now() - timedelta(days=60),
        project_id=proj_alpha.id,
        from_account_id=acc_investor_1.id,
        to_account_id=acc_bank_il.id, # Income
        amount=Decimal(100000),
        remarks="First Installment",
        transaction_type=1
    )
    
    # Expense: Paying Contractor 20,000
    t2 = models.Transaction(
        date=datetime.now() - timedelta(days=30),
        project_id=proj_alpha.id,
        from_account_id=acc_bank_il.id,
        to_account_id=acc_contractor.id, # Expense
        amount=Decimal(20000),
        remarks="Foundation works",
        transaction_type=2
    )

    db.add_all([t1, t2])
    db.commit()

    # 6. Create Future Plan (FORECAST)
    # Investor supposed to pay 50,000 yesterday (Late!) -> Should Roll Over
    plan1 = models.CustomerPaymentPlan(
        project_id=proj_alpha.id,
        price_id=None, # Simplifying for seed
        manual_date=datetime.now() - timedelta(days=1),
        value=Decimal(50000),
        remarks="Second Installment (Late)"
    )
    
    # Investor pays next month 50,000
    plan2 = models.CustomerPaymentPlan(
        project_id=proj_alpha.id,
        price_id=None,
        manual_date=datetime.now() + timedelta(days=30),
        value=Decimal(50000),
        remarks="Third Installment"
    )

    db.add_all([plan1, plan2])
    db.commit()
    
    print("Seeding Complete! Restart the Backend.")
    db.close()

if __name__ == "__main__":
    seed()